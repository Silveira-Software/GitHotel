<?php
require __DIR__ . '/config.php';
require_login();
require __DIR__ . '/layout.php';

function class_from_sprite($s) {
  if (!$s) return '';
  $f = basename(parse_url($s, PHP_URL_PATH) ?: $s);
  $f = preg_replace('/_icon\.png$|\.png$/', '', $f);
  return explode('*', $f)[0];
}

$q = trim($_GET['q'] ?? '');
$path = '/furniture?select=id,name,sprite,category,price&order=name.asc&limit=60';
if ($q) $path .= '&name=ilike.*' . urlencode($q) . '*';
$items = supa_get($path);

layout_head('Sprites 3D');
?>
<h1>🧊 Sprites 3D (Nitro)</h1>
<div class="sub">Puxa o modelo <code>.nitro</code> real do Habbo, converte e renderiza em 3D isométrico animado — igual aparece no quarto</div>

<form method="get" style="margin-bottom:16px;display:flex;gap:8px">
  <input class="input" name="q" value="<?= h($q) ?>" placeholder="🔎 buscar mobi (ex: throne, chair, dragon)…" style="max-width:340px">
  <button class="btn btn-blue">Buscar</button>
</form>

<div style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start">
  <div class="card"><div class="card-b">
    <div id="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px">
      <?php foreach ($items as $it): $cls = class_from_sprite($it['sprite']); ?>
        <div class="sp-cell" data-cls="<?= h($cls) ?>" data-name="<?= h($it['name']) ?>"
          style="background:var(--panel2);border:2px solid var(--border);border-radius:10px;padding:8px;text-align:center;cursor:pointer">
          <img src="<?= h($it['sprite']) ?>" style="width:42px;height:42px;object-fit:contain;image-rendering:pixelated" onerror="this.style.opacity=.2">
          <div style="font-size:10px;color:var(--muted);height:24px;overflow:hidden;margin-top:4px"><?= h($it['name']) ?></div>
        </div>
      <?php endforeach; ?>
      <?php if (!$items): ?><p style="color:var(--muted)">Nenhum mobi.</p><?php endif; ?>
    </div>
  </div></div>

  <div class="card" style="position:sticky;top:16px">
    <div class="card-h">🎬 Preview 3D</div>
    <div class="card-b" style="text-align:center">
      <div id="pvName" style="font-weight:800;margin-bottom:4px">— selecione um mobi —</div>
      <div id="pvCls" style="font-size:12px;color:var(--muted);margin-bottom:10px"></div>
      <div style="background:linear-gradient(180deg,#1b3b5a,#0e2638);border:2px solid var(--border);border-radius:10px;display:grid;place-items:center;height:200px">
        <canvas id="pv" width="160" height="180" style="image-rendering:pixelated"></canvas>
      </div>
      <div id="pvInfo" style="font-size:12px;color:var(--muted);margin:10px 0"></div>
      <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="setDir(0)">↖ 0</button>
        <button class="btn btn-ghost" onclick="setDir(2)">↗ 2</button>
        <button class="btn btn-ghost" onclick="setDir(4)">↘ 4</button>
        <button class="btn btn-ghost" onclick="setDir(6)">↙ 6</button>
      </div>
    </div>
  </div>
</div>

<script>
const APIB = 'https://api.githotel.site';
let cur = null, dir = 2, raf = null, t0 = performance.now();

document.querySelectorAll('.sp-cell').forEach(el => {
  el.onclick = () => loadCls(el.dataset.cls, el.dataset.name);
});

