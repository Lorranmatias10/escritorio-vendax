import { z } from 'zod';
import type { Banco, Q } from './db';
import { podeVer, SemAcesso, type Usuario } from './escopo';
import type { EntradaAgente } from './ia';

export const plataformasAds = z.enum(['google_ads', 'meta_ads']);
export const situacaoConta = z.enum(['principal', 'historica', 'verificar']);
const situacaoFicha = z.enum(['Vendax', 'Ativo', 'Projeto', 'Prospect', 'Inativo', 'Encerrado']);
const data = z.iso.date();
const idCliente = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,119}$/);
const nome = z.string().trim().min(2).max(120);
const conteudo = z.object({
  situacao: situacaoFicha, texto: z.string().trim().min(20).max(6500),
  fonte: z.string().trim().min(3).max(300), data_fonte: data,
});
const conta = z.object({
  plataforma: plataformasAds, conta_id: z.string().regex(/^\d{7,24}$/),
  nome, situacao: situacaoConta, fonte: conteudo.shape.fonte, data_fonte: data,
}).refine(c => c.plataforma !== 'google_ads' || c.conta_id.length === 10, 'ID Google Ads precisa ter 10 dígitos');
const carteira = z.object({
  global: conteudo, clientes: z.array(conteudo.extend({
    chave: idCliente, nome, aliases: z.array(nome).max(12).default([]), contas: z.array(conta).max(12).default([]),
  })).min(1).max(80),
});

type Ficha = z.infer<typeof conteudo> & { chave: string; versao: number };
export type ContaAnuncio = z.infer<typeof conta>;

