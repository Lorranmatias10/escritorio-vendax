import { z } from 'zod';
import { PAPEIS, type EstadoTarefa } from './catalogo';
import type { Q } from './db';
import { filtroSql, podeVer, type Usuario } from './escopo';
import { consultaAds } from './consulta-ads';
import { FLUXOS_CLAUDE, type FluxoClaude } from './skills-claude';

export const DIRETOR = 'diretor_operacoes';
export const clienteDiretor = z.string().min(1).max(150).nullable();
export const modosDiretor = ['responder', 'delegar', 'executar'] as const;
export type AutonomiaDiretor = typeof modosDiretor[number];

export const pedidoDiretor = z.object({
  id: z.uuid(), cliente: clienteDiretor, mensagem: z.string().trim().min(3).max(4000),
  consulta_ads: consultaAds.optional(), autonomia: z.enum(modosDiretor).optional(), criar_tarefas: z.boolean().optional(),
});

export const planoDiretor = z.object({
  delegacoes: z.array(z.object({ papel: z.string(), objetivo: z.string().trim().min(1).max(800) })).max(4),
  periodo_ads: consultaAds.optional().catch(undefined),
  excecao: z.string().trim().min(1).max(600).optional(),
});

export type TurnoDiretor = {
  id: string; mensagem: string; resposta: string | null; estado: EstadoTarefa;
  pedido_em: string; resposta_em: string | null; bloqueio: string | null; cliente_nome?: string | null;
  especialistas: { id: string; nome: string; estado: EstadoTarefa; resumo?: string | null }[];
};

export async function historicoDiretor(q: Q, u: Usuario, cliente: string | null, limite = 30, escopo?: string | null): Promise<TurnoDiretor[]> {
  if (!podeVer(u, cliente, 'direcao')) return [];
  const params: unknown[] = [u.id, cliente, limite];
  const visibilidade = filtroSql(u, params, 't.cliente_id', 't.area_interna');
  const mesmoEscopo = escopo === undefined ? '' : `and t.cliente_id is not distinct from $${params.push(escopo)}::text`;
  const recentes = await q.query<TurnoDiretor>(
    `select t.id::text as id, origem.entrada->'contexto'->>'mensagem_chat' as mensagem, t.estado, c.nome as cliente_nome,
       case when retorno.id is not null then coalesce(retorno.saida->>'rascunho', retorno.saida->>'resumo')
         when t.estado in ('concluida','bloqueada') then origem.saida->>'rascunho' end as resposta,
       t.criado_em as pedido_em,
       coalesce(retorno.concluido_em, case when retorno.id is null and t.estado in ('concluida','bloqueada')
         then origem.concluido_em end) as resposta_em, t.motivo_bloqueio as bloqueio,
       coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', p.nome, 'estado', s.estado,
         'resumo', left(apoio.saida->>'resumo', 360)) order by s.criado_em, s.id)
         from tarefas s join papeis p on p.id = s.papel_atual_id
         left join execucoes apoio on apoio.tarefa_id = s.id and apoio.etapa = 'analisar' and apoio.papel_id = p.id
         where s.parent_id = t.id and s.origem_evento_id like '%:diretor_apoio:%'), '[]'::jsonb) as especialistas
     from tarefas t join execucoes origem on origem.tarefa_id = t.id and origem.etapa = 'diretor_triagem'
     left join execucoes retorno on retorno.tarefa_id = t.id and retorno.etapa = 'diretor_revisao'
     left join clientes c on c.id = t.cliente_id
     where t.dono_humano_id = $1 and not t.demo and ${visibilidade} ${mesmoEscopo}
       and (case when origem.entrada->'contexto' ? 'cliente_chat' then origem.entrada->'contexto'->>'cliente_chat'
         else t.cliente_id end) is not distinct from $2::text
     order by t.criado_em desc, t.id desc limit $3`, params);
  return recentes.reverse();
}

export function fluxoDiretor(papel: string): FluxoClaude | undefined {
  return (Object.keys(FLUXOS_CLAUDE) as FluxoClaude[]).find(f => FLUXOS_CLAUDE[f].papel === papel);
}