async function loadCls(cls, name) {
  document.getElementById('pvName').textContent = name;
  document.getElementById('pvCls').textContent = cls + '.nitro';
  document.getElementById('pvInfo').textContent = 'carregando…';
  cur = null;
  try {
    const r = await fetch(`${APIB}/furni/${encodeURIComponent(cls)}/data`);
    if (!r.ok) { document.getElementById('pvInfo').innerHTML = '<span style="color:var(--red)">sem modelo 3D no mirror</span>'; return; }
    const d = await r.json();
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      cur = build(d.data, img);
      const vis = cur.vis;
      document.getElementById('pvInfo').innerHTML = `✅ 3D · camadas: ${vis.layerCount} · direções: ${cur.dirs.join(',')}${cur.maxFrame>0?' · animado 🎞️':''}`;
    };
    img.src = APIB + d.sheet;
  } catch (e) { document.getElementById('pvInfo').textContent = 'erro: ' + e.message; }
}

function build(data, img) {
  const vis = (data.visualizations.find(v => v.size === 64)) || data.visualizations[0];
  const dirs = Object.keys(vis.directions || {0:{}}).map(Number).sort((a,b)=>a-b);
  let maxFrame = 0;
  for (const k of Object.keys(data.assets)) { const m = k.match(/_(\d+)_(\d+)$/); if (m) maxFrame = Math.max(maxFrame, +m[2]); }
  return { data, img, vis, dirs, maxFrame, cls: data.name, layerCount: vis.layerCount || 1 };
}
function pickDir(m, w){ if(m.dirs.includes(w))return w; let b=m.dirs[0],bd=99; for(const d of m.dirs){const df=Math.min(Math.abs(d-w),8-Math.abs(d-w)); if(df<bd){bd=df;b=d;}} return b; }

function render() {
  raf = requestAnimationFrame(render);
  const cv = document.getElementById('pv'); const ctx = cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  if (!cur) return;
  const m = cur, d = pickDir(m, dir);
  const dirData = (m.vis.directions && m.vis.directions[d]) || {};
  const baseLayers = m.vis.layers || {};
  const frame = m.maxFrame>0 ? Math.floor((performance.now()-t0)/150) % (m.maxFrame+1) : 0;
  const layers = [];
  for (let L=0; L<m.layerCount; L++){
    const letter = String.fromCharCode(97+L);
    let name = `${m.cls}_64_${letter}_${d}_${frame}`;
    if(!m.data.assets[name]) name = `${m.cls}_64_${letter}_${d}_0`;
    if(!m.data.assets[name]) name = `${m.cls}_64_${letter}_0_0`;
    const a = m.data.assets[name]; if(!a) continue;
    let key = name; if(a.source) key = a.source.startsWith(m.cls)?a.source:`${m.cls}_${a.source}`;
    const fr = m.data.spritesheet.frames[`${m.cls}_${key}`] || m.data.spritesheet.frames[key]; if(!fr) continue;
    const lp = {...(baseLayers[L]||{}),...((dirData.layers||{})[L]||{})};
    layers.push({rect:fr.frame,ox:a.x,oy:a.y,z:lp.z??L,alpha:(lp.alpha??255)/255,flipH:!!a.flipH});
  }
  layers.sort((p,q)=>p.z-q.z);
  // centraliza
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  for(const l of layers){minX=Math.min(minX,-l.ox);minY=Math.min(minY,-l.oy);maxX=Math.max(maxX,-l.ox+l.rect.w);maxY=Math.max(maxY,-l.oy+l.rect.h);}
  const cx = cv.width/2 - (minX+maxX)/2, cy = cv.height/2 - (minY+maxY)/2;
  for(const l of layers){
    ctx.globalAlpha = l.alpha;
    const dx = cx - l.ox, dy = cy - l.oy;
    if(l.flipH){ ctx.save(); ctx.translate(dx+l.rect.w,dy); ctx.scale(-1,1); ctx.drawImage(m.img,l.rect.x,l.rect.y,l.rect.w,l.rect.h,0,0,l.rect.w,l.rect.h); ctx.restore(); }
    else ctx.drawImage(m.img,l.rect.x,l.rect.y,l.rect.w,l.rect.h,dx,dy,l.rect.w,l.rect.h);
  }
  ctx.globalAlpha = 1;
}
function setDir(d){ dir = d; }
render();
</script>
<?php layout_foot(); ?>
