import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API, getToken } from '../lib/client';
import { loadModel, getModel, drawFurni, classFromSprite } from '../lib/furni3d';

const TILE_W = 64, TILE_H = 32, GRID = 11, WALL_H = 110;
const ORIGIN = { x: 400, y: 130 };
const AV_W = 56, AV_H = 104, AV_FOOT = 14; // ancoragem do avatar no tile
const VIEW_W = 820, VIEW_H = 560, CANVAS_W = 800, CANVAS_H = 540;

export const FLOORS = {
  floor_wood: { a: '#c8a473', b: '#bb9560', name: 'Madeira' },
  floor_blue: { a: '#2f6f9e', b: '#2a6390', name: 'Azul' },
  floor_grass: { a: '#5aa641', b: '#4f9638', name: 'Grama' },
  floor_dark: { a: '#27506f', b: '#21465f', name: 'Escuro' },
  floor_pink: { a: '#d98ab0', b: '#cc7da3', name: 'Rosa' },
  floor_sand: { a: '#e0c98a', b: '#d4bc7d', name: 'Areia' },
  floor_red: { a: '#b34a3f', b: '#a23f35', name: 'Vermelho' },
  floor_white: { a: '#e8eef4', b: '#d8e0e8', name: 'Branco' },
};
export const WALLS = {
  wall_blue: { c: '#5b7fa6', d: '#4a6c90', name: 'Azul' },
  wall_gray: { c: '#8a93a0', d: '#767f8c', name: 'Cinza' },
  wall_warm: { c: '#b9a07e', d: '#a48b6a', name: 'Bege' },
  wall_dark: { c: '#34495e', d: '#2a3b4d', name: 'Escuro' },
  wall_green: { c: '#5a8a6a', d: '#4c7659', name: 'Verde' },
  wall_pink: { c: '#c98aa6', d: '#b87a95', name: 'Rosa' },
};

const AV = (look, { dir = 2, action = 'std', dance = 0, gif = false } = {}) => {
  let a = dance > 0 ? 'dance' : action;
  const p = [
    `figure=${encodeURIComponent(look)}`, `size=l`, `direction=${dir}`, `head_direction=${dir}`,
    `action=${a}`, dance > 0 ? `dance=${dance}` : '', `gesture=std`, gif ? `img_format=gif` : '',
  ].filter(Boolean).join('&');
  return `https://www.habbo.com/habbo-imaging/avatarimage?${p}`;
};

function toScreen(gx, gy) { return { sx: (gx - gy) * (TILE_W / 2), sy: (gx + gy) * (TILE_H / 2) }; }
function dirFrom(dx, dy) {
  if (dx > 0 && dy > 0) return 4; if (dx > 0 && dy === 0) return 3;
  if (dx === 0 && dy > 0) return 5; if (dx < 0 && dy < 0) return 0;
  if (dx < 0 && dy === 0) return 7; if (dx === 0 && dy < 0) return 1;
  if (dx > 0 && dy < 0) return 2; if (dx < 0 && dy > 0) return 6; return 4;
}

const imgCache = {};
function getImg(url) {
  if (!url) return null;
  if (imgCache[url]) return imgCache[url];
  const im = new Image(); im.crossOrigin = 'anonymous'; im.src = url; imgCache[url] = im; return im;
}

