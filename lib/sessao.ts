import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { banco } from './db';
import { carregarUsuario, type Usuario } from './escopo';
import { loginLigado, usuarioDaSessao } from './auth';

export const COOKIE_USUARIO = 'vx_usuario';   // modo demonstração ("Ver como")
export const COOKIE_SESSAO = 'vx_sessao';     // login (token opaco; no banco só o hash)
export type Contexto = { b: Awaited<ReturnType<typeof banco>>; u: Usuario; modo: 'login' | 'demonstracao' };

// Quem está usando o app. Com VX_LOGIN=ligado: sessão validada no banco a cada requisição.
// Sem login (V1 local): usuário escolhido em "Ver como".
export async function contextoOpcional(): Promise<Contexto | null> {
  const b = await banco();
  const jar = await cookies();
  if (!loginLigado()) {
    const u = (await carregarUsuario(b, jar.get(COOKIE_USUARIO)?.value ?? 'tiago')) ?? (await carregarUsuario(b, 'tiago'))!;
    return { b, u, modo: 'demonstracao' };
  }
  const u = await usuarioDaSessao(b, jar.get(COOKIE_SESSAO)?.value);
  return u ? { b, u, modo: 'login' } : null;
}

export async function contexto(): Promise<Contexto> {
  const c = await contextoOpcional();
  if (!c) redirect('/login');
  return c;
}

export async function gravarCookieSessao(token: string, dias: number) {
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: dias * 86_400,
    secure: (process.env.VX_URL_BASE ?? '').startsWith('https://'),
  });
}
