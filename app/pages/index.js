import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase, api, API } from '../lib/client';

const IsoRoom = dynamic(() => import('../components/IsoRoom'), { ssr: false });

const HEAD = (look, s = 'm') =>
  `https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(look)}&size=${s}&direction=2&head_direction=3&headonly=1&gesture=sml`;
const BODY = (look) =>
  `https://www.habbo.com/habbo-imaging/avatarimage?figure=${encodeURIComponent(look)}&size=l&direction=2&head_direction=3&gesture=std`;

export default function Home() {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [view, setView] = useState('home');
  const [toast, setToast] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    fetch(`${API}/status`).then(r => r.json()).then(setStatus).catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) api('/me').then(setMe); }, [session]);

  const showToast = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind }); setTimeout(() => setToast(null), 2600);
  }, []);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin, scopes: 'read:user' },
    });
  }
  async function sync() {
    showToast('Sincronizando com o GitHub…', 'info');
    const r = await api('/sync', { method: 'POST' });
    if (r.coins != null) setMe(m => ({ ...m, coins: r.coins }));
    showToast(`+${r.credited ?? 0} moedas do GitHub! 🪙`);
  }

  if (status?.maintenance?.on) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', textAlign: 'center', padding: 20 }}>
      <div style={{ maxWidth: 460 }}>
        <div style={{ fontSize: 64 }}>🚧</div>
        <div className="hb-logo" style={{ fontSize: 26, margin: '8px 0' }}>{status.hotel?.name || 'GitHotel'}</div>
        <p style={{ fontSize: 17, color: 'var(--hb-muted)' }}>{status.maintenance.message || 'Hotel em manutenção. Voltamos já!'}</p>
        {session && <button className="hb-btn hb-btn-ghost" style={{ marginTop: 12 }} onClick={() => supabase.auth.signOut()}>Sair</button>}
      </div>
    </div>
  );

  if (!session) return <Landing onLogin={login} />;
  if (!me) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><div className="spin" /></div>;
  if (me.banned) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', textAlign: 'center', padding: 20 }}>
      <div style={{ maxWidth: 460 }}>
        <div style={{ fontSize: 64 }}>🚫</div>
        <h2>Você foi banido do {status?.hotel?.name || 'GitHotel'}</h2>
        <p style={{ color: 'var(--hb-muted)' }}>Se acha que foi engano, fale com a administração.</p>
        <button className="hb-btn hb-btn-ghost" style={{ marginTop: 12 }} onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    </div>
  );

  return (
    <>
      <TopBar me={me} onSync={sync} onLogout={() => supabase.auth.signOut()} view={view} setView={setView} />
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 16px 60px' }}>
        {view === 'home' && <HomeView me={me} setView={setView} />}
        {view === 'hotel' && <HotelView me={me} setMe={setMe} showToast={showToast} />}
        {view === 'catalog' && <CatalogView me={me} setMe={setMe} showToast={showToast} />}
        {view === 'top' && <TopView me={me} />}
      </main>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: toast.kind === 'ok' ? 'var(--hb-green-d)' : toast.kind === 'info' ? 'var(--hb-blue-d)' : 'var(--hb-red)',
          color: '#fff', padding: '12px 22px', borderRadius: 12, fontWeight: 700,
          boxShadow: '0 6px 20px rgba(0,0,0,.4)',
        }}>{toast.msg}</div>
      )}
    </>
  );
}

function TopBar({ me, onSync, onLogout, view, setView }) {
  const tabs = [
    ['home', '🏠 Início'], ['hotel', '🏨 Meu Quarto'],
    ['catalog', '🛒 Catálogo'], ['top', '🏆 Ranking'],
  ];
  return (
    <div className="hb-top">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <span className="hb-logo">GitHotel</span>
        <nav className="hb-nav" style={{ display: 'flex', gap: 2, flex: 1 }}>
          {tabs.map(([k, label]) => (
            <a key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)} style={{ cursor: 'pointer' }}>{label}</a>
          ))}
        </nav>
        <span className="hb-pill" style={{ color: 'var(--hb-yellow)' }}>🪙 {me.coins ?? 0}</span>
        <button className="hb-btn hb-btn-blue hb-btn-sm" onClick={onSync}>↻ Sync GitHub</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={HEAD(me.look)} alt="" style={{ height: 40, imageRendering: 'pixelated' }} />
          <span style={{ fontWeight: 700 }}>{me.github_login}</span>
        </div>
        <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={onLogout}>Sair</button>
      </div>
    </div>
  );
}

