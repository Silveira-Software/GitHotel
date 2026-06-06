<?php
require __DIR__ . '/config.php';
require_login();
require __DIR__ . '/layout.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  csrf_check();
  $id = $_POST['id'] ?? '';
  $act = $_POST['act'] ?? '';
  if ($id) {
    if ($act === 'coins') {
      $v = max(0, (int)($_POST['coins'] ?? 0));
      supa_patch('/profiles?id=eq.' . urlencode($id), ['coins' => $v]);
      admin_log('set_coins', $id, ['coins' => $v]);
      flash("Saldo atualizado para $v 🪙");
    } elseif ($act === 'add') {
      $delta = (int)($_POST['delta'] ?? 0);
      $cur = supa_get('/profiles?id=eq.' . urlencode($id) . '&select=coins');
      $new = max(0, (int)($cur[0]['coins'] ?? 0) + $delta);
      supa_patch('/profiles?id=eq.' . urlencode($id), ['coins' => $new]);
      admin_log('add_coins', $id, ['delta' => $delta]);
      flash(($delta >= 0 ? '+' : '') . "$delta 🪙 aplicados");
    } elseif ($act === 'ban') {
      supa_patch('/profiles?id=eq.' . urlencode($id), ['banned' => true]);
      admin_log('ban', $id); flash('Usuário banido.');
    } elseif ($act === 'unban') {
      supa_patch('/profiles?id=eq.' . urlencode($id), ['banned' => false]);
      admin_log('unban', $id); flash('Usuário desbanido.');
    }
  }
  header('Location: /users.php' . (!empty($_POST['q']) ? '?q=' . urlencode($_POST['q']) : '')); exit;
}

$q = trim($_GET['q'] ?? '');
$path = '/profiles?select=id,github_login,coins,banned,look,created_at,last_synced_at&order=coins.desc&limit=100';
if ($q) $path .= '&github_login=ilike.*' . urlencode($q) . '*';
$users = supa_get($path);

layout_head('Usuários');
?>
<h1>👤 Usuários</h1>
<div class="sub">Gerencie saldo, banimentos e veja a atividade dos devs</div>

<form method="get" style="margin-bottom:16px;display:flex;gap:8px">
  <input class="input" name="q" value="<?= h($q) ?>" placeholder="🔎 buscar por login do GitHub…" style="max-width:320px">
  <button class="btn btn-blue">Buscar</button>
  <?php if ($q): ?><a class="btn btn-ghost" href="/users.php">Limpar</a><?php endif; ?>
</form>

<div class="card"><div class="card-b" style="padding:0">
<table>
  <tr><th>Dev</th><th>Saldo</th><th>Status</th><th>Último sync</th><th style="width:340px">Ações</th></tr>
  <?php foreach ($users as $u): ?>
  <tr>
    <td>
      <img class="avatar" src="https://www.habbo.com/habbo-imaging/avatarimage?figure=<?= urlencode($u['look'] ?? 'hd-180-1.ch-255-66.lg-280-110') ?>&size=s&headonly=1" alt="">
      <b><?= h($u['github_login']) ?></b>
    </td>
    <td style="color:var(--yellow);font-weight:800">🪙 <?= (int)$u['coins'] ?></td>
    <td><?= !empty($u['banned']) ? '<span class="tag tag-ban">BANIDO</span>' : '<span class="tag tag-on">ativo</span>' ?></td>
    <td style="color:var(--muted);font-size:12px"><?= $u['last_synced_at'] ? date('d/m H:i', strtotime($u['last_synced_at'])) : '—' ?></td>
    <td>
      <form class="inline" method="post" onsubmit="return true">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="id" value="<?= h($u['id']) ?>"><input type="hidden" name="q" value="<?= h($q) ?>">
        <input type="hidden" name="act" value="coins">
        <input class="input" name="coins" type="number" value="<?= (int)$u['coins'] ?>" style="width:90px;padding:5px">
        <button class="btn" style="padding:6px 10px">salvar</button>
      </form>
      <form class="inline" method="post"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="id" value="<?= h($u['id']) ?>"><input type="hidden" name="q" value="<?= h($q) ?>"><input type="hidden" name="act" value="add"><input type="hidden" name="delta" value="100"><button class="btn btn-ghost" style="padding:6px 9px">+100</button></form>
      <?php if (empty($u['banned'])): ?>
        <form class="inline" method="post" onsubmit="return confirm('Banir <?= h($u['github_login']) ?>?')"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="id" value="<?= h($u['id']) ?>"><input type="hidden" name="q" value="<?= h($q) ?>"><input type="hidden" name="act" value="ban"><button class="btn btn-red" style="padding:6px 10px">banir</button></form>
      <?php else: ?>
        <form class="inline" method="post"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="id" value="<?= h($u['id']) ?>"><input type="hidden" name="q" value="<?= h($q) ?>"><input type="hidden" name="act" value="unban"><button class="btn" style="padding:6px 10px">desbanir</button></form>
      <?php endif; ?>
    </td>
  </tr>
  <?php endforeach; ?>
  <?php if (!$users): ?><tr><td colspan="5" style="color:var(--muted)">Nenhum usuário<?= $q ? ' pra "' . h($q) . '"' : '' ?>.</td></tr><?php endif; ?>
</table>
</div></div>
<?php layout_foot(); ?>
