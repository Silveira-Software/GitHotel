import zlib from 'zlib';

// Mirror de assets .nitro (alcançável do VPS e do browser, sem 403 do Habbo)
const MIRROR = process.env.NITRO_MIRROR ||
  'https://raw.githubusercontent.com/ObjectRetros/retro-hotel-files/main/nitro/nitro-assets/nitro-assets/bundled/furniture';

const cache = new Map();      // cls -> { json, png(Buffer), ok, ts }
const MAX = 500;

function decomp(buf) {
  for (const fn of [zlib.inflateSync, zlib.gunzipSync, (b) => zlib.inflateRawSync(b)]) {
    try { return fn(buf); } catch {}
  }
  return buf;
}

function parseNitro(buf) {
  let data = buf;
  if (data[0] === 0x1f && data[1] === 0x8b) data = decomp(data);
  let p = 0;
  const u16 = () => { const v = data.readUInt16BE(p); p += 2; return v; };
  const u32 = () => { const v = data.readUInt32BE(p); p += 4; return v; };
  const n = u16();
  const files = {};
  for (let i = 0; i < n; i++) {
    const nl = u16(); const name = data.slice(p, p + nl).toString('utf8'); p += nl;
    const dl = u32(); const raw = data.slice(p, p + dl); p += dl;
    files[name] = decomp(raw);
  }
  return files;
}

// classname seguro p/ montar a URL do mirror (sem path traversal)
export function safeClass(cls) {
  const base = String(cls || '').split('*')[0].trim();
  return /^[a-zA-Z0-9_.\-]+$/.test(base) ? base : null;
}

export async function getFurni(cls) {
  const c = safeClass(cls);
  if (!c) return null;
  const hit = cache.get(c);
  if (hit) return hit;

  let entry = { ok: false };
  try {
    const res = await fetch(`${MIRROR}/${c}.nitro`);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const files = parseNitro(buf);
      const jsonName = Object.keys(files).find(k => k.endsWith('.json'));
      const pngName = Object.keys(files).find(k => k.endsWith('.png'));
      if (jsonName && pngName) {
        entry = { ok: true, json: JSON.parse(files[jsonName].toString('utf8')), png: files[pngName], ts: Date.now() };
      }
    }
  } catch {}

  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(c, entry);
  return entry;
}
