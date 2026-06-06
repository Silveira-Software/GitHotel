<?php
require __DIR__ . '/config.php';
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (($_POST['password'] ?? '') === env('ADMIN_PASSWORD') && env('ADMIN_PASSWORD')) {
    $_SESSION['gh_admin'] = true;
    session_regenerate_id(true);
    $_SESSION['gh_admin'] = true;
    header('Location: /index.php'); exit;
  }
  $err = 'Senha incorreta.';
}
?><!DOCTYPE html><html lang="pt-br"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHotel Admin · Login</title>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:radial-gradient(900px 400px at 50% -150px,#1b4a73,transparent 70%),linear-gradient(180deg,#0a1929,#081521);color:#eaf2fb;min-height:100vh;display:grid;place-items:center}
.box{background:#14304a;border:2px solid #2d567f;border-radius:16px;box-shadow:0 8px 0 rgba(0,0,0,.3);padding:34px;width:340px;text-align:center}
.logo{font-family:'Press Start 2P';color:#ffcc2f;font-size:18px;text-shadow:2px 2px 0 #b3760a;margin-bottom:6px}
p{color:#8fb0cf;font-size:13px;margin-bottom:20px}
input{width:100%;background:#0a1c2e;border:2px solid #2d567f;border-radius:10px;padding:12px;color:#eaf2fb;font-size:15px;margin-bottom:12px}
input:focus{outline:none;border-color:#3a8fd4}
button{width:100%;background:linear-gradient(180deg,#6abe30,#4f9626);color:#fff;border:none;border-radius:10px;padding:13px;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 3px 0 #3c7a1c}
.err{background:#e8503a;color:#fff;padding:10px;border-radius:8px;margin-bottom:12px;font-size:13px}
</style></head><body>
<form class="box" method="post">
  <div class="logo">GitHotel</div>
  <p>Painel administrativo</p>
  <?php if ($err): ?><div class="err"><?= h($err) ?></div><?php endif; ?>
  <input type="password" name="password" placeholder="Senha do admin" autofocus required>
  <button type="submit">Entrar</button>
</form></body></html>
