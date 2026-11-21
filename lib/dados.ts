// Leituras. Toda consulta aplica o escopo do usuário no servidor (filtroSql/podeVer),
// inclusive contadores e resumos.
import type { Q } from './db';
import { filtroSql, podeVer, type Usuario } from './escopo';
import type { StatusCliente } from './ficha-cliente';
import type { Rotina } from './agenda-rotinas';
import type { EstadoTarefa } from './catalogo';
import { atividadeAgentes } from './escritorio-ao-vivo';

export type TarefaLista = {
  id: string; parent_id: string | null; objetivo: string; estado: EstadoTarefa; prazo: string | null; proximo_passo: string | null;
  motivo_bloqueio: string | null; cliente_id: string | null; cliente_nome: string | null; area_interna: string | null;
  departamento_id: string; departamento_nome: string; papel_atual_id: string | null; papel_nome: string | null;
  dono_humano_id: string | null; dono_nome: string | null; demo: boolean; em_hoje: boolean; fonte: string; atualizado_em: string;
};

export type FiltroTarefas = {
  estado?: string; cliente?: string; dono?: string; de?: string; ate?: string; departamento?: string; papel?: string;
  abertas?: boolean; raiz?: boolean;
};

const SELECT_TAREFA = `
  select t.id, t.parent_id, t.objetivo, t.estado, t.prazo, t.proximo_passo, t.motivo_bloqueio, t.cliente_id, c.nome as cliente_nome,
         t.area_interna, t.departamento_id, d.nome as departamento_nome, t.papel_atual_id, p.nome as papel_nome,
         t.dono_humano_id, u.nome as dono_nome, t.demo, t.em_hoje, t.fonte, t.atualizado_em
  from tarefas t
  join departamentos d on d.id = t.departamento_id
  left join clientes c on c.id = t.cliente_id
  left join papeis p on p.id = t.papel_atual_id
  left join usuarios u on u.id = t.dono_humano_id`;

export async function listarTarefas(q: Q, u: Usuario, f: FiltroTarefas = {}) {
  const params: unknown[] = [];
  const where = [filtroSql(u, params, 't.cliente_id', 't.area_interna')];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (f.estado) add('t.estado = ?', f.estado);
  if (f.cliente) add('t.cliente_id = ?', f.cliente);
  if (f.dono) add('t.dono_humano_id = ?', f.dono);
  if (f.departamento) add('t.departamento_id = ?', f.departamento);
  if (f.papel) add('t.papel_atual_id = ?', f.papel);
  if (f.de) add(`coalesce(t.prazo, t.criado_em) >= (?::date)::timestamp at time zone 'America/Sao_Paulo'`, f.de);
  if (f.ate) add(`coalesce(t.prazo, t.criado_em) < ((?::date) + 1)::timestamp at time zone 'America/Sao_Paulo'`, f.ate);
  if (f.abertas) where.push(`t.estado not in ('concluida','cancelada')`);
  if (f.raiz) where.push('t.parent_id is null');
  return q.query<TarefaLista>(`${SELECT_TAREFA} where ${where.join(' and ')} order by t.prazo nulls last, t.atualizado_em desc`, params);
}

export async function obterTarefa(q: Q, u: Usuario, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [t] = await q.query<TarefaLista & { criterio_conclusao: string | null; origem_evento_id: string | null; origem_recebimentos: number; criado_em: string }>(
    `${SELECT_TAREFA.replace('t.atualizado_em', 't.atualizado_em, t.criterio_conclusao, t.origem_evento_id, t.origem_recebimentos, t.criado_em')} where t.id = $1`, [id]);
  if (!t || !podeVer(u, t.cliente_id, t.area_interna)) return null; // acesso indevido = não encontrado
  const [subtarefas, eventos, execucoes, evidencias, aprovacoes] = await Promise.all([
    q.query<TarefaLista>(`${SELECT_TAREFA} where t.parent_id = $1 order by t.criado_em`, [id]),
    q.query<{ id: number; tipo: string; descricao: string; ator: string; criado_em: string }>('select id, tipo, descricao, ator, criado_em from eventos_tarefa where tarefa_id = $1 order by criado_em, id', [id]),
    q.query<Execucao>(`select e.*, p.nome as papel_nome from execucoes e join papeis p on p.id = e.papel_id where e.tarefa_id = $1 order by e.criado_em`, [id]),
    q.query<{ id: number; tipo: string; descricao: string; referencia: string | null; criado_em: string }>('select id, tipo, descricao, referencia, criado_em from evidencias where tarefa_id = $1 order by id', [id]),
    q.query<Aprovacao>(`${SELECT_APROVACAO} where a.tarefa_id = $1`, [id]),
  ]);
  return { ...t, subtarefas, eventos, execucoes, evidencias, aprovacoes };
}

