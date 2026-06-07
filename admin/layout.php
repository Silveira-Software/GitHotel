<?php
function layout_head($title = 'Admin') {
  $nav = [
    'index.php' => '📊 Dashboard',
    'users.php' => '👤 Usuários',
    'furniture.php' => '🛋️ Mobis',
    'sprites.php' => '🧊 Sprites 3D',
    'articles.php' => '📰 Notícias',
    'codes.php' => '🎟️ Códigos',
    'transactions.php' => '🪙 Transações',
    'settings.php' => '⚙️ Hotel / Manutenção',
  ];
  $cur = basename($_SERVER['PHP_SELF']);
  ?><!DOCTYPE html><html lang="pt-br"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHotel Admin · <?= h($title) ?></title>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a1929;--panel:#14304a;--panel2:#1b3b5a;--border:#2d567f;--blue:#3a8fd4;--blued:#1f6fb2;--yellow:#ffcc2f;--green:#6abe30;--red:#e8503a;--text:#eaf2fb;--muted:#8fb0cf}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:linear-gradient(180deg,#0a1929,#081521);color:var(--text);min-height:100vh}
a{color:var(--blue);text-decoration:none}
.layout{display:flex;min-height:100vh}
.side{width:230px;background:#0c2236;border-right:2px solid var(--border);padding:16px 10px;position:sticky;top:0;height:100vh}
.logo{font-family:'Press Start 2P';color:var(--yellow);font-size:14px;text-shadow:2px 2px 0 #b3760a;padding:8px 10px 18px}
.side a{display:block;color:var(--text);font-weight:600;padding:10px 12px;border-radius:8px;margin-bottom:3px}
.side a:hover{background:rgba(255,255,255,.06)}
.side a.active{background:var(--blued);color:#fff}
.side .logout{position:absolute;bottom:16px;width:206px;color:var(--muted)}
.main{flex:1;padding:24px 28px;max-width:1100px}
h1{font-size:22px;margin-bottom:4px}.sub{color:var(--muted);margin-bottom:20px;font-size:14px}
.card{background:var(--panel);border:2px solid var(--border);border-radius:14px;box-shadow:0 6px 0 rgba(0,0,0,.25);margin-bottom:20px}
.card-h{background:linear-gradient(180deg,var(--panel2),var(--panel));border-bottom:2px solid var(--border);border-radius:12px 12px 0 0;padding:12px 16px;font-weight:800}
.card-b{padding:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
.stat{background:var(--panel2);border:2px solid var(--border);border-radius:12px;padding:16px}
.stat b{font-size:30px;display:block;color:var(--yellow)}
.stat span{font-size:13px;color:var(--muted)}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--border);font-size:14px}
th{color:var(--muted);font-size:12px;text-transform:uppercase}
.btn{background:linear-gradient(180deg,var(--green),#4f9626);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 2px 0 #3c7a1c}
.btn:active{transform:translateY(1px)}
.btn-blue{background:linear-gradient(180deg,var(--blue),var(--blued));box-shadow:0 2px 0 #15578f}
.btn-red{background:linear-gradient(180deg,#ef6a55,#c8402b);box-shadow:0 2px 0 #9c2c1b}
.btn-ghost{background:var(--panel2);box-shadow:0 2px 0 rgba(0,0,0,.3)}
.input{background:#0a1c2e;border:2px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:14px}
.input:focus{outline:none;border-color:var(--blue)}
.flash{background:var(--green);color:#fff;padding:12px 16px;border-radius:10px;margin-bottom:16px;font-weight:700}
.tag{font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px}
.tag-on{background:var(--green)}.tag-off{background:#555}.tag-ban{background:var(--red)}
.avatar{height:34px;image-rendering:pixelated;vertical-align:middle}
form.inline{display:inline}
.pill{display:inline-flex;align-items:center;gap:6px;background:#0a1c2e;border:1px solid var(--border);border-radius:999px;padding:4px 10px;font-weight:700}
</style></head><body><div class="layout">
<nav class="side">
  <div class="logo">GitHotel<br>ADMIN</div>
  <?php foreach ($nav as $f => $label): ?>
    <a href="/<?= $f ?>" class="<?= $cur === $f ? 'active' : '' ?>"><?= $label ?></a>
  <?php endforeach; ?>
  <a href="https://app.githotel.site" target="_blank" style="color:var(--muted)">↗ Ver o hotel</a>
  <a class="logout" href="/logout.php">🚪 Sair</a>
</nav>
<main class="main">
<?php if ($f = flash()): ?><div class="flash"><?= h($f) ?></div><?php endif; ?>
<?php }
function layout_foot() { ?></main></div></body></html><?php }
