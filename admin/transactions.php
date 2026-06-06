<?php
require __DIR__ . '/config.php';
require_login();
require __DIR__ . '/layout.php';

$page = max(1, (int)($_GET['page'] ?? 1));
$per = 50;
$from = ($page - 1) * $per;
$tx = supa_get("/transactions?select=amount,reason,meta,created_at,profiles(github_login)&order=created_at.desc&limit=$per&offset=$from");

layout_head('Transações');
?>
<h1>🪙 Transações</h1>
<div class="sub">Auditoria de todas as moedas creditadas e gastas</div>

<div class="card"><div class="card-b" style="padding:0">
<table>
  <tr><th>Quando</th><th>Dev</th><th>Motivo</th><th>Detalhe</th><th>Valor</th></tr>
  <?php foreach ($tx as $t): ?>
  <tr>
    <td style="color:var(--muted);font-size:12px"><?= date('d/m/Y H:i', strtotime($t['created_at'])) ?></td>
    <td><?= h($t['profiles']['github_login'] ?? '—') ?></td>
    <td><?= h($t['reason']) ?></td>
    <td style="color:var(--muted);font-size:12px"><?= h(is_array($t['meta']) ? json_encode($t['meta'], JSON_UNESCAPED_SLASHES) : ($t['meta'] ?? '')) ?></td>
    <td style="color:<?= ($t['amount'] ?? 0) < 0 ? 'var(--red)' : 'var(--green)' ?>;font-weight:800"><?= ($t['amount'] > 0 ? '+' : '') . (int)$t['amount'] ?></td>
  </tr>
  <?php endforeach; ?>
  <?php if (!$tx): ?><tr><td colspan="5" style="color:var(--muted)">Nada por aqui.</td></tr><?php endif; ?>
</table>
</div></div>

<div style="display:flex;gap:8px;justify-content:center">
  <?php if ($page > 1): ?><a class="btn btn-ghost" href="?page=<?= $page - 1 ?>">← anterior</a><?php endif; ?>
  <span class="pill">página <?= $page ?></span>
  <?php if (count($tx) === $per): ?><a class="btn btn-ghost" href="?page=<?= $page + 1 ?>">próxima →</a><?php endif; ?>
</div>
<?php layout_foot(); ?>
