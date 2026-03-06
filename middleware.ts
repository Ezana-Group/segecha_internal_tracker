import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Let the client-side AppLayout handle auth redirects
  // Middleware just protects against direct URL access without a session cookie
  const { pathname } = request.nextUrl

  // Always allow these paths through
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // Check for Supabase session cookies
  const hasSession = request.cookies.has('sb-access-token') ||
    [...request.cookies.getAll()].some(c => c.name.includes('supabase') || c.name.includes('sb-'))

  // We disable middleware redirect for now because Auth is handled in the AppLayout Client Wrapper
  // if (!hasSession) {
  //   return NextResponse.redirect(new URL('/login', request.url))
  // }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
