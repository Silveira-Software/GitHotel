<?php
require __DIR__ . '/config.php';
require_login();
require __DIR__ . '/layout.php';

function slugify($s) {
  $s = iconv('UTF-8', 'ASCII//TRANSLIT', $s);
  $s = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $s));
  return trim($s, '-') ?: 'noticia-' . time();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  csrf_check();
  $act = $_POST['act'] ?? '';
  if ($act === 'delete' && !empty($_POST['id'])) {
    supa_delete('/articles?id=eq.' . urlencode($_POST['id']));
    admin_log('article_delete', $_POST['id']); flash('Notícia removida.');
  } else {
    $payload = [
      'title'    => trim($_POST['title'] ?? ''),
      'excerpt'  => trim($_POST['excerpt'] ?? ''),
      'body'     => trim($_POST['body'] ?? ''),
      'cover_url'=> trim($_POST['cover_url'] ?? ''),
      'author'   => trim($_POST['author'] ?? 'Equipe GitHotel'),
      'published'=> isset($_POST['published']),
    ];
    if (!empty($_POST['id'])) {
      supa_patch('/articles?id=eq.' . urlencode($_POST['id']), $payload);
      admin_log('article_update', $_POST['id']); flash('Notícia atualizada.');
    } else {
      $payload['slug'] = slugify($payload['title']);
      supa_post('/articles', $payload);
      admin_log('article_create', $payload['slug']); flash('Notícia publicada!');
    }
  }
  header('Location: /articles.php'); exit;
}

$edit = null;
if (!empty($_GET['edit'])) {
  $r = supa_get('/articles?id=eq.' . urlencode($_GET['edit']));
  $edit = $r[0] ?? null;
}
$list = supa_get('/articles?select=id,title,excerpt,published,created_at&order=created_at.desc&limit=50');

layout_head('Notícias');
?>
<h1>📰 Notícias do hotel</h1>
<div class="sub">Publique novidades que aparecem na home do app e no site</div>

<div style="display:grid;grid-template-columns:1fr 380px;gap:20px;align-items:start">
  <div class="card"><div class="card-b" style="padding:0">
    <table>
      <tr><th>Título</th><th>Status</th><th>Ações</th></tr>
      <?php foreach ($list as $a): ?>
      <tr>
        <td><b><?= h($a['title']) ?></b><br><span style="color:var(--muted);font-size:12px"><?= h($a['excerpt']) ?></span></td>
        <td><?= $a['published'] ? '<span class="tag tag-on">público</span>' : '<span class="tag tag-off">rascunho</span>' ?></td>
        <td>
          <a class="btn btn-ghost" style="padding:6px 10px" href="/articles.php?edit=<?= h($a['id']) ?>">editar</a>
          <form class="inline" method="post" onsubmit="return confirm('Remover?')"><input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="act" value="delete"><input type="hidden" name="id" value="<?= h($a['id']) ?>"><button class="btn btn-red" style="padding:6px 10px">x</button></form>
        </td>
      </tr>
      <?php endforeach; ?>
      <?php if (!$list): ?><tr><td colspan="3" style="color:var(--muted)">Sem notícias.</td></tr><?php endif; ?>
    </table>
  </div></div>

  <div class="card">
    <div class="card-h"><?= $edit ? '✏️ Editar' : '➕ Nova notícia' ?></div>
    <div class="card-b">
      <form method="post" style="display:flex;flex-direction:column;gap:10px">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
        <?php if ($edit): ?><input type="hidden" name="id" value="<?= h($edit['id']) ?>"><?php endif; ?>
        <input class="input" name="title" placeholder="Título" required value="<?= h($edit['title'] ?? '') ?>">
        <input class="input" name="excerpt" placeholder="Resumo (1 linha)" value="<?= h($edit['excerpt'] ?? '') ?>">
        <textarea class="input" name="body" placeholder="Conteúdo" rows="5"><?= h($edit['body'] ?? '') ?></textarea>
        <input class="input" name="cover_url" placeholder="URL da capa (ex: images.habbo.com/...)" value="<?= h($edit['cover_url'] ?? '') ?>">
        <input class="input" name="author" placeholder="Autor" value="<?= h($edit['author'] ?? 'Equipe GitHotel') ?>">
        <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" name="published" <?= (!$edit || $edit['published']) ? 'checked' : '' ?>> Publicado</label>
        <button class="btn"><?= $edit ? 'Salvar' : 'Publicar' ?></button>
        <?php if ($edit): ?><a href="/articles.php" style="text-align:center;color:var(--muted);font-size:13px">cancelar edição</a><?php endif; ?>
      </form>
    </div>
  </div>
</div>
<?php layout_foot(); ?>
