'use server';
// Ações do servidor. Entrada validada com zod; autorização e registro ficam em lib/orquestracao.ts.
import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { contexto, COOKIE_USUARIO } from '@/lib/sessao';
import { decidirAprovacao, retomarExecucao, salvarInstrucao, desabilitarPapel, criarCliente, definirAcessoClientes } from '@/lib/orquestracao';
import { homologarPiloto, homologarFase2 } from '@/lib/homologacao';
import { testarIntegracao, testarTodas } from '@/lib/integracoes';
import { INTEGRACOES } from '@/lib/catalogo';
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

export async function acaoCriarCliente(fd: FormData) {
  const { b, u } = await contexto();
  const nome = z.string().max(120).parse(String(fd.get('nome') ?? ''));
  let erro = '';
  try { await criarCliente(b, u, nome); } catch (e) { erro = e instanceof Error && /já existe/i.test(e.message) ? 'duplicado' : 'nome'; }
  atualizar();
  redirect(erro ? `/clientes?erro=${erro}` : '/clientes?ok=cliente');
}

export async function acaoAcessoClientes(fd: FormData) {
  const { b, u } = await contexto();
  const usuario = z.string().min(1).parse(fd.get('usuario'));
  const clientes = fd.getAll('clientes').map(String);
  await definirAcessoClientes(b, u, usuario, clientes);
  atualizar();
}

export async function acaoHomologarPiloto() {
  const { b, u } = await contexto();
  await homologarPiloto(b, u);
  atualizar();
  redirect('/agentes#homologacao');
}

export async function acaoHomologarFase2() {
  const { b, u } = await contexto();
  await homologarFase2(b, u);
  atualizar();
  redirect('/agentes#fase2');
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
