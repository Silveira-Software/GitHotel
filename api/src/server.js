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
    .select('id, name, category, price, sprite, width, height, item_type, rare, description', { count: 'exact' })
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

app.get('/room/:key', async (req, res) => {
  const key = req.params.key;
  // sala oficial?
  const { data: room } = await db.from('rooms').select('*').eq('slug', key).maybeSingle();
  if (room) {
    const { data: items } = await db.from('official_room_items')
      .select('id, furniture_id, x, y, rotation, furniture(sprite, width, height, name, fn, fn_params)')
      .eq('room_slug', key);
    return res.json({
      owner: { github_login: key, official: true, room_floor: room.floor, room_wall: room.wall },
      room: { name: room.name, descr: room.descr, w: room.w, h: room.h, official: true },
      items: items || [],
    });
  }
  // quarto pessoal
  const { data: owner } = await db.from('profiles')
    .select('id, github_login, avatar_url, coins, look, room_floor, room_wall')
    .eq('github_login', key).maybeSingle();
  if (!owner) return res.status(404).json({ error: 'not_found' });
  const { data: items } = await db.from('room_items')
    .select('id, furniture_id, x, y, rotation, furniture(sprite, width, height, name, fn, fn_params)')
    .eq('user_id', owner.id);
  res.json({ owner: { ...owner, look: owner.look || DEFAULT_LOOK }, room: { name: `Quarto de ${owner.github_login}`, w: 11, h: 11 }, items: items || [] });
});

// Salvar visual do personagem
app.post('/look', authMiddleware, async (req, res) => {
  const profile = await getOrCreateProfile(req.user);
  const look = String((req.body || {}).look || '').slice(0, 200).trim();
  if (!look) return res.json({ ok: false });
  await db.from('profiles').update({ look }).eq('id', profile.id);
  res.json({ ok: true, look });
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

// ---------- Navegador de quartos (oficiais + dos devs) ----------
app.get('/rooms', async (_req, res) => {
  const { data: official } = await db.from('rooms').select('slug, name, descr, w, h, floor, sort').order('sort');
  const { data: user } = await db.rpc('public_rooms');
  res.json({ official: official || [], user: user || [] });
});

async function profileByLogin(login) {
  const { data } = await db.from('profiles').select('id, github_login, look, coins, banned').eq('github_login', login).maybeSingle();
  return data;
}
async function profilesByIds(ids) {
  if (!ids.length) return {};
  const { data } = await db.from('profiles').select('id, github_login, look, coins').in('id', ids);
  return Object.fromEntries((data || []).map(p => [p.id, p]));
}

// ---------- Amigos ----------
app.get('/friends', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const { data: acc } = await db.from('friendships').select('friend_id').eq('user_id', me.id).eq('status', 'accepted');
  const { data: inc } = await db.from('friendships').select('user_id').eq('friend_id', me.id).eq('status', 'pending');
  const { data: out } = await db.from('friendships').select('friend_id').eq('user_id', me.id).eq('status', 'pending');
  const ids = [...(acc || []).map(r => r.friend_id), ...(inc || []).map(r => r.user_id), ...(out || []).map(r => r.friend_id)];
  const pmap = await profilesByIds(ids);
  res.json({
    friends: (acc || []).map(r => pmap[r.friend_id]).filter(Boolean),
    requests: (inc || []).map(r => pmap[r.user_id]).filter(Boolean),
    pending: (out || []).map(r => pmap[r.friend_id]).filter(Boolean),
  });
});
app.post('/friends/request', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const t = await profileByLogin(String((req.body || {}).login || '').trim());
  if (!t || t.id === me.id) return res.json({ ok: false, error: 'not_found' });
  await db.from('friendships').upsert({ user_id: me.id, friend_id: t.id, status: 'pending' }, { onConflict: 'user_id,friend_id', ignoreDuplicates: true });
  io.to('user:' + t.github_login).emit('friend:request', { from: me.github_login });
  res.json({ ok: true });
});
app.post('/friends/accept', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const t = await profileByLogin(String((req.body || {}).login || '').trim());
  if (!t) return res.json({ ok: false });
  await db.from('friendships').update({ status: 'accepted' }).eq('user_id', t.id).eq('friend_id', me.id);
  await db.from('friendships').upsert({ user_id: me.id, friend_id: t.id, status: 'accepted' }, { onConflict: 'user_id,friend_id' });
  io.to('user:' + t.github_login).emit('friend:accepted', { by: me.github_login });
  res.json({ ok: true });
});
app.post('/friends/remove', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const t = await profileByLogin(String((req.body || {}).login || '').trim());
  if (!t) return res.json({ ok: false });
  await db.from('friendships').delete().or(`and(user_id.eq.${me.id},friend_id.eq.${t.id}),and(user_id.eq.${t.id},friend_id.eq.${me.id})`);
  res.json({ ok: true });
});

