'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { contexto } from '@/lib/sessao';
import { importarCarteira, salvarConta, salvarFicha } from '@/lib/memoria-vendax';

const rota = '/clientes/memoria';
const caminho = (cliente: string) => cliente ? `${rota}?cliente=${encodeURIComponent(cliente)}` : rota;
const dadosFicha = (fd: FormData) => Object.fromEntries(['situacao', 'texto', 'fonte', 'data_fonte'].map(k => [k, fd.get(k)]));

export async function acaoImportarCarteira(fd: FormData) {
  const { b, u } = await contexto();
  const pacote = fd.get('carteira');
  let destino = `${rota}?erro=importar`;
  if (typeof pacote === 'string' && pacote.length < 180_000) {
    try {
      const r = await importarCarteira(b, u, JSON.parse(pacote));
      revalidatePath('/', 'layout');
      destino = `${rota}?${new URLSearchParams(Object.entries(r).map(([k, v]) => [k, String(v)]))}`;
    } catch { /* A mensagem da página evita mostrar dados dos registros no erro. */ }
  }
  redirect(destino);
}

export async function acaoSalvarFicha(fd: FormData) {
  const { b, u } = await contexto();
  const cliente = String(fd.get('cliente') ?? '');
  let estado = 'ficha';
  try {
    estado = await salvarFicha(b, u, cliente || null, dadosFicha(fd), Number(fd.get('versao'))) ? 'salvo' : 'conflito';
    revalidatePath('/', 'layout');
  } catch { /* A mensagem da página evita mostrar dados dos registros no erro. */ }
  redirect(`${caminho(cliente)}${cliente ? '&' : '?'}resultado=${estado}`);
}

export async function acaoSalvarConta(fd: FormData) {
  const { b, u } = await contexto();
  const cliente = String(fd.get('cliente') ?? '');
  const dados = Object.fromEntries(['plataforma', 'conta_id', 'nome', 'situacao', 'fonte', 'data_fonte'].map(k => [k, fd.get(k)]));
  const contaId = String(dados.conta_id).replace(/^act_/i, '').replaceAll('-', '').trim();
  let estado = 'conta';
  try {
    await salvarConta(b, u, cliente, { ...dados, conta_id: contaId });
    revalidatePath('/', 'layout');
    estado = 'salvo';
  } catch { /* A mensagem da página evita mostrar dados dos registros no erro. */ }
  redirect(`${caminho(cliente)}${cliente ? '&' : '?'}resultado=${estado}`);
}
