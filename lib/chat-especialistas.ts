import { z } from 'zod';
import type { EstadoTarefa } from './catalogo';
import type { Q } from './db';
import { consultaAds } from './consulta-ads';
import { podeVer, type Usuario } from './escopo';
import { adaptadorDoPapel, claudeHomologado } from './ia';
import { FLUXOS_CLAUDE, FLUXOS_CLAUDE_IDS, PAPEIS_CLAUDE } from './skills-claude';

export const conversaEspecialista = z.object({
  fluxo: z.enum(FLUXOS_CLAUDE_IDS), cliente: z.string().min(1).max(150),
});
export type ConversaEspecialista = z.infer<typeof conversaEspecialista>;
export const pedidoChatEspecialista = conversaEspecialista.extend({
  id: z.uuid(), mensagem: z.string().trim().min(3).max(2000), dados: z.string().trim().max(20_000), consulta_ads: consultaAds.optional(),
});

export type TurnoEspecialista = {
  id: string;
  mensagem: string;
  resposta: string | null;
  estado: EstadoTarefa;
  pedido_em: string;
  resposta_em: string | null;
};

export async function fluxosDisponiveis(q: Q) {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const papeis = await q.query<{ id: string; claude_homologado_com: string }>(
    `select id, claude_homologado_com from papeis where id = any($1::text[]) and execucao_habilitada and claude_homologado_com is not null`, [PAPEIS_CLAUDE]);
  const prontos = await Promise.all(papeis.map(async p => ({ id: p.id, pronto: await claudeHomologado(p.id, p.claude_homologado_com, (await adaptadorDoPapel(p.id)).provedor) })));
  return FLUXOS_CLAUDE_IDS.filter(id => prontos.some(p => p.pronto && p.id === FLUXOS_CLAUDE[id].papel));
}

// A conversa pertence ao autor e ao cliente. O painel geral de tarefas usa seu próprio escopo.
export async function historicoEspecialista(q: Q, u: Usuario, canal: ConversaEspecialista, limite = 30) {
  if (!podeVer(u, canal.cliente, null)) return [];
  const recentes = await q.query<TurnoEspecialista>(
    `select t.id::text as id, e.entrada->'contexto'->>'mensagem_chat' as mensagem,
       coalesce(e.saida->>'rascunho', e.saida->>'resumo') as resposta, t.estado,
       t.criado_em as pedido_em, e.concluido_em as resposta_em
     from tarefas t join execucoes e on e.tarefa_id = t.id and e.etapa = 'analisar'
     where t.dono_humano_id = $1 and t.cliente_id = $2 and e.entrada->'contexto'->>'fluxo_claude' = $3
       and e.entrada->'contexto'->>'mensagem_chat' is not null and not t.demo
     order by t.criado_em desc, t.id desc limit $4`, [u.id, canal.cliente, canal.fluxo, limite]);
  return recentes.reverse();
}
