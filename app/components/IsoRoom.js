import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API, getToken } from '../lib/client';

const TILE_W = 64, TILE_H = 32, GRID = 11;
const AVATAR = (look) =>
  `https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(look)}&size=l&direction=2&head_direction=3&gesture=std`;

function toScreen(gx, gy, ox, oy) {
  return { sx: ox + (gx - gy) * (TILE_W / 2), sy: oy + (gx + gy) * (TILE_H / 2) };
}
function toTile(mx, my, ox, oy) {
  const dx = mx - ox, dy = my - oy;
  const gx = Math.round((dx / (TILE_W / 2) + dy / (TILE_H / 2)) / 2);
  const gy = Math.round((dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2);
  return { gx, gy };
}

// cache global de imagens
const imgCache = {};
function getImg(url) {
  if (!url) return null;
  if (imgCache[url]) return imgCache[url];
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.src = url;
  imgCache[url] = im;
  return im;
}

export default function IsoRoom({ roomLogin, placingItem, onPlaced, me, myLook }) {
  const canvasRef = useRef(null);
  const sockRef = useRef(null);
  const [items, setItems] = useState([]);
  const [players, setPlayers] = useState({});
  const [chat, setChat] = useState([]);

  useEffect(() => {
    fetch(`${API}/room/${roomLogin}`).then(r => r.json())
      .then(d => setItems(d.items || []));
  }, [roomLogin]);

  useEffect(() => {
    let sock;
    (async () => {
      const token = await getToken();
      sock = io(API, { auth: { token }, transports: ['websocket', 'polling'] });
      sockRef.current = sock;
      sock.on('connect', () => sock.emit('room:join', roomLogin));
      sock.on('room:players', (list) => {
        const m = {}; list.forEach(p => { m[p.login] = p; }); setPlayers(m);
      });
      sock.on('player:enter', (p) => setPlayers(s => ({ ...s, [p.login]: p })));
      sock.on('player:move', (p) => setPlayers(s => ({ ...s, [p.login]: { ...s[p.login], ...p } })));
      sock.on('player:leave', (p) => setPlayers(s => { const c = { ...s }; delete c[p.login]; return c; }));
      sock.on('room:placed', (it) => setItems(s => [...s, it]));
      sock.on('room:removed', ({ id }) => setItems(s => s.filter(i => i.id !== id)));
      sock.on('chat:msg', (m) => setChat(s => [...s.slice(-40), m]));
    })();
    return () => sock && sock.disconnect();
  }, [roomLogin]);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const ox = cv.width / 2, oy = 70;
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      // piso isometrico
      for (let gx = 0; gx < GRID; gx++) for (let gy = 0; gy < GRID; gy++) {
        const { sx, sy } = toScreen(gx, gy, ox, oy);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
        ctx.lineTo(sx, sy + TILE_H);
        ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2);
        ctx.closePath();
        ctx.fillStyle = (gx + gy) % 2 ? '#27506f' : '#21465f';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.stroke();
      }
      // borda do piso (parede sutil)
      const c0 = toScreen(0, 0, ox, oy);
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c0.sx, c0.sy);
      const cN = toScreen(GRID, 0, ox, oy), cE = toScreen(0, GRID, ox, oy);
      ctx.lineTo(cN.sx, cN.sy); ctx.moveTo(c0.sx, c0.sy); ctx.lineTo(cE.sx, cE.sy);
      ctx.stroke(); ctx.lineWidth = 1;

      // entidades (mobis + players) ordenadas por profundidade
      const ents = [];
      for (const it of items) ents.push({ kind: 'furni', x: it.x, y: it.y, it });
      Object.values(players).forEach(p => ents.push({ kind: 'player', x: p.x ?? 5, y: p.y ?? 5, p }));
      ents.sort((a, b) => (a.x + a.y) - (b.x + b.y));

      for (const e of ents) {
        const { sx, sy } = toScreen(e.x, e.y, ox, oy);
        if (e.kind === 'furni') {
          const url = e.it.furniture?.sprite;
          const im = getImg(url);
          if (im && im.complete && im.naturalWidth) {
            const s = 44;
            ctx.drawImage(im, sx - s / 2, sy + TILE_H / 2 - s, s, s);
          } else {
            ctx.fillStyle = '#3a8fd4'; ctx.fillRect(sx - 14, sy - 6, 28, 24);
          }
        } else {
          const im = getImg(AVATAR(e.p.look || myLook));
          if (im && im.complete && im.naturalWidth) {
            const w = 50, h = 80;
            ctx.drawImage(im, sx - w / 2, sy + TILE_H / 2 - h, w, h);
          } else {
            ctx.fillStyle = e.p.login === me ? '#ffcc2f' : '#6abe30';
            ctx.beginPath(); ctx.arc(sx, sy + 6, 9, 0, Math.PI * 2); ctx.fill();
          }
          // nameplate
          ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
          const tw = ctx.measureText(e.p.login).width;
          ctx.fillStyle = 'rgba(0,0,0,.6)';
          ctx.fillRect(sx - tw / 2 - 5, sy - 78, tw + 10, 16);
          ctx.fillStyle = '#fff'; ctx.fillText(e.p.login, sx, sy - 66);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [items, players, me, myLook]);

  function onClick(e) {
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    const ox = cv.width / 2, oy = 70;
    const mx = (e.clientX - rect.left) * (cv.width / rect.width);
    const my = (e.clientY - rect.top) * (cv.height / rect.height);
    const { gx, gy } = toTile(mx, my, ox, oy);
    if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return;

    if (placingItem) {
      sockRef.current?.emit('room:place', { furniture_id: placingItem, x: gx, y: gy });
      onPlaced && onPlaced();
    } else {
      setPlayers(s => ({ ...s, [me]: { ...(s[me] || {}), login: me, look: myLook, x: gx, y: gy } }));
      sockRef.current?.emit('player:move', { x: gx, y: gy });
    }
  }

  return (
    <div>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid var(--hb-border)' }}>
        <canvas ref={canvasRef} width={760} height={520}
          onClick={onClick}
          style={{
            width: '100%', display: 'block',
            background: 'linear-gradient(180deg,#16364f,#0e2638)',
            cursor: placingItem ? 'copy' : 'pointer',
          }}
        />
        {placingItem && (
          <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,204,47,.95)',
            color: '#3a2a00', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            🪑 Clique no quarto pra posicionar
          </div>
        )}
      </div>
      <ChatPanel messages={chat} onSend={(t) => sockRef.current?.emit('chat:msg', { text: t })} />
    </div>
  );
}

function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [messages]);
  return (
    <div className="hb-card" style={{ marginTop: 10 }}>
      <div style={{ maxHeight: 110, overflowY: 'auto', padding: 10, fontSize: 13 }}>
        {messages.length === 0 && <div style={{ color: 'var(--hb-muted)' }}>💬 Diga oi pros devs do quarto…</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 2 }}>
            <b style={{ color: 'var(--hb-blue)' }}>{m.login}:</b> {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form style={{ display: 'flex', gap: 6, padding: 8, borderTop: '2px solid var(--hb-border)' }}
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(''); } }}>
        <input className="hb-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem…" />
        <button className="hb-btn hb-btn-blue hb-btn-sm" type="submit">Enviar</button>
      </form>
    </div>
  );
}
