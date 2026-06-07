import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase, api, API } from '../lib/client';
import { classFromSprite } from '../lib/furni3d';

const IsoRoom = dynamic(() => import('../components/IsoRoom'), { ssr: false });
const Furni3DView = dynamic(() => import('../components/Furni3DView'), { ssr: false });

const HEAD = (look, s = 'm') => `https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(look)}&size=${s}&direction=2&head_direction=3&headonly=1&gesture=sml`;
const BODY = (look) => `https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(look)}&size=l&direction=2&head_direction=3&gesture=std`;

export default function Home() {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [view, setView] = useState('home');
  const [toast, setToast] = useState(null);
  const [status, setStatus] = useState(null);
  const [visitRoom, setVisitRoom] = useState(null);
  const [editLook, setEditLook] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    fetch(`${API}/status`).then(r => r.json()).then(setStatus).catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) api('/me').then(setMe); }, [session]);
  useEffect(() => { if (!session) return; const f = () => api('/dms').then(d => setUnread(d.unread || 0)).catch(() => {}); f(); const t = setInterval(f, 15000); return () => clearInterval(t); }, [session]);

  const showToast = useCallback((msg, kind = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2600); }, []);

  async function login() { await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin, scopes: 'read:user' } }); }
  async function sync() {
    showToast('Sincronizando com o GitHub…', 'info');
    const r = await api('/sync', { method: 'POST' });
    if (r.coins != null) setMe(m => ({ ...m, coins: r.coins }));
    showToast(`+${r.credited ?? 0} moedas do GitHub! 🪙`);
  }
  function visit(login) { setVisitRoom(login === me?.github_login ? null : login); setView('hotel'); }

  if (status?.maintenance?.on) return (
    <Center><div style={{ fontSize: 64 }}>🚧</div><div className="hb-logo" style={{ fontSize: 26, margin: '8px 0' }}>{status.hotel?.name || 'GitHotel'}</div>
      <p style={{ fontSize: 17, color: 'var(--hb-muted)' }}>{status.maintenance.message || 'Hotel em manutenção. Voltamos já!'}</p>
      {session && <button className="hb-btn hb-btn-ghost" style={{ marginTop: 12 }} onClick={() => supabase.auth.signOut()}>Sair</button>}</Center>
  );
  if (!session) return <Landing onLogin={login} />;
  if (!me) return <Center><div className="spin" /></Center>;
  if (me.banned) return (<Center><div style={{ fontSize: 64 }}>🚫</div><h2>Você foi banido</h2>
    <button className="hb-btn hb-btn-ghost" style={{ marginTop: 12 }} onClick={() => supabase.auth.signOut()}>Sair</button></Center>);

  return (
    <>
      <TopBar me={me} onSync={sync} onLogout={() => supabase.auth.signOut()} view={view} setView={setView} onEditLook={() => setEditLook(true)} unread={unread} />
      {editLook && <AvatarEditor me={me} onClose={() => setEditLook(false)} onSaved={(look) => { setMe(m => ({ ...m, look })); setEditLook(false); showToast('Visual salvo! 👕'); }} />}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 60px' }}>
        {view === 'home' && <HomeView me={me} setView={setView} onVisit={visit} />}
        {view === 'navigator' && <NavigatorView me={me} onVisit={visit} />}
        {view === 'hotel' && <HotelView me={me} setMe={setMe} showToast={showToast} visitRoom={visitRoom} setVisitRoom={setVisitRoom} />}
        {view === 'catalog' && <CatalogView me={me} setMe={setMe} showToast={showToast} />}
        {view === 'market' && <MarketView me={me} setMe={setMe} showToast={showToast} />}
        {view === 'console' && <ConsoleView me={me} showToast={showToast} onVisit={visit} />}
        {view === 'bag' && <BagView me={me} setMe={setMe} showToast={showToast} />}
        {view === 'top' && <TopView me={me} onVisit={visit} />}
      </main>
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 5000, background: toast.kind === 'ok' ? 'var(--hb-green-d)' : toast.kind === 'info' ? 'var(--hb-blue-d)' : 'var(--hb-red)', color: '#fff', padding: '12px 22px', borderRadius: 12, fontWeight: 700, boxShadow: '0 6px 20px rgba(0,0,0,.4)' }}>{toast.msg}</div>}
    </>
  );
}

const Center = ({ children }) => <div style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', textAlign: 'center', padding: 20 }}><div style={{ maxWidth: 480 }}>{children}</div></div>;

