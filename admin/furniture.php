<?php
require __DIR__ . '/config.php';
require_login();
require __DIR__ . '/layout.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  csrf_check();
  $id = $_POST['id'] ?? '';
  $act = $_POST['act'] ?? '';
  if ($id) {
    if ($act === 'price') {
      supa_patch('/furniture?id=eq.' . urlencode($id), ['price' => max(0, (int)$_POST['price'])]);
      admin_log('set_price', $id, ['price' => (int)$_POST['price']]); flash('Preço atualizado.');
    } elseif ($act === 'toggle') {
      supa_patch('/furniture?id=eq.' . urlencode($id), ['active' => $_POST['active'] === '1']);
      flash($_POST['active'] === '1' ? 'Mobi ativado.' : 'Mobi desativado.');
    } elseif ($act === 'rare') {
      supa_patch('/furniture?id=eq.' . urlencode($id), ['rare' => $_POST['rare'] === '1']);
      flash('Raridade atualizada.');
    } elseif ($act === 'fn') {
      supa_patch('/furniture?id=eq.' . urlencode($id), ['fn' => 'coin_machine', 'fn_params' => ['amount' => max(1, (int)($_POST['amount'] ?? 5)), 'cooldown' => max(10, (int)($_POST['cooldown'] ?? 300))]]);
      admin_log('furni_fn', $id, ['fn' => 'coin_machine']); flash('Função GitCoin ativada neste mobi.');
    } elseif ($act === 'fnclear') {
      supa_patch('/furniture?id=eq.' . urlencode($id), ['fn' => null]);
      flash('Função removida.');
    }
  }
  $qs = http_build_query(array_filter(['q' => $_POST['q'] ?? '', 'cat' => $_POST['cat'] ?? '']));
  header('Location: /furniture.php' . ($qs ? "?$qs" : '')); exit;
}

$q = trim($_GET['q'] ?? '');
$cat = trim($_GET['cat'] ?? '');
$cats = supa('POST', '/rpc/furniture_categories', [])['data'] ?? [];
$path = '/furniture?select=id,name,category,price,sprite,active,rare,item_type,fn,fn_params&order=name.asc&limit=80';
if ($q) $path .= '&name=ilike.*' . urlencode($q) . '*';
if ($cat) $path .= '&category=eq.' . urlencode($cat);
$items = supa_get($path);

layout_head('Mobis');
?>
<h1>🛋️ Catálogo de mobis</h1>
<div class="sub">Ajuste preços, ative/desative e marque raros (<?= number_format(array_sum(array_column($cats,'n')),0,',','.') ?> itens)</div>

<form method="get" style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
  <input class="input" name="q" value="<?= h($q) ?>" placeholder="🔎 buscar mobi…" style="max-width:280px">
  <select class="input" name="cat" onchange="this.form.submit()">
    <option value="">Todas categorias</option>
    <?php foreach ($cats as $c): ?>
      <option value="<?= h($c['category']) ?>" <?= $cat === $c['category'] ? 'selected' : '' ?>><?= h($c['category']) ?> (<?= $c['n'] ?>)</option>
    <?php endforeach; ?>
  </select>
  <button class="btn btn-blue">Buscar</button>
</form>

<div class="card"><div class="card-b" style="padding:0">
<table>
  <tr><th>Mobi</th><th>Categoria</th><th>Preço</th><th>Status</th><th>Função</th><th>Ações</th></tr>
  <?php foreach ($items as $it): ?>
  <tr>
    <td><img src="<?= h($it['sprite']) ?>" style="width:34px;height:34px;object-fit:contain;image-rendering:pixelated;vertical-align:middle" onerror="this.style.opacity=.2"> <?= h($it['name']) ?> <?= !empty($it['rare']) ? '<span class="tag tag-ban">RARO</span>' : '' ?></td>
    <td style="color:var(--muted)"><?= h($it['category']) ?> · <?= h($it['item_type']) ?></td>
    <td>
      <form class="inline" method="post"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="id" value="<?= h($it['id']) ?>"><input type="hidden" name="q" value="<?= h($q) ?>"><input type="hidden" name="cat" value="<?= h($cat) ?>"><input type="hidden" name="act" value="price">
      <input class="input" name="price" type="number" value="<?= (int)$it['price'] ?>" style="width:80px;padding:5px"> <button class="btn" style="padding:6px 9px">🪙</button></form>
    </td>
    <td><?= $it['active'] ? '<span class="tag tag-on">ativo</span>' : '<span class="tag tag-off">off</span>' ?></td>
    <td>
      <?php if (!empty($it['fn'])): ?>
        <span class="tag tag-on">💰 <?= h($it['fn_params']['amount'] ?? 5) ?>/<?= h($it['fn_params']['cooldown'] ?? 300) ?>s</span>
        <form class="inline" method="post"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="id" value="<?= h($it['id']) ?>"><input type="hidden" name="q" value="<?= h($q) ?>"><input type="hidden" name="cat" value="<?= h($cat) ?>"><input type="hidden" name="act" value="fnclear"><button class="btn btn-ghost" style="padding:5px 8px">✖</button></form>
      <?php else: ?>
        <form class="inline" method="post" title=" amount / cooldown(s)">
          <input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="id" value="<?= h($it['id']) ?>"><input type="hidden" name="q" value="<?= h($q) ?>"><input type="hidden" name="cat" value="<?= h($cat) ?>"><input type="hidden" name="act" value="fn">
          <input class="input" name="amount" type="number" value="5" style="width:48px;padding:4px" title="moedas">
          <input class="input" name="cooldown" type="number" value="300" style="width:60px;padding:4px" title="cooldown s">
          <button class="btn btn-ghost" style="padding:5px 8px">💰 GitCoin</button>
        </form>
      <?php endif; ?>
    </td>
    <td>
      <form class="inline" method="post"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="id" value="<?= h($it['id']) ?>"><input type="hidden" name="q" value="<?= h($q) ?>"><input type="hidden" name="cat" value="<?= h($cat) ?>"><input type="hidden" name="act" value="toggle"><input type="hidden" name="active" value="<?= $it['active'] ? '0' : '1' ?>"><button class="btn btn-ghost" style="padding:6px 10px"><?= $it['active'] ? 'desativar' : 'ativar' ?></button></form>
      <form class="inline" method="post"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="id" value="<?= h($it['id']) ?>"><input type="hidden" name="q" value="<?= h($q) ?>"><input type="hidden" name="cat" value="<?= h($cat) ?>"><input type="hidden" name="act" value="rare"><input type="hidden" name="rare" value="<?= !empty($it['rare']) ? '0' : '1' ?>"><button class="btn btn-ghost" style="padding:6px 10px"><?= !empty($it['rare']) ? 'não-raro' : 'raro' ?></button></form>
    </td>
  </tr>
  <?php endforeach; ?>
  <?php if (!$items): ?><tr><td colspan="5" style="color:var(--muted)">Nenhum mobi encontrado.</td></tr><?php endif; ?>
</table>
</div></div>
<?php layout_foot(); ?>
