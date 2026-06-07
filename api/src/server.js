import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { db } from './db.js';
import { authMiddleware, verifySupabaseJWT } from './auth.js';
import { syncGithubActivity } from './github.js';
import { getFurni, safeClass } from './furni.js';

const app = express();
const origin = (process.env.APP_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({ origin }));
app.use(express.json());

// Look padrao (avatar Habbo) pra novos devs
const DEFAULT_LOOK = 'hd-180-1.ch-255-66.lg-280-110.sh-305-62.hr-828-61';

async function getOrCreateProfile(user) {
  let { data } = await db.from('profiles').select('*').eq('id', user.sub).single();
  if (!data) {
    const meta = user.user_metadata || {};
    const ins = await db.from('profiles').insert({
      id: user.sub,
      github_login: meta.user_name || meta.preferred_username || `dev_${user.sub.slice(0, 6)}`,
      github_id: meta.provider_id ? Number(meta.provider_id) : null,
      avatar_url: meta.avatar_url || null,
    }).select('*').single();
    data = ins.data;
  }
  return data;
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'githotel-api' }));

// Estado publico do hotel (manutencao, nome) — usado pelo app e landing
app.get('/status', async (_req, res) => {
  const { data } = await db.from('settings').select('key, value').in('key', ['maintenance', 'hotel']);
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  res.json({ maintenance: map.maintenance || { on: false }, hotel: map.hotel || { name: 'GitHotel' } });
});

app.get('/me', authMiddleware, async (req, res) => {
  const profile = await getOrCreateProfile(req.user);
  res.json({ ...profile, look: profile.look || DEFAULT_LOOK });
});

app.post('/sync', authMiddleware, async (req, res) => {
  const profile = await getOrCreateProfile(req.user);
  const result = await syncGithubActivity(profile);
  const { data } = await db.from('profiles').select('coins').eq('id', profile.id).single();
  res.json({ ...result, coins: data?.coins });
});

// ---------- Catalogo (loja) com busca + categoria + paginacao ----------
app.get('/shop', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const category = (req.query.category || '').toString().trim();
  const type = (req.query.type || '').toString().trim(); // floor | wall
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(120, Math.max(1, parseInt(req.query.limit) || 60));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = db.from('furniture')
    .select('id, name, category, price, sprite, width, height, item_type, rare', { count: 'exact' })
    .eq('active', true);

  if (q) query = query.ilike('name', `%${q}%`);
  if (category) query = query.eq('category', category);
  if (type) query = query.eq('item_type', type);

  query = query.order('rare', { ascending: false }).order('name').range(from, to);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    items: data || [],
    total: count || 0,
    page,
    pages: Math.ceil((count || 0) / limit),
  });
});

// Categorias com contagem (pra sidebar da loja)
app.get('/categories', async (_req, res) => {
  const { data, error } = await db.rpc('furniture_categories');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/buy', authMiddleware, async (req, res) => {
  const profile = await getOrCreateProfile(req.user);
  const { furniture_id } = req.body || {};
  const { data, error } = await db.rpc('buy_furniture', {
    p_user: profile.id, p_furniture: furniture_id,
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/inventory', authMiddleware, async (req, res) => {
  const { data } = await db.from('inventory')
    .select('furniture_id, qty, furniture(name, sprite, category, width, height)')
    .eq('user_id', req.user.sub);
  res.json(data || []);
});

app.get('/room/:login', async (req, res) => {
  const { data: owner } = await db.from('profiles')
    .select('id, github_login, avatar_url, coins, look, room_floor, room_wall')
    .eq('github_login', req.params.login).single();
  if (!owner) return res.status(404).json({ error: 'not_found' });
  const { data: items } = await db.from('room_items')
    .select('id, furniture_id, x, y, rotation, furniture(sprite, width, height, name, fn, fn_params)')
    .eq('user_id', owner.id);
  res.json({ owner: { ...owner, look: owner.look || DEFAULT_LOOK }, items: items || [] });
});

app.get('/leaderboard', async (_req, res) => {
  const { data } = await db.from('profiles')
    .select('github_login, avatar_url, coins, look')
    .order('coins', { ascending: false })
    .limit(30);
  res.json(data || []);
});

// ---------- Noticias do hotel ----------
app.get('/articles', async (_req, res) => {
  const { data } = await db.from('articles')
    .select('id, title, slug, excerpt, cover_url, author, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(12);
  res.json(data || []);
});

app.get('/articles/:slug', async (req, res) => {
  const { data } = await db.from('articles')
    .select('*').eq('slug', req.params.slug).eq('published', true).single();
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

// ---------- Furni 3D (Nitro) ---------- (CORS aberto: dados publicos)
app.get('/furni/:cls/data', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const f = await getFurni(req.params.cls);
  if (!f || !f.ok) return res.status(404).json({ ok: false });
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ ok: true, data: f.json, sheet: `/furni/${safeClass(req.params.cls)}/sheet.png` });
});

// Spritesheet PNG extraído do .nitro
app.get('/furni/:cls/sheet.png', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const f = await getFurni(req.params.cls);
  if (!f || !f.ok) return res.status(404).end();
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(f.png);
});

// Existe modelo 3D pra este classname?
app.get('/furni/:cls/check', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const f = await getFurni(req.params.cls);
  res.json({ ok: !!(f && f.ok), dirs: f?.ok ? furniDirs(f.json) : [] });
});

