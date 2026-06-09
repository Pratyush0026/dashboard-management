import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import nodemailer from 'nodemailer'
import { getSupabaseAdmin } from '@/lib/supabase/client'

// Lazily build transporter only if email env vars are set
function getTransporter() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Always return 200 to avoid email enumeration
    const SUCCESS_RESPONSE = NextResponse.json({
      message: 'If an account with that email exists, a reset link has been sent.',
    })

    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .single()

    if (!admin) return SUCCESS_RESPONSE

    // Generate a secure token using crypto
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    // Store hashed token (plain token is sent to user, we verify the hash)
    // Note: In production, add a password_reset_tokens table.
    // For now, we encode expiry in the token itself.
    const tokenPayload = Buffer.from(
      JSON.stringify({ id: admin.id, hash: tokenHash, exp: expiresAt })
    ).toString('base64url')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password?token=${tokenPayload}`

    const transporter = getTransporter()
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'noreply@talenthub.app',
          to: email,
          subject: 'Reset your TalentHub password',
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
              <h2 style="color: #7c3aed;">Reset your password</h2>
              <p>You requested a password reset for your TalentHub account.</p>
              <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
              <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
                Reset Password
              </a>
              <p style="color:#888;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        })
      } catch (emailError) {
        console.error('Email send error:', emailError)
        // Still return success to not reveal internal errors
      }
    } else {
      console.warn(
        'Email not configured — password reset token (dev only):',
        resetUrl
      )
    }

    return SUCCESS_RESPONSE
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