export type Execucao = {
  id: string; tarefa_id: string; papel_id: string; papel_nome: string; etapa: string; estado: string; tentativas: number;
  saida: import('./ia').SaidaAgente | null; erro: string | null; provedor: string | null; versao_instrucao: string | null; demo: boolean; criado_em: string; atualizado_em: string; concluido_em: string | null;
};

// ---------- Hoje ----------
export async function hoje(q: Q, u: Usuario) {
  const abertas = await listarTarefas(q, u, { abertas: true });
  const [aprov, incid] = await Promise.all([listarAprovacoes(q, u, 'pendente'), listarIncidentes(q, u, { abertos: true })]);
  return {
    pendencias: abertas.filter(t => t.estado !== 'bloqueada' && t.dono_humano_id && t.prazo)
      .sort((a, b) => Number(b.em_hoje) - Number(a.em_hoje) || +new Date(a.prazo!) - +new Date(b.prazo!)),
    bloqueadas: abertas.filter(t => t.estado === 'bloqueada' || t.estado === 'falhou'),
    aprovacoes: aprov,
    incidentes: incid,
  };
}

// ---------- Escritório (prédio e lista usam a mesma fonte) ----------
export type Sala = {
  id: string; andar: number; nome: string; responsavel_humano: string; fila: string;
  contagem: Partial<Record<EstadoTarefa, number>>; abertas: number;
  papeis: Papel[];
};
export type Papel = {
  id: string; nome: string; departamento_id: string; fase: 'piloto' | 'fase_2' | 'fase_3'; responsavel_proposto: string; modo: string;
  estado_config: 'aguardando_configuracao' | 'em_homologacao' | 'habilitado' | 'desabilitado'; execucao_habilitada: boolean;
  versao_instrucao: string | null; vinculo_reservado: string | null;
  fontes: string[]; ferramentas: string[]; limites: string | null; como_desabilitar: string | null; homologado_com: string | null;
  claude_homologado_com: string | null; claude_versao_instrucao: string | null;
};

export async function salas(q: Q, u: Usuario, estado?: string) {
  const params: unknown[] = [];
  const escopo = filtroSql(u, params, 't.cliente_id', 't.area_interna');
  const [deptos, papeis, contagens] = await Promise.all([
    q.query<Omit<Sala, 'contagem' | 'abertas' | 'papeis'>>('select id, andar, nome, responsavel_humano, fila from departamentos order by andar desc, ordem'),
    q.query<Papel>('select * from papeis order by ordem'),
    q.query<{ departamento_id: string; estado: EstadoTarefa; n: number }>(
      `select t.departamento_id, t.estado, count(*)::int as n from tarefas t where ${escopo} group by 1, 2`, params),
  ]);
  return deptos.map(d => {
    const contagem: Sala['contagem'] = {};
    for (const c of contagens) if (c.departamento_id === d.id && (!estado || c.estado === estado)) contagem[c.estado] = c.n;
    const abertas = Object.entries(contagem).filter(([e]) => e !== 'concluida' && e !== 'cancelada').reduce((s, [, n]) => s + (n ?? 0), 0);
    return { ...d, contagem, abertas, papeis: papeis.filter(p => p.departamento_id === d.id) };
  });
}

export async function obterPapel(q: Q, u: Usuario, id: string) {
  const [p] = await q.query<Papel & { departamento_nome: string }>('select p.*, d.nome as departamento_nome from papeis p join departamentos d on d.id = p.departamento_id where p.id = $1', [id]);
  if (!p) return null;
  const params: unknown[] = [id];
  const escopo = filtroSql(u, params, 't.cliente_id', 't.area_interna');
  // Histórico autorizado: só execuções de tarefas que o usuário pode ver.
  const historico = await q.query<Execucao & { objetivo: string }>(
    `select e.*, p.nome as papel_nome, t.objetivo from execucoes e join tarefas t on t.id = e.tarefa_id join papeis p on p.id = e.papel_id
     where e.papel_id = $1 and ${escopo} order by e.atualizado_em desc limit 15`, params);
  const [instrucoes, registro, homologacao, homologacaoClaude] = await Promise.all([
    q.query<{ id: string; versao: string; estado: string; criado_em: string; conteudo: string }>(
      'select id, versao, estado, criado_em, conteudo from instrucoes where papel_id = $1 order by criado_em desc', [id]),
    q.query<{ id: number; acao: string; detalhe: string; ator: string; criado_em: string }>(
      'select id, acao, detalhe, ator, criado_em from registro_configuracao where papel_id = $1 order by id desc', [id]),
    ultimaHomologacao(q, id),
    ultimaHomologacao(q, id, 'claude'),
  ]);
  return { ...p, historico, instrucoes, registro, homologacao, homologacaoClaude };
}

