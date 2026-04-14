import { SignJWT, jwtVerify } from 'jose'

function getSecret(): Uint8Array {
  const s = process.env.ADMIN_SECRET
  if (!s) throw new Error('ADMIN_SECRET env var is required')
  return new TextEncoder().encode(s)
}

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(getSecret())
}

export async function verifyAdminToken(token: string) {
  return jwtVerify(token, getSecret())
}
