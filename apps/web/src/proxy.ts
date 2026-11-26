import { NextResponse, type NextRequest } from 'next/server';
import { loginUrl } from './lib/safe-back';

/**
 * Stránky jen pro přihlášené: bez cookie přihlášení rovnou na přihlášení s návratem na požadovanou
 * stránku (bez zbytečných volání API, která by skončila 401). Ostatním předá cestu v hlavičce
 * x-pathname, aby layout při neplatné session vrátil uživatele na stejné místo.
 */
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname + req.nextUrl.search;
  if (!req.cookies.get('dej_session')?.value) return NextResponse.redirect(new URL(loginUrl(path), req.url));
  const headers = new Headers(req.headers);
  headers.set('x-pathname', path);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/muj-ucet/:path*', '/zpravy/:path*'] };
