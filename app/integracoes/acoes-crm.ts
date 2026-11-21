'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loginLigado } from '@/lib/auth';
import { guardarSegredo } from '@/lib/cofre';
import { testarIntegracao, testarTokenCrm } from '@/lib/integracoes';
import { contexto } from '@/lib/sessao';

export async function acaoConectarCrm(fd: FormData) {
  const { b, u } = await contexto();
  if (!loginLigado() || u.perfil !== 'admin') redirect('/integracoes?erro=sem_permissao');
  if (process.env.CRM_VENDAX_TOKEN?.trim()) redirect('/integracoes?erro=crm_configurado_servidor');
  const token = String(fd.get('token') ?? '').trim();
  if (!/^vdx_mcp_[A-Za-z0-9_-]{32,128}$/.test(token)) redirect('/integracoes?erro=crm_token_invalido');

  const teste = await testarTokenCrm(token).catch(() => null);
  if (!teste) redirect('/integracoes?erro=crm_indisponivel');
  if (teste.status !== 'conectado') redirect('/integracoes?erro=crm_token_escopo');

  await guardarSegredo(b, 'CRM_VENDAX_TOKEN', token);
  await testarIntegracao(b, 'crm', 'conexao', u.id);
  revalidatePath('/integracoes');
  redirect('/integracoes?ok=crm');
}
