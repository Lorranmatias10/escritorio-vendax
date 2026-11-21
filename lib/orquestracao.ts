// Orquestração: fila persistida (tabela execucoes), executor sob demanda, delegação, aprovações.
// Toda escrita passa por aqui: autorização centralizada (podeVer / alçada) e registro de eventos.
import type { Banco, Q } from './db';
import { carregarUsuario, podeVer, SemAcesso, type Usuario } from './escopo';
import { SaidaAgente, adaptadorConfigurado, adaptadorDoPapel, claudeHomologado, type AdaptadorModelo, type EntradaAgente } from './ia';
import { fluxoDoPapel, type FluxoClaude } from './skills-claude';
import { consultaAds } from './consulta-ads';
import { confirmarFontesInternas, confirmarIdentidadeConta, consultarFontes, pendenciasFontes, planoFontes } from './fontes-cliente';
import { contasDoCliente, dadosContaCliente, dadosFichaCliente, fonteCliente,
  obterFichaCliente, operacoesVendax, type FonteCliente } from './ficha-cliente';
import { formularioRotina, horarioRotina, janelaRotina, periodoRotina, semanaAnteriorAoPeriodo, type Rotina } from './agenda-rotinas';
import { dadosReuniaoDemo } from './demo';
import { fontesDaMemoria } from './memoria-vendax';
import type { z } from 'zod';
import { DIRETOR, delegacoesRelatorioAds, equipeDiretor, fluxoDiretor, historicoDiretor,
  identificarClienteDiretor, pedidoDiretor, periodoAdsPadrao, periodoDoRelatorioAds } from './diretor';

type TarefaRow = {
  id: string; parent_id: string | null; cliente_id: string | null; area_interna: string | null; departamento_id: string;
  dono_humano_id: string | null; estado: string; demo: boolean; objetivo: string; origem_evento_id: string | null; criado_em: Date | string;
};
type Papel = { id: string; nome: string; fase: string; modo: string; estado_config: string; execucao_habilitada: boolean; versao_instrucao: string | null; homologado_com: string | null;
  claude_homologado_com: string | null; claude_versao_instrucao: string | null };
type ExecRow = { estado_anterior?: string; id: string; tarefa_id: string; papel_id: string; etapa: string; estado: string; tentativas: number; entrada: EntradaAgente; demo: boolean };

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
  if (r.length) await registrarEvento(q, tarefaId, 'execucao_enfileirada', `Execução "${etapa}" enfileirada para ${papel}.`, 'sistema', { papel });
  return r[0]?.id ?? null;
}

