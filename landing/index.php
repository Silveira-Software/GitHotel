<?php
$year = date('Y');
// puxa noticias e online da API (server-side; se falhar, segue sem)
$articles = [];
$online = null;
$ctx = stream_context_create(['http' => ['timeout' => 2]]);
$j = @file_get_contents('https://api.githotel.site/articles', false, $ctx);
if ($j) { $articles = json_decode($j, true) ?: []; }
$o = @file_get_contents('https://api.githotel.site/online', false, $ctx);
if ($o) { $od = json_decode($o, true); $online = $od['online'] ?? null; }
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GitHotel — o Habbo dos devs</title>
<meta name="description" content="Seu quarto pixelado que cresce com seus commits. Login com GitHub, ganhe moedas, compre +13.000 mobis e visite outros devs em tempo real.">
<meta property="og:title" content="GitHotel — o Habbo dos devs">
<meta property="og:description" content="Commits viram moedas. Moedas viram mobis. +13.000 itens do catálogo.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><text y=%2214%22 font-size=%2214%22>🏨</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Inter:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a1929;--panel:#14304a;--panel2:#1b3b5a;--border:#2d567f;--blue:#3a8fd4;--blued:#1f6fb2;--yellow:#ffcc2f;--green:#6abe30;--text:#eaf2fb;--muted:#8fb0cf}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;color:var(--text);background:radial-gradient(1200px 500px at 50% -200px,#1b4a73,transparent 70%),linear-gradient(180deg,#0a1929,#081521);background-attachment:fixed;min-height:100vh}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.logo{font-family:'Press Start 2P';color:var(--yellow);text-shadow:2px 2px 0 #b3760a}
nav{display:flex;justify-content:space-between;align-items:center;padding:18px 0}
.btn{background:linear-gradient(180deg,var(--green),#4f9626);color:#fff;border:none;border-radius:10px;padding:12px 24px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;box-shadow:0 3px 0 #3c7a1c,inset 0 1px 0 rgba(255,255,255,.3)}
.btn:active{transform:translateY(2px)}
.btn-blue{background:linear-gradient(180deg,var(--blue),var(--blued));box-shadow:0 3px 0 #15578f}
.hero{text-align:center;padding:70px 0 40px}
.hero h1{font-size:54px;line-height:1.1;margin-bottom:18px}
.hero h1 .g{color:var(--yellow)}
.hero p{font-size:19px;color:var(--muted);max-width:620px;margin:0 auto 28px}
.stats{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:28px}
.stat{background:var(--panel);border:2px solid var(--border);border-radius:14px;padding:16px 26px;min-width:150px}
.stat b{font-size:28px;display:block;color:var(--yellow)}
.stat span{font-size:13px;color:var(--muted)}
.card{background:var(--panel);border:2px solid var(--border);border-radius:14px;box-shadow:0 6px 0 rgba(0,0,0,.25)}
.card-head{background:linear-gradient(180deg,var(--panel2),var(--panel));border-bottom:2px solid var(--border);border-radius:12px 12px 0 0;padding:14px 18px;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin:24px 0}
.feat{padding:22px}.feat .i{font-size:30px;margin-bottom:10px}.feat h3{margin-bottom:6px}.feat p{color:var(--muted);font-size:14px}
.news{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:18px}
.ncard{background:var(--panel2);border:2px solid var(--border);border-radius:12px;overflow:hidden}
.ncard .cv{height:90px;display:grid;place-items:center;background:#0e2638}.ncard .cv img{height:54px;image-rendering:pixelated}
.ncard .bd{padding:12px}.ncard h4{font-size:14px;margin-bottom:6px}.ncard p{font-size:12px;color:var(--muted)}
.economy{padding:8px 18px 18px}
.economy table{width:100%;border-collapse:collapse}
.economy td{padding:11px 4px;border-bottom:1px solid var(--border)}
.economy td:last-child{text-align:right;font-weight:800;color:var(--yellow)}
footer{text-align:center;color:var(--muted);padding:40px 0;border-top:2px solid var(--border);margin-top:50px}
section{margin:50px 0}
h2.t{margin-bottom:6px}.sub{color:var(--muted);margin-bottom:18px}
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <div class="logo" style="font-size:20px">GitHotel</div>
    <a class="btn btn-blue" href="https://app.githotel.site">Entrar com GitHub</a>
  </nav>

  <section class="hero">
    <h1>O <span class="g">Habbo</span> dos devs</h1>
    <p>Seu quarto pixelado que cresce com seus commits. Conecte o GitHub, ganhe moedas por commits, PRs e stars, e gaste em mais de 13.000 mobis do catálogo clássico.</p>
    <a class="btn" href="https://app.githotel.site">🪙 Começar a jogar</a>
    <div class="stats">
      <div class="stat"><b>13.443</b><span>mobis no catálogo</span></div>
      <div class="stat"><b><?= $online !== null ? (int)$online : '—' ?></b><span>devs online agora</span></div>
      <div class="stat"><b>∞</b><span>quartos pra visitar</span></div>
    </div>
  </section>

  <?php if ($articles): ?>
  <section>
    <div class="card">
      <div class="card-head">📰 Últimas notícias do hotel</div>
      <div class="news">
        <?php foreach (array_slice($articles, 0, 4) as $a): ?>
        <div class="ncard">
          <div class="cv"><?php if (!empty($a['cover_url'])): ?><img src="<?= htmlspecialchars($a['cover_url']) ?>" alt=""><?php endif; ?></div>
          <div class="bd"><h4><?= htmlspecialchars($a['title']) ?></h4><p><?= htmlspecialchars($a['excerpt'] ?? '') ?></p></div>
        </div>
        <?php endforeach; ?>
      </div>
    </div>
  </section>
  <?php endif; ?>

  <section>
    <h2 class="t">Como funciona</h2>
    <p class="sub">Atividade no GitHub vira economia no hotel.</p>
    <div class="grid">
      <div class="card feat"><div class="i">⚡</div><h3>Atividade vira moeda</h3><p>Commit, PR, issue fechada e star recebida creditam moedas automaticamente.</p></div>
      <div class="card feat"><div class="i">🛋️</div><h3>+13.000 mobis</h3><p>O catálogo clássico do Habbo inteiro, com busca e categorias. Compre e decore.</p></div>
      <div class="card feat"><div class="i">👥</div><h3>Multiplayer real</h3><p>Veja devs andando no quarto e visite os quartos da galera ao vivo.</p></div>
      <div class="card feat"><div class="i">🏆</div><h3>Ranking</h3><p>Os devs mais ricos do hotel. Suba no ranking e provoque os amigos.</p></div>
    </div>
  </section>

  <section>
    <div class="card">
      <div class="card-head">🪙 Economia</div>
      <div class="economy">
        <table>
          <tr><td>Commit (PushEvent)</td><td>+1 🪙 <small style="color:var(--muted)">(cap diário)</small></td></tr>
          <tr><td>Pull Request aberto</td><td>+5 🪙</td></tr>
          <tr><td>Pull Request merged</td><td>+20 🪙</td></tr>
          <tr><td>Issue fechada</td><td>+10 🪙</td></tr>
          <tr><td>Star recebida</td><td>+15 🪙</td></tr>
        </table>
      </div>
    </div>
  </section>

  <footer>
    <p>GitHotel © <?= $year ?> · feito com 🪙 por devs que amam pixel art</p>
    <p style="margin-top:8px"><a href="https://app.githotel.site" style="color:var(--blue)">app</a> · <a href="https://api.githotel.site/health" style="color:var(--blue)">api status</a></p>
  </footer>
</div>
</body>
</html>
