<?php
require __DIR__ . '/config.php';
require_login();
require __DIR__ . '/layout.php';

$FLOORS = ['floor_wood', 'floor_blue', 'floor_grass', 'floor_dark', 'floor_pink', 'floor_sand', 'floor_red', 'floor_white'];
$WALLS = ['wall_blue', 'wall_gray', 'wall_warm', 'wall_dark', 'wall_green', 'wall_pink'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  csrf_check();
  $act = $_POST['act'] ?? '';
  $slug = $_POST['slug'] ?? '';
  if ($act === 'room_create') {
    $s = preg_replace('/[^a-z0-9_]/', '', strtolower($_POST['new_slug'] ?? ''));
    if ($s) { supa_post('/rooms', ['slug' => $s, 'name' => $_POST['new_name'] ?: $s, 'w' => (int)($_POST['new_w'] ?: 11), 'h' => (int)($_POST['new_h'] ?: 11)]); admin_log('room_create', $s); flash("Sala '$s' criada."); $slug = $s; }
  } elseif ($act === 'room_save') {
    supa_patch('/rooms?slug=eq.' . urlencode($slug), ['name' => $_POST['name'], 'descr' => $_POST['descr'], 'floor' => $_POST['floor'], 'wall' => $_POST['wall'], 'w' => (int)$_POST['w'], 'h' => (int)$_POST['h']]);
    flash('Sala salva.');
  } elseif ($act === 'item_add') {
    supa_post('/official_room_items', ['room_slug' => $slug, 'furniture_id' => $_POST['furniture_id'], 'x' => (int)$_POST['x'], 'y' => (int)$_POST['y'], 'rotation' => (int)($_POST['rotation'] ?: 2)]);
    flash('Mobi adicionado.');
  } elseif ($act === 'item_del') {
    supa_delete('/official_room_items?id=eq.' . urlencode($_POST['id']));
    flash('Mobi removido.');
  } elseif ($act === 'item_move') {
    supa_patch('/official_room_items?id=eq.' . urlencode($_POST['id']), ['x' => (int)$_POST['x'], 'y' => (int)$_POST['y'], 'rotation' => (int)$_POST['rotation']]);
    flash('Posição atualizada.');
  }
  header('Location: /rooms.php?room=' . urlencode($slug)); exit;
}

$rooms = supa_get('/rooms?select=slug,name,w,h&order=sort');
$slug = $_GET['room'] ?? ($rooms[0]['slug'] ?? '');
$room = null; $items = []; $found = [];
if ($slug) {
  $r = supa_get('/rooms?slug=eq.' . urlencode($slug));
  $room = $r[0] ?? null;
  $items = supa_get('/official_room_items?select=id,furniture_id,x,y,rotation,furniture(name,sprite)&room_slug=eq.' . urlencode($slug) . '&order=id');
}
$q = trim($_GET['q'] ?? '');
if ($q) $found = supa_get('/furniture?select=id,name,sprite&name=ilike.*' . urlencode($q) . '*&limit=24');

layout_head('Salas');
?>
<h1>🏨 Salas (housekeeping)</h1>
<div class="sub">Crie e decore as salas oficiais do hotel — colocar, mover e remover mobis</div>

<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
  <?php foreach ($rooms as $r): ?>
    <a class="btn <?= $r['slug'] === $slug ? '' : 'btn-ghost' ?>" href="?room=<?= h($r['slug']) ?>"><?= h($r['name']) ?> (<?= $r['w'] ?>×<?= $r['h'] ?>)</a>
  <?php endforeach; ?>
  <form method="post" style="display:flex;gap:6px;align-items:center;margin-left:auto">
    <input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="act" value="room_create">
    <input class="input" name="new_slug" placeholder="slug" style="width:90px">
    <input class="input" name="new_name" placeholder="nome" style="width:120px">
    <input class="input" name="new_w" type="number" value="11" style="width:55px"><input class="input" name="new_h" type="number" value="11" style="width:55px">
    <button class="btn">➕ Nova sala</button>
  </form>
</div>

