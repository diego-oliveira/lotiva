import { NextResponse, type NextRequest } from 'next/server'

const publicPathPrefixes = ['/signin', '/auth', '/api/auth']

function hasSessionCookie(request: NextRequest) {
  return (
    request.cookies.has('next-auth.session-token') ||
    request.cookies.has('__Secure-next-auth.session-token')
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicPathPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (hasSessionCookie(request)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const signInUrl = new URL('/signin', request.url)
  signInUrl.searchParams.set('callbackUrl', request.nextUrl.href)

  return NextResponse.redirect(signInUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
