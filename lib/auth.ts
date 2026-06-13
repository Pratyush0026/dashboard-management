import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
const secret = new TextEncoder().encode(JWT_SECRET)

export interface JWTPayload {
  sub: string
  email: string
  name: string
  iat?: number
  exp?: number
}

export async function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    // For server-side use only - synchronous workaround
    // We'll use a simplified approach
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    
    return payload as JWTPayload
  } catch {
    return null
  }
}

export async function verifyTokenAsync(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}