<?php if ($room): ?>
<div style="display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start">
  <div class="card">
    <div class="card-h">⚙️ <?= h($room['name']) ?></div>
    <div class="card-b">
      <form method="post" style="display:flex;flex-direction:column;gap:8px">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="act" value="room_save"><input type="hidden" name="slug" value="<?= h($slug) ?>">
        <label style="font-size:12px;color:var(--muted)">Nome</label><input class="input" name="name" value="<?= h($room['name']) ?>">
        <label style="font-size:12px;color:var(--muted)">Descrição</label><input class="input" name="descr" value="<?= h($room['descr'] ?? '') ?>">
        <label style="font-size:12px;color:var(--muted)">Piso</label>
        <select class="input" name="floor"><?php foreach ($FLOORS as $f): ?><option <?= ($room['floor'] ?? '') === $f ? 'selected' : '' ?>><?= $f ?></option><?php endforeach; ?></select>
        <label style="font-size:12px;color:var(--muted)">Parede</label>
        <select class="input" name="wall"><?php foreach ($WALLS as $w): ?><option <?= ($room['wall'] ?? '') === $w ? 'selected' : '' ?>><?= $w ?></option><?php endforeach; ?></select>
        <div style="display:flex;gap:6px"><div><label style="font-size:12px;color:var(--muted)">Larg</label><input class="input" name="w" type="number" value="<?= (int)$room['w'] ?>"></div><div><label style="font-size:12px;color:var(--muted)">Alt</label><input class="input" name="h" type="number" value="<?= (int)$room['h'] ?>"></div></div>
        <button class="btn">Salvar sala</button>
      </form>
    </div>
  </div>

  <div>
    <div class="card">
      <div class="card-h">➕ Adicionar mobi — buscar</div>
      <div class="card-b">
        <form method="get" style="display:flex;gap:6px;margin-bottom:10px"><input type="hidden" name="room" value="<?= h($slug) ?>"><input class="input" name="q" value="<?= h($q) ?>" placeholder="🔎 nome do mobi"><button class="btn btn-blue">Buscar</button></form>
        <?php if ($found): ?>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
          <?php foreach ($found as $f): ?>
            <form method="post" style="background:var(--panel2);border:2px solid var(--border);border-radius:8px;padding:8px;text-align:center">
              <input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="act" value="item_add"><input type="hidden" name="slug" value="<?= h($slug) ?>"><input type="hidden" name="furniture_id" value="<?= h($f['id']) ?>">
              <img src="<?= h($f['sprite']) ?>" style="width:36px;height:36px;object-fit:contain;image-rendering:pixelated" onerror="this.style.opacity=.2"><br>
              <span style="font-size:11px;color:var(--muted)"><?= h($f['name']) ?></span><br>
              x<input class="input" name="x" type="number" value="<?= (int)($room['w']/2) ?>" style="width:42px;padding:3px"> y<input class="input" name="y" type="number" value="<?= (int)($room['h']/2) ?>" style="width:42px;padding:3px">
              <button class="btn" style="width:100%;margin-top:4px;padding:5px">➕ colocar</button>
            </form>
          <?php endforeach; ?>
        </div>
        <?php endif; ?>
      </div>
    </div>

    <div class="card">
      <div class="card-h">🛋️ Mobis na sala (<?= count($items) ?>)</div>
      <div class="card-b" style="padding:0">
        <table>
          <tr><th>Mobi</th><th>Pos (x,y)</th><th>Dir</th><th>Ações</th></tr>
          <?php foreach ($items as $it): ?>
          <tr>
            <td><img src="<?= h($it['furniture']['sprite'] ?? '') ?>" style="width:30px;height:30px;object-fit:contain;image-rendering:pixelated;vertical-align:middle" onerror="this.style.opacity=.2"> <?= h($it['furniture']['name'] ?? $it['furniture_id']) ?></td>
            <td>
              <form class="inline" method="post"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="act" value="item_move"><input type="hidden" name="slug" value="<?= h($slug) ?>"><input type="hidden" name="id" value="<?= h($it['id']) ?>">
              <input class="input" name="x" type="number" value="<?= (int)$it['x'] ?>" style="width:44px;padding:3px"><input class="input" name="y" type="number" value="<?= (int)$it['y'] ?>" style="width:44px;padding:3px">
            </td>
            <td><input class="input" name="rotation" type="number" value="<?= (int)$it['rotation'] ?>" style="width:42px;padding:3px"><button class="btn btn-ghost" style="padding:4px 8px">↻</button></form></td>
            <td><form class="inline" method="post"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="act" value="item_del"><input type="hidden" name="slug" value="<?= h($slug) ?>"><input type="hidden" name="id" value="<?= h($it['id']) ?>"><button class="btn btn-red" style="padding:4px 8px">x</button></form></td>
          </tr>
          <?php endforeach; ?>
          <?php if (!$items): ?><tr><td colspan="4" style="color:var(--muted)">Sala vazia. Busque mobis acima.</td></tr><?php endif; ?>
        </table>
      </div>
    </div>
  </div>
</div>
<?php endif; ?>
<?php layout_foot(); ?>
