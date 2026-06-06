<?php
require __DIR__ . '/config.php';
require_login();
require __DIR__ . '/layout.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  csrf_check();
  if (($_POST['form'] ?? '') === 'maint') {
    setting_set('maintenance', [
      'on' => isset($_POST['on']),
      'message' => trim($_POST['message'] ?? 'Voltamos já!'),
    ]);
    admin_log('maintenance', null, ['on' => isset($_POST['on'])]);
    flash(isset($_POST['on']) ? '🚧 Manutenção ATIVADA — hotel fechado.' : '✅ Hotel ABERTO.');
  } elseif (($_POST['form'] ?? '') === 'hotel') {
    setting_set('hotel', ['name' => trim($_POST['name'] ?? 'GitHotel'), 'welcome' => trim($_POST['welcome'] ?? '')]);
    flash('Dados do hotel salvos.');
  }
  header('Location: /settings.php'); exit;
}

$maint = setting_get('maintenance', ['on' => false, 'message' => '']);
$hotel = setting_get('hotel', ['name' => 'GitHotel', 'welcome' => '']);

layout_head('Hotel / Manutenção');
?>
<h1>⚙️ Hotel & Manutenção</h1>
<div class="sub">Libere ou feche o hotel e configure dados gerais</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
  <div class="card">
    <div class="card-h">🚧 Modo manutenção</div>
    <div class="card-b">
      <p style="color:var(--muted);font-size:14px;margin-bottom:14px">
        Status atual:
        <?= !empty($maint['on']) ? '<span class="tag tag-ban">FECHADO</span>' : '<span class="tag tag-on">ABERTO</span>' ?>
      </p>
      <form method="post" style="display:flex;flex-direction:column;gap:12px">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="form" value="maint">
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="on" <?= !empty($maint['on']) ? 'checked' : '' ?>> Ativar manutenção (bloqueia entrada dos devs)</label>
        <textarea class="input" name="message" rows="3" placeholder="Mensagem exibida"><?= h($maint['message'] ?? '') ?></textarea>
        <button class="btn">Aplicar</button>
      </form>
    </div>
  </div>

  <div class="card">
    <div class="card-h">🏨 Dados do hotel</div>
    <div class="card-b">
      <form method="post" style="display:flex;flex-direction:column;gap:12px">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>"><input type="hidden" name="form" value="hotel">
        <label style="font-size:13px;color:var(--muted)">Nome do hotel</label>
        <input class="input" name="name" value="<?= h($hotel['name'] ?? 'GitHotel') ?>">
        <label style="font-size:13px;color:var(--muted)">Mensagem de boas-vindas</label>
        <input class="input" name="welcome" value="<?= h($hotel['welcome'] ?? '') ?>">
        <button class="btn">Salvar</button>
      </form>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-h">🔐 Segurança</div>
  <div class="card-b" style="color:var(--muted);font-size:14px">
    Senha do admin definida em <code style="color:var(--text)">.env</code> (<code>ADMIN_PASSWORD</code>) no servidor.
    Para trocar, edite o arquivo <code style="color:var(--text)">/home/githotel-admin/htdocs/admin.githotel.site/.env</code>.
  </div>
</div>
<?php layout_foot(); ?>
