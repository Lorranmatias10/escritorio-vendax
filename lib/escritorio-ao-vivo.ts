import { z } from 'zod';
import type { EstadoTarefa } from './catalogo';
import type { Q } from './db';
import { filtroSql, SemAcesso, type Usuario } from './escopo';
import { historicoEspecialista, type ConversaEspecialista, type TurnoEspecialista } from './chat-especialistas';

import { historicoDiretor, type TurnoDiretor } from './diretor';

export const TAMANHO_CHAT = 50;
export const destinoChat = z.string().min(1).max(100).nullable();
export const mensagemChat = z.object({
  destinatario: destinoChat,
  requisicao: z.uuid(),
  corpo: z.string().trim().min(1).max(2000),
});

export type MensagemChat = {
  id: string;
  autor_id: string;
  autor: string;
  corpo: string;
  criado_em: string;
};

export type TipoAtividade = 'delegada' | 'execucao_enfileirada' | 'execucao_iniciada' | 'execucao_concluida' | 'execucao_falhou' | 'execucao_bloqueada';
export type AtividadeAgente = {
  id: string;
  tipo: TipoAtividade;
  de: string;
  origem: string;
  para: string | null;
  destino: string | null;
  tarefa: string;
  objetivo: string;
  quando: string;
};
export type EstadoDaFila = { papel: string | null; estado: EstadoTarefa; total: number };
export type EscritorioAoVivo = { mensagens: MensagemChat[]; atividade: AtividadeAgente[]; fila: EstadoDaFila[]; conversa: TurnoEspecialista[]; diretor: TurnoDiretor[] };

export async function listarMensagensChat(q: Q, u: Usuario, destino: string | null, antes?: string) {
  const condicao = destino === null ? 'm.destinatario_id is null' :
    '((m.autor_id = $1 and m.destinatario_id = $2) or (m.autor_id = $2 and m.destinatario_id = $1))';
  const params: unknown[] = destino === null ? [] : [u.id, destino];
  const cursor = antes ? `and m.id < $${params.push(antes)}::bigint` : '';
  const linhas = await q.query<MensagemChat>(
    `select m.id::text as id, m.autor_id, u.nome as autor, m.corpo, m.criado_em
     from mensagens_escritorio m join usuarios u on u.id = m.autor_id
     where ${condicao} ${cursor} order by m.id desc limit ${TAMANHO_CHAT}`, params);
  return linhas.reverse();
}

export async function enviarMensagemChat(q: Q, u: Usuario, entrada: unknown) {
  const { destinatario, corpo, requisicao } = mensagemChat.parse(entrada);
  if (destinatario !== null && (destinatario === u.id || !(await q.query('select 1 from usuarios where id = $1', [destinatario])).length))
    throw new SemAcesso('Destinatário indisponível.');
  await q.query(
    `insert into mensagens_escritorio (autor_id, destinatario_id, corpo, requisicao) values ($1,$2,$3,$4)
     on conflict (autor_id, requisicao) do nothing`, [u.id, destinatario, corpo, requisicao]);
  const [salva] = await q.query<MensagemChat & { destinatario_id: string | null }>(
    `select m.id::text as id, m.autor_id, u.nome as autor, m.corpo, m.criado_em, m.destinatario_id
     from mensagens_escritorio m join usuarios u on u.id = m.autor_id where m.autor_id = $1 and m.requisicao = $2`, [u.id, requisicao]);
  if (!salva || salva.destinatario_id !== destinatario || salva.corpo !== corpo) throw new SemAcesso('A mensagem enviada mudou.');
  return { id: salva.id, autor_id: salva.autor_id, autor: salva.autor, corpo: salva.corpo, criado_em: salva.criado_em };
}

export async function atividadeAgentes(q: Q, u: Usuario, { somentePassagens = false, limite = 40 } = {}) {
  const params: unknown[] = [];
  const escopo = filtroSql(u, params, 't.cliente_id', 't.area_interna');
  const passagens = somentePassagens ? "and e.tipo = 'delegada'" : '';
  params.push(limite);
  return q.query<AtividadeAgente>(
    `select e.id::text as id, e.tipo, p.id as de, p.nome as origem, destino.id as para, destino.nome as destino,
       coalesce(sub.id, t.id)::text as tarefa, coalesce(sub.objetivo, t.objetivo) as objetivo, e.criado_em as quando
     from eventos_tarefa e
     join tarefas t on t.id = e.tarefa_id
     left join tarefas sub on e.tipo = 'delegada' and sub.parent_id = t.id and sub.id::text = e.dados->>'subtarefa'
       and sub.cliente_id is not distinct from t.cliente_id and sub.area_interna is not distinct from t.area_interna
     join papeis p on p.id = coalesce(e.dados->>'de', e.dados->>'papel',
       case when e.tipo = 'delegada' then (
         select x.papel_id from execucoes x join tarefas tx on tx.id = x.tarefa_id
         where (tx.id = t.id or tx.parent_id = t.id) and x.estado = 'concluida' and x.concluido_em <= e.criado_em
         order by x.concluido_em desc, x.id desc limit 1
       ) else e.ator end)
     left join papeis destino on destino.id = coalesce(e.dados->>'para', sub.papel_atual_id)
     where e.tipo in ('delegada', 'execucao_enfileirada', 'execucao_iniciada', 'execucao_concluida', 'execucao_falhou', 'execucao_bloqueada')
       and e.criado_em > now() - interval '7 days' and ${escopo} ${passagens}
       and (e.tipo <> 'delegada' or (sub.id is not null and destino.id <> p.id))
     order by e.criado_em desc, e.id desc limit $${params.length}`, params);
}

export async function estadoFila(q: Q, u: Usuario) {
  const params: unknown[] = [];
  const escopo = filtroSql(u, params, 't.cliente_id', 't.area_interna');
  return q.query<EstadoDaFila>(
    `select t.papel_atual_id as papel, t.estado, count(*)::int as total from tarefas t
     where t.estado not in ('concluida', 'cancelada') and ${escopo}
     group by 1,2 order by 1,2`, params);
}

export async function consultarEscritorio(q: Q, u: Usuario, destino: string | null, canal?: ConversaEspecialista, clienteDiretor?: string | null): Promise<EscritorioAoVivo> {
  const [mensagens, atividade, fila, conversa, diretor] = await Promise.all([
    canal || clienteDiretor !== undefined ? [] : listarMensagensChat(q, u, destino), atividadeAgentes(q, u), estadoFila(q, u),
    canal ? historicoEspecialista(q, u, canal) : [],
    clienteDiretor !== undefined ? historicoDiretor(q, u, clienteDiretor) : [],
  ]);
  return { mensagens, atividade, fila, conversa, diretor };
}