// Delegação: cria (ou reaproveita) a subtarefa vinculada e enfileira a etapa do papel de destino.
async function delegar(q: Q, pai: TarefaRow, de: string, papel: string, etapa: string, objetivo: string, entrada: EntradaAgente) {
  const depto = await deptoDoPapel(q, papel);
  const origem = entrada.contexto.diretor === true ? `${pai.id}:diretor_apoio:${papel}` : `${pai.id}:delegacao:${etapa}`;
  const [sub] = await q.query<{ id: string }>(
    `insert into tarefas (parent_id, cliente_id, area_interna, departamento_id, papel_atual_id, dono_humano_id, objetivo, fonte, origem_evento_id, estado, demo, criterio_conclusao, proximo_passo)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'na_fila',$10,'Execução do papel concluída com saída válida', 'Executar etapa: ' || $11)
     on conflict (origem_evento_id) do update set atualizado_em = now() returning id`,
    [pai.id, pai.cliente_id, pai.area_interna, depto, papel, pai.dono_humano_id, objetivo, `Delegada pela tarefa ${pai.id.slice(0, 8)}`, origem, pai.demo, etapa]);
  await registrarEvento(q, pai.id, 'delegada', `Subtarefa delegada para ${papel}: ${objetivo}`, 'sistema', { subtarefa: sub.id, de, para: papel });
  await registrarEvento(q, sub.id, 'criada', `Recebida por delegação da tarefa de origem.`, 'sistema', { origem: pai.id });
  const anterior = entrada.contexto.relatorio_reaberto === true && await q.query(
    `update execucoes set estado = 'na_fila', entrada = $2, saida = null, erro = null, concluido_em = null,
       disponivel_em = now(), atualizado_em = now()
     where tarefa_id = $1 and etapa = $3 and estado in ('concluida', 'falhou') returning id`, [sub.id, entrada, etapa]);
  if (anterior && anterior.length) await q.query(
    "update tarefas set estado = 'na_fila', objetivo = $2, motivo_bloqueio = null where id = $1", [sub.id, objetivo]);
  else await enfileirar(q, sub.id, papel, etapa, entrada, pai.demo);
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
    const dono = await carregarUsuario(q,ev.dono_id);
    if (!dono || !podeVer(dono,ev.cliente_id,null)) throw new SemAcesso('O responsável não tem acesso ao cliente deste evento.');
    const [t] = await q.query<{ id: string }>(
      `insert into tarefas (cliente_id, departamento_id, papel_atual_id, dono_humano_id, objetivo, fonte, origem_evento_id, prazo, estado, demo, criterio_conclusao, proximo_passo)
       values ($1,'contas','gerente_contas',$2,$3,$4,$5,$6,'na_fila',$7,$8,'Gerente de Contas organiza entregas e pendências')
       on conflict (origem_evento_id) do nothing returning id`,
      [ev.cliente_id, ev.dono_id, `Briefing da carteira piloto · ${ev.titulo}`, `Reunião: ${ev.titulo}${ev.demo ? ' (evento sintético · Demonstração)' : ''}`,
       ev.id, ev.prazo, ev.demo, 'Decisão humana registrada sobre os prazos sem confirmação']);
    if (!t) {
      const [existente] = await q.query<{ id: string; origem_recebimentos: number }>(`update tarefas set
        origem_recebimentos=origem_recebimentos+1, atualizado_em=now()
        where origem_evento_id=$1 and cliente_id=$2 and demo=$3 and fonte like 'Reunião:%'
        returning id,origem_recebimentos`,[ev.id,ev.cliente_id,ev.demo]);
      if (!existente) throw new SemAcesso();
      await q.query(`update execucoes set entrada=jsonb_set(entrada,'{contexto,recebimentos}',to_jsonb($2::int)), atualizado_em=now()
        where chave_dedup=$1`,[`${existente.id}:gerente_contas:organizar`,existente.origem_recebimentos]);
      await registrarEvento(q,existente.id,'evento_repetido',`Evento de origem recebido de novo (${existente.origem_recebimentos}ª vez).`,u.nome,{origem:ev.id});
      return { tarefaId:existente.id,repetido:true };
    }
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

// ---------- Pedido a um papel (entrada genérica dos fluxos da fase 2) ----------
// Um pedido = uma tarefa do papel, etapa "analisar" em A1: o papel prepara o rascunho e o dono humano revisa (aprovação).
export type PedidoPapel = {
  id: string; papel_id: string; cliente_id: string | null; area_interna: string | null; dono_id: string; objetivo: string;
  conteudo_recuperado: EntradaAgente['conteudo_recuperado']; demo: boolean; fluxo_claude?: FluxoClaude; mensagem_chat?: string; consulta_ads?: z.infer<typeof consultaAds>;
  fontes_integracoes?: FonteCliente[]; aprovador_id?: string; rotina?: boolean;
};

export async function receberPedido(b: Banco, u: Usuario, p: PedidoPapel, transacao?: Q) {
  if (!podeVer(u, p.cliente_id, p.area_interna)) throw new SemAcesso('Sem acesso ao cliente ou à área deste pedido.');
  const gravar = async (q: Q) => {
    const depto = await deptoDoPapel(q, p.papel_id);
    const [dono] = await q.query<{ nome: string }>('select nome from usuarios where id = $1', [p.dono_id]);
    const [t] = await q.query<{ id: string }>(
      `insert into tarefas (cliente_id, area_interna, departamento_id, papel_atual_id, dono_humano_id, objetivo, fonte, origem_evento_id, estado, demo, criterio_conclusao, proximo_passo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'na_fila',$9,'Dono humano revisou o rascunho do papel','Papel prepara o rascunho')
       on conflict (origem_evento_id) do nothing returning id`,
      [p.cliente_id, p.area_interna, depto, p.papel_id, p.dono_id, p.objetivo, p.rotina ? 'Rotina agendada' : p.mensagem_chat ? 'Chat com especialista' : `Pedido ${p.id}${p.demo ? ' · Demonstração' : ''}`, p.id, p.demo]);
    if (!t) {
      const [existente] = await q.query<{ id: string; origem_recebimentos: number; cliente_id: string | null; area_interna: string | null }>(
        `update tarefas set origem_recebimentos = origem_recebimentos + 1, atualizado_em = now()
         where origem_evento_id = $1 returning id, origem_recebimentos, cliente_id, area_interna`, [p.id]);
      if (!existente || !podeVer(u, existente.cliente_id, existente.area_interna)) throw new SemAcesso();
      await registrarEvento(q, existente.id, 'evento_repetido', `Pedido de origem recebido de novo (${existente.origem_recebimentos}ª vez). Nenhum registro duplicado.`, u.nome, { origem: p.id });
      return { tarefaId: existente.id, repetido: true };
    }
    await registrarEvento(q, t.id, 'criada', p.mensagem_chat ? 'Pedido enviado pelo chat com especialista.' : `Tarefa criada a partir do pedido ${p.id}.`, u.nome);
    await enfileirar(q, t.id, p.papel_id, 'analisar', {
      papel_id: p.papel_id, etapa: 'analisar',
      instrucao_operacional: `${p.mensagem_chat ?? p.objetivo}. Prepare a entrega do seu papel como rascunho para revisão. Não envie nada.`,
      conteudo_recuperado: p.conteudo_recuperado, contexto: { dono_nome: dono?.nome, fluxo_claude: p.fluxo_claude, mensagem_chat: p.mensagem_chat, consulta_ads: p.consulta_ads,
        fontes_integracoes: p.fontes_integracoes, aprovador_id: p.aprovador_id, rotina: p.rotina },
    }, p.demo);
    return { tarefaId: t.id, repetido: false };
  };
  return transacao ? gravar(transacao) : b.transacao(gravar);
}

async function contextoDaConversa(q: Q, u: Usuario, canal: string | null, escopo: string | null) {
  const historico = (await historicoDiretor(q, u, canal, 6, escopo)).filter(h => h.resposta).slice(-3);
  return historico.map(h => ({ fonte: 'Conversa anterior com o Diretor', texto: `${h.mensagem.slice(0, 1200)}\n${h.resposta!.slice(0, 1600)}` }));
}

export async function registrarPedidoDiretor(b: Banco, u: Usuario, entrada: unknown) {
  const pedido = pedidoDiretor.parse(entrada);
  const autonomia = pedido.autonomia ?? (pedido.criar_tarefas ? 'executar' : 'delegar');
  if (!podeVer(u, pedido.cliente, 'direcao')) throw new SemAcesso('Sem acesso a este cliente.');
  return b.transacao(async q => {
    if (pedido.cliente && !(await q.query('select id from clientes where id = $1 and not demo', [pedido.cliente])).length)
      throw new SemAcesso('Cliente indisponível para este pedido.');
    const identificacao = pedido.cliente ? null : await identificarClienteDiretor(q, u, pedido.mensagem);
    const escopo = pedido.cliente ?? identificacao?.cliente?.id ?? null;
    const origem = `diretor:${u.id}:${pedido.id}`;
    const [t] = await q.query<{ id: string }>(
      `insert into tarefas (cliente_id, area_interna, departamento_id, papel_atual_id, dono_humano_id,
         objetivo, fonte, origem_evento_id, estado, criterio_conclusao, proximo_passo)
       values ($1,$2,'direcao',$3,$4,$5,'Chat com Diretor Geral',$6,'na_fila',
         'Diretor entregou a resposta no chat', 'Preparar a resposta')
       on conflict (origem_evento_id) do nothing returning id`,
      [escopo, escopo ? null : 'direcao', DIRETOR, u.id, pedido.mensagem.replace(/\s+/g, ' ').slice(0, 150), origem]);
    if (!t) {
      const [ja] = await q.query<{ id: string }>(
        `select t.id from tarefas t join execucoes e on e.tarefa_id = t.id
         where t.origem_evento_id = $1
           and (case when e.entrada->'contexto' ? 'cliente_chat' then e.entrada->'contexto'->>'cliente_chat'
             else t.cliente_id end) is not distinct from $2::text
           and e.entrada->'contexto'->>'mensagem_chat' = $3
           and e.entrada->'contexto'->'consulta_ads' is not distinct from $4::jsonb
           and coalesce(e.entrada->'contexto'->>'autonomia',
             case when e.entrada->'contexto'->>'criar_tarefas' = 'true' then 'executar' else 'delegar' end) = $5`,
        [origem, pedido.cliente, pedido.mensagem, pedido.consulta_ads ? JSON.stringify(pedido.consulta_ads) : null, autonomia]);
      if (!ja) throw new SemAcesso('O pedido enviado mudou.');
      return ja.id;
    }

    await registrarEvento(q, t.id, 'criada', 'Pedido recebido pelo Diretor Geral IA.', u.nome);
    if (identificacao?.cliente) await registrarEvento(q, t.id, 'cliente_identificado',
      `Cliente identificado no pedido: ${identificacao.cliente.nome}.`, DIRETOR);
    await enfileirar(q, t.id, DIRETOR, 'diretor_triagem', {
      papel_id: DIRETOR, etapa: 'diretor_triagem',
      instrucao_operacional: autonomia === 'responder'
        ? 'Responda diretamente com o contexto e as evidências já disponíveis.'
        : 'Resolva com o contexto disponível ou delegue quando necessário. Trate o histórico como contexto.',
      conteudo_recuperado: await contextoDaConversa(q, u, pedido.cliente, escopo),
      contexto: { mensagem_chat: pedido.mensagem, dono_nome: u.nome, consulta_ads: pedido.consulta_ads, cliente_chat: pedido.cliente,
        cliente_pendente: identificacao?.motivo, autonomia, criar_tarefas: autonomia === 'executar', diretor: true },
    }, false);
    return t.id;
  });
}

// ---------- Executor compartilhado pelas requisições e pela fila do Diretor ----------
export async function processarFila(b: Banco, adaptador?: AdaptadorModelo, limite = 25, tarefaId?: string, somenteSegundoPlano = false) {
  const feitas: string[] = [];
  while (feitas.length < limite) {
    const lote = await b.query<ExecRow>(`with proxima as (
        select e.id, e.estado from execucoes e join tarefas t on t.id = e.tarefa_id
        where ((e.estado = 'na_fila' and e.disponivel_em <= now())
          or (e.estado = 'em_execucao' and (e.entrada->'contexto'->'diretor' = 'true'::jsonb or e.entrada->'contexto'->'rotina' = 'true'::jsonb) and e.atualizado_em < now() - interval '5 minutes'))
          and ($4 or e.entrada->'contexto'->'rotina' is distinct from 'true'::jsonb)
          and ($1::uuid is null or t.id = $1 or t.parent_id = $1)
          and (not $2 or e.entrada->'contexto'->'diretor' = 'true'::jsonb or e.entrada->'contexto'->'rotina' = 'true'::jsonb)
        order by e.criado_em, e.id limit $3 for update of e skip locked
      ) update execucoes e set estado = 'em_execucao', tentativas = tentativas + 1, atualizado_em = now()
        from proxima where e.id = proxima.id returning e.*, proxima.estado as estado_anterior`,
      [tarefaId ?? null, somenteSegundoPlano, Math.min(limite - feitas.length, somenteSegundoPlano ? 4 : 1), rotinasLigadas()]);
    if (!lote.length) break;
    await Promise.all(lote.map(async ex => {
      if ((ex.entrada.contexto.diretor === true || ex.entrada.contexto.rotina === true) && ex.tentativas > 2 && ex.estado_anterior === 'em_execucao') {
        await finalizarFalha(b, ex, 'O servidor interrompeu as tentativas anteriores de execução.', 'falhou');
        return;
      }
      const destino = adaptador ?? (ex.entrada.contexto.fluxo_claude ? await adaptadorDoPapel(ex.papel_id) : adaptadorConfigurado());
      if (!adaptador && ex.entrada.contexto.diretor === true && destino.provedor === 'simulado-local')
        await finalizarFalha(b, ex, 'Configure o provedor de IA do Diretor Geral.', 'bloqueada');
      else await executar(b, ex, destino);
    }));
    feitas.push(...lote.map(ex => ex.id));
  }
  return feitas;
}

async function executar(b: Banco, ex: ExecRow, adaptador: AdaptadorModelo) {
  const tentativa = ex.tentativas;
  const diretor = ex.entrada.contexto.diretor === true;
  await b.query(`update execucoes set provedor = $2 where id = $1 and tentativas = $3`, [ex.id, adaptador.provedor, tentativa]);
  await b.query(`update tarefas set estado = 'em_execucao', papel_atual_id = $2, atualizado_em = now() where id = $1`, [ex.tarefa_id, ex.papel_id]);
  const [papel] = await b.query<Papel>('select * from papeis where id = $1', [ex.papel_id]);

  // Habilitado = homologado. Antes disso, só o piloto roda, e só em demonstração. Papel desabilitado nunca roda.
  // A habilitação vale para o provedor/modelo homologado; outro provedor só roda em demonstração.
  const comClaude = Boolean(ex.entrada.contexto.fluxo_claude);
  const homologadoCom = comClaude ? papel.claude_homologado_com : papel.homologado_com;
  const versaoInstrucao = comClaude ? papel.claude_versao_instrucao : papel.versao_instrucao;
  const homologadoAqui = papel.execucao_habilitada && (comClaude
    ? await claudeHomologado(ex.papel_id, homologadoCom, adaptador.provedor)
    : homologadoCom === adaptador.provedor);
  // Fases posteriores rodam em demonstração só enquanto estão em homologação (banco isolado da homologação).
  const podeRodar = homologadoAqui || (ex.demo && (papel.fase === 'piloto' ? papel.estado_config !== 'desabilitado' : papel.estado_config === 'em_homologacao'));
  if (!podeRodar) {
    const msg = papel.execucao_habilitada && homologadoCom !== adaptador.provedor
      ? `${papel.nome} foi homologado com ${homologadoCom ?? 'outro provedor'}; o provedor atual é ${adaptador.provedor}. Rode a homologação de novo.`
      : papel.estado_config === 'desabilitado' && papel.fase === 'piloto'
      ? `Execução desabilitada para ${papel.nome} (papel desabilitado pela direção).`
      : `Execução desabilitada para ${papel.nome} (aguarda instrução e homologação).`;
    await finalizarFalha(b, ex, msg, 'bloqueada');
    return;
  }

  const [instr] = await b.query<{ versao: string; conteudo: string }>(
    `select versao, conteudo from instrucoes where papel_id = $1 and ($2::text is null or versao = $2) order by criado_em desc limit 1`,
    [ex.papel_id, versaoInstrucao]);
  await b.query('update execucoes set versao_instrucao = $2 where id = $1 and tentativas = $3', [ex.id, instr?.versao ?? null, tentativa]);

  try {
    await registrarEvento(b, ex.tarefa_id, 'execucao_iniciada', `${papel.nome} iniciou a etapa "${ex.etapa}".`, ex.papel_id);
    const entradaAnterior = await recuperarEscopoDoPedido(b, ex);
    const entrada = await prepararEntrada(b, entradaAnterior ? { ...ex, entrada: entradaAnterior } : ex);
    const semConta = entrada.conteudo_recuperado.filter(f => f.disponivel === false && f.texto.startsWith('Conta de '));
    if (semConta.length) {
      await finalizarFalha(b, ex, semConta.map(f => f.texto).join(' · '), 'bloqueada');
      return;
    }
    const saida = garantirContrato(entrada, SaidaAgente.parse(await adaptador.executar(entrada, instr ?? null, tentativa)), papel);
    await b.transacao(async q => {
      if (!await execucaoAtual(q, ex)) return;
      const retorno = await aplicarEfeitos(q, { ...ex, entrada }, saida, papel);
      await q.query(`update execucoes set estado = 'concluida', saida = $2, erro = null, concluido_em = now(), atualizado_em = now() where id = $1`, [ex.id, retorno ?? saida]);
      await registrarEvento(q, ex.tarefa_id, 'execucao_concluida', `${papel.nome} concluiu "${ex.etapa}" (tentativa ${tentativa}).`, ex.papel_id);
      if (diretor && ex.etapa === 'analisar') await filaDeRetorno(q, await carregarTarefa(q, ex.tarefa_id));
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finalizarFalha(b, ex, msg, 'falhou');
  }
}

async function execucaoAtual(q: Q, ex: ExecRow) {
  const [atual] = await q.query('select id from execucoes where id = $1 and tentativas = $2 and estado = $3 for update',
    [ex.id, ex.tentativas, 'em_execucao']);
  return Boolean(atual);
}

async function finalizarFalha(b: Banco, ex: ExecRow, msg: string, estado: 'bloqueada' | 'falhou') {
  await b.transacao(async q => {
    if (!await execucaoAtual(q, ex)) return;
    const temporaria = estado === 'falhou' && ex.entrada.contexto.diretor === true && ex.tentativas < 2
      && /tempo|timeout|HTTP (429|5\d\d)|conexão|fetch failed|abort/i.test(msg);
    await q.query(`update execucoes set estado = $2, erro = $3, atualizado_em = now(),
       disponivel_em = now() + ($4::int * interval '1 second') where id = $1`,
      [ex.id, temporaria ? 'na_fila' : 'falhou', msg, temporaria ? 10 : 0]);
    await q.query(`update tarefas set estado = $3, motivo_bloqueio = $2, proximo_passo = $4, atualizado_em = now() where id = $1`,
      [ex.tarefa_id, msg, temporaria ? 'na_fila' : estado, temporaria ? 'Nova tentativa automática agendada' : 'Retomar após corrigir a causa']);
    await registrarEvento(q, ex.tarefa_id, temporaria ? 'retomada_agendada' : estado === 'bloqueada' ? 'execucao_bloqueada' : 'execucao_falhou', msg, ex.papel_id);
    if (!temporaria && ex.entrada.contexto.diretor === true && ex.etapa === 'analisar')
      await filaDeRetorno(q, await carregarTarefa(q, ex.tarefa_id));
  });
}

// Pedidos de versões anteriores podem ter uma referência a cliente gravada no canal interno.
async function recuperarEscopoDoPedido(b: Banco, ex: ExecRow): Promise<EntradaAgente | null> {
  const contexto = ex.entrada.contexto;
  if (ex.etapa !== 'diretor_triagem' || Object.hasOwn(contexto, 'cliente_chat') || typeof contexto.mensagem_chat !== 'string') return null;
  const mensagem = contexto.mensagem_chat;
  return b.transacao(async q => {
    if (!await execucaoAtual(q, ex)) return null;
    const t = await carregarTarefa(q, ex.tarefa_id);
    if (t.cliente_id || !t.dono_humano_id) return null;
    const u = await carregarUsuario(q, t.dono_humano_id);
    if (!u) return null;
    const { cliente, motivo } = await identificarClienteDiretor(q, u, mensagem);
    if (!cliente && !motivo) return null;
    const entrada = {
      ...ex.entrada,
      conteudo_recuperado: await contextoDaConversa(q, u, null, cliente?.id ?? null),
      contexto: { ...contexto, cliente_chat: null, cliente_pendente: motivo },
    };
    if (cliente) {
      await q.query('update tarefas set cliente_id = $2, area_interna = null where id = $1', [t.id, cliente.id]);
      await registrarEvento(q, t.id, 'cliente_identificado', `Cliente identificado no pedido: ${cliente.nome}.`, DIRETOR);
    }
    await q.query('update execucoes set entrada = $2 where id = $1', [ex.id, entrada]);
    return entrada;
  });
}

async function prepararEntrada(q: Q, ex: ExecRow): Promise<EntradaAgente> {
  if (ex.demo) return ex.entrada;
  const t = await carregarTarefa(q, ex.tarefa_id);
  const autor = t.dono_humano_id ? await carregarUsuario(q, t.dono_humano_id) : null;
  if (!autor) {
    if (ex.entrada.contexto.diretor === true) throw new SemAcesso('Responsável indisponível para este pedido.');
    return ex.entrada;
  }
  if (!podeVer(autor, t.cliente_id, t.area_interna)) throw new SemAcesso('Acesso do responsável ao escopo da tarefa está indisponível.');
  const fontes = ex.entrada.contexto.relatorio_ads === true
    ? [] : await fontesDaMemoria(q, autor, t.cliente_id, t.area_interna, t.id);
  const periodo = consultaAds.safeParse(ex.entrada.contexto.consulta_ads).data;
  const plataforma = ex.entrada.contexto.fluxo_claude;
  const escolhidas = Array.isArray(ex.entrada.contexto.fontes_integracoes)
    ? ex.entrada.contexto.fontes_integracoes.filter((f): f is FonteCliente => fonteCliente.safeParse(f).success) : [];
  if (periodo && t.cliente_id && (plataforma === 'google_ads' || plataforma === 'meta_ads') && fluxoDoPapel(plataforma, ex.papel_id))
    escolhidas.push(plataforma === 'google_ads' ? 'google-ads' : 'meta-ads');
  if (escolhidas.length) {
    const pedido = ex.entrada.contexto.mensagem_chat ?? ex.entrada.contexto.pedido_original ?? t.objetivo;
    const plano = await planoFontes(q, autor, t.cliente_id, t.area_interna, [...new Set(escolhidas)], ex.papel_id,
      ex.entrada.contexto.rotina === true ? undefined : String(pedido));
    const pendencias = pendenciasFontes(plano,t.cliente_id);
    const data = periodo ?? periodoAdsPadrao();
    const comparacao = periodo && ex.entrada.contexto.rotina === true ? semanaAnteriorAoPeriodo(periodo) : undefined;
    fontes.push(...(pendencias.length ? pendencias : await consultarFontes(q,plano,data,comparacao)));
  }
  const contexto = { ...ex.entrada.contexto };
  if (ex.etapa === 'diretor_triagem' || ex.etapa === 'diretor_revisao') {
    contexto.equipe_autorizada = contexto.autonomia === 'responder'
      ? [] : (await equipeDiretor(q, autor, t.cliente_id)).map(p => ({ id: p.id, nome: p.nome, faz: p.faz }));
    contexto.escopo = t.cliente_id ?? 'Operação interna da Vendax';
    contexto.periodo_padrao_ads = periodoAdsPadrao();
    if (typeof contexto.mensagem_chat === 'string')
      contexto.periodo_solicitado_ads = periodoDoRelatorioAds(contexto.mensagem_chat, t.criado_em);
  }
  return { ...ex.entrada, contexto, conteudo_recuperado: [...fontes, ...ex.entrada.conteudo_recuperado] };
}

// Garantias do contrato que não dependem do modelo: o sistema sabe quais fontes foram entregues e se estão disponíveis.
function garantirContrato(e: EntradaAgente, s: SaidaAgente, papel: Papel): SaidaAgente {
  const fontes = [...s.fontes];
  for (const c of e.conteudo_recuperado) {
    const disp = c.disponivel !== false;
    const f = fontes.find(x => x.nome === c.fonte);
    if (f) {
      f.disponivel = disp;
      if (c.identificador) f.referencia = c.identificador;
    } else fontes.push({ nome: c.fonte, disponivel: disp, referencia: c.identificador });
  }
  const lacunas = [...s.lacunas];
  for (const c of e.conteudo_recuperado.filter(c => c.disponivel === false))
    if (!lacunas.some(l => l.includes(c.fonte) && /Integração pendente/i.test(l)))
      lacunas.push(c.texto || `${c.fonte}: Integração pendente${c.resolve ? ` — quem resolve: ${c.resolve}` : ''}`);
  // A1 = consulta e rascunho: nada foi executado, então não há efeito confirmado.
  // Parecer e gravidade são do Auditor de Qualidade; em outras etapas o sistema descarta.
  const auditoria = e.etapa === 'auditar';
  return { ...s, fontes, lacunas, efeito_confirmado: papel.modo === 'A1' ? null : s.efeito_confirmado,
    parecer: auditoria ? s.parecer : undefined, gravidade: auditoria ? s.gravidade : undefined };
}

// Efeitos de cada etapa. Todos idempotentes (chaves de deduplicação), para retomada sem duplicar.
async function aplicarEfeitos(q: Q, ex: ExecRow, s: SaidaAgente, papel: Papel) {
  const t = await carregarTarefa(q, ex.tarefa_id);
  const chaveEvidencia = ex.entrada.contexto.relatorio_reaberto === true ? `${ex.id}:${ex.tentativas}` : ex.id;
  for (const [i, f] of s.fontes.entries()) await evidencia(q, t.id, ex.id, `${chaveEvidencia}:fonte:${i}`, 'fonte', `${f.nome}${f.disponivel ? '' : ' — Integração pendente'}`, f.referencia);
  if (s.rascunho) await evidencia(q, t.id, ex.id, `${chaveEvidencia}:rascunho`, 'rascunho', s.rascunho);
  const concluirSub = async () => {
    await q.query(`update tarefas set estado = 'concluida', motivo_bloqueio = null, proximo_passo = $2, atualizado_em = now() where id = $1`, [t.id, s.proxima_acao]);
  };
  const pai = t.parent_id ? await carregarTarefa(q, t.parent_id) : t;

  if (ex.etapa === 'diretor_triagem') {
    return delegarDiretor(q, t, ex, s);
  } else if (ex.etapa === 'diretor_revisao') {
    return fecharPedidoDiretor(q, t, ex, s);
  } else if (ex.etapa === 'analisar' && ex.entrada.contexto.diretor === true) {
    const pendencia = ex.entrada.conteudo_recuperado.filter(f => f.disponivel === false).map(f => f.fonte).join(', ');
    if (pendencia) await q.query(`update tarefas set estado = 'bloqueada', motivo_bloqueio = $2,
      proximo_passo = $3, atualizado_em = now() where id = $1`, [t.id, `Fonte indisponível: ${pendencia}`, s.proxima_acao]);
    else await concluirSub();
  } else if (ex.etapa === 'organizar') {
    // A1 (consulta e rascunho): os itens ficam no rascunho. A2+ grava as entregas pelo fluxo autorizado.
    if (papel.modo !== 'A1') for (const [i, it] of (s.itens ?? []).entries())
      if (t.cliente_id) await q.query(
        `insert into entregas (cliente_id, tarefa_id, chave_dedup, titulo, estado, demo) values ($1,$2,$3,$4,'planejada',$5) on conflict (chave_dedup) do nothing`,
        [t.cliente_id, t.id, `${t.id}:entrega:${i}`, `${it.titulo}${it.prazo ? ` (prazo citado: ${it.prazo})` : ''}`, t.demo]);
    await q.query(`update tarefas set estado = 'em_execucao', proximo_passo = $2, atualizado_em = now() where id = $1`, [t.id, s.proxima_acao]);
    await delegar(q, t, ex.papel_id, 'auditor_qualidade', 'auditar', 'Auditar o plano da carteira contra a reunião', {
      ...ex.entrada, papel_id: 'auditor_qualidade', etapa: 'auditar',
      instrucao_operacional: 'Confira o plano com a fonte. Aponte prazos, números ou escopos sem confirmação.',
      conteudo_recuperado: [...ex.entrada.conteudo_recuperado, ...(t.demo ? [dadosReuniaoDemo.fonteAusente] : [])],
    });
  } else if (ex.etapa === 'auditar') {
    await concluirSub();
    for (const [i, a] of s.afirmacoes.filter(x => x.tipo === 'fato').entries())
      await evidencia(q, pai.id, ex.id, `${ex.id}:achado:${i}`, 'fonte', `Auditor: ${a.texto}`, 'Transcrição da reunião');
    await delegar(q, pai, ex.papel_id, 'diretor_operacoes', 'priorizar', 'Priorizar o briefing e definir quem decide', {
      ...ex.entrada, papel_id: 'diretor_operacoes', etapa: 'priorizar',
      instrucao_operacional: 'Priorize o briefing. Se houver prazo a confirmar, redija uma mensagem baseada na transcrição para revisão interna. Nenhuma ação externa.',
      contexto: { ...ex.entrada.contexto, lacunas: s.lacunas,
        ...(t.demo ? { mensagem_sugerida: dadosReuniaoDemo.mensagem } : {}) },
    });
  } else if (ex.etapa === 'priorizar') {
    await concluirSub();
    const prazo = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const dono = pai.dono_humano_id ? await carregarUsuario(q,pai.dono_humano_id) : null;
    const ficha = pai.cliente_id && dono && !pai.demo ? await obterFichaCliente(q,dono,pai.cliente_id) : null;
    const destinatario = pai.demo ? dadosReuniaoDemo.destinatario : ficha?.contato_whatsapp;
    const rascunho = s.rascunho?.trim();
    if (!pai.demo && (!destinatario || !rascunho)) {
      const motivo = !destinatario ? 'Contato de WhatsApp ausente na ficha do cliente - quem resolve: direção' : 'Rascunho da reunião ausente - quem resolve: responsável pela tarefa';
      await q.query("update tarefas set estado='bloqueada', em_hoje=true, motivo_bloqueio=$2, atualizado_em=now() where id=$1", [pai.id,motivo]);
      await registrarEvento(q,pai.id,'fonte_ausente',motivo,DIRETOR);
      return;
    }
    await q.query(
      `update tarefas set estado = 'aguardando_aprovacao', em_hoje = true, papel_atual_id = 'diretor_operacoes', prazo = $2, motivo_bloqueio = null, proximo_passo = $3, atualizado_em = now() where id = $1`,
      [pai.id, prazo, s.proxima_acao]);
    await q.query(
      `insert into aprovacoes (tarefa_id, chave_dedup, intencao, alvo, conta, parametros, prazo, aprovador_id, demo, modo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (chave_dedup) do nothing`,
      [pai.id, `${pai.id}:aprovacao:confirmar-prazo`, pai.demo ? dadosReuniaoDemo.intencao : 'Revisar o rascunho de confirmação da reunião',
       pai.demo ? dadosReuniaoDemo.alvo : 'Revisão interna', pai.demo ? dadosReuniaoDemo.conta : 'Escritório Vendax',
       { canal: 'whatsapp', destinatario, contato: ficha?.contato_nome, mensagem: rascunho },
       prazo, pai.dono_humano_id, pai.demo, pai.demo ? 'A3' : 'A1']);
    await registrarEvento(q, pai.id, 'em_hoje', `Briefing priorizado e colocado em Hoje. Quem decide: ${s.responsavel_humano}.`, 'diretor_operacoes');
  } else if (ex.etapa === 'analisar' && !ex.entrada.conteudo_recuperado.some(c => c.disponivel === false)) {
    // A1: o rascunho fica como evidência e o dono humano revisa. Nenhuma ação externa.
    // Bloqueio por fonte ausente vem do que o sistema entregou; lacunas que o modelo apontar ficam no rascunho para o revisor.
    const prazo = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const emHoje = ex.entrada.contexto.rotina === true;
    await q.query(`update tarefas set estado = 'aguardando_aprovacao', motivo_bloqueio = null, proximo_passo = $2,
      em_hoje = $3 or em_hoje, prazo = case when $3 then coalesce(prazo,$4) else prazo end, atualizado_em = now() where id = $1`,
    [t.id, s.proxima_acao, emHoje, prazo]);
    await q.query(
      `insert into aprovacoes (tarefa_id, chave_dedup, intencao, alvo, conta, parametros, prazo, aprovador_id, demo, modo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'A1') on conflict (chave_dedup) do nothing`,
      [t.id, `${t.id}:aprovacao:revisar`, `Revisar o rascunho de ${papel.nome}`, 'Revisão interna', 'Escritório Vendax',
       { rascunho: s.rascunho ?? s.resumo, papel_destino: s.papel_destino }, prazo, ex.entrada.contexto.aprovador_id ?? t.dono_humano_id, t.demo]);
  } else if (ex.etapa === 'consultar_fonte' || ex.etapa === 'analisar') { // analisar com fonte ausente: bloqueia e aponta quem resolve
    await q.query(`update tarefas set estado = 'bloqueada', motivo_bloqueio = $2, proximo_passo = $3, atualizado_em = now() where id = $1`,
      [t.id, s.lacunas.join(' · '), s.proxima_acao]);
    await registrarEvento(q, t.id, 'fonte_ausente', `Fonte indisponível: ${s.lacunas.join(' · ')}`, ex.papel_id);
  } else {
    await q.query(`update tarefas set estado = 'concluida', motivo_bloqueio = null, proximo_passo = $2, atualizado_em = now() where id = $1`, [t.id, s.proxima_acao]);
  }
}

async function delegarDiretor(q: Q, t: TarefaRow, ex: ExecRow, s: SaidaAgente) {
  const { autonomia: modo, mensagem_chat, cliente_pendente, relatorio_reaberto } = ex.entrada.contexto;
  const mensagem = typeof mensagem_chat === 'string' ? mensagem_chat : '';
  const relatorio = modo === 'responder' ? [] : delegacoesRelatorioAds(mensagem);
  if (!t.cliente_id && (cliente_pendente || relatorio.length)) {
    const pendencia = cliente_pendente === 'ambiguidade' ? 'Há mais de um cliente possível. Selecione o cliente em “Cliente ou operação”.'
      : 'Selecione um cliente autorizado em “Cliente ou operação” para continuar.';
    return fecharPedidoDiretor(q, t, ex, { ...s, rascunho: 'Preciso confirmar o cliente antes de continuar.', pendencia_diretor: pendencia });
  }
  if (modo === 'responder') return fecharPedidoDiretor(q, t, ex, s);
  const { delegacoes = [], periodo_ads, excecao } = s.plano_diretor ?? {};
  if (!delegacoes.length && !relatorio.length) {
    if (s.rascunho?.trim()) return fecharPedidoDiretor(q, t, ex, s);
    if (!s.plano_diretor) return fecharPedidoDiretor(q, t, ex, { ...s, rascunho: 'Preciso de um detalhe para encaminhar.',
      pendencia_diretor: s.pendencia_diretor ?? 'Indique o relatório ou a fonte que a equipe deve consultar.' });
  }
  const u = t.dono_humano_id ? await carregarUsuario(q, t.dono_humano_id) : null;
  if (!u || !podeVer(u, t.cliente_id, t.area_interna)) throw new SemAcesso();
  const autorizados = new Set((await equipeDiretor(q, u, t.cliente_id)).map(p => p.id));
  const periodos = consultaAds.safeParse(ex.entrada.contexto.consulta_ads).data
    ?? periodoDoRelatorioAds(mensagem, t.criado_em) ?? periodo_ads ?? periodoAdsPadrao();
  const outrasDelegacoes = delegacoes.filter(d => !relatorio.some(canal => canal.papel === d.papel));
  const destinos = [...new Map([...relatorio, ...outrasDelegacoes].map(d => [d.papel, d.objetivo])).entries()].slice(0, 4);
  for (const [papel, objetivo] of destinos) {
    if (!autorizados.has(papel)) continue;
    const fluxo = fluxoDiretor(papel);
    const canalAds = fluxo === 'google_ads' || fluxo === 'meta_ads';
    const relatorioAds = canalAds && relatorio.length > 0;
    await delegar(q, t, DIRETOR, papel, 'analisar', objetivo, {
      papel_id: papel, etapa: 'analisar',
      instrucao_operacional: `Pedido delegado pelo Diretor Geral: ${objetivo}\nUse a conta e o cliente da tarefa. Cite as fontes e separe dados, lacunas e recomendações.`,
      conteudo_recuperado: [],
      contexto: { diretor: true, dono_nome: u.nome, objetivo_delegado: objetivo, fluxo_claude: fluxo,
        consulta_ads: canalAds ? periodos : undefined, relatorio_ads: relatorioAds, relatorio_reaberto, pedido_original: mensagem },
    });
  }
  const papeisIndisponiveis = destinos.some(([p]) => !autorizados.has(p));
  await q.query(`update tarefas set estado = 'em_execucao', motivo_bloqueio = null,
      proximo_passo = $2, atualizado_em = now() where id = $1`,
    [t.id, destinos.length ? 'Acompanhar análises delegadas' : 'Consolidar resposta ao pedido']);
  await filaDeRetorno(q, t, {
    plano: s.resumo, excecao, papeisIndisponiveis, periodo_ads: periodos,
  });
  return { ...s, plano_diretor: { delegacoes: destinos.map(([papel, objetivo]) => ({ papel, objetivo })), periodo_ads: periodos, excecao } };
}

async function filaDeRetorno(q: Q, tarefa: TarefaRow, triagem?: Record<string, unknown>) {
  const raiz = tarefa.parent_id ?? tarefa.id;
  await q.query('select id from tarefas where id = $1 for update', [raiz]);
  const [origem] = await q.query<Pick<ExecRow, 'entrada'> & { saida: SaidaAgente | null }>(
    `select entrada, saida from execucoes where tarefa_id = $1 and etapa = 'diretor_triagem'`, [raiz]);
  if (!origem) return;
  const apoios = await q.query<{ id: string; nome: string; estado: string; motivo_bloqueio: string | null; saida: SaidaAgente | null }>(
    `select t.id, p.nome, t.estado, t.motivo_bloqueio, e.saida
       from tarefas t join execucoes e on e.tarefa_id = t.id and e.etapa = 'analisar'
       join papeis p on p.id = e.papel_id
       where t.parent_id = $1 and e.entrada->'contexto'->'diretor' = 'true'::jsonb order by p.ordem, t.id`, [raiz]);
  if (apoios.some(a => a.estado === 'na_fila' || a.estado === 'em_execucao')) return;
  const plano = triagem ?? {
    plano: origem.saida?.resumo, excecao: origem.saida?.plano_diretor?.excecao,
    papeisIndisponiveis: (origem.saida?.plano_diretor?.delegacoes.length ?? 0) > apoios.length,
  };
  const entrada: EntradaAgente = {
    papel_id: DIRETOR, etapa: 'diretor_revisao',
    instrucao_operacional: 'Revise a solicitação original e os retornos. Consolide uma resposta única, priorizando os dados do período pedido. Assuntos históricos só entram se explicarem os números. Quando o pedido for de mídia, trate a ausência de CRM ou agenda como limite da atribuição, salvo se o cruzamento foi solicitado.',
    conteudo_recuperado: [...origem.entrada.conteudo_recuperado, ...apoios.map(a => ({
      fonte: a.nome, disponivel: a.estado === 'concluida',
      texto: JSON.stringify({ estado: a.estado, bloqueio: a.motivo_bloqueio, resumo: a.saida?.resumo,
        analise: a.saida?.rascunho?.slice(0, 6000), fontes: a.saida?.fontes, lacunas: a.saida?.lacunas }).slice(0, 10_000),
    }))],
    contexto: { ...origem.entrada.contexto, ...plano,
      apoios_incompletos: apoios.filter(a => a.estado !== 'concluida').map(a => a.nome),
      bloqueios_fontes: apoios.map(a => a.motivo_bloqueio).filter(m => m?.startsWith('Conta de ')) },
  };

  const nova = await enfileirar(q, raiz, DIRETOR, 'diretor_revisao', entrada, false);
  if (!nova) {
    // Uma análise retomada pode substituir a resposta parcial no mesmo fio.
    const [atualizada] = await q.query(
      `update execucoes set entrada = $2, estado = 'na_fila', disponivel_em = now(), atualizado_em = now()
         where tarefa_id = $1 and etapa = 'diretor_revisao' and estado in ('concluida', 'falhou')
         returning id`, [raiz, entrada]);
    if (!atualizada) return;
  }
  await q.query(`update tarefas set estado = 'em_execucao', proximo_passo = 'Diretor revisa os retornos',
     atualizado_em = now() where id = $1`, [raiz]);
  if (tarefa.parent_id) await registrarEvento(q, raiz, 'retorno_especialistas', 'Retornos prontos para revisão da direção.', DIRETOR);
}

async function fecharPedidoDiretor(q: Q, t: TarefaRow, ex: ExecRow, s: SaidaAgente): Promise<SaidaAgente> {
  const { papeisIndisponiveis, apoios_incompletos, bloqueios_fontes } = ex.entrada.contexto;
  const incompletos = Array.isArray(apoios_incompletos) ? apoios_incompletos : [];
  const bloqueio = [
    ...(Array.isArray(bloqueios_fontes) ? bloqueios_fontes : []),
    s.pendencia_diretor,
    papeisIndisponiveis ? 'Um especialista solicitado está indisponível neste escopo.' : '',
    incompletos.length ? `Apoio pendente de ${incompletos.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
  const u = t.dono_humano_id ? await carregarUsuario(q, t.dono_humano_id) : null;
  if (!u || !podeVer(u, t.cliente_id, t.area_interna)) throw new SemAcesso();
  const tarefasCriadas: string[] = [];
  if (!bloqueio && ex.entrada.contexto.criar_tarefas === true) {
    const equipe = new Map((await equipeDiretor(q, u, t.cliente_id)).map(p => [p.id, p]));
    const titulos = new Set<string>();
    for (const item of (s.itens ?? []).slice(0, 5)) {
      const papel = equipe.get(item.dono);
      const titulo = item.titulo.trim().replace(/\s+/g, ' ').slice(0, 240);
      if (!papel || titulo.length < 3 || titulos.has(titulo.toLowerCase())) continue;
      titulos.add(titulo.toLowerCase());
      const donoProposto = papel.responsavel.split(' e ')[0].toLocaleLowerCase('pt-BR');
      const [responsavel] = await q.query<{ id: string }>('select id from usuarios where lower(nome) = $1', [donoProposto]);
      const dono = responsavel ? await carregarUsuario(q, responsavel.id) : null;
      const [nova] = await q.query<{ id: string }>(
        `insert into tarefas (parent_id, cliente_id, area_interna, departamento_id, papel_atual_id, dono_humano_id, objetivo,
         fonte, origem_evento_id, estado, criterio_conclusao, proximo_passo)
         values ($1,$2,$3,$4,$5,$6,$7,'Atribuída pelo Diretor Geral',$8,'na_fila','Responsável registra o resultado','Executar e registrar o resultado')
         on conflict (origem_evento_id) do nothing returning id`,
        [t.id, t.cliente_id, t.area_interna, papel.departamento, papel.id, dono && podeVer(dono, t.cliente_id, t.area_interna) ? dono.id : u.id,
          titulo, `${t.id}:diretor_pendencia:${titulo.toLowerCase()}`]);
      if (!nova) continue;
      tarefasCriadas.push(titulo);
      await registrarEvento(q, nova.id, 'criada', 'Tarefa interna criada a pedido do solicitante.', DIRETOR);
      await registrarEvento(q, t.id, 'delegada', `Pendência atribuída a ${papel.nome}.`, DIRETOR, { subtarefa: nova.id, de: DIRETOR, para: papel.id });
    }
  }

  if (!bloqueio && ex.entrada.contexto.relatorio_reaberto === true) {
    const entregues = await q.query<{ id: string }>(
      `update tarefas set estado = 'concluida', proximo_passo = 'Relatório entregue na tarefa de origem',
        atualizado_em = now() where parent_id = $1 and estado = 'na_fila'
        and fonte = 'Atribuída pelo Diretor Geral' and objetivo ilike 'Consolidar relat%' returning id`, [t.id]);
    for (const tarefa of entregues) await registrarEvento(q, tarefa.id, 'relatorio_entregue', 'O relatório foi entregue na tarefa de origem.', DIRETOR);
  }
  const rascunho = [s.rascunho ?? s.resumo, bloqueio && `Pendência: ${bloqueio}`,
    tarefasCriadas.length > 0 && `Tarefas registradas no Escritório:\n${tarefasCriadas.map(titulo => `• ${titulo}`).join('\n')}`]
    .filter(Boolean).join('\n\n');
  await q.query(`update tarefas set estado = $2, motivo_bloqueio = $3, em_hoje = $4,
     proximo_passo = $5, atualizado_em = now() where id = $1`,
    [t.id, bloqueio ? 'bloqueada' : 'concluida', bloqueio || null, Boolean(bloqueio), s.proxima_acao]);
  await registrarEvento(q, t.id, bloqueio ? 'diretor_retornou_com_pendencia' : 'diretor_aprovou',
    bloqueio ? 'O Diretor devolveu o resultado com pendências.' : 'O Diretor validou e entregou a resposta no chat.', DIRETOR);
  return { ...s, rascunho, efeito_confirmado: null };
}

// ---------- Retomada ----------
export async function relatorioParaRetomar(q: Q, u: Usuario, tarefaId: string) {
  const [r] = await q.query<{ execucao_id: string; cliente_id: string; dono_humano_id: string; mensagem: string; autonomia: string | null }>(
    `select e.id as execucao_id, t.cliente_id, t.dono_humano_id,
       e.entrada->'contexto'->>'mensagem_chat' as mensagem, e.entrada->'contexto'->>'autonomia' as autonomia
     from tarefas t join execucoes e on e.tarefa_id = t.id and e.etapa = 'diretor_triagem'
     where t.id = $1 and t.cliente_id is not null and t.estado = 'concluida' and e.estado = 'concluida' and not t.demo
       and not exists (
         select 1 from tarefas a join execucoes x on x.tarefa_id = a.id and x.etapa = 'analisar'
         where a.parent_id = t.id and x.entrada->'contexto'->>'fluxo_claude' in ('google_ads','meta_ads')
           and x.entrada->>'instrucao_operacional' like 'Pedido delegado pelo Diretor Geral:%'
       )`, [tarefaId]);
  if (!r || (u.perfil !== 'admin' && u.id !== r.dono_humano_id) || !podeVer(u, r.cliente_id, null)
    || r.autonomia === 'responder' || !r.mensagem || !delegacoesRelatorioAds(r.mensagem).length) return null;
  return r.execucao_id;
}

export async function retomarExecucao(b: Banco, u: Usuario, execId: string) {
  const retomada = await b.transacao(async q => {
    const [ex] = await q.query<ExecRow>('select * from execucoes where id = $1 for update', [execId]);
    if (!ex) throw new SemAcesso();
    const t = await autorizarTarefa(q, u, ex.tarefa_id);
    if (u.perfil !== 'admin' && u.id !== t.dono_humano_id) throw new SemAcesso('Só o dono da tarefa ou a direção pode retomar.');
    const diretor = ex.entrada.contexto.diretor === true;
    const relatorioReaberto = diretor && ex.estado === 'concluida' && (await relatorioParaRetomar(q, u, t.id)) === ex.id;
    if (ex.estado !== 'falhou' && !relatorioReaberto) return null;
    const entrada = relatorioReaberto
      ? { ...ex.entrada, contexto: { ...ex.entrada.contexto, criar_tarefas: false, relatorio_reaberto: true } } : ex.entrada;
    await q.query(`update execucoes set estado = 'na_fila', entrada = $2, disponivel_em = now(), atualizado_em = now() where id = $1`, [execId, entrada]);
    if (relatorioReaberto) {
      await q.query(`update tarefas set estado = 'na_fila', motivo_bloqueio = null,
        proximo_passo = 'Consultar as fontes do relatório', atualizado_em = now() where id = $1`, [t.id]);
      await q.query(`update execucoes set saida = null, concluido_em = null where tarefa_id = $1
        and etapa = 'diretor_revisao' and estado in ('concluida','falhou')`, [t.id]);
    }
    await registrarEvento(q, t.id, 'retomada',
      relatorioReaberto ? 'Relatório reaberto para consulta das fontes.' : `Execução "${ex.etapa}" retomada por ${u.nome}.`, u.nome);
    return { diretor, tarefaId: t.parent_id ?? t.id };
  });
  if (!retomada) return;
  if (retomada.diretor) await processarFila(b, undefined, 6, retomada.tarefaId, true);
  else await processarFila(b);
}

// ---------- Aprovações (A3) ----------
export async function decidirAprovacao(b: Banco, u: Usuario, aprovacaoId: string, decisao: 'aprovada' | 'rejeitada', nota: string) {
  return b.transacao(async q => {
    const [ap] = await q.query<{ id: string; tarefa_id: string; aprovador_id: string; estado: string; prazo: string; intencao: string; modo: string; alvo: string }>(
      'select * from aprovacoes where id = $1 for update', [aprovacaoId]);
    if (!ap) throw new SemAcesso();
    await autorizarTarefa(q, u, ap.tarefa_id);
    if (u.id !== ap.aprovador_id && u.perfil !== 'admin') throw new SemAcesso('Somente o aprovador designado ou a direção pode decidir.');
    if (ap.estado !== 'pendente') return { estado: ap.estado, externa: 'desabilitada_v1' as const };
    if (new Date(ap.prazo) < new Date()) {
      await q.query(`update aprovacoes set estado = 'expirada' where id = $1`, [ap.id]);
      await registrarEvento(q, ap.tarefa_id, 'aprovacao_expirada', 'Aprovação expirada: o prazo passou antes da decisão.', 'sistema');
      return { estado: 'expirada', externa: 'desabilitada_v1' as const };
    }
    await q.query(`update aprovacoes set estado = $2, decisao_nota = $3, decidido_por = $4, decidido_em = now() where id = $1`, [ap.id, decisao, nota || null, u.id]);
    await registrarEvento(q, ap.tarefa_id, 'aprovacao_decidida', `${u.nome} ${decisao === 'aprovada' ? 'aprovou' : 'rejeitou'}: ${ap.intencao}.`, u.nome, { nota });
    const revisaoInterna = ap.modo === 'A1' || ap.alvo === 'Revisão interna';
    if (!revisaoInterna) await registrarEvento(q, ap.tarefa_id, 'acao_externa_bloqueada', 'Execução externa desabilitada na V1: nada foi enviado. A decisão ficou registrada.', 'sistema');
    if (!revisaoInterna && decisao === 'aprovada')
      await evidencia(q, ap.tarefa_id, null, `${ap.id}:acao_solicitada`, 'acao_solicitada', `${ap.intencao} — aprovada por ${u.nome}; não executada (V1, sem resultado confirmado).`);
    // Critério de conclusão da tarefa de origem: decisão humana registrada.
    await q.query(`update tarefas set estado = 'concluida', proximo_passo = $2, atualizado_em = now() where id = $1`,
      [ap.tarefa_id, revisaoInterna ? (decisao === 'aprovada' ? 'Rascunho revisado e aprovado.' : 'Revisão registrada. Ajuste o rascunho se necessário.')
        : decisao === 'aprovada' ? 'Enviar manualmente pela conta oficial, se ainda necessário (execução externa desabilitada na V1).' : 'Decisão registrada: não enviar. Definir nova abordagem com o cliente.']);
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

// ---------- Clientes e acesso ----------
// Só a direção cadastra clientes e define quem da equipe vê cada um (a direção vê todos).
const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

export async function criarCliente(b: Banco, u: Usuario, nome: string) {
  if (u.perfil !== 'admin') throw new SemAcesso('Somente a direção cadastra clientes.');
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (limpo.length < 2) throw new Error('Informe o nome do cliente.');
  const base = slug(limpo) || 'cliente';
  const existentes = await b.query<{ id: string; nome: string }>('select id, nome from clientes where id = $1 or id like $2 or lower(nome) = lower($3)', [base, `${base}-%`, limpo]);
  if (existentes.some(c => c.nome.toLowerCase() === limpo.toLowerCase())) throw new Error(`Já existe um cliente chamado ${limpo}.`);
  const id = existentes.some(c => c.id === base) ? `${base}-${existentes.length + 1}` : base;
  await b.query('insert into clientes (id, nome, demo) values ($1, $2, false)', [id, limpo]);
  return id;
}

export async function definirAcessoClientes(b: Banco, u: Usuario, usuarioId: string, clientes: string[]) {
  if (u.perfil !== 'admin') throw new SemAcesso('Somente a direção define acessos.');
  await b.transacao(async q => {
    const validos = (await q.query<{ id: string }>('select id from clientes where id = any($1::text[])', [clientes])).map(c => c.id);
    await q.query('delete from permissoes_cliente where usuario_id = $1', [usuarioId]);
    for (const c of validos) await q.query('insert into permissoes_cliente values ($1,$2) on conflict do nothing', [usuarioId, c]);
  });
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

// ---------- Ficha e contas vinculadas ----------
function exigirDirecao(u: Usuario) {
  if (u.perfil !== 'admin') throw new SemAcesso('Somente a direção pode fazer esta alteração.');
}

async function registroCliente(q: Q, u: Usuario, cliente: string, acao: string, detalhe: string) {
  await q.query('insert into clientes_auditoria (cliente_id,acao,detalhe,ator_id) values ($1,$2,$3,$4)',[cliente,acao,detalhe,u.id]);
}

export async function atualizarFichaCliente(b: Banco, u: Usuario, cliente: string, entrada: unknown) {
  exigirDirecao(u);
  const f = dadosFichaCliente.parse(entrada);
  if ((f.status === null) !== operacoesVendax.includes(cliente)) throw new Error('Selecione um status válido.');
  return b.transacao(async q => {
    const [anterior] = await q.query<{ status: string | null }>('select status from clientes where id=$1 and not demo for update',[cliente]);
    if (!anterior) throw new SemAcesso();
    if (f.responsavel_id) {
      const responsavel = await carregarUsuario(q,f.responsavel_id);
      if (!responsavel || !podeVer(responsavel,cliente,null)) throw new Error('O responsável precisa ter acesso ao cliente.');
    }
    const rows = await q.query(`update clientes set status=$2,responsavel_id=$3,contato_nome=$4,contato_whatsapp=$5
      where id=$1 and (status,responsavel_id,contato_nome,contato_whatsapp) is distinct from ($2,$3,$4,$5) returning id`,
      [cliente,f.status,f.responsavel_id,f.contato_nome,f.contato_whatsapp]);
    if (rows.length) await registroCliente(q,u,cliente,'ficha_atualizada',
      anterior.status === f.status ? 'Responsável ou contato atualizado.' : `Status: ${anterior.status ?? 'interno'} → ${f.status ?? 'interno'}.`);
  });
}

export async function gravarVinculoCliente(b: Banco, u: Usuario, cliente: string, entrada: unknown, edicao?: { id: string; versao: number }) {
  exigirDirecao(u);
  const a = dadosContaCliente.parse(entrada);
  if (a.integracao === 'crm' && a.tipo === 'espaco_crm' && a.identificador === process.env.CRM_VENDAX_ESPACO_COMERCIAL_ID?.trim())
    throw new Error('O espaço reservado ao comercial da Vendax não pode ser vinculado a um cliente.');
  return b.transacao(async q => {
    const [c] = await q.query('select id from clientes where id=$1 and not demo for update',[cliente]);
    if (!c) throw new SemAcesso();
    if (!edicao) {
      const rows = await q.query<{ id: string }>(`insert into contas_cliente (cliente_id,integracao,tipo,identificador,rotulo)
        values ($1,$2,$3,$4,$5) on conflict (integracao,tipo,identificador) do nothing returning id`,
      [cliente,a.integracao,a.tipo,a.identificador,a.rotulo]);
      if (rows.length) await registroCliente(q,u,cliente,'conta_criada',`${a.integracao} · ${a.identificador}`);
      else if (!(await q.query('select id from contas_cliente where cliente_id=$1 and integracao=$2 and tipo=$3 and identificador=$4',
        [cliente,a.integracao,a.tipo,a.identificador])).length) throw new Error('Este identificador já está vinculado a outro cliente.');
      return;
    }
    const [anterior] = await q.query<{ integracao: string; tipo: string; identificador: string; rotulo: string; versao: number }>(
      'select integracao,tipo,identificador,rotulo,versao from contas_cliente where cliente_id=$1 and id=$2 for update',[cliente,edicao.id]);
    if (!anterior || anterior.versao !== edicao.versao) throw new Error('O vínculo mudou. Atualize a página e tente de novo.');
    const mudou = [anterior.integracao,anterior.tipo,anterior.identificador].some((v,i) => v !== [a.integracao,a.tipo,a.identificador][i]);
    if (!mudou && anterior.rotulo === a.rotulo) return;
    await q.query(`update contas_cliente set integracao=$3,tipo=$4,identificador=$5,rotulo=$6,versao=versao+1,
      verificado_em=case when $7 then null else verificado_em end,verificado_por=case when $7 then null else verificado_por end
      where cliente_id=$1 and id=$2`,[cliente,edicao.id,a.integracao,a.tipo,a.identificador,a.rotulo,mudou]);
    await registroCliente(q,u,cliente,'conta_editada',`${anterior.integracao} · ${anterior.identificador} → ${a.integracao} · ${a.identificador}`);
  });
}

export async function retirarVinculoCliente(b: Banco, u: Usuario, cliente: string, id: string, versao: number) {
  exigirDirecao(u);
  await b.transacao(async q => {
    const [a] = await q.query<{ integracao: string; identificador: string }>(`delete from contas_cliente
      where cliente_id=$1 and id=$2 and versao=$3 returning integracao,identificador`,[cliente,id,versao]);
    if (a) await registroCliente(q,u,cliente,'conta_removida',`${a.integracao} · ${a.identificador}`);
    else if ((await q.query('select id from contas_cliente where cliente_id=$1 and id=$2',[cliente,id])).length)
      throw new Error('O vínculo mudou. Atualize a página e tente de novo.');
  });
}

export async function verificarVinculoCliente(b: Banco, u: Usuario, cliente: string, id: string, versao: number) {
  exigirDirecao(u);
  const a = (await contasDoCliente(b,u,cliente)).find(c => c.id === id && c.versao === versao);
  if (!a) throw new Error('O vínculo mudou. Atualize a página e tente de novo.');
  await confirmarIdentidadeConta(b,a);
  await b.transacao(async q => {
    const [atualizada] = await q.query(`update contas_cliente set verificado_em=now(),verificado_por=$3,versao=versao+1
      where cliente_id=$1 and id=$2 and versao=$4 returning id`,[cliente,id,u.id,versao]);
    if (!atualizada) throw new Error('O vínculo mudou durante a verificação. Tente de novo.');
    await registroCliente(q,u,cliente,'conta_verificada',`${a.integracao} · ${a.identificador}`);
  });
}

// ---------- Rotinas: mesma fila e mesma entrada dos pedidos manuais ----------
export function rotinasLigadas() {
  return process.env.VX_ROTINAS === 'ligado';
}

function limiteDisparos() {
  const limite = Number(process.env.VX_ROTINAS_LIMITE_HORA);
  return Number.isSafeInteger(limite) && limite > 0 ? limite : 20;
}

async function validarEscopoRotina(q: Q, r: Pick<Rotina,'cliente_id'|'area_interna'|'dono_id'|'aprovador_id'>) {
  const [dono,aprovador] = await Promise.all([carregarUsuario(q,r.dono_id),carregarUsuario(q,r.aprovador_id)]);
  if (!dono || !podeVer(dono,r.cliente_id,r.area_interna) || !aprovador || !podeVer(aprovador,r.cliente_id,r.area_interna))
    throw new Error('O dono e o aprovador precisam ter acesso ao escopo da rotina.');
  return dono;
}

export async function salvarRotina(b: Banco, u: Usuario, entrada: unknown, id?: string, agora = new Date()) {
  exigirDirecao(u);
  const r = formularioRotina.parse(entrada);
  return b.transacao(async q => {
    await validarEscopoRotina(q,r);
    if (r.cliente_id && !await obterFichaCliente(q,u,r.cliente_id)) throw new Error('Cliente indisponível.');
    const args = [r.nome,r.papel_id,r.cliente_id,r.area_interna,r.dono_id,r.aprovador_id,r.objetivo,r.fontes,
      r.frequencia,r.dia,r.hora,r.inclui_sazonal];
    if (id) {
      const [linha] = await q.query<Rotina>('select * from rotinas where id=$1 for update',[id]);
      if (!linha) throw new Error('Rotina indisponível.');
      const agendaMudou = linha.frequencia !== r.frequencia || linha.dia !== r.dia || linha.hora.slice(0,5) !== r.hora;
      const proxima = linha.ativa && agendaMudou ? horarioRotina(r,agora,'proxima').toISOString() : linha.proxima_execucao;
      await q.query(`update rotinas set nome=$1,papel_id=$2,cliente_id=$3,area_interna=$4,dono_id=$5,aprovador_id=$6,objetivo=$7,
        fontes=$8,frequencia=$9,dia=$10,hora=$11,inclui_sazonal=$12,proxima_execucao=$13 where id=$14`,[...args,proxima,id]);
      return id;
    }
    const [criada] = await q.query<{ id: string }>(`insert into rotinas (nome,papel_id,cliente_id,area_interna,dono_id,aprovador_id,objetivo,
      fontes,frequencia,dia,hora,inclui_sazonal,chave_dedup) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      on conflict (chave_dedup) do nothing returning id`,[...args,r.chave_dedup]);
    if (criada) return criada.id;
    const [existente] = await q.query<{ id: string }>('select id from rotinas where chave_dedup=$1',[r.chave_dedup]);
    return existente.id;
  });
}

export async function definirRotinaAtiva(b: Banco, u: Usuario, id: string, ativa: boolean, agora = new Date()) {
  exigirDirecao(u);
  await b.transacao(async q => {
    const [r] = await q.query<Rotina>('select * from rotinas where id=$1 for update',[id]);
    if (!r) throw new Error('Rotina indisponível.');
    if (r.ativa === ativa) return;
    const proxima = ativa ? horarioRotina(r,agora,'proxima').toISOString() : null;
    await q.query('update rotinas set ativa=$2,proxima_execucao=$3 where id=$1',[id,ativa,proxima]);
  });
}

type Disparo = { tarefaId: string | null; motivo: string };

async function dispararRotina(b: Banco, q: Q, r: Rotina, janela: string, origem: 'manual' | 'agenda', agora: Date): Promise<Disparo> {
  const [anterior] = await q.query<{ tarefa_id: string }>(
    "select tarefa_id from rotinas_execucoes where rotina_id=$1 and janela=$2 and estado='disparada'",[r.id,janela]);
  if (anterior) return { tarefaId: anterior.tarefa_id, motivo: 'Já disparada nesta janela.' };
  const log = async (motivo: string, tarefaId: string | null = null) => {
    await q.query(`insert into rotinas_execucoes (rotina_id,janela,origem,estado,motivo,tarefa_id,criado_em)
      values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing`,[r.id,janela,origem,tarefaId ? 'disparada' : 'ignorada',motivo,tarefaId,agora.toISOString()]);
    return { tarefaId,motivo };
  };
  if (!r.ativa) return log('Rotina desligada.');
  const [papel] = await q.query<Papel>('select * from papeis where id=$1 for share',[r.papel_id]);
  if (!papel?.execucao_habilitada || papel.estado_config !== 'habilitado' || papel.modo !== 'A1')
    return log('Papel desabilitado ou fora de A1.');
  if (papel.homologado_com !== adaptadorConfigurado().provedor) return log('Papel não homologado com o provedor atual.');
  let dono: Usuario;
  try {
    dono = await validarEscopoRotina(q,r);
  } catch {
    return log('Dono ou aprovador sem acesso ao escopo.');
  }
  if (r.cliente_id) {
    const [c] = await q.query<{ status: string | null }>('select status from clientes where id=$1 and not demo for share',[r.cliente_id]);
    if (c?.status !== 'ativo' && !(r.inclui_sazonal && c?.status === 'sazonal'))
      return log(c?.status ? `Rotina não habilitada para cliente com status ${c.status}.` : 'Cliente indisponível.');
  }
  const plano = await planoFontes(q,dono,r.cliente_id,r.area_interna,r.fontes,r.papel_id);
  const pendencias = pendenciasFontes(plano,r.cliente_id);
  if (pendencias.length) return log(pendencias.map(p => p.texto).join(' · '));
  const [usados] = await q.query<{ n: number }>(`select count(*)::int n from rotinas_execucoes
    where estado='disparada' and criado_em > $1::timestamptz - interval '1 hour'`,[agora.toISOString()]);
  if (usados.n >= limiteDisparos()) return log('Limite geral de disparos na última hora atingido.');
  try {
    await confirmarFontesInternas(q,plano);
  } catch {
    return log('O CRM Vendax não confirmou o espaço comercial de leitura - quem resolve: direção');
  }
  const { tarefaId } = await receberPedido(b,dono,{
    id: `rotina:${r.id}:${janela}`, papel_id: r.papel_id, cliente_id: r.cliente_id, area_interna: r.area_interna,
    dono_id: r.dono_id, aprovador_id: r.aprovador_id, objetivo: r.objetivo, fontes_integracoes: r.fontes,
    rotina: true, conteudo_recuperado: [], demo: false,
    consulta_ads: periodoRotina(r,origem === 'agenda' ? horarioRotina(r,agora,'ultima') : agora),
  },q);
  await q.query('update rotinas set ultima_execucao=$2 where id=$1',[r.id,agora.toISOString()]);
  return log('Tarefa criada na fila A1.',tarefaId);
}

export async function rodarRotinaAgora(b: Banco, u: Usuario, id: string, agora = new Date()): Promise<Disparo> {
  exigirDirecao(u);
  if (!rotinasLigadas()) return { tarefaId: null, motivo: 'Agendador desligado (VX_ROTINAS).' };
  return b.transacao(async q => {
    await q.query('select id from rotinas_controle where id for update');
    const [r] = await q.query<Rotina>('select * from rotinas where id=$1 for update',[id]);
    if (!r) throw new Error('Rotina indisponível.');
    return dispararRotina(b,q,r,janelaRotina(r,agora),'manual',agora);
  });
}

export async function dispararRotinasVencidas(b: Banco, agora = new Date()) {
  if (!rotinasLigadas()) return [];
  return b.transacao(async q => {
    await q.query('select id from rotinas_controle where id for update');
    const vencidas = await q.query<Rotina>(`select * from rotinas where ativa and proxima_execucao <= $1
      order by proxima_execucao,id for update skip locked`,[agora.toISOString()]);
    const resultados: Disparo[] = [];
    for (const r of vencidas) {
      const janela = janelaRotina(r,horarioRotina(r,agora,'ultima'));
      resultados.push(await dispararRotina(b,q,r,janela,'agenda',agora));
      await q.query('update rotinas set proxima_execucao=$2 where id=$1',[r.id,horarioRotina(r,agora,'proxima').toISOString()]);
    }
    return resultados;
  });
}
