// Orquestração: fila persistida (tabela execucoes), executor sob demanda, delegação, aprovações.
// Toda escrita passa por aqui: autorização centralizada (podeVer / alçada) e registro de eventos.
import type { Banco, Q } from './db';
import { podeVer, SemAcesso, type Usuario } from './escopo';
import { SaidaAgente, adaptadorConfigurado, type AdaptadorModelo, type EntradaAgente } from './ia';

type TarefaRow = {
  id: string; parent_id: string | null; cliente_id: string | null; area_interna: string | null; departamento_id: string;
  dono_humano_id: string | null; estado: string; demo: boolean; objetivo: string; origem_evento_id: string | null;
};
type Papel = { id: string; nome: string; fase: string; modo: string; estado_config: string; execucao_habilitada: boolean; versao_instrucao: string | null; homologado_com: string | null };
type ExecRow = { id: string; tarefa_id: string; papel_id: string; etapa: string; estado: string; tentativas: number; entrada: EntradaAgente; demo: boolean };

export async function registrarEvento(q: Q, tarefaId: string, tipo: string, descricao: string, ator: string, dados?: unknown) {
  await q.query('insert into eventos_tarefa (tarefa_id, tipo, descricao, ator, dados) values ($1,$2,$3,$4,$5)', [tarefaId, tipo, descricao, ator, dados ?? null]);
}

async function carregarTarefa(q: Q, id: string) {
  const [t] = await q.query<TarefaRow>('select * from tarefas where id = $1', [id]);
  return t;
}

async function autorizarTarefa(q: Q, u: Usuario, id: string) {
  const t = await carregarTarefa(q, id);
  if (!t || !podeVer(u, t.cliente_id, t.area_interna)) throw new SemAcesso();
  return t;
}

async function deptoDoPapel(q: Q, papel: string) {
  const [p] = await q.query<{ departamento_id: string }>('select departamento_id from papeis where id = $1', [papel]);
  if (!p) throw new Error(`Papel desconhecido: ${papel}`);
  return p.departamento_id;
}

// Enfileira uma execução. chave_dedup garante que a mesma etapa da mesma tarefa não roda duas vezes.
export async function enfileirar(q: Q, tarefaId: string, papel: string, etapa: string, entrada: EntradaAgente, demo: boolean) {
  const r = await q.query<{ id: string }>(
    `insert into execucoes (tarefa_id, papel_id, etapa, chave_dedup, estado, entrada, demo) values ($1,$2,$3,$4,'na_fila',$5,$6)
     on conflict (chave_dedup) do nothing returning id`,
    [tarefaId, papel, etapa, `${tarefaId}:${papel}:${etapa}`, entrada, demo]);
  if (r.length) await registrarEvento(q, tarefaId, 'execucao_enfileirada', `Execução "${etapa}" enfileirada para ${papel}.`, 'sistema');
  return r[0]?.id ?? null;
}

// Delegação: cria (ou reaproveita) a subtarefa vinculada e enfileira a etapa do papel de destino.
async function delegar(q: Q, pai: TarefaRow, papel: string, etapa: string, objetivo: string, entrada: EntradaAgente) {
  const depto = await deptoDoPapel(q, papel);
  const origem = `${pai.id}:delegacao:${etapa}`;
  const [sub] = await q.query<{ id: string }>(
    `insert into tarefas (parent_id, cliente_id, area_interna, departamento_id, papel_atual_id, dono_humano_id, objetivo, fonte, origem_evento_id, estado, demo, criterio_conclusao, proximo_passo)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'na_fila',$10,'Execução do papel concluída com saída válida', 'Executar etapa: ' || $11)
     on conflict (origem_evento_id) do update set atualizado_em = now() returning id`,
    [pai.id, pai.cliente_id, pai.area_interna, depto, papel, pai.dono_humano_id, objetivo, `Delegada pela tarefa ${pai.id.slice(0, 8)}`, origem, pai.demo, etapa]);
  await registrarEvento(q, pai.id, 'delegada', `Subtarefa delegada para ${papel}: ${objetivo}`, 'sistema', { subtarefa: sub.id });
  await registrarEvento(q, sub.id, 'criada', `Recebida por delegação da tarefa de origem.`, 'sistema', { origem: pai.id });
  await enfileirar(q, sub.id, papel, etapa, entrada, pai.demo);
  return sub.id;
}

