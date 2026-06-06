#!/usr/bin/env bash
# Sincroniza o codigo vivo dos sites CloudPanel para o monorepo e commita.
# Uso: bash /opt/githotel-repo/sync.sh "mensagem do commit"
set -e
REPO=/opt/githotel-repo
MSG="${1:-update: sync $(date +%F_%T)}"

EXCL=(--exclude node_modules --exclude .next --exclude .env --exclude .env.local --exclude .git --exclude logs --exclude '*.log')

rsync -a --delete "${EXCL[@]}" /home/githotel-app/htdocs/app.githotel.site/   "$REPO/app/"
rsync -a --delete "${EXCL[@]}" /home/githotel-api/htdocs/api.githotel.site/   "$REPO/api/"
rsync -a --delete "${EXCL[@]}" /home/githotel-admin/htdocs/admin.githotel.site/ "$REPO/admin/" 2>/dev/null || true
rsync -a --delete "${EXCL[@]}" /home/githotel/htdocs/githotel.site/            "$REPO/landing/"

# remove refs pesados que nao vao pro repo
rm -rf "$REPO/app/refs" 2>/dev/null || true

cd "$REPO"
git add -A
if git diff --cached --quiet; then
  echo "nada novo pra commitar"
else
  git commit -m "$MSG"
  echo "commit feito: $MSG"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git push origin HEAD:main && echo "push ok" || echo "push falhou (token/remote?)"
else
  echo "remote 'origin' nao configurado — rode: git remote add origin <url> (ou use deploy key)"
fi