export default function IsoRoom({ roomLogin, placingItem, onPlaced, onInventoryChange, me, myLook, canEdit }) {
  const canvasRef = useRef(null);
  const sockRef = useRef(null);
  const wrapRef = useRef(null);
  const [items, setItems] = useState([]);
  const [players, setPlayers] = useState({});
  const [chat, setChat] = useState([]);
  const [floor, setFloor] = useState('floor_wood');
  const [wall, setWall] = useState('wall_blue');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editor, setEditor] = useState(false);
  const [myDance, setMyDance] = useState(0);
  const [selected, setSelected] = useState(null); // furni selecionado (id)
  const walkTimer = useRef(null);
  const otherWalkTimers = useRef({});
  const myPos = useRef({ x: 5, y: 5, dir: 4 });

  function fitView() {
    // calcula bounds da sala e ajusta zoom/pan pra caber tudo
    const left = ORIGIN.x + toScreen(0, GRID).sx - TILE_W / 2;
    const right = ORIGIN.x + toScreen(GRID, 0).sx + TILE_W / 2;
    const top = ORIGIN.y - WALL_H - 10;
    const bottom = ORIGIN.y + toScreen(GRID, GRID).sy + TILE_H + 10;
    const z = Math.min(VIEW_W / (right - left), VIEW_H / (bottom - top), 1.4) * 0.98;
    setZoom(z);
    setPan({ x: (VIEW_W - (right + left) * z) / 2, y: (VIEW_H - (bottom + top) * z) / 2 });
  }

  useEffect(() => {
    fetch(`${API}/room/${roomLogin}`).then(r => r.json()).then(d => {
      setItems(d.items || []);
      if (d.owner?.room_floor) setFloor(d.owner.room_floor);
      if (d.owner?.room_wall) setWall(d.owner.room_wall);
    });
    setSelected(null);
    fitView();
  }, [roomLogin]);

  useEffect(() => { items.forEach(it => loadModel(classFromSprite(it.furniture?.sprite))); }, [items]);

  useEffect(() => {
    let sock;
    (async () => {
      const token = await getToken();
      sock = io(API, { auth: { token }, transports: ['websocket', 'polling'] });
      sockRef.current = sock;
      sock.on('connect', () => sock.emit('room:join', roomLogin));
      sock.on('room:players', (list) => { const m = {}; list.forEach(p => { m[p.login] = { ...p, walking: false }; }); setPlayers(m); });
      sock.on('player:enter', (p) => setPlayers(s => ({ ...s, [p.login]: { ...p, walking: false } })));
      sock.on('player:move', (p) => {
        setPlayers(s => ({ ...s, [p.login]: { ...(s[p.login] || {}), x: p.x, y: p.y, dir: p.dir ?? (s[p.login]?.dir), walking: true } }));
        clearTimeout(otherWalkTimers.current[p.login]);
        otherWalkTimers.current[p.login] = setTimeout(() => setPlayers(s => s[p.login] ? ({ ...s, [p.login]: { ...s[p.login], walking: false } }) : s), 430);
      });
      sock.on('player:dance', (p) => setPlayers(s => ({ ...s, [p.login]: { ...(s[p.login] || {}), dance: p.dance } })));
      sock.on('player:leave', (p) => setPlayers(s => { const c = { ...s }; delete c[p.login]; return c; }));
      sock.on('room:placed', (it) => setItems(s => [...s.filter(i => i.id !== it.id), it]));
      sock.on('room:removed', ({ id }) => { setItems(s => s.filter(i => i.id !== id)); setSelected(sel => sel === id ? null : sel); });
      sock.on('room:rotated', ({ id, rotation }) => setItems(s => s.map(i => i.id === id ? { ...i, rotation } : i)));
      sock.on('room:decor', (d) => { if (d.room_floor) setFloor(d.room_floor); if (d.room_wall) setWall(d.room_wall); });
      sock.on('inventory:changed', () => onInventoryChange && onInventoryChange());
      sock.on('chat:msg', (m) => setChat(s => [...s.slice(-40), m]));
    })();
    return () => sock && sock.disconnect();
  }, [roomLogin]);

  // ----- render do piso/paredes/mobis -----
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const F = FLOORS[floor] || FLOORS.floor_wood;
    const W = WALLS[wall] || WALLS.wall_blue;
    const ox = ORIGIN.x, oy = ORIGIN.y;
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const p00 = toScreen(0, 0), pN0 = toScreen(GRID, 0), p0N = toScreen(0, GRID);
      ctx.fillStyle = W.c;
      ctx.beginPath(); ctx.moveTo(ox + p00.sx, oy + p00.sy - WALL_H); ctx.lineTo(ox + pN0.sx, oy + pN0.sy - WALL_H); ctx.lineTo(ox + pN0.sx, oy + pN0.sy); ctx.lineTo(ox + p00.sx, oy + p00.sy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = W.d;
      ctx.beginPath(); ctx.moveTo(ox + p00.sx, oy + p00.sy - WALL_H); ctx.lineTo(ox + p0N.sx, oy + p0N.sy - WALL_H); ctx.lineTo(ox + p0N.sx, oy + p0N.sy); ctx.lineTo(ox + p00.sx, oy + p00.sy); ctx.closePath(); ctx.fill();

      for (let gx = 0; gx < GRID; gx++) for (let gy = 0; gy < GRID; gy++) {
        const { sx, sy } = toScreen(gx, gy); const x = ox + sx, y = oy + sy;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + TILE_W / 2, y + TILE_H / 2); ctx.lineTo(x, y + TILE_H); ctx.lineTo(x - TILE_W / 2, y + TILE_H / 2); ctx.closePath();
        ctx.fillStyle = (gx + gy) % 2 ? F.a : F.b; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.stroke();
      }
      // tile selecionado (highlight)
      if (selected) {
        const it = items.find(i => i.id === selected);
        if (it) { const { sx, sy } = toScreen(it.x, it.y); const x = ox + sx, y = oy + sy;
          ctx.strokeStyle = '#ffcc2f'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + TILE_W / 2, y + TILE_H / 2); ctx.lineTo(x, y + TILE_H); ctx.lineTo(x - TILE_W / 2, y + TILE_H / 2); ctx.closePath(); ctx.stroke(); ctx.lineWidth = 1; }
      }

      const now = performance.now();
      const fs = [...items].sort((a, b) => (a.x + a.y) - (b.x + b.y));
      for (const it of fs) {
        const { sx, sy } = toScreen(it.x, it.y); const x = ox + sx, y = oy + sy;
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y + TILE_H / 2, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
        const cls = classFromSprite(it.furniture?.sprite);
        const model = getModel(cls);
        const dir = (it.rotation ?? 2);
        if (model && model.ok && drawFurni(ctx, model, x, y, { direction: dir, t: now })) { /* 3D */ }
        else { const im = getImg(it.furniture?.sprite); if (im && im.complete && im.naturalWidth) { const s = 46; ctx.drawImage(im, x - s / 2, y + TILE_H / 2 - s, s, s); } }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [items, floor, wall, selected]);

  // ----- click-to-walk (passo a passo, dentro dos tiles) -----
  const stepTo = useCallback((tx, ty) => {
    clearInterval(walkTimer.current);
    const tick = () => {
      const cur = myPos.current;
      if (cur.x === tx && cur.y === ty) { clearInterval(walkTimer.current); setPlayers(s => ({ ...s, [me]: { ...(s[me] || {}), walking: false } })); return; }
      const dx = Math.sign(tx - cur.x), dy = Math.sign(ty - cur.y);
      const nx = cur.x + dx, ny = cur.y + dy, dir = dirFrom(dx, dy);
      myPos.current = { x: nx, y: ny, dir };
      setPlayers(s => ({ ...s, [me]: { ...(s[me] || {}), login: me, look: myLook, x: nx, y: ny, dir, walking: true, dance: 0 } }));
      sockRef.current?.emit('player:move', { x: nx, y: ny, dir });
    };
    tick();
    walkTimer.current = setInterval(tick, 380);
  }, [me, myLook]);

  // ----- ponteiro: pan / walk / place / selecionar furni -----
  const down = useRef(null);
  function screenToTile(clientX, clientY) {
    const rect = wrapRef.current.getBoundingClientRect();
    const lx = (clientX - rect.left - pan.x) / zoom - ORIGIN.x;
    const ly = (clientY - rect.top - pan.y) / zoom - ORIGIN.y;
    const gx = Math.round((lx / (TILE_W / 2) + ly / (TILE_H / 2)) / 2);
    const gy = Math.round((ly / (TILE_H / 2) - lx / (TILE_W / 2)) / 2);
    return { gx, gy };
  }
  function onDown(e) { down.current = { x: e.clientX, y: e.clientY, pan: { ...pan }, moved: false }; }
  function onMove(e) {
    if (!down.current) return;
    const ddx = e.clientX - down.current.x, ddy = e.clientY - down.current.y;
    if (Math.abs(ddx) + Math.abs(ddy) > 6) { down.current.moved = true; setPan({ x: down.current.pan.x + ddx, y: down.current.pan.y + ddy }); }
  }
  function onUp(e) {
    const d = down.current; down.current = null;
    if (!d || d.moved) return;
    const { gx, gy } = screenToTile(e.clientX, e.clientY);
    if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) { setSelected(null); return; }
    if (placingItem) { sockRef.current?.emit('room:place', { furniture_id: placingItem, x: gx, y: gy, rotation: 2 }); onPlaced && onPlaced(); return; }
    const here = items.find(i => i.x === gx && i.y === gy);
    if (canEdit && here) { setSelected(here.id); return; }   // seleciona pra girar/guardar
    setSelected(null);
    stepTo(gx, gy);
  }
  function onWheel(e) { e.preventDefault(); setZoom(z => Math.max(0.4, Math.min(2.4, z - Math.sign(e.deltaY) * 0.12))); }

  function rotateSel() {
    const it = items.find(i => i.id === selected); if (!it) return;
    const cls = classFromSprite(it.furniture?.sprite); const model = getModel(cls);
    const dirs = (model && model.ok && model.frames?.dirs?.length) ? model.frames.dirs : [0, 2, 4, 6];
    const cur = it.rotation ?? 2; const idx = dirs.indexOf(cur);
    const next = dirs[(idx + 1) % dirs.length];
    setItems(s => s.map(i => i.id === it.id ? { ...i, rotation: next } : i));
    sockRef.current?.emit('room:rotate', { id: it.id, rotation: next });
  }
  function pickupSel() { sockRef.current?.emit('room:pickup', { id: selected }); setSelected(null); }
  function doDance(n) { const d = myDance === n ? 0 : n; setMyDance(d); setPlayers(s => ({ ...s, [me]: { ...(s[me] || {}), dance: d, walking: false } })); sockRef.current?.emit('player:dance', { dance: d }); }
  function setDecor(kind, id) { if (kind === 'floor') setFloor(id); else setWall(id); sockRef.current?.emit('room:decor', { [kind]: id }); }

  const meState = players[me] || { x: 5, y: 5, dir: 4, dance: myDance, walking: false, look: myLook };
  const allPlayers = { ...players, [me]: { ...meState, login: me, look: myLook } };
  const selItem = items.find(i => i.id === selected);
  const selScreen = selItem ? toScreen(selItem.x, selItem.y) : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={() => setZoom(z => Math.min(2.4, z + 0.15))}>🔍+</button>
        <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}>🔍−</button>
        <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={fitView}>⛶ ver tudo</button>
        <span style={{ width: 8 }} />
        <span style={{ fontSize: 12, color: 'var(--hb-muted)' }}>Dançar:</span>
        {[1, 2, 3, 4].map(n => (<button key={n} className={'hb-btn hb-btn-sm ' + (myDance === n ? '' : 'hb-btn-ghost')} onClick={() => doDance(n)}>💃{n}</button>))}
        {canEdit && <button className={'hb-btn hb-btn-sm ' + (editor ? '' : 'hb-btn-blue')} style={{ marginLeft: 'auto' }} onClick={() => setEditor(e => !e)}>🎨 Piso/Parede</button>}
      </div>

      {editor && canEdit && (
        <div className="hb-card" style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--hb-muted)', marginBottom: 4 }}>Piso</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {Object.entries(FLOORS).map(([id, f]) => (<button key={id} onClick={() => setDecor('floor', id)} title={f.name} style={{ width: 30, height: 30, borderRadius: 6, border: floor === id ? '3px solid var(--hb-yellow)' : '2px solid var(--hb-border)', background: f.a, cursor: 'pointer' }} />))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--hb-muted)', marginBottom: 4 }}>Parede</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(WALLS).map(([id, w]) => (<button key={id} onClick={() => setDecor('wall', id)} title={w.name} style={{ width: 30, height: 30, borderRadius: 6, border: wall === id ? '3px solid var(--hb-yellow)' : '2px solid var(--hb-border)', background: w.c, cursor: 'pointer' }} />))}
          </div>
        </div>
      )}

      <div ref={wrapRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => (down.current = null)} onWheel={onWheel}
        style={{ position: 'relative', width: '100%', height: VIEW_H, overflow: 'hidden', borderRadius: 12, border: '2px solid var(--hb-border)', background: 'linear-gradient(180deg,#0d2438,#091824)', cursor: placingItem ? 'copy' : 'grab', userSelect: 'none' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: 'block' }} />
          {Object.values(allPlayers).map(p => {
            const { sx, sy } = toScreen(p.x ?? 5, p.y ?? 5);
            const cx = ORIGIN.x + sx, cy = ORIGIN.y + sy + TILE_H / 2;
            const moving = p.walking, dancing = (p.dance || 0) > 0;
            const url = AV(p.look || myLook, { dir: p.dir ?? 4, action: moving ? 'wlk' : 'std', dance: p.dance || 0, gif: moving || dancing });
            return (
              <div key={p.login} style={{ position: 'absolute', left: cx, top: cy, width: 0, height: 0, transition: 'left .38s linear, top .38s linear', zIndex: 1000 + Math.round((p.x + p.y) * 10) }}>
                <div style={{ position: 'absolute', left: '50%', top: -(AV_H + 4), transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                  <div style={{ background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 6 }}>{p.login}</div>
                </div>
                <img src={url} alt="" style={{ position: 'absolute', left: -AV_W / 2, top: -(AV_H - AV_FOOT), width: AV_W, height: AV_H, imageRendering: 'pixelated', pointerEvents: 'none' }} />
              </div>
            );
          })}
        </div>

        {/* popover do furni selecionado */}
        {selItem && canEdit && (
          <div style={{ position: 'absolute', left: pan.x + (ORIGIN.x + selScreen.sx) * zoom, top: pan.y + (ORIGIN.y + selScreen.sy - 70) * zoom, transform: 'translateX(-50%)', zIndex: 3000, display: 'flex', gap: 6, background: '#0c2236', border: '2px solid var(--hb-border)', borderRadius: 10, padding: 6 }}>
            <button className="hb-btn hb-btn-sm" onClick={rotateSel}>↻ Girar</button>
            <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={pickupSel}>📦 Guardar</button>
            <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={() => setSelected(null)}>✕</button>
          </div>
        )}

        {placingItem && (<div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,204,47,.95)', color: '#3a2a00', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>🪑 Clique num tile pra posicionar</div>)}
        <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 11, color: 'var(--hb-muted)' }}>arraste = câmera · scroll = zoom · clique vazio = andar · clique no mobi = girar/guardar</div>
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
        {messages.map((m, i) => (<div key={i} style={{ marginBottom: 2 }}><b style={{ color: 'var(--hb-blue)' }}>{m.login}:</b> {m.text}</div>))}
        <div ref={endRef} />
      </div>
      <form style={{ display: 'flex', gap: 6, padding: 8, borderTop: '2px solid var(--hb-border)' }} onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(''); } }}>
        <input className="hb-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem…" />
        <button className="hb-btn hb-btn-blue hb-btn-sm" type="submit">Enviar</button>
      </form>
    </div>
  );
}