function HomeView({ me, setView }) {
  const [articles, setArticles] = useState([]);
  const [online, setOnline] = useState(0);
  useEffect(() => {
    fetch(`${API}/articles`).then(r => r.json()).then(setArticles);
    fetch(`${API}/online`).then(r => r.json()).then(d => setOnline(d.online));
  }, []);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
      <div className="hb-card">
        <div className="hb-card-head">📰 Últimas notícias do hotel</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
          {articles.map(a => (
            <div key={a.id} className="hb-card news-card">
              <div className="cover">{a.cover_url && <img src={a.cover_url} alt="" />}</div>
              <div className="body">
                <h4>{a.title}</h4>
                <p>{a.excerpt}</p>
              </div>
            </div>
          ))}
          {articles.length === 0 && <p style={{ color: 'var(--hb-muted)' }}>Sem notícias ainda.</p>}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="hb-card">
          <div className="hb-card-head">👋 Bem-vindo</div>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <img src={BODY(me.look)} alt="" style={{ height: 110, imageRendering: 'pixelated' }} />
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 6 }}>{me.github_login}</div>
            <div style={{ color: 'var(--hb-yellow)', fontWeight: 700 }}>🪙 {me.coins} moedas</div>
            <button className="hb-btn" style={{ marginTop: 12, width: '100%' }} onClick={() => setView('hotel')}>Entrar no meu quarto</button>
          </div>
        </div>
        <div className="hb-card">
          <div className="hb-card-head">🟢 Online agora</div>
          <div style={{ padding: 16, fontSize: 28, fontWeight: 800, textAlign: 'center' }}>
            {online} <span style={{ fontSize: 13, color: 'var(--hb-muted)', fontWeight: 400 }}>devs no hotel</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HotelView({ me, setMe, showToast }) {
  const [inventory, setInventory] = useState([]);
  const [placing, setPlacing] = useState(null);
  const [visiting, setVisiting] = useState(null);
  const loadInv = useCallback(() => api('/inventory').then(setInventory), []);
  useEffect(() => { loadInv(); }, [loadInv]);

  const roomLogin = visiting || me.github_login;
  const isOwn = roomLogin === me.github_login;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
      <div className="hb-card">
        <div className="hb-card-head" style={{ justifyContent: 'space-between' }}>
          <span>🏨 {isOwn ? 'Meu quarto' : `Quarto de @${roomLogin}`}</span>
          {!isOwn && <button className="hb-btn hb-btn-ghost hb-btn-sm" onClick={() => setVisiting(null)}>← Voltar</button>}
        </div>
        <div style={{ padding: 12 }}>
          <IsoRoom roomLogin={roomLogin} me={me.github_login} myLook={me.look} canEdit={isOwn}
            placingItem={isOwn ? placing : null} onPlaced={() => { setPlacing(null); showToast('Mobi posicionado! 🪑'); }} />
        </div>
      </div>

      <div className="hb-card">
        <div className="hb-card-head">🎒 Minha mochila</div>
        <div style={{ padding: 12 }}>
          {inventory.length === 0 && <p style={{ color: 'var(--hb-muted)', fontSize: 13 }}>Vazia. Vá ao catálogo comprar mobis!</p>}
          <div className="furni-grid">
            {inventory.map(i => (
              <div key={i.furniture_id} className={'furni-cell' + (placing === i.furniture_id ? ' sel' : '')}
                onClick={() => isOwn && setPlacing(i.furniture_id)} title={i.furniture?.name}>
                <img src={i.furniture?.sprite} alt="" onError={(e) => { e.target.style.opacity = .25; }} />
                <div className="nm">{i.furniture?.name}</div>
                <div className="pr">x{i.qty}</div>
              </div>
            ))}
          </div>
          {placing && <p style={{ color: 'var(--hb-yellow)', fontSize: 12, marginTop: 8 }}>Clique no quarto pra posicionar.</p>}
        </div>
      </div>
    </div>
  );
}

