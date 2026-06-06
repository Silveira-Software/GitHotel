import { createRemoteJWKSet, jwtVerify } from 'jose';

// Supabase agora usa chaves assimetricas (ECC P-256).
// O backend verifica tokens usando o JWKS publico do projeto.
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

export async function verifySupabaseJWT(token) {
  if (!token) throw new Error('no_token');
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${process.env.SUPABASE_URL}/auth/v1`,
  });
  return payload;
}

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    req.user = await verifySupabaseJWT(token);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
