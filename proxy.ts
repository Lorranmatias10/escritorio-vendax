import { NextResponse, type NextRequest } from 'next/server';

// Checagem otimista: sem cookie de sessão, manda para /login. A validação de verdade (sessão no banco,
// escopo por cliente e financeiro) acontece no servidor em lib/sessao.ts e lib/escopo.ts.
const PUBLICAS = ['/login', '/acesso/', '/api/eventos/reuniao'];

export function proxy(request: NextRequest) {
  if (process.env.VX_LOGIN !== 'ligado') return NextResponse.next(); // modo demonstração
  const { pathname } = request.nextUrl;
  if (PUBLICAS.some(p => pathname.startsWith(p)) || request.cookies.has('vx_sessao')) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|escritorio.png).*)'] };
