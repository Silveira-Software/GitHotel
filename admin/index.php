<?php
require __DIR__ . '/config.php';
require_login();
require __DIR__ . '/layout.php';

$stats = supa('POST', '/rpc/hotel_stats', [])['data'] ?? [];
$online = 0;
$o = @file_get_contents('https://api.githotel.site/online', false, stream_context_create(['http' => ['timeout' => 2]]));
if ($o) { $online = json_decode($o, true)['online'] ?? 0; }
$maint = setting_get('maintenance', ['on' => false]);
$recentTx = supa_get('/transactions?select=amount,reason,created_at,profiles(github_login)&order=created_at.desc&limit=8');
$topUsers = supa_get('/profiles?select=github_login,coins,look&order=coins.desc&limit=5');

layout_head('Dashboard');
?>
<h1>📊 Dashboard</h1>
<div class="sub">Visão geral do GitHotel</div>

<?php if (!empty($maint['on'])): ?>
  <div class="flash" style="background:var(--red)">🚧 Hotel em MANUTENÇÃO — usuários não conseguem entrar. <a href="/settings.php" style="color:#fff;text-decoration:underline">Gerenciar</a></div>
<?php endif; ?>

<div class="grid" style="margin-bottom:20px">
  <div class="stat"><b><?= (int)($stats['users'] ?? 0) ?></b><span>devs cadastrados</span></div>
  <div class="stat"><b style="color:var(--green)"><?= (int)$online ?></b><span>online agora</span></div>
  <div class="stat"><b><?= number_format($stats['total_coins'] ?? 0, 0, ',', '.') ?></b><span>moedas no hotel</span></div>
  <div class="stat"><b><?= number_format($stats['furni'] ?? 0, 0, ',', '.') ?></b><span>mobis no catálogo</span></div>
  <div class="stat"><b><?= (int)($stats['rooms_decorated'] ?? 0) ?></b><span>quartos decorados</span></div>
  <div class="stat"><b style="color:var(--red)"><?= (int)($stats['banned'] ?? 0) ?></b><span>banidos</span></div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
  <div class="card">
    <div class="card-h">🪙 Últimas transações</div>
    <div class="card-b" style="padding:0">
      <table>
        <tr><th>Dev</th><th>Motivo</th><th>Valor</th></tr>
        <?php foreach ($recentTx as $t): ?>
          <tr>
            <td><?= h($t['profiles']['github_login'] ?? '—') ?></td>
            <td><?= h($t['reason']) ?></td>
            <td style="color:<?= ($t['amount'] ?? 0) < 0 ? 'var(--red)' : 'var(--green)' ?>;font-weight:700"><?= ($t['amount'] > 0 ? '+' : '') . (int)$t['amount'] ?></td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$recentTx): ?><tr><td colspan="3" style="color:var(--muted)">Sem transações ainda.</td></tr><?php endif; ?>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-h">🏆 Top devs</div>
    <div class="card-b" style="padding:0">
      <table>
        <?php foreach ($topUsers as $i => $u): ?>
          <tr>
            <td style="width:30px;color:var(--yellow);font-weight:800"><?= $i + 1 ?></td>
            <td><img class="avatar" src="https://www.habbo.com/habbo-imaging/avatarimage?figure=<?= urlencode($u['look'] ?? 'hd-180-1.ch-255-66.lg-280-110') ?>&size=s&headonly=1" alt=""> <?= h($u['github_login']) ?></td>
            <td style="color:var(--yellow);font-weight:700">🪙 <?= (int)$u['coins'] ?></td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$topUsers): ?><tr><td style="color:var(--muted)">Ninguém ainda.</td></tr><?php endif; ?>
      </table>
    </div>
  </div>
</div>
<?php layout_foot(); ?>