async function evidencia(q: Q, tarefaId: string, execId: string | null, chave: string, tipo: string, descricao: string, referencia?: string) {
  await q.query('insert into evidencias (tarefa_id, execucao_id, chave_dedup, tipo, descricao, referencia) values ($1,$2,$3,$4,$5,$6) on conflict (chave_dedup) do nothing',
    [tarefaId, execId, chave, tipo, descricao, referencia ?? null]);
}

// ---------- Evento de reunião (entrada do piloto) ----------
export type EventoReuniao = { id: string; cliente_id: string; titulo: string; dono_id: string; transcricao: string; prazo: string; demo: boolean };

export async function receberEventoReuniao(b: Banco, u: Usuario, ev: EventoReuniao) {
  if (!podeVer(u, ev.cliente_id, null)) throw new SemAcesso('Sem acesso ao cliente deste evento.');
  return b.transacao(async q => {
    const [existente] = await q.query<{ id: string; origem_recebimentos: number }>('select id, origem_recebimentos from tarefas where origem_evento_id = $1', [ev.id]);
    if (existente) {
      // Evento repetido: mantém um registro só e atualiza a execução correspondente pelo identificador de origem.
      const n = existente.origem_recebimentos + 1;
      await q.query('update tarefas set origem_recebimentos = $2, atualizado_em = now() where id = $1', [existente.id, n]);
      await q.query(`update execucoes set entrada = jsonb_set(entrada, '{contexto,recebimentos}', to_jsonb($2::int)), atualizado_em = now() where chave_dedup = $1`,
        [`${existente.id}:gerente_contas:organizar`, n]);
      await registrarEvento(q, existente.id, 'evento_repetido', `Evento de origem recebido de novo (${n}ª vez). Nenhum registro duplicado.`, u.nome, { origem: ev.id });
      return { tarefaId: existente.id, repetido: true };
    }
    const [dono] = await q.query<{ nome: string }>('select nome from usuarios where id = $1', [ev.dono_id]);
    const [t] = await q.query<{ id: string }>(
      `insert into tarefas (cliente_id, departamento_id, papel_atual_id, dono_humano_id, objetivo, fonte, origem_evento_id, prazo, estado, demo, criterio_conclusao, proximo_passo)
       values ($1,'contas','gerente_contas',$2,$3,$4,$5,$6,'na_fila',$7,$8,'Gerente de Contas organiza entregas e pendências')
       returning id`,
      [ev.cliente_id, ev.dono_id, `Briefing da carteira piloto · ${ev.titulo}`, `Reunião: ${ev.titulo}${ev.demo ? ' (evento sintético · Demonstração)' : ''}`,
       ev.id, ev.prazo, ev.demo, 'Decisão humana registrada sobre os prazos sem confirmação']);
    await registrarEvento(q, t.id, 'criada', `Tarefa criada a partir do evento de reunião ${ev.id}.`, 'sistema');
    await enfileirar(q, t.id, 'gerente_contas', 'organizar', {
      papel_id: 'gerente_contas', etapa: 'organizar',
      instrucao_operacional: 'Organize entregas, pendências, donos e prazos citados. Não envie nada ao cliente.',
      conteudo_recuperado: [{ fonte: `Transcrição: ${ev.titulo}`, texto: ev.transcricao }],
      contexto: { dono_nome: dono?.nome, recebimentos: 1 },
    }, ev.demo);
    return { tarefaId: t.id, repetido: false };
  });
}

