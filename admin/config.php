<?php
// Carrega .env simples (KEY=VALUE por linha)
if (!isset($_ENV['SUPABASE_URL']) && file_exists(__DIR__ . '/.env')) {
  foreach (file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (str_starts_with(trim($line), '#')) continue;
    [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
    $_ENV[trim($k)] = trim($v, " \t\"'");
  }
}
function env($k, $default = null) { return $_ENV[$k] ?? getenv($k) ?: $default; }

session_start();

const SUPABASE_URL = '';

function supa($method, $path, $body = null) {
  $url = env('SUPABASE_URL') . '/rest/v1' . $path;
  $headers = [
    'apikey: ' . env('SUPABASE_SERVICE_ROLE_KEY'),
    'Authorization: Bearer ' . env('SUPABASE_SERVICE_ROLE_KEY'),
    'Content-Type: application/json',
    'Prefer: return=representation',
  ];
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => $body !== null ? json_encode($body) : null,
    CURLOPT_TIMEOUT => 15,
  ]);
  $res = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return ['code' => $code, 'data' => json_decode($res, true), 'raw' => $res];
}

function require_login() {
  if (empty($_SESSION['admin'])) { header('Location: /login.php'); exit; }
}

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function flash($msg = null) {
  if ($msg !== null) $_SESSION['flash'] = $msg;
  $f = $_SESSION['flash'] ?? null;
  unset($_SESSION['flash']);
  return $f;
}
