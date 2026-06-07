-- ============================================================
-- GitHotel — schema Supabase (Postgres)
-- Rode no SQL Editor do Supabase, ou via `supabase db push`.
-- ============================================================

-- Perfis dos devs (1:1 com auth.users do Supabase)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  github_login  text unique not null,
  github_id     bigint unique,
  avatar_url    text,
  coins         bigint not null default 100,        -- saldo de moedas
  last_event_id text,                               -- ultimo evento GitHub processado (cursor)
  last_synced_at timestamptz,
  created_at    timestamptz not null default now()
);

-- Catalogo de mobis (itens da loja). Admin gerencia.
create table if not exists public.furniture (
  id        text primary key,                        -- ex: 'rug_red'
  name      text not null,
  category  text not null default 'misc',            -- floor | wall | seat | deco | rug
  price     int  not null default 50,
  sprite    text not null,                            -- nome/URL do sprite
  width     int  not null default 1,                  -- tamanho em tiles
  height    int  not null default 1,
  active    boolean not null default true,
  created_at timestamptz not null default now()
);

-- Inventario: o que cada dev possui
create table if not exists public.inventory (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  furniture_id text not null references public.furniture(id),
  qty          int  not null default 1,
  primary key (user_id, furniture_id)
);

-- Layout do quarto: mobis posicionados
create table if not exists public.room_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  furniture_id text not null references public.furniture(id),
  x            int  not null,
  y            int  not null,
  rotation     int  not null default 0,              -- 0,90,180,270
  created_at   timestamptz not null default now()
);
create index if not exists room_items_user_idx on public.room_items(user_id);

-- Log de transacoes de moedas (auditoria + anti-fraude)
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     int  not null,                           -- positivo = ganho, negativo = gasto
  reason     text not null,                           -- 'commit' | 'pr_merged' | 'purchase' | ...
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_idx on public.transactions(user_id, created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.inventory   enable row level security;
alter table public.room_items  enable row level security;
alter table public.transactions enable row level security;
alter table public.furniture   enable row level security;

-- Perfis: todos leem (mundo publico), so o dono atualiza visuais nao-sensiveis
create policy "profiles_read_all" on public.profiles for select using (true);
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id);

-- Mobis: catalogo publico para leitura
create policy "furniture_read_all" on public.furniture for select using (active = true);

-- Inventario: dono le o seu
create policy "inventory_self_read" on public.inventory for select using (auth.uid() = user_id);

-- Room items: qualquer um le (para visitar quartos), so o dono mexe
create policy "room_items_read_all" on public.room_items for select using (true);
create policy "room_items_self_write" on public.room_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Transacoes: dono le as suas
create policy "tx_self_read" on public.transactions for select using (auth.uid() = user_id);

-- IMPORTANTE: escrita de coins/transactions/compra eh feita pelo backend (api.)
-- usando a service_role key, que ignora RLS. O cliente NUNCA credita moedas.

-- ============================================================
-- RPC: comprar mobi de forma atomica (debita moeda + adiciona ao inventario)
-- Chamada pelo backend com service_role.
-- ============================================================
create or replace function public.buy_furniture(p_user uuid, p_furniture text)
returns json language plpgsql security definer as $$
declare
  v_price int;
  v_coins bigint;
begin
  select price into v_price from public.furniture where id = p_furniture and active = true;
  if v_price is null then
    return json_build_object('ok', false, 'error', 'furniture_not_found');
  end if;

  select coins into v_coins from public.profiles where id = p_user for update;
  if v_coins < v_price then
    return json_build_object('ok', false, 'error', 'insufficient_coins');
  end if;

  update public.profiles set coins = coins - v_price where id = p_user;

  insert into public.inventory (user_id, furniture_id, qty)
  values (p_user, p_furniture, 1)
  on conflict (user_id, furniture_id) do update set qty = inventory.qty + 1;

  insert into public.transactions (user_id, amount, reason, meta)
  values (p_user, -v_price, 'purchase', json_build_object('furniture', p_furniture));

  return json_build_object('ok', true, 'coins', v_coins - v_price);
end;
$$;