// ---------- Executor (sob demanda; sem serviço permanente por especialista) ----------
export async function processarFila(b: Banco, adaptador: AdaptadorModelo = adaptadorConfigurado(), limite = 25) {
  const feitas: string[] = [];
  for (let i = 0; i < limite; i++) {
    const [ex] = await b.query<ExecRow>(`select * from execucoes where estado = 'na_fila' order by criado_em, id limit 1`);
    if (!ex) break;
    await executar(b, ex, adaptador);
    feitas.push(ex.id);
  }
  return feitas;
}

async function executar(b: Banco, ex: ExecRow, adaptador: AdaptadorModelo) {
  const tentativa = ex.tentativas + 1;
  await b.query(`update execucoes set estado = 'em_execucao', tentativas = $2, provedor = $3, atualizado_em = now() where id = $1`, [ex.id, tentativa, adaptador.provedor]);
  await b.query(`update tarefas set estado = 'em_execucao', papel_atual_id = $2, atualizado_em = now() where id = $1`, [ex.tarefa_id, ex.papel_id]);
  const [papel] = await b.query<Papel>('select * from papeis where id = $1', [ex.papel_id]);

  // Habilitado = homologado. Antes disso, só o piloto roda, e só em demonstração. Papel desabilitado nunca roda.
  // A habilitação vale para o provedor/modelo homologado; outro provedor só roda em demonstração.
  const homologadoAqui = papel.execucao_habilitada && papel.homologado_com === adaptador.provedor;
  const podeRodar = homologadoAqui || (ex.demo && papel.fase === 'piloto' && papel.estado_config !== 'desabilitado');
  if (!podeRodar) {
    const msg = papel.execucao_habilitada && papel.homologado_com !== adaptador.provedor
      ? `${papel.nome} foi homologado com ${papel.homologado_com ?? 'outro provedor'}; o provedor atual é ${adaptador.provedor}. Rode a homologação de novo.`
      : papel.estado_config === 'desabilitado' && papel.fase === 'piloto'
      ? `Execução desabilitada para ${papel.nome} (papel desabilitado pela direção).`
      : `Execução desabilitada para ${papel.nome} (aguarda instrução e homologação).`;
    await b.query(`update execucoes set estado = 'falhou', erro = $2, atualizado_em = now() where id = $1`, [ex.id, msg]);
    await b.query(`update tarefas set estado = 'bloqueada', motivo_bloqueio = $2 where id = $1`, [ex.tarefa_id, msg]);
    await registrarEvento(b, ex.tarefa_id, 'execucao_bloqueada', msg, 'sistema');
    return;
  }
  // Instrução: a versão ativa do papel; antes da homologação, a versão mais recente em homologação.
  const [instr] = await b.query<{ versao: string; conteudo: string }>(
    `select versao, conteudo from instrucoes where papel_id = $1 and ($2::text is null or versao = $2) order by criado_em desc limit 1`,
    [ex.papel_id, papel.versao_instrucao]);
  await b.query('update execucoes set versao_instrucao = $2 where id = $1', [ex.id, instr?.versao ?? null]);

  try {
    const saida = garantirContrato(ex.entrada, SaidaAgente.parse(await adaptador.executar(ex.entrada, instr ?? null, tentativa)), papel);
    await b.transacao(async q => {
      await aplicarEfeitos(q, ex, saida, papel);
      await q.query(`update execucoes set estado = 'concluida', saida = $2, erro = null, concluido_em = now(), atualizado_em = now() where id = $1`, [ex.id, saida]);
      await registrarEvento(q, ex.tarefa_id, 'execucao_concluida', `${papel.nome} concluiu "${ex.etapa}" (tentativa ${tentativa}).`, ex.papel_id);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await b.query(`update execucoes set estado = 'falhou', erro = $2, atualizado_em = now() where id = $1`, [ex.id, msg]);
    await b.query(`update tarefas set estado = 'falhou', motivo_bloqueio = $2, proximo_passo = 'Retomar a execução após corrigir a causa', atualizado_em = now() where id = $1`, [ex.tarefa_id, msg]);
    await registrarEvento(b, ex.tarefa_id, 'execucao_falhou', `Falha na tentativa ${tentativa}: ${msg}`, ex.papel_id);
  }
}

// Garantias do contrato que não dependem do modelo: o sistema sabe quais fontes foram entregues e se estão disponíveis.
function garantirContrato(e: EntradaAgente, s: SaidaAgente, papel: Papel): SaidaAgente {
  const fontes = [...s.fontes];
  for (const c of e.conteudo_recuperado) {
    const disp = c.disponivel !== false;
    const f = fontes.find(x => x.nome === c.fonte);
    if (f) f.disponivel = disp; else fontes.push({ nome: c.fonte, disponivel: disp });
  }
  const lacunas = [...s.lacunas];
  for (const c of e.conteudo_recuperado.filter(c => c.disponivel === false))
    if (!lacunas.some(l => l.includes(c.fonte) && /Integração pendente/i.test(l)))
      lacunas.push(`${c.fonte}: Integração pendente${c.resolve ? ` — quem resolve: ${c.resolve}` : ''}`);
  // A1 = consulta e rascunho: nada foi executado, então não há efeito confirmado.
  // Parecer e gravidade são do Auditor de Qualidade; em outras etapas o sistema descarta.
  const auditoria = e.etapa === 'auditar';
  return { ...s, fontes, lacunas, efeito_confirmado: papel.modo === 'A1' ? null : s.efeito_confirmado,
    parecer: auditoria ? s.parecer : undefined, gravidade: auditoria ? s.gravidade : undefined };
}

// Efeitos de cada etapa. Todos idempotentes (chaves de deduplicação), para retomada sem duplicar.
async function aplicarEfeitos(q: Q, ex: ExecRow, s: SaidaAgente, papel: Papel) {
  const t = await carregarTarefa(q, ex.tarefa_id);
  for (const [i, f] of s.fontes.entries()) await evidencia(q, t.id, ex.id, `${ex.id}:fonte:${i}`, 'fonte', `${f.nome}${f.disponivel ? '' : ' — Integração pendente'}`, f.referencia);
  if (s.rascunho) await evidencia(q, t.id, ex.id, `${ex.id}:rascunho`, 'rascunho', s.rascunho);
  const concluirSub = async () => {
    await q.query(`update tarefas set estado = 'concluida', motivo_bloqueio = null, proximo_passo = $2, atualizado_em = now() where id = $1`, [t.id, s.proxima_acao]);
  };
  const pai = t.parent_id ? await carregarTarefa(q, t.parent_id) : t;

  if (ex.etapa === 'organizar') {
    // A1 (consulta e rascunho): os itens ficam no rascunho. A2+ grava as entregas pelo fluxo autorizado.
    if (papel.modo !== 'A1') for (const [i, it] of (s.itens ?? []).entries())
      if (t.cliente_id) await q.query(
        `insert into entregas (cliente_id, tarefa_id, chave_dedup, titulo, estado, demo) values ($1,$2,$3,$4,'planejada',$5) on conflict (chave_dedup) do nothing`,
        [t.cliente_id, t.id, `${t.id}:entrega:${i}`, `${it.titulo}${it.prazo ? ` (prazo citado: ${it.prazo})` : ''}`, t.demo]);
    await q.query(`update tarefas set estado = 'em_execucao', proximo_passo = $2, atualizado_em = now() where id = $1`, [t.id, s.proxima_acao]);
    await delegar(q, t, 'auditor_qualidade', 'auditar', 'Auditar o plano da carteira contra a reunião', {
      ...ex.entrada, papel_id: 'auditor_qualidade', etapa: 'auditar',
      instrucao_operacional: 'Confira o plano com a fonte. Aponte prazos, números ou escopos sem confirmação.',
      conteudo_recuperado: [...ex.entrada.conteudo_recuperado, { fonte: 'Relatório de performance (Reportei)', texto: '', disponivel: false, resolve: 'Lorran (integrações)' }],
    });
  } else if (ex.etapa === 'auditar') {
    await concluirSub();
    for (const [i, a] of s.afirmacoes.filter(x => x.tipo === 'fato').entries())
      await evidencia(q, pai.id, ex.id, `${ex.id}:achado:${i}`, 'fonte', `Auditor: ${a.texto}`, 'Transcrição da reunião');
    await delegar(q, pai, 'diretor_operacoes', 'priorizar', 'Priorizar o briefing e definir quem decide', {
      ...ex.entrada, papel_id: 'diretor_operacoes', etapa: 'priorizar',
      instrucao_operacional: 'Priorize, atribua quem decide e coloque o briefing em Hoje. Nenhuma ação externa.',
      contexto: { ...ex.entrada.contexto, lacunas: s.lacunas,
        mensagem_sugerida: 'Olá! Confirmando o combinado na reunião: a landing page de implantes fica pronta até sexta-feira. Podemos considerar esse prazo?' },
    });
  } else if (ex.etapa === 'priorizar') {
    await concluirSub();
    const prazo = new Date(Date.now() + 2 * 86_400_000).toISOString();
    await q.query(
      `update tarefas set estado = 'aguardando_aprovacao', em_hoje = true, papel_atual_id = 'diretor_operacoes', prazo = $2, motivo_bloqueio = null, proximo_passo = $3, atualizado_em = now() where id = $1`,
      [pai.id, prazo, s.proxima_acao]);
    await q.query(
      `insert into aprovacoes (tarefa_id, chave_dedup, intencao, alvo, conta, parametros, prazo, aprovador_id, demo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (chave_dedup) do nothing`,
      [pai.id, `${pai.id}:aprovacao:confirmar-prazo`, 'Enviar ao cliente a confirmação do prazo da landing page',
       'WhatsApp · contato fictício da Clínica Aurora', 'WhatsApp oficial Vendax (Demonstração)',
       { canal: 'whatsapp', destinatario: 'Contato fictício da Clínica Aurora', mensagem: s.rascunho, envio: 'imediato após aprovação' },
       prazo, pai.dono_humano_id, pai.demo]);
    await registrarEvento(q, pai.id, 'em_hoje', `Briefing priorizado e colocado em Hoje. Quem decide: ${s.responsavel_humano}.`, 'diretor_operacoes');
  } else if (ex.etapa === 'consultar_fonte') {
    await q.query(`update tarefas set estado = 'bloqueada', motivo_bloqueio = $2, proximo_passo = $3, atualizado_em = now() where id = $1`,
      [t.id, s.lacunas.join(' · '), s.proxima_acao]);
    await registrarEvento(q, t.id, 'fonte_ausente', `Fonte indisponível: ${s.lacunas.join(' · ')}`, ex.papel_id);
  } else {
    await q.query(`update tarefas set estado = 'concluida', motivo_bloqueio = null, proximo_passo = $2, atualizado_em = now() where id = $1`, [t.id, s.proxima_acao]);
  }
}

// ---------- Retomada ----------
export async function retomarExecucao(b: Banco, u: Usuario, execId: string) {
  const [ex] = await b.query<ExecRow>('select * from execucoes where id = $1', [execId]);
  if (!ex) throw new SemAcesso();
  const t = await autorizarTarefa(b, u, ex.tarefa_id);
  if (u.perfil !== 'admin' && u.id !== t.dono_humano_id) throw new SemAcesso('Só o dono da tarefa ou a direção pode retomar.');
  if (ex.estado !== 'falhou') return;
  await b.query(`update execucoes set estado = 'na_fila', atualizado_em = now() where id = $1`, [execId]);
  await registrarEvento(b, ex.tarefa_id, 'retomada', `Execução "${ex.etapa}" retomada por ${u.nome}.`, u.nome);
  await processarFila(b);
}

// ---------- Aprovações (A3) ----------
export async function decidirAprovacao(b: Banco, u: Usuario, aprovacaoId: string, decisao: 'aprovada' | 'rejeitada', nota: string) {
  const [ap] = await b.query<{ id: string; tarefa_id: string; aprovador_id: string; estado: string; prazo: string; intencao: string }>('select * from aprovacoes where id = $1', [aprovacaoId]);
  if (!ap) throw new SemAcesso();
  await autorizarTarefa(b, u, ap.tarefa_id);
  if (u.id !== ap.aprovador_id && u.perfil !== 'admin') throw new SemAcesso('Somente o aprovador designado ou a direção pode decidir.');
  if (ap.estado !== 'pendente') return { estado: ap.estado, externa: 'desabilitada_v1' as const };
  return b.transacao(async q => {
    if (new Date(ap.prazo) < new Date()) {
      await q.query(`update aprovacoes set estado = 'expirada' where id = $1`, [ap.id]);
      await registrarEvento(q, ap.tarefa_id, 'aprovacao_expirada', 'Aprovação expirada: o prazo passou antes da decisão.', 'sistema');
      return { estado: 'expirada', externa: 'desabilitada_v1' as const };
    }
    await q.query(`update aprovacoes set estado = $2, decisao_nota = $3, decidido_por = $4, decidido_em = now() where id = $1`, [ap.id, decisao, nota || null, u.id]);
    await registrarEvento(q, ap.tarefa_id, 'aprovacao_decidida', `${u.nome} ${decisao === 'aprovada' ? 'aprovou' : 'rejeitou'}: ${ap.intencao}.`, u.nome, { nota });
    // V1: nenhuma ação externa roda, nem depois da aprovação.
    await registrarEvento(q, ap.tarefa_id, 'acao_externa_bloqueada', 'Execução externa desabilitada na V1: nada foi enviado. A decisão ficou registrada.', 'sistema');
    if (decisao === 'aprovada')
      await evidencia(q, ap.tarefa_id, null, `${ap.id}:acao_solicitada`, 'acao_solicitada', `${ap.intencao} — aprovada por ${u.nome}; não executada (V1, sem resultado confirmado).`);
    // Critério de conclusão da tarefa de origem: decisão humana registrada.
    await q.query(`update tarefas set estado = 'concluida', proximo_passo = $2, atualizado_em = now() where id = $1`,
      [ap.tarefa_id, decisao === 'aprovada' ? 'Enviar manualmente pela conta oficial, se ainda necessário (execução externa desabilitada na V1).' : 'Decisão registrada: não enviar. Definir nova abordagem com o cliente.']);
    await registrarEvento(q, ap.tarefa_id, 'concluida', 'Critério de conclusão atendido: decisão humana registrada.', 'sistema');
    return { estado: decisao, externa: 'desabilitada_v1' as const };
  });
}

// ---------- Instruções (entrada para os 23 agentes) ----------
export async function salvarInstrucao(b: Banco, u: Usuario, papelId: string, versao: string, conteudo: string) {
  if (u.perfil !== 'admin') throw new SemAcesso('Somente a direção registra instruções.');
  await b.query(`insert into instrucoes (papel_id, versao, conteudo, autor_id) values ($1,$2,$3,$4)
                 on conflict (papel_id, versao) do update set conteudo = excluded.conteudo where instrucoes.estado = 'rascunho'`, [papelId, versao, conteudo, u.id]);
}

// ---------- Configuração de papéis ----------
export async function registrarConfiguracao(q: Q, papelId: string, acao: string, detalhe: string, ator: string) {
  await q.query('insert into registro_configuracao (papel_id, acao, detalhe, ator) values ($1,$2,$3,$4)', [papelId, acao, detalhe, ator]);
}

// Desabilita um papel: o executor passa a bloquear novas execuções (inclusive em demonstração). Tarefas e histórico ficam.
export async function desabilitarPapel(b: Banco, u: Usuario, papelId: string, motivo: string) {
  if (u.perfil !== 'admin') throw new SemAcesso('Somente a direção desabilita papéis.');
  await b.transacao(async q => {
    const r = await q.query(`update papeis set estado_config = 'desabilitado', execucao_habilitada = false where id = $1 returning id`, [papelId]);
    if (!r.length) throw new Error(`Papel desconhecido: ${papelId}`);
    await registrarConfiguracao(q, papelId, 'desabilitado', motivo || 'Sem motivo informado.', u.nome);
  });
}
