import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Use SUPABASE_JWT_SECRET as the primary key (matches existing env setup)
// Falls back to a generated secret based on the Supabase service key so the
// app works out-of-the-box without requiring a new env variable.
function getJwtSecret(): string {
  const secret =
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    // Derive a stable secret from an existing key so it survives restarts
    (process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `talentrack-${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-32)}`
      : null)

  if (!secret) {
    throw new Error(
      'No JWT secret available. Set JWT_SECRET in your .env.local file.'
    )
  }
  return secret
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12)
  return bcrypt.hash(password, salt)
}

export async function comparePasswords(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(adminId: string): string {
  return jwt.sign(
    { sub: adminId, iat: Math.floor(Date.now() / 1000) },
    getJwtSecret(),
    { expiresIn: '7d' }
  )
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { sub: string }
  } catch {
    return null
  }
}
