<?php
// ---- carrega .env ----
if (!isset($GLOBALS['__env'])) {
  $GLOBALS['__env'] = [];
  if (file_exists(__DIR__ . '/.env')) {
    foreach (file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
      if (str_starts_with(trim($line), '#')) continue;
      [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
      $GLOBALS['__env'][trim($k)] = trim($v, " \t\"'");
    }
  }
}
function env($k, $d = null) { return $GLOBALS['__env'][$k] ?? getenv($k) ?: $d; }

if (session_status() === PHP_SESSION_NONE) session_start();

// ---- Supabase REST ----
function supa($method, $path, $body = null, $extraHeaders = []) {
  $url = rtrim(env('SUPABASE_URL'), '/') . '/rest/v1' . $path;
  $key = env('SUPABASE_SERVICE_ROLE_KEY');
  $headers = array_merge([
    'apikey: ' . $key,
    'Authorization: Bearer ' . $key,
    'Content-Type: application/json',
    'Prefer: return=representation',
  ], $extraHeaders);
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => $body !== null ? json_encode($body) : null,
    CURLOPT_TIMEOUT => 20,
  ]);
  $res = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return ['code' => $code, 'data' => json_decode($res, true)];
}
function supa_get($path)            { return supa('GET', $path)['data'] ?? []; }
function supa_patch($path, $body)   { return supa('PATCH', $path, $body); }
function supa_post($path, $body)    { return supa('POST', $path, $body); }
function supa_delete($path)         { return supa('DELETE', $path); }
function supa_count($table, $q = '') {
  $url = rtrim(env('SUPABASE_URL'), '/') . "/rest/v1/$table?select=id" . ($q ? "&$q" : '');
  $key = env('SUPABASE_SERVICE_ROLE_KEY');
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_NOBODY => false,
    CURLOPT_HTTPHEADER => ["apikey: $key", "Authorization: Bearer $key", 'Prefer: count=exact', 'Range: 0-0'],
    CURLOPT_HEADER => true, CURLOPT_TIMEOUT => 20,
  ]);
  $resp = curl_exec($ch);
  curl_close($ch);
  if (preg_match('/content-range:\s*\d+-\d+\/(\d+|\*)/i', $resp, $m)) return $m[1] === '*' ? 0 : (int)$m[1];
  return 0;
}

// ---- settings helpers ----
function setting_get($key, $default = []) {
  $r = supa_get('/settings?key=eq.' . urlencode($key) . '&select=value');
  return $r[0]['value'] ?? $default;
}
function setting_set($key, $value) {
  // upsert
  return supa('POST', '/settings', ['key' => $key, 'value' => $value, 'updated_at' => date('c')],
    ['Prefer: resolution=merge-duplicates,return=representation']);
}

function admin_log($action, $target = null, $meta = null) {
  supa_post('/admin_log', ['action' => $action, 'target' => $target, 'meta' => $meta]);
}

// ---- auth ----
function require_login() { if (empty($_SESSION['gh_admin'])) { header('Location: /login.php'); exit; } }
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function flash($msg = null) {
  if ($msg !== null) { $_SESSION['flash'] = $msg; return; }
  $f = $_SESSION['flash'] ?? null; unset($_SESSION['flash']); return $f;
}
function csrf_token() { return $_SESSION['csrf'] ??= bin2hex(random_bytes(16)); }
function csrf_check() {
  if (($_POST['csrf'] ?? '') !== ($_SESSION['csrf'] ?? '!')) { http_response_code(419); exit('CSRF inválido'); }
}
