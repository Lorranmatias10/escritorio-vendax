'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contexto } from '@/lib/sessao';
import { definirRotinaAtiva, processarFila, rodarRotinaAgora, salvarRotina } from '@/lib/orquestracao';

const str = (f: FormData,k: string) => String(f.get(k) ?? '').trim();

export async function acaoSalvarRotina(f: FormData) {
  const { b,u } = await contexto();
  const entrada = Object.fromEntries(['chave_dedup','nome','papel_id','dono_id','aprovador_id','objetivo','frequencia','hora'].map(k => [k,str(f,k)]));
  const [tipo,ref] = str(f,'escopo').split(':');
  const existente = z.uuid().safeParse(str(f,'id')).data;
  let id: string | undefined;
  try {
    id = await salvarRotina(b,u,{
      ...entrada, cliente_id: tipo === 'cliente' ? ref : null, area_interna: tipo === 'area' ? ref : null,
      dia: entrada.frequencia === 'diaria' || !str(f,'dia') ? null : Number(f.get('dia')),
      fontes: f.getAll('fontes'), inclui_sazonal: f.has('inclui_sazonal'),
    },existente);
    revalidatePath('/rotinas');
  } catch { /* A interface apresenta uma mensagem sem dados internos. */ }
  if (id) redirect(`/rotinas?rotina=${id}&ok=salva`);
  redirect(`/rotinas?${new URLSearchParams({ erro: 'salvar', ...(existente ? {rotina: existente, editar: 'sim'} : {nova: 'sim'}) })}`);
}

export async function acaoAtivarRotina(f: FormData) {
  const { b,u } = await contexto();
  const id = z.uuid().safeParse(str(f,'id')).data;
  let resultado = 'erro=alterar';
  if (id) {
    try {
      await definirRotinaAtiva(b,u,id,str(f,'ativa') === 'sim');
      revalidatePath('/rotinas');
      resultado = 'ok=alterada';
    } catch { /* A interface apresenta uma mensagem sem dados internos. */ }
  }
  redirect(`/rotinas?${id ? `rotina=${id}&` : ''}${resultado}`);
}

export async function acaoRodarRotina(f: FormData) {
  const { b,u } = await contexto();
  const id = z.uuid().safeParse(str(f,'id')).data;
  let resultado = 'erro=rodar';
  if (id) {
    try {
      const r = await rodarRotinaAgora(b,u,id);
      // A fila persistente do servidor cuida da execução em produção.
      if (r.tarefaId && !(process.env.NODE_ENV === 'production' && process.env.DATABASE_URL))
        await processarFila(b,undefined,1,r.tarefaId);
      revalidatePath('/', 'layout');
      resultado = r.tarefaId ? 'ok=disparo' : 'ok=ignorada';
    } catch { /* A interface apresenta uma mensagem sem dados internos. */ }
  }
  redirect(`/rotinas?${id ? `rotina=${id}&` : ''}${resultado}`);
}
