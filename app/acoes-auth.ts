'use server';
// Login com e-mail e senha (login próprio do Escritório).
import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { banco } from '@/lib/db';
import { contexto, COOKIE_SESSAO, gravarCookieSessao } from '@/lib/sessao';
import { definirSenhaUsuario, encerrarSessao, entrarComSenha, gerarLink, LINK_HORAS, loginLigado, SENHA_MINIMA, SESSAO_DIAS } from '@/lib/auth';

export async function entrar(fd: FormData) {
  if (!loginLigado()) redirect('/hoje');
  const d = z.object({ email: z.email(), senha: z.string().min(1).max(200) }).safeParse({ email: fd.get('email'), senha: fd.get('senha') });
  if (!d.success) redirect('/login?erro=dados');
  const r = await entrarComSenha(await banco(), d.data.email, d.data.senha);
  if (!r.ok) redirect(`/login?erro=${r.motivo}`);
  await gravarCookieSessao(r.token, SESSAO_DIAS);
  redirect('/hoje');
}

export async function sair() {
  const jar = await cookies();
  await encerrarSessao(await banco(), jar.get(COOKIE_SESSAO)?.value);
  jar.delete(COOKIE_SESSAO);
  redirect('/login');
}

export async function definirSenha(fd: FormData) {
  const { b, u } = await contexto(); // exige sessão válida (veio do link de acesso ou do login)
  const d = z.object({ senha: z.string().min(SENHA_MINIMA, 'curta').max(200), confirmacao: z.string() })
    .refine(x => x.senha === x.confirmacao, 'diferente')
    .safeParse({ senha: fd.get('senha'), confirmacao: fd.get('confirmacao') });
  if (!d.success) redirect(`/definir-senha?erro=${d.error.issues[0]?.message === 'diferente' ? 'diferente' : 'curta'}`);
  await definirSenhaUsuario(b, u.id, d.data.senha, (await cookies()).get(COOKIE_SESSAO)?.value);
  redirect('/hoje?senha=ok');
}

export async function salvarEmail(fd: FormData) {
  const { b, u } = await contexto();
  if (u.perfil !== 'admin') throw new Error('Somente a direção gerencia usuários.');
  const d = z.object({ usuario: z.string().min(1), email: z.email() }).parse({ usuario: fd.get('usuario'), email: fd.get('email') });
  await b.query('update usuarios set email = lower($2) where id = $1', [d.usuario, d.email]);
  revalidatePath('/usuarios');
}

// Link de acesso de uso único (definir ou redefinir a senha). Aparece uma vez para quem gerou; no banco fica só o hash.
export async function gerarLinkAcesso(_: unknown, fd: FormData): Promise<{ link?: string; erro?: string }> {
  const { b, u } = await contexto();
  if (u.perfil !== 'admin') return { erro: 'Somente a direção gera links de acesso.' };
  const id = z.string().min(1).parse(fd.get('usuario'));
  const [p] = await b.query<{ email: string | null }>('select email from usuarios where id = $1', [id]);
  if (!p?.email) return { erro: 'Cadastre o e-mail da pessoa primeiro.' };
  const token = await gerarLink(b, id, u.id);
  return { link: `${process.env.VX_URL_BASE ?? 'http://localhost:7777'}/acesso/${token}`, erro: loginLigado() ? undefined : `Login desligado neste ambiente: o link só funciona com VX_LOGIN=ligado. Validade: ${LINK_HORAS} h.` };
}