function CatalogView({ me, setMe, showToast }) {
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch(`${API}/categories`).then(r => r.json()).then(setCats); }, []);

  const fetchShop = useCallback((append) => {
    setLoading(true);
    const p = append ? page + 1 : 1;
    const url = `${API}/shop?page=${p}&limit=60` +
      (q ? `&q=${encodeURIComponent(q)}` : '') +
      (cat ? `&category=${encodeURIComponent(cat)}` : '') +
      (type ? `&type=${type}` : '');
    fetch(url).then(r => r.json()).then(d => {
      setData(prev => append ? { ...d, items: [...prev.items, ...d.items] } : d);
      setPage(p); setLoading(false);
    });
  }, [q, cat, type, page]);

  useEffect(() => {
    const t = setTimeout(() => fetchShop(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, cat, type]);

  async function buy(it) {
    const r = await api('/buy', { method: 'POST', body: JSON.stringify({ furniture_id: it.id }) });
    if (r.ok) { setMe(m => ({ ...m, coins: r.coins })); showToast(`Comprado: ${it.name} 🪙-${it.price}`); }
    else showToast(r.error === 'insufficient_coins' ? 'Moedas insuficientes!' : (r.error || 'Erro'), 'err');
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>
      <div className="hb-card">
        <div className="hb-card-head">📂 Categorias</div>
        <div style={{ padding: 10 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[['', 'Tudo'], ['floor', 'Chão'], ['wall', 'Parede']].map(([k, l]) => (
              <button key={k} className={'hb-btn hb-btn-sm ' + (type === k ? '' : 'hb-btn-ghost')} style={{ flex: 1 }} onClick={() => setType(k)}>{l}</button>
            ))}
          </div>
          <div className="cat-list">
            <div className={'cat-item' + (cat === '' ? ' active' : '')} onClick={() => setCat('')}>
              <span>Todas</span><span className="n">{data.total}</span>
            </div>
            {cats.map(c => (
              <div key={c.category} className={'cat-item' + (cat === c.category ? ' active' : '')} onClick={() => setCat(c.category)}>
                <span>{c.category}</span><span className="n">{c.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hb-card">
        <div className="hb-card-head" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span>🛒 Catálogo {cat && `· ${cat}`}</span>
          <input className="hb-input" style={{ maxWidth: 260 }} placeholder="🔎 Buscar mobi…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--hb-muted)', marginBottom: 10 }}>
            {data.total.toLocaleString('pt-BR')} mobis encontrados
          </div>
          <div className="furni-grid">
            {data.items.map(it => (
              <div key={it.id} className="furni-cell" onClick={() => buy(it)} title={`${it.name} — comprar por ${it.price}`}>
                {it.rare && <span className="rare-tag">RARO</span>}
                <img src={it.sprite} alt="" loading="lazy" onError={(e) => { e.target.style.opacity = .2; }} />
                <div className="nm">{it.name}</div>
                <div className="pr">🪙 {it.price}</div>
              </div>
            ))}
          </div>
          {loading && <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}><div className="spin" /></div>}
          {!loading && data.page < data.pages && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="hb-btn hb-btn-blue" onClick={() => fetchShop(true)}>Carregar mais</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopView({ me }) {
  const [top, setTop] = useState([]);
  useEffect(() => { fetch(`${API}/leaderboard`).then(r => r.json()).then(setTop); }, []);
  return (
    <div className="hb-card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="hb-card-head">🏆 Ranking — devs mais ricos</div>
      <div style={{ padding: 12 }}>
        {top.map((u, i) => (
          <div key={u.github_login} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10,
            background: u.github_login === me.github_login ? 'var(--hb-blue-d)' : (i % 2 ? 'transparent' : 'rgba(255,255,255,.03)'),
          }}>
            <span className="pixel" style={{ width: 32, fontSize: 12, color: i < 3 ? 'var(--hb-yellow)' : 'var(--hb-muted)' }}>{i + 1}</span>
            <img src={HEAD(u.look || 'hd-180-1.ch-255-66.lg-280-110')} alt="" style={{ height: 34, imageRendering: 'pixelated' }} />
            <span style={{ flex: 1, fontWeight: 700 }}>{u.github_login}</span>
            <span style={{ color: 'var(--hb-yellow)', fontWeight: 800 }}>🪙 {u.coins}</span>
          </div>
        ))}
        {top.length === 0 && <p style={{ color: 'var(--hb-muted)' }}>Ninguém no ranking ainda.</p>}
      </div>
    </div>
  );
}

function Landing({ onLogin }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', textAlign: 'center', padding: 20 }}>
      <div style={{ maxWidth: 520 }}>
        <div className="hb-logo" style={{ fontSize: 34, marginBottom: 8 }}>GitHotel</div>
        <p style={{ fontSize: 18, color: 'var(--hb-muted)' }}>
          O Habbo dos devs. Seus commits viram moedas, suas moedas viram mobis.
          Decore seu quarto com o catálogo completo do hotel e visite outros devs em tempo real.
        </p>
        <button className="hb-btn" style={{ fontSize: 16, marginTop: 16 }} onClick={onLogin}>Entrar com GitHub</button>
        <p style={{ color: 'var(--hb-muted)', fontSize: 13, marginTop: 18 }}>
          +13.000 mobis clássicos · multiplayer · ranking
        </p>
      </div>
    </div>
  );
}