// ---------- DMs ----------
app.get('/dms/:login', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const t = await profileByLogin(req.params.login);
  if (!t) return res.json([]);
  const { data } = await db.from('dms')
    .select('id, from_id, to_id, body, created_at')
    .or(`and(from_id.eq.${me.id},to_id.eq.${t.id}),and(from_id.eq.${t.id},to_id.eq.${me.id})`)
    .order('created_at').limit(100);
  await db.from('dms').update({ read: true }).eq('from_id', t.id).eq('to_id', me.id).eq('read', false);
  res.json((data || []).map(m => ({ ...m, mine: m.from_id === me.id })));
});
app.post('/dms', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const { to, body } = req.body || {};
  const t = await profileByLogin(String(to || '').trim());
  const text = String(body || '').slice(0, 500).trim();
  if (!t || !text) return res.json({ ok: false });
  const { data } = await db.from('dms').insert({ from_id: me.id, to_id: t.id, body: text }).select('id, created_at').single();
  io.to('user:' + t.github_login).emit('dm:new', { from: me.github_login, body: text, at: data?.created_at });
  res.json({ ok: true });
});
app.get('/dms', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const { count } = await db.from('dms').select('id', { count: 'exact', head: true }).eq('to_id', me.id).eq('read', false);
  res.json({ unread: count || 0 });
});

// ---------- Marketplace ----------
app.get('/market', async (_req, res) => {
  const { data } = await db.from('market_listings')
    .select('id, price, created_at, furniture_id, furniture(name, sprite, category, rare), seller:profiles!seller_id(github_login, look)')
    .eq('status', 'active').order('created_at', { ascending: false }).limit(80);
  res.json(data || []);
});
app.get('/market/mine', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const { data } = await db.from('market_listings').select('id, price, status, furniture_id, furniture(name, sprite)').eq('seller_id', me.id).order('created_at', { ascending: false }).limit(50);
  res.json(data || []);
});
app.post('/market/list', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const { furniture_id, price } = req.body || {};
  const { data } = await db.rpc('market_list', { p_seller: me.id, p_furni: furniture_id, p_price: parseInt(price) || 0 });
  res.json(data);
});
app.post('/market/buy', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const { data } = await db.rpc('market_buy', { p_buyer: me.id, p_listing: (req.body || {}).listing_id });
  res.json(data);
});
app.post('/market/cancel', authMiddleware, async (req, res) => {
  const me = await getOrCreateProfile(req.user);
  const { data } = await db.rpc('market_cancel', { p_seller: me.id, p_listing: (req.body || {}).listing_id });
  res.json(data);
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
  socket.join('user:' + profile.github_login);   // canal pessoal (DM/amigos)
  onlineCount++;
  io.emit('hotel:online', { online: onlineCount });

  socket.on('room:join', async (roomLogin) => {
    for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
    socket.join(roomLogin);
    socket.data.room = roomLogin;

    const sockets = await io.in(roomLogin).fetchSockets();
    const players = sockets.map((s) => ({
      login: s.data.login, look: s.data.look, x: s.data.x ?? 5, y: s.data.y ?? 5,
      dir: s.data.dir ?? 2, dance: s.data.dance || 0, sit: s.data.sit || false,
      action: s.data.action || 'std', gesture: s.data.gesture || 'nrm',
    }));
    socket.emit('room:players', players);
    socket.to(roomLogin).emit('player:enter', {
      login: profile.github_login, look: socket.data.look, x: 5, y: 5, dir: 2, dance: 0, sit: false, action: 'std', gesture: 'nrm',
    });
  });

  // movimento: alvo + direcao + sentado (cliente faz o tween de andar)
  socket.on('player:move', ({ x, y, dir, sit }) => {
    socket.data.x = x; socket.data.y = y;
    if (dir != null) socket.data.dir = dir;
    socket.data.sit = !!sit;
    if (socket.data.room)
      socket.to(socket.data.room).emit('player:move', { login: profile.github_login, x, y, dir: socket.data.dir, sit: socket.data.sit });
  });

  // poses: action (wav/respect/lay/std), gesture (sml/sad/agr/srp/nrm), dance (0-4)
  socket.on('player:pose', ({ action, gesture, dance }) => {
    if (action !== undefined) socket.data.action = action;
    if (gesture !== undefined) socket.data.gesture = gesture;
    if (dance !== undefined) socket.data.dance = Number(dance) || 0;
    if (socket.data.room)
      socket.to(socket.data.room).emit('player:pose', { login: profile.github_login, action: socket.data.action, gesture: socket.data.gesture, dance: socket.data.dance });
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
    let { data: ri } = await db.from('room_items')
      .select('furniture_id, furniture(fn, fn_params, name)').eq('id', id).maybeSingle();
    if (!ri) ({ data: ri } = await db.from('official_room_items')
      .select('furniture_id, furniture(fn, fn_params, name)').eq('id', id).maybeSingle());
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