function normalizar(v: string) {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function importarCarteira(b: Banco, u: Usuario, entrada: unknown) {
  if (u.perfil !== 'admin') throw new SemAcesso();
  const pacote = carteira.parse(entrada);
  return b.transacao(async q => {
    const atuais = await q.query<{ id: string; nome: string }>('select id, nome from clientes where not demo order by id');
    async function ficha(chave: string, cliente: string | null, f: z.infer<typeof conteudo>) {
      return q.query(`insert into memoria_vendax (chave,cliente_id,situacao,texto,fonte,data_fonte,atualizado_por)
        values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing returning chave`, [chave, cliente, f.situacao, f.texto, f.fonte, f.data_fonte, u.id]);
    }
    let fichas = (await ficha('vendax', null, pacote.global)).length;
    let contas = 0;
    let clientes = 0;
    let revisar = 0;
    for (const f of pacote.clientes) {
      const nomes = new Set([f.nome, ...f.aliases].map(normalizar));
      const encontrados = atuais.filter(c => c.id === f.chave || nomes.has(normalizar(c.nome)));
      if (encontrados.length > 1) { revisar++; continue; }
      const existente = encontrados[0];
      const id = existente?.id ?? f.chave;
      if (!existente) {
        const criado = await q.query('insert into clientes (id,nome,demo) values ($1,$2,false) on conflict do nothing returning id', [id, f.nome]);
        if (!criado.length) { revisar++; continue; }
        atuais.push({ id, nome: f.nome });
        clientes++;
      }
      fichas += (await ficha(`cliente:${id}`, id, f)).length;
      for (const a of f.contas) {
        const vinculadas = await q.query(`insert into contas_anuncio (plataforma,conta_id,cliente_id,nome,situacao,fonte,data_fonte)
          values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing returning conta_id`,
        [a.plataforma, a.conta_id, id, a.nome, a.situacao, a.fonte, a.data_fonte]);
        contas += vinculadas.length;
        if (!vinculadas.length) {
          const [vinculo] = await q.query<{ cliente_id: string }>('select cliente_id from contas_anuncio where plataforma=$1 and conta_id=$2',
            [a.plataforma, a.conta_id]);
          if (vinculo?.cliente_id !== id) revisar++;
        }
      }
    }
    return { fichas, clientes, contas, revisar };
  });
}

export async function lerFicha(q: Q, u: Usuario, cliente: string | null) {
  if (cliente && !podeVer(u, cliente, null)) throw new SemAcesso();
  const [ficha] = await q.query<Ficha>(`select chave,situacao,texto,fonte,data_fonte::text,versao from memoria_vendax
    where cliente_id is not distinct from $1::text`, [cliente]);
  return ficha ?? null;
}

export async function lerContas(q: Q, u: Usuario, cliente: string) {
  if (!podeVer(u, cliente, null)) throw new SemAcesso();
  return q.query<ContaAnuncio>(`select plataforma,conta_id,nome,situacao,fonte,data_fonte::text from contas_anuncio
    where cliente_id=$1 order by plataforma,(situacao = 'principal') desc, nome`, [cliente]);
}

export async function salvarFicha(q: Q, u: Usuario, cliente: string | null, entrada: unknown, versao: number) {
  if (u.perfil !== 'admin') throw new SemAcesso();
  const f = conteudo.parse(entrada);
  if (cliente) {
    const [c] = await q.query('select 1 from clientes where id=$1 and not demo', [cliente]);
    if (!c) throw new SemAcesso();
  }
  const alteradas = await q.query(`insert into memoria_vendax (chave,cliente_id,situacao,texto,fonte,data_fonte,atualizado_por)
    values ($1,$2,$3,$4,$5,$6,$7)
    on conflict (chave) do update set texto=excluded.texto, situacao=excluded.situacao, fonte=excluded.fonte,
    data_fonte=excluded.data_fonte, atualizado_por=excluded.atualizado_por, versao=memoria_vendax.versao+1, atualizado_em=now()
    where memoria_vendax.versao=$8 returning chave`, [cliente ? `cliente:${cliente}` : 'vendax', cliente, f.situacao, f.texto, f.fonte, f.data_fonte, u.id, versao]);
  return alteradas.length === 1;
}

export async function salvarConta(b: Banco, u: Usuario, cliente: string, entrada: unknown) {
  if (u.perfil !== 'admin') throw new SemAcesso();
  const a = conta.parse(entrada);
  return b.transacao(async q => {
    const [c] = await q.query('select id from clientes where id=$1 and not demo for update', [cliente]);
    if (!c) throw new SemAcesso();
    if (a.situacao === 'principal') await q.query(`update contas_anuncio set situacao='historica'
      where cliente_id=$1 and plataforma=$2 and conta_id<>$3 and situacao='principal'`, [cliente, a.plataforma, a.conta_id]);
    const resultado = await q.query(`insert into contas_anuncio (plataforma,conta_id,cliente_id,nome,situacao,fonte,data_fonte) values ($1,$2,$3,$4,$5,$6,$7)
      on conflict (plataforma,conta_id) do update set nome=excluded.nome, situacao=excluded.situacao, fonte=excluded.fonte,
      data_fonte=excluded.data_fonte where contas_anuncio.cliente_id=excluded.cliente_id returning conta_id`,
    [a.plataforma, a.conta_id, cliente, a.nome, a.situacao, a.fonte, a.data_fonte]);
    if (!resultado.length) throw new Error('A conta já pertence a outro cliente.');
  });
}

export async function fontesDaMemoria(q: Q, u: Usuario, cliente: string | null, area: string | null, tarefaId: string) {
  const fontes: EntradaAgente['conteudo_recuperado'] = [];
  if (!podeVer(u, cliente, area)) return fontes;
  const fichas = await Promise.all([lerFicha(q, u, null), cliente ? lerFicha(q, u, cliente) : null]);
  for (const [i, f] of fichas.entries()) if (f) fontes.push({
    fonte: `${i ? 'Ficha do cliente' : 'Memória operacional da Vendax'} · v${f.versao} · ${f.data_fonte}`,
    texto: `Situação registrada: ${f.situacao}\nOrigem: ${f.fonte}\n${f.texto}`,
  });
  if (!cliente) return fontes;
  const [contas, tarefas] = await Promise.all([
    lerContas(q, u, cliente),
    q.query<{ objetivo: string; estado: string; atualizado_em: string }>(
      `select left(objetivo,240) as objetivo,estado,atualizado_em::date::text as atualizado_em from tarefas
       where cliente_id=$1 and not demo and id<>$2 and fonte not in ('Chat com especialista', 'Chat com Diretor Geral') order by atualizado_em desc limit 8`, [cliente, tarefaId]),
  ]);
  if (contas.length) fontes.push({
    fonte: 'Contas de anúncios cadastradas para este cliente',
    texto: contas.map(c => `${c.plataforma} ${c.conta_id} (${c.nome}) · ${c.situacao} · ${c.data_fonte} · ${c.fonte}`).join('\n'),
  });
  if (tarefas.length) fontes.push({
    fonte: 'Tarefas recentes do cliente no Escritório',
    texto: tarefas.map(t => `${t.atualizado_em} · ${t.objetivo} · ${t.estado}`).join('\n'),
  });
  return fontes;
}