export async function equipeDiretor(q: Q, u: Usuario, cliente: string | null) {
  if (!podeVer(u, cliente, 'direcao')) return [];
  const habilitados = await q.query<{ id: string }>('select id from papeis where execucao_habilitada');
  const ids = new Set(habilitados.map(p => p.id));
  return PAPEIS.filter(p => p.id !== DIRETOR && ids.has(p.id)
    && p.departamento !== 'financeiro'
    && (cliente || !fluxoDiretor(p.id)));
}

function termos(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function identificarClienteDiretor(q: Q, u: Usuario, mensagem: string) {
  const texto = ` ${termos(mensagem)} `;
  const clientes = (await q.query<{ id: string; nome: string }>('select id, nome from clientes where not demo'))
    .map(c => ({ ...c, nomeBusca: termos(c.nome).replace(/^(?:dra?|doutora?) /, '') }));
  const completos = clientes.filter(c => c.nomeBusca && texto.includes(` ${c.nomeBusca} `));
  let resto = texto;
  for (const c of completos) resto = resto.replaceAll(` ${c.nomeBusca} `, ' ');
  const chamados = new Set([...resto.matchAll(/\b(?:dra?|doutora?) ([a-z0-9]{3,})\b/g)].map(m => m[1]));
  const ids = new Set(completos.map(c => c.id));
  const citados = clientes.filter(c => ids.has(c.id) || chamados.has(c.nomeBusca.split(' ')[0]));
  const [candidato] = citados;
  const cliente = citados.length === 1 && podeVer(u, candidato.id, null) ? candidato : null;
  const motivo = citados.length > 1 ? 'ambiguidade' : candidato && !cliente ? 'sem_acesso' : null;
  return { cliente, motivo };
}

export function delegacoesRelatorioAds(mensagem: string) {
  const texto = termos(mensagem);
  if (!/\b(?:relatorio|diagnostico|analise|auditoria)\b/.test(texto)
    || !/\b(?:trafego|midia paga|campanhas?|google ads|meta ads|facebook ads|instagram ads)\b/.test(texto)
    || /\b(?:exemplo|modelo|template|rascunho|escreva (?:uma? )?(?:mensagem|frase|texto)|formate|reescreva|ja entregue|ja apurado|sem consultar|sem consulta|nao consulte|reaproveite)\b/.test(texto)) return [];
  const google = /\bgoogle ads\b/.test(texto);
  const meta = /\b(?:meta|facebook|instagram) ads\b/.test(texto);
  // Deixe exclusões de plataforma a cargo da triagem em linguagem natural.
  if ((google || meta) && /\b(?:sem|exceto|nao|menos|exclua|ou)\b/.test(texto)) return [];
  const fluxos: FluxoClaude[] = [];
  if (google || !meta) fluxos.push('google_ads');
  if (meta || !google) fluxos.push('meta_ads');
  return fluxos.map(f => ({ papel: FLUXOS_CLAUDE[f].papel, objetivo:
    `Prepare o relatório de ${FLUXOS_CLAUDE[f].nome} para o período solicitado. Inclua investimento, cliques, conversões por tipo, campanhas de maior impacto, lacunas e prioridades. Pedido: ${mensagem.slice(0, 360)}`,
  }));
}

const dataSP = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' });
export function periodoAdsPadrao(agora = new Date()) {
  const hoje = Date.parse(dataSP.format(agora));
  return { inicio: new Date(hoje - 30 * 86_400_000).toISOString().slice(0, 10),
    fim: new Date(hoje - 86_400_000).toISOString().slice(0, 10) };
}

export function periodoDoRelatorioAds(mensagem: string, dataPedido: Date | string) {
  if (!/\b(?:mes atual|mes corrente|este mes|nesse mes|neste mes)\b/.test(termos(mensagem))) return undefined;
  const fim = dataSP.format(new Date(dataPedido));
  return { inicio: `${fim.slice(0, 7)}-01`, fim };
}
