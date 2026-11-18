'use server';
// Ações do servidor. Entrada validada com zod; autorização e registro ficam em lib/orquestracao.ts.
import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { contexto, COOKIE_USUARIO } from '@/lib/sessao';
import { decidirAprovacao, retomarExecucao, salvarInstrucao, desabilitarPapel } from '@/lib/orquestracao';
import { homologarPiloto } from '@/lib/homologacao';
import { testarIntegracao, testarTodas } from '@/lib/integracoes';
import { INTEGRACOES } from '@/lib/catalogo';
import { dispararFluxoPiloto, simularFalha, simularFonteAusente } from '@/lib/demo';
import { resetarDemonstracao } from '@/lib/seed';
import { banco } from '@/lib/db';
import { carregarUsuario } from '@/lib/escopo';
import { loginLigado } from '@/lib/auth';

const atualizar = () => revalidatePath('/', 'layout');

export async function trocarUsuario(fd: FormData) {
  if (loginLigado()) throw new Error('Com login ligado, cada pessoa entra com a própria conta.');
  const id = z.string().min(1).parse(fd.get('usuario'));
  if (!(await carregarUsuario(await banco(), id))) throw new Error('Usuário inválido.');
  (await cookies()).set(COOKIE_USUARIO, id, { httpOnly: true, sameSite: 'lax', path: '/' });
  atualizar();
}

export async function acaoFluxoPiloto() {
  const { b, u } = await contexto();
  const r = await dispararFluxoPiloto(b, u);
  atualizar();
  redirect(`/tarefas/${r.tarefaId}${r.repetido ? '?repetido=1' : ''}`);
}

export async function acaoFonteAusente() {
  const { b, u } = await contexto();
  const id = await simularFonteAusente(b, u);
  atualizar();
  redirect(`/tarefas/${id}`);
}

export async function acaoFalha() {
  const { b, u } = await contexto();
  const id = await simularFalha(b, u);
  atualizar();
  redirect(`/tarefas/${id}`);
}

export async function acaoRetomar(fd: FormData) {
  const { b, u } = await contexto();
  const exec = z.uuid().parse(fd.get('execucao'));
  await retomarExecucao(b, u, exec);
  atualizar();
}

export async function acaoDecidir(fd: FormData) {
  const { b, u } = await contexto();
  const dados = z.object({
    aprovacao: z.uuid(),
    decisao: z.enum(['aprovada', 'rejeitada']),
    nota: z.string().max(500).default(''),
  }).parse({ aprovacao: fd.get('aprovacao'), decisao: fd.get('decisao'), nota: fd.get('nota') ?? '' });
  await decidirAprovacao(b, u, dados.aprovacao, dados.decisao, dados.nota);
  atualizar();
}

export async function acaoSalvarInstrucao(fd: FormData) {
  const { b, u } = await contexto();
  const d = z.object({
    papel: z.string().min(1),
    versao: z.string().regex(/^\d+(\.\d+){0,2}$/, 'Use o formato 1.1 ou 1.1.0'),
    conteudo: z.string().min(20, 'Instrução muito curta').max(20_000),
  }).parse({ papel: fd.get('papel'), versao: fd.get('versao'), conteudo: fd.get('conteudo') });
  await salvarInstrucao(b, u, d.papel, d.versao, d.conteudo);
  atualizar();
}

export async function acaoResetar() {
  const { b, u } = await contexto();
  if (u.perfil !== 'admin') throw new Error('Somente a direção pode resetar a demonstração.');
  await resetarDemonstracao(b);
  atualizar();
  redirect('/demonstracao');
}

export async function acaoHomologarPiloto() {
  const { b, u } = await contexto();
  await homologarPiloto(b, u);
  atualizar();
  redirect('/agentes#homologacao');
}

export async function acaoDesabilitarPapel(fd: FormData) {
  const { b, u } = await contexto();
  const d = z.object({ papel: z.string().min(1), motivo: z.string().min(3, 'Informe o motivo').max(300) })
    .parse({ papel: fd.get('papel'), motivo: fd.get('motivo') });
  await desabilitarPapel(b, u, d.papel, d.motivo);
  atualizar();
}

export async function acaoTestarIntegracao(fd: FormData) {
  const { b, u } = await contexto();
  if (u.perfil !== 'admin') throw new Error('Somente a direção testa integrações.');
  const id = z.enum(INTEGRACOES.map(i => i.id) as [string, ...string[]]).parse(fd.get('integracao'));
  await testarIntegracao(b, id, 'manual', u.id);
  atualizar();
}

export async function acaoTestarTodas() {
  const { b, u } = await contexto();
  if (u.perfil !== 'admin') throw new Error('Somente a direção testa integrações.');
  await testarTodas(b, 'manual', u.id);
  atualizar();
}
