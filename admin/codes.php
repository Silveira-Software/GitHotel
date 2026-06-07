<?php
require __DIR__ . '/config.php';
require_login();
require __DIR__ . '/layout.php';

function gen_code() {
  $a = strtoupper(bin2hex(random_bytes(2)));
  $b = strtoupper(bin2hex(random_bytes(2)));
  return "GH-$a-$b";
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  csrf_check();
  $count = max(1, min(100, (int)($_POST['count'] ?? 1)));
  $amount = max(1, (int)($_POST['amount'] ?? 100));
  $batch = 'lote-' . date('Ymd-His');
  $rows = [];
  for ($i = 0; $i < $count; $i++) $rows[] = ['code' => gen_code(), 'amount' => $amount, 'batch' => $batch];
  supa_post('/credit_codes', $rows);
  admin_log('codes_generate', $batch, ['count' => $count, 'amount' => $amount]);
  flash("$count códigos de $amount 🪙 gerados ($batch).");
  header('Location: /codes.php'); exit;
}

$codes = supa_get('/credit_codes?select=code,amount,batch,used_by,used_at,created_at&order=created_at.desc&limit=80');

layout_head('Códigos de crédito');
?>
<h1>🎟️ Códigos de crédito</h1>
<div class="sub">Gere códigos resgatáveis pelos devs na aba “Sacola → Resgatar código”</div>

<div style="display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start">
  <div class="card">
    <div class="card-h">➕ Gerar lote</div>
    <div class="card-b">
      <form method="post" style="display:flex;flex-direction:column;gap:10px">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
        <label style="font-size:13px;color:var(--muted)">Quantidade (máx 100)</label>
        <input class="input" name="count" type="number" value="10" min="1" max="100">
        <label style="font-size:13px;color:var(--muted)">Moedas por código</label>
        <input class="input" name="amount" type="number" value="100" min="1">
        <button class="btn">Gerar</button>
      </form>
    </div>
  </div>

  <div class="card"><div class="card-b" style="padding:0">
    <table>
      <tr><th>Código</th><th>Valor</th><th>Status</th><th>Lote</th></tr>
      <?php foreach ($codes as $c): ?>
      <tr>
        <td><code style="font-size:14px;color:var(--text)"><?= h($c['code']) ?></code></td>
        <td style="color:var(--yellow);font-weight:700">🪙 <?= (int)$c['amount'] ?></td>
        <td><?= $c['used_by'] ? '<span class="tag tag-off">usado</span>' : '<span class="tag tag-on">livre</span>' ?></td>
        <td style="color:var(--muted);font-size:12px"><?= h($c['batch']) ?></td>
      </tr>
      <?php endforeach; ?>
      <?php if (!$codes): ?><tr><td colspan="4" style="color:var(--muted)">Nenhum código ainda.</td></tr><?php endif; ?>
    </table>
  </div></div>
</div>
<?php layout_foot(); ?>
