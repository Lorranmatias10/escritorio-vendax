import { NextResponse } from 'next/server';
import { banco } from '@/lib/db';
import { consumirLink, loginLigado, SESSAO_DIAS } from '@/lib/auth';
import { gravarCookieSessao } from '@/lib/sessao';

// Link de acesso de uso único: cria a sessão e leva a pessoa para definir a senha.
export async function GET(req: Request, { params }: RouteContext<'/acesso/[token]'>) {
  const { token } = await params;
  const origem = new URL(req.url).origin;
  if (!loginLigado()) return NextResponse.redirect(new URL('/hoje', origem));
  const sessao = /^[A-Za-z0-9_-]{40,60}$/.test(token) ? await consumirLink(await banco(), token) : null;
  if (!sessao) return NextResponse.redirect(new URL('/login?erro=link', origem));
  await gravarCookieSessao(sessao, SESSAO_DIAS);
  return NextResponse.redirect(new URL('/definir-senha', origem));
}
