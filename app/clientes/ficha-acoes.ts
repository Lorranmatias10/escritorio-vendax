'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { contexto } from '@/lib/sessao';
import { atualizarFichaCliente, gravarVinculoCliente, retirarVinculoCliente, verificarVinculoCliente } from '@/lib/orquestracao';

const texto = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function acaoFichaCliente(f: FormData) {
  const { b,u } = await contexto();
  const cliente = texto(f,'cliente');
  let resultado = 'salvo';
  try {
    await atualizarFichaCliente(b,u,cliente,{
      status: texto(f,'status') || null, responsavel_id: texto(f,'responsavel_id') || null,
      contato_nome: texto(f,'contato_nome') || null, contato_whatsapp: texto(f,'contato_whatsapp').replace(/[() .-]/g,'') || null,
    });
    revalidatePath('/', 'layout');
  } catch {
    resultado = 'cadastro';
  }
  redirect(`/clientes/memoria?cliente=${encodeURIComponent(cliente)}&resultado=${resultado}`);
}

export async function acaoVinculoCliente(f: FormData) {
  const { b,u } = await contexto();
  const cliente = texto(f,'cliente'), acao = texto(f,'acao');
  let resultado = 'salvo';
  try {
    const id = texto(f,'id');
    const versao = Number(f.get('versao'));
    const edicao = id ? { id: z.uuid().parse(id), versao: z.number().int().positive().parse(versao) } : undefined;
    if (acao === 'verificar' && edicao) {
      await verificarVinculoCliente(b,u,cliente,edicao.id,edicao.versao);
      resultado = 'verificado';
    } else if (acao === 'remover' && edicao) {
      await retirarVinculoCliente(b,u,cliente,edicao.id,edicao.versao);
    } else if (acao === 'salvar') {
      await gravarVinculoCliente(b,u,cliente,Object.fromEntries(['integracao','tipo','identificador','rotulo'].map(k => [k,texto(f,k)])),edicao);
    } else {
      throw new Error('Ação inválida.');
    }
    revalidatePath('/', 'layout');
  } catch {
    resultado = acao === 'verificar' ? 'verificacao' : 'conta';
  }
  redirect(`/clientes/memoria?cliente=${encodeURIComponent(cliente)}&resultado=${resultado}#contas`);
}
