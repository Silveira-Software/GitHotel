import { API } from './client';

// cache de modelos por classname
const models = {};      // cls -> { ready, ok, data, img, frames }
const loading = {};

// extrai o classname base a partir da URL do icone (sprite) ou de um classname
export function classFromSprite(sprite) {
  if (!sprite) return null;
  if (!sprite.startsWith('http')) return sprite.split('*')[0];
  try {
    const file = sprite.split('/').pop();          // {class}_icon.png
    return file.replace('_icon.png', '').replace('.png', '').split('*')[0];
  } catch { return null; }
}

export function getModel(cls) { return cls ? models[cls] : null; }

export function loadModel(cls) {
  if (!cls) return;
  if (models[cls] || loading[cls]) return;
  loading[cls] = true;
  fetch(`${API}/furni/${encodeURIComponent(cls)}/data`)
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d || !d.ok) { models[cls] = { ready: true, ok: false }; return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        models[cls] = { ready: true, ok: true, data: d.data, img, frames: indexFrames(d.data) };
      };
      img.onerror = () => { models[cls] = { ready: true, ok: false }; };
      img.src = `${API}${d.sheet}`;
    })
    .catch(() => { models[cls] = { ready: true, ok: false }; })
    .finally(() => { delete loading[cls]; });
}

// pré-indexa direções disponíveis e nº de frames por (dir)
function indexFrames(data) {
  const cls = data.name;
  const vis = data.visualizations.find(v => v.size === 64) || data.visualizations[0];
  const layerCount = vis.layerCount || 1;
  const dirs = Object.keys(vis.directions || { 0: {} }).map(Number).sort((a, b) => a - b);
  // nº de frames = maior frame index achado nos assets
  let maxFrame = 0;
  for (const k of Object.keys(data.assets)) {
    const m = k.match(/_(\d+)_(\d+)$/);          // ..._{dir}_{frame}
    if (m) maxFrame = Math.max(maxFrame, parseInt(m[2]));
  }
  return { cls, vis, layerCount, dirs, maxFrame };
}

function pickDir(model, wanted) {
  const dirs = model.frames.dirs;
  if (dirs.includes(wanted)) return wanted;
  // direção mais próxima disponível
  let best = dirs[0], bd = 99;
  for (const d of dirs) { const diff = Math.min(Math.abs(d - wanted), 8 - Math.abs(d - wanted)); if (diff < bd) { bd = diff; best = d; } }
  return best;
}

// desenha o furni 3D no contexto, ancorado no ponto (px,py) = centro do tile no chão
// retorna true se desenhou (modelo ok)
export function drawFurni(ctx, model, px, py, { direction = 2, t = 0, scale = 1 } = {}) {
  if (!model || !model.ok) return false;
  const { cls, vis, layerCount, maxFrame } = model.frames;
  const dir = pickDir(model, direction);
  const dirData = (vis.directions && vis.directions[dir]) || {};
  const baseLayers = vis.layers || {};
  const frame = maxFrame > 0 ? Math.floor(t / 150) % (maxFrame + 1) : 0;

  const layers = [];
  for (let L = 0; L < layerCount; L++) {
    const letter = String.fromCharCode(97 + L);
    let name = `${cls}_64_${letter}_${dir}_${frame}`;
    if (!model.data.assets[name]) name = `${cls}_64_${letter}_${dir}_0`;
    if (!model.data.assets[name]) name = `${cls}_64_${letter}_0_0`;
    let a = model.data.assets[name];
    if (!a) continue;
    let frameKey = name, flipH = !!a.flipH, ox = a.x, oy = a.y;
    if (a.source) {                                   // frame compartilhado
      const src = a.source.startsWith(cls) ? a.source : `${cls}_${a.source}`;
      frameKey = src;
    }
    const fr = model.data.spritesheet.frames[`${cls}_${frameKey}`] || model.data.spritesheet.frames[frameKey];
    if (!fr) continue;
    const lp = { ...(baseLayers[L] || {}), ...((dirData.layers || {})[L] || {}) };
    if (lp.alpha === 0 || lp.ignoreMouse === undefined) {}
    layers.push({ rect: fr.frame, ox, oy, z: lp.z ?? L, alpha: (lp.alpha ?? 255) / 255, flipH });
  }
  layers.sort((p, q) => p.z - q.z);

  for (const ly of layers) {
    ctx.globalAlpha = ly.alpha;
    const dx = px - ly.ox * scale;
    const dy = py - ly.oy * scale;
    if (ly.flipH) {
      ctx.save();
      ctx.translate(dx + ly.rect.w * scale, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(model.img, ly.rect.x, ly.rect.y, ly.rect.w, ly.rect.h, 0, 0, ly.rect.w * scale, ly.rect.h * scale);
      ctx.restore();
    } else {
      ctx.drawImage(model.img, ly.rect.x, ly.rect.y, ly.rect.w, ly.rect.h, dx, dy, ly.rect.w * scale, ly.rect.h * scale);
    }
  }
  ctx.globalAlpha = 1;
  return true;
}