function furniDirs(json) {
  try {
    const v = json.visualizations.find(v => v.size === 64) || json.visualizations[0];
    return Object.keys(v.directions || { 0: {} }).map(Number).sort((a, b) => a - b);
  } catch { return [0]; }
}

// ---------- Economia: pacotes + resgate de codigo ----------
app.get('/packages', async (_req, res) => {
  const { data } = await db.from('coin_packages').select('*').eq('active', true).order('sort');
  res.json(data || []);
});

app.post('/redeem', authMiddleware, async (req, res) => {
  const profile = await getOrCreateProfile(req.user);
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  if (!code) return res.json({ ok: false, error: 'invalid' });
  const { data, error } = await db.rpc('redeem_code', { p_user: profile.id, p_code: code });
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json(data);
});

// ---------- Navegador de quartos publicos ----------
app.get('/rooms', async (_req, res) => {
  const { data } = await db.rpc('public_rooms');
  res.json(data || []);
});

// Quem esta online agora (presenca via sockets)
let onlineCount = 0;
app.get('/online', (_req, res) => res.json({ online: onlineCount }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin } });

io.use(async (socket, next) => {
  try {
    socket.user = await verifySupabaseJWT(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', async (socket) => {
  const profile = await getOrCreateProfile(socket.user);
  if (profile.banned) { socket.emit('banned'); return socket.disconnect(true); }
  socket.data.login = profile.github_login;
  socket.data.look = profile.look || DEFAULT_LOOK;
  socket.data.dir = 2;
  onlineCount++;
  io.emit('hotel:online', { online: onlineCount });

  socket.on('room:join', async (roomLogin) => {
    for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
    socket.join(roomLogin);
    socket.data.room = roomLogin;

    const sockets = await io.in(roomLogin).fetchSockets();
    const players = sockets.map((s) => ({
      login: s.data.login, look: s.data.look, x: s.data.x ?? 5, y: s.data.y ?? 5,
      dir: s.data.dir ?? 2, dance: s.data.dance || 0,
    }));
    socket.emit('room:players', players);
    socket.to(roomLogin).emit('player:enter', {
      login: profile.github_login, look: socket.data.look, x: 5, y: 5, dir: 2, dance: 0,
    });
  });

  // movimento: alvo + direcao (cliente faz o tween de andar)
  socket.on('player:move', ({ x, y, dir }) => {
    socket.data.x = x; socket.data.y = y;
    if (dir != null) socket.data.dir = dir;
    if (socket.data.room)
      socket.to(socket.data.room).emit('player:move', { login: profile.github_login, x, y, dir: socket.data.dir });
  });

  // dança / gesto
  socket.on('player:dance', ({ dance }) => {
    socket.data.dance = Number(dance) || 0;
    if (socket.data.room)
      socket.to(socket.data.room).emit('player:dance', { login: profile.github_login, dance: socket.data.dance });
  });

  // editor de piso/parede (só o dono do quarto)
  socket.on('room:decor', async ({ floor, wall }) => {
    if (socket.data.room !== profile.github_login) return;
    const patch = {};
    if (floor) patch.room_floor = String(floor).slice(0, 40);
    if (wall) patch.room_wall = String(wall).slice(0, 40);
    if (!Object.keys(patch).length) return;
    await db.from('profiles').update(patch).eq('id', profile.id);
    io.in(profile.github_login).emit('room:decor', patch);
  });

  socket.on('chat:msg', ({ text }) => {
    if (!socket.data.room || !text) return;
    const clean = String(text).slice(0, 200);
    io.in(socket.data.room).emit('chat:msg', { login: profile.github_login, text: clean, at: Date.now() });
  });

  socket.on('room:place', async ({ furniture_id, x, y, rotation = 0 }) => {
    if (socket.data.room !== profile.github_login) return;
    const { data: inv } = await db.from('inventory')
      .select('qty').eq('user_id', profile.id).eq('furniture_id', furniture_id).single();
    if (!inv || inv.qty < 1) return socket.emit('error:msg', 'item_nao_possuido');

    const { data: item } = await db.from('room_items').insert({
      user_id: profile.id, furniture_id, x, y, rotation,
    }).select('id, furniture_id, x, y, rotation, furniture(sprite, width, height, name)').single();

    // baixa 1 do inventario (some da mochila, vai pro quarto)
    if (inv.qty > 1) await db.from('inventory').update({ qty: inv.qty - 1 }).eq('user_id', profile.id).eq('furniture_id', furniture_id);
    else await db.from('inventory').delete().eq('user_id', profile.id).eq('furniture_id', furniture_id);

    io.in(profile.github_login).emit('room:placed', item);
    socket.emit('inventory:changed');
  });

  // girar mobi (muda a direcao/rotacao)
  socket.on('room:rotate', async ({ id, rotation }) => {
    if (socket.data.room !== profile.github_login) return;
    const r = ((Number(rotation) % 360) + 360) % 360;
    await db.from('room_items').update({ rotation: r }).eq('id', id).eq('user_id', profile.id);
    io.in(profile.github_login).emit('room:rotated', { id, rotation: r });
  });

  // usar furni interativo (ex: GitCoin machine) — credita quem clicou
  socket.on('furni:use', async ({ id }) => {
    const { data: ri } = await db.from('room_items')
      .select('furniture_id, furniture(fn, fn_params, name)').eq('id', id).single();
    if (!ri || !ri.furniture?.fn) return;
    if (ri.furniture.fn === 'coin_machine') {
      const amount = Number(ri.furniture.fn_params?.amount) || 5;
      const cd = Number(ri.furniture.fn_params?.cooldown) || 300;
      const { data } = await db.rpc('use_coin_machine', { p_user: profile.id, p_furni: ri.furniture_id, p_amount: amount, p_cooldown: cd });
      socket.emit('furni:used', { id, name: ri.furniture.name, ...data });
    }
  });

  // guardar mobi de volta na mochila
  socket.on('room:pickup', async ({ id }) => {
    if (socket.data.room !== profile.github_login) return;
    const { data: it } = await db.from('room_items').select('furniture_id').eq('id', id).eq('user_id', profile.id).single();
    if (!it) return;
    await db.from('room_items').delete().eq('id', id).eq('user_id', profile.id);
    const { data: inv } = await db.from('inventory').select('qty').eq('user_id', profile.id).eq('furniture_id', it.furniture_id).single();
    if (inv) await db.from('inventory').update({ qty: inv.qty + 1 }).eq('user_id', profile.id).eq('furniture_id', it.furniture_id);
    else await db.from('inventory').insert({ user_id: profile.id, furniture_id: it.furniture_id, qty: 1 });
    io.in(profile.github_login).emit('room:removed', { id });
    socket.emit('inventory:changed');
  });

  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
    io.emit('hotel:online', { online: onlineCount });
    if (socket.data.room)
      socket.to(socket.data.room).emit('player:leave', { login: profile.github_login });
  });
});

const PORT = process.env.PORT || 3008;
httpServer.listen(PORT, '127.0.0.1', () => console.log(`githotel-api on :${PORT}`));