-- ============================================================
-- Seed: alguns mobis iniciais
-- ============================================================
insert into public.furniture (id, name, category, price, sprite, width, height) values
  ('rug_red',    'Tapete vermelho',  'rug',  40,  'rug_red',    2, 2),
  ('chair_wood', 'Cadeira de madeira','seat', 60,  'chair_wood', 1, 1),
  ('plant_fern', 'Samambaia',        'deco', 35,  'plant_fern', 1, 1),
  ('lamp_neon',  'Luminaria neon',   'deco', 120, 'lamp_neon',  1, 1),
  ('sofa_blue',  'Sofa azul',        'seat', 200, 'sofa_blue',  2, 1),
  ('crt_pc',     'PC retro CRT',     'deco', 300, 'crt_pc',     1, 1)
on conflict (id) do nothing;

-- Incremento atomico de moedas (chamado pelo sync do GitHub)
create or replace function public.increment_coins(p_user uuid, p_amount int)
returns void language sql security definer as $$
  update public.profiles set coins = coins + p_amount where id = p_user;
$$;

-- ============================================================
-- v2 (Catalogo Habbo + features de hotel) — aplicado 2026-06
-- ============================================================
alter table public.furniture add column if not exists revision int;
alter table public.furniture add column if not exists item_type text not null default 'floor';
alter table public.furniture add column if not exists furniline text;
alter table public.furniture add column if not exists rare boolean not null default false;
alter table public.furniture add column if not exists description text;
alter table public.profiles  add column if not exists look text;

create extension if not exists pg_trgm;
create index if not exists furniture_name_trgm on public.furniture using gin (name gin_trgm_ops);
create index if not exists furniture_cat_idx   on public.furniture (category);
create index if not exists furniture_price_idx on public.furniture (price);
create index if not exists furniture_type_idx  on public.furniture (item_type);

-- Catalogo real do Habbo (~13.4k mobis) e carregado via db/seed_furni.py -> \copy
-- (furnidata: https://github.com/Habbobba/JSON-Habbo-Catalog-Generator)

create or replace function public.furniture_categories()
returns table(category text, n bigint) language sql stable security definer as $$
  select category, count(*) as n from public.furniture
  where active = true group by category order by n desc;
$$;
grant execute on function public.furniture_categories() to anon, authenticated;

-- Noticias do hotel (estilo Atom CMS "Latest news")
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null, slug text unique, excerpt text, body text,
  cover_url text, author text, published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.articles enable row level security;
drop policy if exists "articles_read" on public.articles;
create policy "articles_read" on public.articles for select using (published = true);

-- ============================================================
-- v3 (Economia + furni interativo + quartos publicos) — 2026-06
-- ============================================================
create table if not exists public.credit_codes (
  code text primary key, amount int not null, batch text,
  used_by uuid references public.profiles(id), used_at timestamptz,
  created_at timestamptz default now()
);
alter table public.credit_codes enable row level security;

create table if not exists public.coin_packages (
  id text primary key, name text not null, coins int not null, bonus int default 0,
  price_cents int not null, currency text default 'BRL', active boolean default true, sort int default 0
);
alter table public.coin_packages enable row level security;
create policy coin_packages_read on public.coin_packages for select using (active = true);

alter table public.profiles add column if not exists banned boolean not null default false;
alter table public.profiles add column if not exists room_floor text default 'floor_wood';
alter table public.profiles add column if not exists room_wall  text default 'wall_blue';
alter table public.furniture add column if not exists fn text;
alter table public.furniture add column if not exists fn_params jsonb default '{}'::jsonb;

create table if not exists public.furni_cooldowns (
  user_id uuid references public.profiles(id), furniture_id text, last_at timestamptz,
  primary key (user_id, furniture_id)
);
alter table public.furni_cooldowns enable row level security;

create table if not exists public.settings (key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz default now());
alter table public.settings enable row level security;
create policy settings_read on public.settings for select using (true);

-- RPCs: redeem_code, use_coin_machine, public_rooms, hotel_stats, furniture_categories
-- (ver corpo completo no histórico do projeto / migrações aplicadas)