// ---------- Clientes, entregas, incidentes ----------
export async function clientesVisiveis(q: Q, u: Usuario) {
  const params: unknown[] = [];
  return q.query<{ id: string; nome: string; demo: boolean; status: StatusCliente | null; responsavel: string | null }>(
    `select c.id,c.nome,c.demo,c.status,u.nome as responsavel from clientes c left join usuarios u on u.id=c.responsavel_id where ${filtroSql(u, params, 'c.id', null)} order by c.nome`, params);
}

export async function listarEntregas(q: Q, u: Usuario, f: { cliente?: string; de?: string; ate?: string } = {}) {
  const params: unknown[] = [];
  const where = [filtroSql(u, params, 'e.cliente_id', null)];
  if (f.cliente) { params.push(f.cliente); where.push(`e.cliente_id = $${params.length}`); }
  if (f.de) { params.push(f.de); where.push(`e.prazo >= ($${params.length}::date)::timestamp at time zone 'America/Sao_Paulo'`); }
  if (f.ate) { params.push(f.ate); where.push(`e.prazo < (($${params.length}::date) + 1)::timestamp at time zone 'America/Sao_Paulo'`); }
  return q.query<{ id: number; titulo: string; prazo: string | null; estado: string; cliente_id: string; cliente_nome: string; tarefa_id: string | null; demo: boolean }>(
    `select e.id, e.titulo, e.prazo, e.estado, e.cliente_id, c.nome as cliente_nome, e.tarefa_id, e.demo from entregas e join clientes c on c.id = e.cliente_id
     where ${where.join(' and ')} order by e.prazo nulls last`, params);
}

export async function listarIncidentes(q: Q, u: Usuario, f: { cliente?: string; abertos?: boolean } = {}) {
  const params: unknown[] = [];
  const where = [filtroSql(u, params, 'i.cliente_id', 'i.area_interna')];
  if (f.cliente) { params.push(f.cliente); where.push(`i.cliente_id = $${params.length}`); }
  if (f.abertos) where.push(`i.estado <> 'resolvido'`);
  return q.query<{ id: number; titulo: string; severidade: string; estado: string; cliente_id: string | null; cliente_nome: string | null; area_interna: string | null; tarefa_id: string | null; demo: boolean; criado_em: string }>(
    `select i.id, i.titulo, i.severidade, i.estado, i.cliente_id, c.nome as cliente_nome, i.area_interna, i.tarefa_id, i.demo, i.criado_em
     from incidentes i left join clientes c on c.id = i.cliente_id where ${where.join(' and ')} order by i.criado_em desc`, params);
}

// ---------- Aprovações ----------
export type Aprovacao = {
  id: string; tarefa_id: string; modo: string; intencao: string; alvo: string; conta: string; parametros: Record<string, unknown>;
  prazo: string; aprovador_id: string; aprovador_nome: string; estado: string; decisao_nota: string | null; decidido_por_nome: string | null;
  decidido_em: string | null; execucao_externa: string; demo: boolean; objetivo: string; cliente_nome: string | null; criado_em: string;
};
const SELECT_APROVACAO = `
  select a.*, ua.nome as aprovador_nome, ud.nome as decidido_por_nome, t.objetivo, c.nome as cliente_nome
  from aprovacoes a join tarefas t on t.id = a.tarefa_id left join clientes c on c.id = t.cliente_id
  join usuarios ua on ua.id = a.aprovador_id left join usuarios ud on ud.id = a.decidido_por`;

export async function listarAprovacoes(q: Q, u: Usuario, estado?: string) {
  const params: unknown[] = [];
  const where = [filtroSql(u, params, 't.cliente_id', 't.area_interna')];
  if (estado) { params.push(estado); where.push(`a.estado = $${params.length}`); }
  return q.query<Aprovacao>(`${SELECT_APROVACAO} where ${where.join(' and ')} order by a.criado_em desc`, params);
}

