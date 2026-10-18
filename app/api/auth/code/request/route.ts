import { NextResponse } from 'next/server'
import { requestLoginCode } from '@/lib/login-code'

export async function POST(request: Request) {
  const data = await request.json().catch(() => null)
  const email = typeof data?.email === 'string' ? data.email : ''
  if (!email || email.length > 320) {
    return NextResponse.json({ error: 'Informe um email valido.' }, { status: 400 })
  }

  try {
    await requestLoginCode(email)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[auth] Failed to send access code', error)
    return NextResponse.json({ error: 'Nao foi possivel enviar o codigo agora.' }, { status: 500 })
  }
}