function TopBar({ me, onSync, onLogout, view, setView, onEditLook, unread }) {
  const tabs = [['home', '🏠 Início'], ['navigator', '🚪 Quartos'], ['hotel', '🏨 Meu Quarto'], ['catalog', '🛒 Catálogo'], ['market', '🏪 Mercado'], ['bag', '🛍️ Sacola'], ['console', '💬 Amigos'], ['top', '🏆 Ranking']];
  return (
    <div className="hb-top">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span className="hb-logo">GitHotel</span>
        <nav className="hb-nav" style={{ display: 'flex', gap: 2, flex: 1, flexWrap: 'wrap' }}>
          {tabs.map(([k, label]) => <a key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)} style={{ cursor: 'pointer', position: 'relative' }}>{label}{k === 'console' && unread > 0 && <span style={{ position: 'absolute', top: -2, right: -4, background: 'var(--hb-red)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '0 5px' }}>{unread}</span>}</a>)}
        </nav>
        <span className="hb-pill" style={{ color: 'var(--hb-yellow)' }}>🪙 {me.coins ?? 0}</span>
        <button className="hb-btn hb-btn-blue hb-btn-sm" onClick={onSync}>↻ Sync GitHub</button>
        <img src={HEAD(me.look)} alt="" title="Editar visual" onClick={onEditLook} style={{ height: 40, imageRendering: 'pixelated', cursor: 'pointer' }} />
        <span style={{ fontWeight: 700 }}>{me.github_login}</span>
        <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={onEditLook}>👕 Visual</button>
        <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={onLogout}>Sair</button>
      </div>
    </div>
  );
}

const PRESET_LOOKS = [
  'hd-180-1.ch-255-66.lg-280-110.sh-305-62.hr-828-61',
  'hd-180-2.ch-3030-1408.lg-275-1408.sh-290-64.hr-100-61',
  'hd-185-3.ch-665-92.lg-700-82.sh-705-62.hr-115-45.ha-1003-70',
  'hd-180-1.ch-235-1408.lg-275-64.sh-300-64.hr-3163-61.he-1602',
  'hd-209-7.ch-255-82.lg-280-82.sh-305-92.hr-831-49',
  'hd-180-1.ch-3110-66-1408.lg-280-110.sh-906-92.hr-681-45',
  'hd-185-2.ch-3001-92.lg-3116-92.sh-3068-92.hr-125-40.ea-1401',
  'hd-180-1.ch-210-66.lg-270-82.sh-290-80.hr-170-61.ha-1012-90',
  'hd-180-10.ch-267-1408.lg-285-64.sh-300-62.hr-155-31',
  'hd-600-1.ch-635-1408.lg-716-64.sh-735-62.hr-545-31.ha-1017-1408',
  'hd-600-2.ch-665-66.lg-695-82.sh-725-92.hr-500-45.ea-1404',
  'hd-180-1.ch-3334-66-1408.lg-3023-110.sh-3035-62.hr-3278-45.fa-1206',
];

const SKIN = [{ id: 1, hex: '#F5DCB1' }, { id: 2, hex: '#FFD0A6' }, { id: 3, hex: '#F2AF88' }, { id: 4, hex: '#C98F66' }, { id: 5, hex: '#8C5A3B' }, { id: 6, hex: '#5A3B2A' }];
const HAIRC = [{ id: 45, hex: '#2d2926' }, { id: 61, hex: '#6b4a2b' }, { id: 40, hex: '#f0c419' }, { id: 42, hex: '#c7873b' }, { id: 31, hex: '#a0522d' }, { id: 21, hex: '#e8503a' }, { id: 49, hex: '#b03a2e' }, { id: 1407, hex: '#5b8fd4' }];
const CLOTHC = [{ id: 1, hex: '#c9c9c9' }, { id: 3, hex: '#ffffff' }, { id: 92, hex: '#4a4a4a' }, { id: 61, hex: '#6b4a2b' }, { id: 100, hex: '#e8503a' }, { id: 104, hex: '#f0c419' }, { id: 106, hex: '#6abe30' }, { id: 143, hex: '#3a8fd4' }, { id: 96, hex: '#a371f7' }, { id: 1408, hex: '#222222' }];
const SETS = {
  hd: { label: '🧑 Rosto', head: true, req: true, ids: [180, 185, 190, 195, 200, 205, 206, 207, 208, 209, 3091, 3093, 3096], colors: SKIN },
  hr: { label: '💇 Cabelo', head: true, ids: [0, 100, 105, 110, 115, 120, 125, 130, 140, 155, 165, 170, 500, 505, 515, 3090, 3162, 3163, 802, 828, 831], colors: HAIRC },
  ha: { label: '🎩 Chapéu', head: true, ids: [0, 1001, 1002, 1003, 1004, 1009, 1010, 1012, 1013, 1014, 1017, 1018, 3110], colors: CLOTHC },
  ea: { label: '👓 Óculos', head: true, ids: [0, 1401, 1402, 1403, 1404, 1405, 1406, 1408], colors: CLOTHC },
  fa: { label: '🎭 Máscara', head: true, ids: [0, 1201, 1202, 1203, 1204, 1205, 1206, 1212], colors: CLOTHC },
  ch: { label: '👕 Camisa', ids: [0, 210, 215, 220, 225, 230, 235, 240, 245, 255, 260, 3030, 3077, 3216, 667, 669, 3334], colors: CLOTHC },
  cc: { label: '🧥 Casaco', ids: [0, 260, 3007, 3030, 3075, 3110, 3280], colors: CLOTHC },
  lg: { label: '👖 Calça', ids: [270, 275, 280, 285, 695, 700, 705, 710, 715, 716, 3023, 3116], colors: CLOTHC },
  sh: { label: '👟 Sapato', ids: [290, 295, 300, 305, 725, 730, 735, 740, 905, 906, 3068], colors: CLOTHC },
};
const ORDER = ['hd', 'hr', 'ch', 'cc', 'lg', 'sh', 'ha', 'ea', 'fa'];

function parseLook(look) {
  const parts = {};
  (look || '').split('.').forEach(seg => { const [t, id, c] = seg.split('-'); if (t) parts[t] = { id: parseInt(id) || 0, c: parseInt(c) || 1 }; });
  if (!parts.hd) parts.hd = { id: 180, c: 1 };
  return parts;
}
function buildLook(parts) { return ORDER.filter(t => parts[t] && parts[t].id > 0).map(t => `${t}-${parts[t].id}-${parts[t].c}`).join('.') || 'hd-180-1'; }
function partThumb(type, id, color, parts) {
  const head = SETS[type].head;
  const base = head ? `hd-${parts.hd.id}-${parts.hd.c}` : `hd-180-1.lg-270-1408`;
  const fig = id > 0 ? `${base}.${type}-${id}-${color}` : base;
  return `https://www.habbo.com/habbo-imaging/avatarimage?figure=${fig}&size=l&direction=2&head_direction=2${head ? '&headonly=1' : ''}&gesture=sml`;
}

function AvatarEditor({ me, onClose, onSaved }) {
  const [parts, setParts] = useState(() => parseLook(me.look));
  const [cat, setCat] = useState('hr');
  const look = buildLook(parts);
  const set = SETS[cat];
  function pick(id) { setParts(p => ({ ...p, [cat]: { id, c: p[cat]?.c || set.colors[0].id } })); }
  function pickColor(c) { setParts(p => ({ ...p, [cat]: { id: p[cat]?.id ?? (set.req ? set.ids[0] : 0), c } })); }
  async function save() { const r = await api('/look', { method: 'POST', body: JSON.stringify({ look }) }); if (r.ok) onSaved(r.look); }
  function randomize() { const np = {}; ORDER.forEach(t => { const s = SETS[t]; const ids = s.ids; const id = ids[Math.floor(Math.random() * ids.length)]; const c = s.colors[Math.floor(Math.random() * s.colors.length)].id; np[t] = { id, c }; }); np.hd.id = SETS.hd.ids[Math.floor(Math.random() * SETS.hd.ids.length)]; setParts(np); }
  const cur = parts[cat] || { id: 0, c: set.colors[0].id };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'grid', placeItems: 'center', zIndex: 6000 }}>
      <div onClick={e => e.stopPropagation()} className="hb-card" style={{ width: 720, maxWidth: '96vw' }}>
        <div className="hb-card-head" style={{ justifyContent: 'space-between' }}><span>👕 Guarda-roupa</span><button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={onClose}>✕</button></div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '170px 1fr', gap: 16 }}>
          <div>
            <div style={{ textAlign: 'center', background: 'linear-gradient(180deg,#1b3b5a,#0e2638)', border: '2px solid var(--hb-border)', borderRadius: 10, padding: 10 }}>
              <img src={BODY(look)} alt="" style={{ height: 150, imageRendering: 'pixelated' }} />
            </div>
            <button className="hb-btn hb-btn-ghost hb-btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={randomize}>🎲 Aleatório</button>
            <button className="hb-btn" style={{ width: '100%', marginTop: 6 }} onClick={save}>Salvar visual</button>
          </div>
          <div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {Object.entries(SETS).map(([k, s]) => <button key={k} className={'hb-btn hb-btn-sm ' + (cat === k ? '' : 'hb-btn-ghost')} onClick={() => setCat(k)}>{s.label}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {set.colors.map(c => <div key={c.id} onClick={() => pickColor(c.id)} title={'cor ' + c.id} style={{ width: 24, height: 24, borderRadius: '50%', background: c.hex, cursor: 'pointer', border: cur.c === c.id ? '3px solid var(--hb-yellow)' : '2px solid var(--hb-border)' }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(56px,1fr))', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {set.ids.map(id => (
                <div key={id} onClick={() => pick(id)} style={{ cursor: 'pointer', borderRadius: 8, border: cur.id === id ? '2px solid var(--hb-yellow)' : '2px solid var(--hb-border)', background: '#0e2638', display: 'grid', placeItems: 'center', height: 66, overflow: 'hidden' }}>
                  {id === 0 ? <span style={{ fontSize: 11, color: 'var(--hb-muted)' }}>nenhum</span> : <img src={partThumb(cat, id, cur.c, parts)} alt="" loading="lazy" style={{ height: 60, imageRendering: 'pixelated' }} onError={e => e.target.style.opacity = .15} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeView({ me, setView, onVisit }) {
  const [articles, setArticles] = useState([]);
  const [online, setOnline] = useState(0);
  useEffect(() => { fetch(`${API}/articles`).then(r => r.json()).then(setArticles); fetch(`${API}/online`).then(r => r.json()).then(d => setOnline(d.online)); }, []);
  return (
    <>
      <HotelFront me={me} online={online} setView={setView} onVisit={onVisit} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
      <div className="hb-card"><div className="hb-card-head">📰 Últimas notícias do hotel</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
          {articles.map(a => (<div key={a.id} className="hb-card news-card"><div className="cover">{a.cover_url && <img src={a.cover_url} alt="" />}</div><div className="body"><h4>{a.title}</h4><p>{a.excerpt}</p></div></div>))}
          {articles.length === 0 && <p style={{ color: 'var(--hb-muted)' }}>Sem notícias ainda.</p>}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="hb-card"><div className="hb-card-head">👋 Bem-vindo</div>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <img src={BODY(me.look)} alt="" style={{ height: 110, imageRendering: 'pixelated' }} />
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 6 }}>{me.github_login}</div>
            <div style={{ color: 'var(--hb-yellow)', fontWeight: 700 }}>🪙 {me.coins} moedas</div>
            <button className="hb-btn" style={{ marginTop: 12, width: '100%' }} onClick={() => setView('hotel')}>Entrar no meu quarto</button>
          </div>
        </div>
        <div className="hb-card"><div className="hb-card-head">🟢 Online agora</div><div style={{ padding: 16, fontSize: 28, fontWeight: 800, textAlign: 'center' }}>{online} <span style={{ fontSize: 13, color: 'var(--hb-muted)', fontWeight: 400 }}>devs no hotel</span></div></div>
      </div>
      </div>
    </>
  );
}

function HotelFront({ me, online, setView, onVisit }) {
  const cols = 9, rows = 4;
  const win = [];
  for (let i = 0; i < cols * rows; i++) win.push(Math.random() < 0.55);
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 20, border: '2px solid var(--hb-border)',
      background: 'linear-gradient(180deg,#0b1f33 0%,#13314c 55%,#16324a 100%)', minHeight: 240 }}>
      {/* céu + nuvens */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(600px 200px at 80% -60px,#2a5f8f,transparent 70%)' }} />
      {/* prédio */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', paddingTop: 26 }}>
        <div style={{ width: 360, background: 'linear-gradient(180deg,#3a8fd4,#2a6390)', borderRadius: '10px 10px 0 0', padding: '14px 16px 0', boxShadow: '0 0 0 4px #1f4f7a, 0 12px 30px rgba(0,0,0,.4)' }}>
          {/* letreiro */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <span className="hb-logo" style={{ fontSize: 22, color: 'var(--hb-yellow)' }}>GitHotel</span>
          </div>
          {/* janelas */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 6, marginBottom: 0 }}>
            {win.map((on, i) => (
              <div key={i} style={{ height: 22, borderRadius: 3, background: on ? '#ffd964' : '#16324a', boxShadow: on ? '0 0 6px #ffd96488' : 'none', border: '1px solid #1f4f7a' }} />
            ))}
          </div>
          {/* porta */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <div style={{ width: 70, height: 44, background: 'linear-gradient(180deg,#ffd964,#e0a92f)', borderRadius: '8px 8px 0 0', display: 'grid', placeItems: 'center', fontSize: 22 }}>🚪</div>
          </div>
        </div>
      </div>
      {/* overlay info + ações */}
      <div style={{ position: 'absolute', left: 20, bottom: 16, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Bem-vindo ao GitHotel 🏨</div>
          <div style={{ color: 'var(--hb-muted)', fontSize: 13 }}>🟢 {online} devs online agora</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="hb-btn" onClick={() => onVisit('lobby')}>🏨 Entrar no Lobby</button>
          <button className="hb-btn hb-btn-blue" onClick={() => setView('hotel')}>Meu quarto</button>
          <button className="hb-btn hb-btn-ghost" onClick={() => setView('navigator')}>🚪 Ver quartos</button>
        </div>
      </div>
    </div>
  );
}

const ROOM_ICON = { lobby: '🛎️', cafe: '☕', games: '🎮' };
function NavigatorView({ me, onVisit }) {
  const [data, setData] = useState({ official: [], user: [] });
  useEffect(() => { fetch(`${API}/rooms`).then(r => r.json()).then(d => setData(d.official ? d : { official: [], user: d })); }, []);
  return (
    <>
      <div className="hb-card" style={{ marginBottom: 20 }}>
        <div className="hb-card-head">🏨 Salas oficiais do hotel</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          {data.official.map(r => (
            <div key={r.slug} className="hb-card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => onVisit(r.slug)}>
              <div style={{ height: 90, background: 'linear-gradient(135deg,#2a6390,#3a8fd4)', display: 'grid', placeItems: 'center', fontSize: 40 }}>{ROOM_ICON[r.slug] || '🚪'}</div>
              <div style={{ padding: 12 }}><div style={{ fontWeight: 800 }}>{r.name}</div><div style={{ fontSize: 12, color: 'var(--hb-muted)' }}>{r.descr}</div><div style={{ fontSize: 12, color: 'var(--hb-green)', marginTop: 4 }}>🟢 {r.online || 0} online</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="hb-card">
        <div className="hb-card-head">🚪 Quartos dos devs</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 14 }}>
          <div className="hb-card" style={{ padding: 14, textAlign: 'center', cursor: 'pointer', border: '2px solid var(--hb-yellow)' }} onClick={() => onVisit(me.github_login)}>
            <img src={BODY(me.look)} alt="" style={{ height: 78, imageRendering: 'pixelated' }} /><div style={{ fontWeight: 700, marginTop: 4 }}>Meu quarto</div>
          </div>
          {data.user.filter(r => r.github_login !== me.github_login).map(r => (
            <div key={r.github_login} className="hb-card" style={{ padding: 14, textAlign: 'center', cursor: 'pointer' }} onClick={() => onVisit(r.github_login)}>
              <img src={BODY(r.look || 'hd-180-1.ch-255-66.lg-280-110')} alt="" style={{ height: 78, imageRendering: 'pixelated' }} />
              <div style={{ fontWeight: 700, marginTop: 4 }}>@{r.github_login}</div>
              <div style={{ fontSize: 12, color: 'var(--hb-muted)' }}>🛋️ {r.items} mobis</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function HotelView({ me, setMe, showToast, visitRoom, setVisitRoom }) {
  const [inventory, setInventory] = useState([]);
  const [placing, setPlacing] = useState(null);
  const loadInv = useCallback(() => api('/inventory').then(setInventory), []);
  useEffect(() => { loadInv(); }, [loadInv]);
  const roomLogin = visitRoom || me.github_login;
  const isOwn = roomLogin === me.github_login;

  function onFurniUsed(d) {
    if (d?.ok) { setMe(m => ({ ...m, coins: d.coins })); showToast(`⚡ +${d.amount} moedas! (${d.name || 'máquina'})`); }
    else if (d?.error === 'cooldown') showToast(`⏳ Espere ${d.wait}s pra usar de novo`, 'info');
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
      <div className="hb-card">
        <div className="hb-card-head" style={{ justifyContent: 'space-between' }}>
          <span>🏨 {isOwn ? 'Meu quarto' : `Quarto de @${roomLogin}`}</span>
          {!isOwn && <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={() => setVisitRoom(null)}>← Meu quarto</button>}
        </div>
        <div style={{ padding: 12 }}>
          <IsoRoom roomLogin={roomLogin} me={me.github_login} myLook={me.look} canEdit={isOwn}
            placingItem={isOwn ? placing : null} onInventoryChange={loadInv} onFurniUsed={onFurniUsed}
            onPlaced={() => { setPlacing(null); showToast('Mobi posicionado! 🪑'); loadInv(); }} />
        </div>
      </div>
      <div className="hb-card"><div className="hb-card-head">🎒 Minha mochila</div>
        <div style={{ padding: 12 }}>
          {inventory.length === 0 && <p style={{ color: 'var(--hb-muted)', fontSize: 13 }}>Vazia. Vá ao catálogo comprar mobis!</p>}
          <div className="furni-grid">
            {inventory.map(i => (
              <div key={i.furniture_id} className={'furni-cell' + (placing === i.furniture_id ? ' sel' : '')} onClick={() => isOwn && setPlacing(i.furniture_id)} title={i.furniture?.name}>
                <img src={i.furniture?.sprite} alt="" onError={(e) => { e.target.style.opacity = .25; }} />
                <div className="nm">{i.furniture?.name}</div><div className="pr">x{i.qty}</div>
              </div>
            ))}
          </div>
          {placing && <p style={{ color: 'var(--hb-yellow)', fontSize: 12, marginTop: 8 }}>Clique no quarto pra posicionar.</p>}
          {!isOwn && <p style={{ color: 'var(--hb-muted)', fontSize: 12 }}>Você está visitando. Clique nas máquinas pra ganhar moedas! ⚡</p>}
        </div>
      </div>
    </div>
  );
}

function CatalogView({ me, setMe, showToast }) {
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState(''); const [type, setType] = useState(''); const [q, setQ] = useState('');
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1); const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(null);

  useEffect(() => { fetch(`${API}/categories`).then(r => r.json()).then(setCats); }, []);
  const fetchShop = useCallback((append) => {
    setLoading(true);
    const p = append ? page + 1 : 1;
    const url = `${API}/shop?page=${p}&limit=60` + (q ? `&q=${encodeURIComponent(q)}` : '') + (cat ? `&category=${encodeURIComponent(cat)}` : '') + (type ? `&type=${type}` : '');
    fetch(url).then(r => r.json()).then(d => { setData(prev => append ? { ...d, items: [...prev.items, ...d.items] } : d); setPage(p); setLoading(false); });
  }, [q, cat, type, page]);
  useEffect(() => { const t = setTimeout(() => fetchShop(false), 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, cat, type]);

  async function confirmBuy(it) {
    const r = await api('/buy', { method: 'POST', body: JSON.stringify({ furniture_id: it.id }) });
    if (r.ok) { setMe(m => ({ ...m, coins: r.coins })); showToast(`Comprado: ${it.name} 🪙-${it.price}`); setBuying(null); }
    else showToast(r.error === 'insufficient_coins' ? 'Moedas insuficientes!' : (r.error || 'Erro'), 'err');
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>
      <div className="hb-card"><div className="hb-card-head">📂 Categorias</div>
        <div style={{ padding: 10 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[['', 'Tudo'], ['floor', 'Chão'], ['wall', 'Parede']].map(([k, l]) => <button key={k} className={'hb-btn hb-btn-sm ' + (type === k ? '' : 'hb-btn-ghost')} style={{ flex: 1 }} onClick={() => setType(k)}>{l}</button>)}
          </div>
          <div className="cat-list">
            <div className={'cat-item' + (cat === '' ? ' active' : '')} onClick={() => setCat('')}><span>Todas</span><span className="n">{data.total}</span></div>
            {cats.map(c => <div key={c.category} className={'cat-item' + (cat === c.category ? ' active' : '')} onClick={() => setCat(c.category)}><span>{c.category}</span><span className="n">{c.n}</span></div>)}
          </div>
        </div>
      </div>
      <div className="hb-card">
        <div className="hb-card-head" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span>🛒 Catálogo {cat && `· ${cat}`}</span>
          <input className="hb-input" style={{ maxWidth: 260 }} placeholder="🔎 Buscar mobi…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--hb-muted)', marginBottom: 10 }}>{data.total.toLocaleString('pt-BR')} mobis · clique pra ver em 3D e comprar</div>
          <div className="furni-grid">
            {data.items.map(it => (
              <div key={it.id} className="furni-cell" onClick={() => setBuying(it)} title={it.name}>
                {it.rare && <span className="rare-tag">RARO</span>}
                <img src={it.sprite} alt="" loading="lazy" onError={(e) => { e.target.style.opacity = .2; }} />
                <div className="nm">{it.name}</div><div className="pr">🪙 {it.price}</div>
              </div>
            ))}
          </div>
          {loading && <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}><div className="spin" /></div>}
          {!loading && data.page < data.pages && <div style={{ textAlign: 'center', marginTop: 16 }}><button className="hb-btn hb-btn-blue" onClick={() => fetchShop(true)}>Carregar mais</button></div>}
        </div>
      </div>

      {buying && (
        <div onClick={() => setBuying(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'grid', placeItems: 'center', zIndex: 4000 }}>
          <div onClick={e => e.stopPropagation()} className="hb-card" style={{ width: 540, maxWidth: '94vw' }}>
            <div className="hb-card-head" style={{ justifyContent: 'space-between' }}>
              <span>{buying.rare && <span className="rare-tag" style={{ position: 'static', marginRight: 6 }}>RARO</span>}{buying.name}</span>
              <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={() => setBuying(null)}>✕</button>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '210px 1fr', gap: 16 }}>
              <Furni3DView cls={classFromSprite(buying.sprite)} size={200} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: 'var(--hb-muted)', fontSize: 13, marginBottom: 8 }}>{buying.description || 'Um mobi clássico do hotel.'}</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--hb-muted)', marginBottom: 10 }}>
                  <span>📂 {buying.category}</span><span>📐 {buying.width}×{buying.height}</span><span>{buying.item_type === 'wall' ? '🖼️ parede' : '🟫 chão'}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--hb-muted)' }}>Gire o mobi nos botões abaixo do preview 👈</div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--hb-yellow)', margin: '8px 0' }}>🪙 {buying.price}</div>
                <div style={{ fontSize: 12, color: 'var(--hb-muted)', marginBottom: 8 }}>Seu saldo: 🪙 {me.coins}</div>
                <button className="hb-btn" style={{ width: '100%', fontSize: 15 }} disabled={me.coins < buying.price} onClick={() => confirmBuy(buying)}>
                  {me.coins < buying.price ? 'Moedas insuficientes' : '✅ Confirmar compra'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BagView({ me, setMe, showToast }) {
  const [packages, setPackages] = useState([]);
  const [code, setCode] = useState('');
  useEffect(() => { fetch(`${API}/packages`).then(r => r.json()).then(setPackages); }, []);
  async function redeem() {
    if (!code.trim()) return;
    const r = await api('/redeem', { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
    if (r.ok) { setMe(m => ({ ...m, coins: r.coins })); showToast(`🎟️ +${r.amount} moedas resgatadas!`); setCode(''); }
    else showToast(r.error === 'used' ? 'Código já usado' : 'Código inválido', 'err');
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
      <div className="hb-card"><div className="hb-card-head">🛍️ Sacola de moedas</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14 }}>
          {packages.map(p => (
            <div key={p.id} className="hb-card" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 34 }}>{p.coins >= 3000 ? '💰' : p.coins >= 1000 ? '👛' : '🪙'}</div>
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              <div style={{ color: 'var(--hb-yellow)', fontWeight: 700, margin: '4px 0' }}>🪙 {p.coins.toLocaleString('pt-BR')}{p.bonus ? ` +${p.bonus}` : ''}</div>
              <div style={{ color: 'var(--hb-muted)', fontSize: 13 }}>R$ {(p.price_cents / 100).toFixed(2)}</div>
              <button className="hb-btn hb-btn-blue hb-btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => showToast('💳 Pagamento (PayPal/cripto) em breve!', 'info')}>Comprar</button>
            </div>
          ))}
        </div>
      </div>
      <div className="hb-card"><div className="hb-card-head">🎟️ Resgatar código</div>
        <div style={{ padding: 16 }}>
          <p style={{ color: 'var(--hb-muted)', fontSize: 13, marginTop: 0 }}>Tem um código de crédito? Resgate aqui.</p>
          <input className="hb-input" placeholder="EX: GITHOTEL-XXXX" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
          <button className="hb-btn" style={{ width: '100%', marginTop: 10 }} onClick={redeem}>Resgatar</button>
          <p style={{ color: 'var(--hb-muted)', fontSize: 12, marginTop: 12 }}>💡 Você também ganha moedas sincronizando seu GitHub (commits, PRs, stars).</p>
        </div>
      </div>
    </div>
  );
}

function TopView({ me, onVisit }) {
  const [top, setTop] = useState([]);
  useEffect(() => { fetch(`${API}/leaderboard`).then(r => r.json()).then(setTop); }, []);
  return (
    <div className="hb-card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="hb-card-head">🏆 Ranking — devs mais ricos</div>
      <div style={{ padding: 12 }}>
        {top.map((u, i) => (
          <div key={u.github_login} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10, background: u.github_login === me.github_login ? 'var(--hb-blue-d)' : (i % 2 ? 'transparent' : 'rgba(255,255,255,.03)') }}>
            <span className="pixel" style={{ width: 32, fontSize: 12, color: i < 3 ? 'var(--hb-yellow)' : 'var(--hb-muted)' }}>{i + 1}</span>
            <img src={HEAD(u.look || 'hd-180-1.ch-255-66.lg-280-110')} alt="" style={{ height: 34, imageRendering: 'pixelated' }} />
            <span style={{ flex: 1, fontWeight: 700, cursor: 'pointer' }} onClick={() => onVisit(u.github_login)}>{u.github_login}</span>
            <span style={{ color: 'var(--hb-yellow)', fontWeight: 800 }}>🪙 {u.coins}</span>
          </div>
        ))}
        {top.length === 0 && <p style={{ color: 'var(--hb-muted)' }}>Ninguém no ranking ainda.</p>}
      </div>
    </div>
  );
}

function ConsoleView({ me, showToast, onVisit }) {
  const [data, setData] = useState({ friends: [], requests: [], pending: [] });
  const [add, setAdd] = useState('');
  const [open, setOpen] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [online, setOnline] = useState([]);
  const load = useCallback(() => api('/friends').then(setData), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const f = () => fetch(`${API}/online/who`).then(r => r.json()).then(setOnline).catch(() => {}); f(); const t = setInterval(f, 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!open) return;
    const fetchMsgs = () => api(`/dms/${open}`).then(setMsgs);
    fetchMsgs(); const t = setInterval(fetchMsgs, 2500); return () => clearInterval(t);
  }, [open]);
  async function sendReq() { if (!add.trim()) return; const r = await api('/friends/request', { method: 'POST', body: JSON.stringify({ login: add.trim() }) }); showToast(r.ok ? `Pedido enviado a @${add.trim()} 👥` : 'Usuário não encontrado', r.ok ? 'ok' : 'err'); setAdd(''); load(); }
  async function accept(login) { await api('/friends/accept', { method: 'POST', body: JSON.stringify({ login }) }); showToast(`Agora vocês são amigos! 🎉`); load(); }
  async function remove(login) { await api('/friends/remove', { method: 'POST', body: JSON.stringify({ login }) }); if (open === login) setOpen(null); load(); }
  async function send() { if (!text.trim() || !open) return; await api('/dms', { method: 'POST', body: JSON.stringify({ to: open, body: text.trim() }) }); setText(''); api(`/dms/${open}`).then(setMsgs); }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
      <div className="hb-card">
        <div className="hb-card-head">👥 Amigos</div>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input className="hb-input" placeholder="add por @login" value={add} onChange={e => setAdd(e.target.value)} />
            <button className="hb-btn hb-btn-sm" onClick={sendReq}>+</button>
          </div>
          {data.requests.length > 0 && <div style={{ fontSize: 12, color: 'var(--hb-yellow)', margin: '6px 0' }}>Pedidos recebidos</div>}
          {data.requests.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <img src={HEAD(u.look || '')} style={{ height: 28, imageRendering: 'pixelated' }} alt="" />
              <span style={{ flex: 1, fontSize: 13 }}>{u.github_login}</span>
              <button className="hb-btn hb-btn-sm" onClick={() => accept(u.github_login)}>aceitar</button>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--hb-muted)', margin: '10px 0 4px' }}>Meus amigos ({data.friends.length})</div>
          {data.friends.length === 0 && <p style={{ color: 'var(--hb-muted)', fontSize: 13 }}>Adicione amigos pelo @login.</p>}
          {data.friends.map(u => (
            <div key={u.id} className={'cat-item' + (open === u.github_login ? ' active' : '')} onClick={() => setOpen(u.github_login)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span title={online.includes(u.github_login) ? 'online' : 'offline'} style={{ width: 8, height: 8, borderRadius: '50%', background: online.includes(u.github_login) ? 'var(--hb-green)' : '#555', flexShrink: 0 }} />
              <img src={HEAD(u.look || '')} style={{ height: 28, imageRendering: 'pixelated' }} alt="" />
              <span style={{ flex: 1 }}>{u.github_login}</span>
              <span title="visitar quarto" onClick={(e) => { e.stopPropagation(); onVisit(u.github_login); }}>🚪</span>
            </div>
          ))}
        </div>
      </div>
      <div className="hb-card">
        <div className="hb-card-head">💬 {open ? `Conversa com @${open}` : 'Mensagens'}</div>
        <div style={{ padding: 12 }}>
          {!open && <p style={{ color: 'var(--hb-muted)' }}>Selecione um amigo pra conversar.</p>}
          {open && (
            <>
              <div style={{ height: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {msgs.map(m => (
                  <div key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', background: m.mine ? 'var(--hb-blue-d)' : '#1b3b5a', color: '#fff', padding: '6px 12px', borderRadius: 12, maxWidth: '70%', fontSize: 14 }}>{m.body}</div>
                ))}
                {msgs.length === 0 && <p style={{ color: 'var(--hb-muted)' }}>Diga oi! 👋</p>}
              </div>
              <form style={{ display: 'flex', gap: 6 }} onSubmit={e => { e.preventDefault(); send(); }}>
                <input className="hb-input" value={text} onChange={e => setText(e.target.value)} placeholder="Mensagem privada…" maxLength={500} />
                <button className="hb-btn hb-btn-blue hb-btn-sm" type="submit">Enviar</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketView({ me, setMe, showToast }) {
  const [tab, setTab] = useState('buy');
  const [listings, setListings] = useState([]);
  const [mine, setMine] = useState([]);
  const [inv, setInv] = useState([]);
  const [price, setPrice] = useState({});
  const loadAll = useCallback(() => { fetch(`${API}/market`).then(r => r.json()).then(setListings); api('/market/mine').then(setMine); api('/inventory').then(setInv); }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  async function buy(l) { const r = await api('/market/buy', { method: 'POST', body: JSON.stringify({ listing_id: l.id }) }); if (r.ok) { setMe(m => ({ ...m, coins: r.coins })); showToast(`Comprado: ${l.furniture?.name} 🪙-${l.price}`); loadAll(); } else showToast(r.error === 'insufficient_coins' ? 'Moedas insuficientes' : r.error === 'own' ? 'É seu próprio anúncio' : 'Indisponível', 'err'); }
  async function sell(it) { const p = parseInt(price[it.furniture_id]) || 0; if (p < 1) return showToast('Defina um preço', 'err'); const r = await api('/market/list', { method: 'POST', body: JSON.stringify({ furniture_id: it.furniture_id, price: p }) }); if (r.ok) { showToast(`Anunciado por 🪙${p}!`); loadAll(); } else showToast('Erro ao anunciar', 'err'); }
  async function cancel(l) { const r = await api('/market/cancel', { method: 'POST', body: JSON.stringify({ listing_id: l.id }) }); if (r.ok) { showToast('Anúncio cancelado, mobi voltou pra mochila'); loadAll(); } }
  return (
    <div className="hb-card">
      <div className="hb-card-head" style={{ gap: 8 }}>
        <span>🏪 Mercado</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {[['buy', 'Comprar'], ['sell', 'Vender'], ['mine', 'Meus anúncios']].map(([k, l]) => <button key={k} className={'hb-btn hb-btn-sm ' + (tab === k ? '' : 'hb-btn-ghost')} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        {tab === 'buy' && (
          <div className="furni-grid">
            {listings.map(l => (
              <div key={l.id} className="furni-cell" title={l.furniture?.name}>
                {l.furniture?.rare && <span className="rare-tag">RARO</span>}
                <img src={l.furniture?.sprite} alt="" onError={e => e.target.style.opacity = .2} />
                <div className="nm">{l.furniture?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--hb-muted)' }}>@{l.seller?.github_login}</div>
                <button className="hb-btn hb-btn-sm" style={{ width: '100%', marginTop: 4 }} onClick={() => buy(l)}>🪙 {l.price}</button>
              </div>
            ))}
            {listings.length === 0 && <p style={{ color: 'var(--hb-muted)' }}>Nenhum anúncio. Seja o primeiro a vender!</p>}
          </div>
        )}
        {tab === 'sell' && (
          <div className="furni-grid">
            {inv.map(i => (
              <div key={i.furniture_id} className="furni-cell" title={i.furniture?.name}>
                <img src={i.furniture?.sprite} alt="" onError={e => e.target.style.opacity = .2} />
                <div className="nm">{i.furniture?.name} x{i.qty}</div>
                <input className="hb-input" style={{ padding: 4, fontSize: 12, margin: '4px 0' }} placeholder="🪙 preço" value={price[i.furniture_id] || ''} onChange={e => setPrice(p => ({ ...p, [i.furniture_id]: e.target.value }))} />
                <button className="hb-btn hb-btn-sm" style={{ width: '100%' }} onClick={() => sell(i)}>Anunciar</button>
              </div>
            ))}
            {inv.length === 0 && <p style={{ color: 'var(--hb-muted)' }}>Mochila vazia.</p>}
          </div>
        )}
        {tab === 'mine' && (
          <div className="furni-grid">
            {mine.filter(l => l.status === 'active').map(l => (
              <div key={l.id} className="furni-cell">
                <img src={l.furniture?.sprite} alt="" onError={e => e.target.style.opacity = .2} />
                <div className="nm">{l.furniture?.name}</div><div className="pr">🪙 {l.price}</div>
                <button className="hb-btn hb-btn-ghost hb-btn-sm" style={{ width: '100%', marginTop: 4 }} onClick={() => cancel(l)}>Cancelar</button>
              </div>
            ))}
            {mine.filter(l => l.status === 'active').length === 0 && <p style={{ color: 'var(--hb-muted)' }}>Você não tem anúncios ativos.</p>}
          </div>
        )}
        <p style={{ color: 'var(--hb-muted)', fontSize: 12, marginTop: 12 }}>💡 O hotel cobra 10% de taxa nas vendas.</p>
      </div>
    </div>
  );
}

function Landing({ onLogin }) {
  return (
    <Center>
      <div className="hb-logo" style={{ fontSize: 34, marginBottom: 8 }}>GitHotel</div>
      <p style={{ fontSize: 18, color: 'var(--hb-muted)' }}>O Habbo dos devs. Seus commits viram moedas, suas moedas viram mobis. Decore seu quarto, visite outros devs e ganhe moedas nas máquinas.</p>
      <button className="hb-btn" style={{ fontSize: 16, marginTop: 16 }} onClick={onLogin}>Entrar com GitHub</button>
      <p style={{ color: 'var(--hb-muted)', fontSize: 13, marginTop: 18 }}>+13.000 mobis · 3D · multiplayer · ranking</p>
    </Center>
  );
}