// ---------- Catálogo ----------
export async function catalogo(q: Q) {
  const [andares, deptos, papeis, integracoes] = await Promise.all([
    q.query<{ numero: number; nome: string }>('select * from andares order by numero desc'),
    q.query<{ id: string; nome: string; andar: number; responsavel_humano: string }>('select * from departamentos order by andar desc, ordem'),
    q.query<Papel & { departamento_nome: string }>('select p.*, d.nome as departamento_nome from papeis p join departamentos d on d.id = p.departamento_id order by d.andar desc, d.ordem, p.ordem'),
    q.query<{ id: string; nome: string; estado: string; observacao: string | null }>('select * from integracoes order by nome'),
  ]);
  return { andares, deptos, papeis, integracoes };
}

export async function usuarios(q: Q) {
  return q.query<{ id: string; nome: string; perfil: string }>('select id, nome, perfil from usuarios order by perfil, nome');
}

// ---------- Homologação ----------
export type CasoHomologacao = { caso: string; esperado: string; passou: boolean; evidencia: Record<string, unknown>; versao: string; rodada: string; executado_em: string; executado_por: string };
// ---------- Comunicação entre agentes (passagens de tarefa) ----------
// Cada delegação registrada vira uma "conversa": o papel que concluiu a etapa leva o trabalho ao papel de destino.
// Respeita o mesmo escopo de visibilidade da tarefa de origem.
export type Conversa = { id: string; de: string; para: string; quando: string; objetivo: string };
export async function conversasRecentes(q: Q, u: Usuario, limite = 8): Promise<Conversa[]> {
  return (await atividadeAgentes(q, u, { somentePassagens: true, limite })).flatMap(c =>
    c.para ? [{ id: c.id, de: c.de, para: c.para, quando: c.quando, objetivo: c.objetivo }] : []);
}

export async function ultimaHomologacao(q: Q, papel?: string, tipo: 'padrao' | 'claude' = 'padrao') {
  const [ult] = await q.query<{ rodada: string }>(`select rodada from homologacoes
    where ($1::text is null or $1 = any(papeis)) and (coalesce(evidencia->>'provedor', '') like 'claude:%') = $2
    order by executado_em desc, id desc limit 1`, [papel ?? null, tipo === 'claude']);
  if (!ult) return null;
  const casos = await q.query<CasoHomologacao>(
    `select h.caso, h.esperado, h.passou, h.evidencia, h.versao, h.rodada, h.executado_em, u.nome as executado_por
     from homologacoes h join usuarios u on u.id = h.executado_por where h.rodada = $1 and ($2::text is null or $2 = any(h.papeis)) order by h.id`, [ult.rodada, papel ?? null]);
  return { rodada: ult.rodada, versao: casos[0].versao, executado_em: casos[0].executado_em, executado_por: casos[0].executado_por, aprovado: casos.every(c => c.passou), casos };
}


export async function auditoriaCliente(q: Q, u: Usuario, cliente: string) {
  if (u.perfil !== 'admin' || !podeVer(u,cliente,null)) return [];
  return q.query<{ id: number; acao: string; detalhe: string; ator: string; criado_em: string }>(
    `select a.id,a.acao,a.detalhe,u.nome as ator,a.criado_em from clientes_auditoria a
     join usuarios u on u.id=a.ator_id where a.cliente_id=$1 order by a.id desc limit 30`,[cliente]);
}

export async function listarRotinas(q: Q, u: Usuario) {
  if (u.perfil !== 'admin') return [];
  return q.query<Rotina & { papel: string; cliente: string | null; area: string | null; dono: string; aprovador: string }>(
    `select r.*,p.nome as papel,c.nome as cliente,d.nome as area,x.nome as dono,y.nome as aprovador from rotinas r
     join papeis p on p.id=r.papel_id left join clientes c on c.id=r.cliente_id
     left join departamentos d on d.id=r.area_interna join usuarios x on x.id=r.dono_id join usuarios y on y.id=r.aprovador_id
     order by r.ativa desc,r.proxima_execucao nulls last,r.nome,r.id`);
}

export async function historicoRotina(q: Q, u: Usuario, id: string) {
  if (u.perfil !== 'admin') return [];
  return q.query<{id: number; janela: string; origem: 'agenda'|'manual'; estado: 'ignorada'|'disparada';
    motivo: string; tarefa_id: string|null; criado_em: string}>(
    'select * from rotinas_execucoes where rotina_id=$1 order by id desc limit 40',[id]);
}
