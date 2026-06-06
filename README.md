# 🏨 GitHotel

O **Habbo dos devs**: seu quarto pixelado isométrico que cresce com a sua atividade no GitHub.
Commits, PRs, issues e stars viram moedas; moedas compram mobis do **catálogo completo do Habbo (~13.4k itens)**.

🔗 **Live:** [githotel.site](https://githotel.site) · app: [app.githotel.site](https://app.githotel.site) · api: [api.githotel.site](https://api.githotel.site/health)

---

## Stack

| Parte | Tech | Subdomínio | Porta |
|---|---|---|---|
| `landing/` | PHP | githotel.site | php-fpm |
| `app/` | Next.js 14 + Socket.IO client | app.githotel.site | 3007 |
| `api/` | Node + Express + Socket.IO | api.githotel.site | 3008 |
| `admin/` | PHP (housekeeping) | admin.githotel.site | php-fpm |
| `db/` | Supabase (Postgres) | — | — |

Auth: **Supabase Auth (GitHub OAuth)**, tokens verificados por JWKS (ECC P-256).
Moedas/compras: backend com `service_role`, RPC atômica `buy_furniture`. Front nunca credita.

## Features

- 🔐 Login GitHub (Supabase)
- 🪙 Economia: sync de eventos públicos do GitHub → moedas
- 🛒 Catálogo real do Habbo (~13.443 mobis) com busca + categorias + paginação
- 🏨 Quarto isométrico multiplayer (Socket.IO): avatares Habbo, mobis com ícones reais, chat
- 🏆 Ranking de moedas · 📰 Notícias do hotel · 🟢 Online agora

> Avatares e ícones de mobis carregam **client-side** direto do CDN do Habbo
> (`images.habbo.com` / `habbo-imaging`) — o IP do servidor é bloqueado, o do browser não.

## Setup do banco

```bash
# 1. schema
psql "$SUPABASE_PG_URI" -f api/db/schema.sql
# 2. catálogo (gera /tmp/furni.csv a partir do furnidata e faz \copy)
#    furnidata: github.com/Habbobba/JSON-Habbo-Catalog-Generator
python3 api/db/seed_furni.py
psql "$SUPABASE_PG_URI" -c "\copy public.furniture (...) FROM '/tmp/furni.csv' WITH (FORMAT csv, HEADER true)"
```

## Deploy

```bash
# API
cd api && npm install && cp .env.example .env  # preencher
pm2 start ecosystem.config.cjs
# APP
cd app && npm install && cp .env.example .env.local  # preencher
npm run build && pm2 start ecosystem.config.cjs
```

## Sync deste repo (backup)

```bash
bash /opt/githotel-repo/sync.sh "mensagem"
```

---

Créditos de inspiração: [git-city](https://github.com/srizzon/git-city), [Atom CMS](https://github.com/atom-retros/atomcms).
Uso educacional.
