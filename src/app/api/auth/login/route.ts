import { NextRequest, NextResponse } from 'next/server'

async function createSession(secret: string): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64')
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const sig = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${payload}.${sig}`
}

export async function POST(request: NextRequest) {
  const { username, password } = await request.json()

  const validUser = process.env.ADMIN_USERNAME ?? 'admin'
  const validPass = process.env.ADMIN_PASSWORD ?? 'password'

  if (username !== validUser || password !== validPass) {
    return NextResponse.json({ error: 'IDまたはパスワードが違います' }, { status: 401 })
  }

  const secret = process.env.SESSION_SECRET ?? 'fallback-secret'
  const token = await createSession(secret)

  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
