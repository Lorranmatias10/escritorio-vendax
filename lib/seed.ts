import type { Banco, Q } from './db';
import { ANDARES, DEPARTAMENTOS, PAPEIS, INTEGRACOES, estadoInicial, configuracaoPapel } from './catalogo';
import { lerCatalogoInstrucoes, compor } from './instrucoes';

// Sincroniza o catálogo (fonte única em lib/catalogo.ts) sem apagar a configuração já feita.
export async function sincronizarCatalogo(q: Q) {
  for (const a of ANDARES) await q.query('insert into andares values ($1,$2) on conflict (numero) do update set nome = excluded.nome', [a.numero, a.nome]);
  for (const [i, d] of DEPARTAMENTOS.entries())
    await q.query(
      `insert into departamentos (id, andar, nome, responsavel_humano, fila, ordem) values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do update set andar = excluded.andar, nome = excluded.nome, responsavel_humano = excluded.responsavel_humano, fila = excluded.fila, ordem = excluded.ordem`,
      [d.id, d.andar, d.nome, d.responsavel, d.fila, i]);
  for (const [i, p] of PAPEIS.entries()) {
    const c = configuracaoPapel(p);
    await q.query(
      `insert into papeis (id, departamento_id, nome, fase, responsavel_proposto, estado_config, vinculo_reservado, ordem, fontes, ferramentas, limites, como_desabilitar)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do update set departamento_id = excluded.departamento_id, nome = excluded.nome, fase = excluded.fase,
         responsavel_proposto = excluded.responsavel_proposto, vinculo_reservado = excluded.vinculo_reservado, ordem = excluded.ordem,
         fontes = excluded.fontes, ferramentas = excluded.ferramentas, limites = excluded.limites, como_desabilitar = excluded.como_desabilitar`,
      [p.id, p.departamento, p.nome, p.fase, p.responsavel, estadoInicial(p), p.vinculo ?? null, i, JSON.stringify(c.fontes), JSON.stringify(c.ferramentas), c.limites, c.como_desabilitar]);
  }
  for (const it of INTEGRACOES)
    await q.query('insert into integracoes (id, nome, observacao) values ($1,$2,$3) on conflict (id) do update set nome = excluded.nome, observacao = excluded.observacao', [it.id, it.nome, it.observacao]);
  await q.query('delete from integracoes where not (id = any($1::text[]))', [INTEGRACOES.map(i => i.id)]);
}

const dia = 86_400_000;
const em = (dias: number, hora = 18) => { const d = new Date(Date.now() + dias * dia); d.setUTCHours(hora + 3, 0, 0, 0); return d.toISOString(); }; // hora em São Paulo (UTC-3)

// Dados sintéticos de demonstração. Nenhum paciente real: só "Paciente fictício NN".
export async function semearDemonstracao(q: Q) {
  const usuarios = [
    ['tiago', 'Tiago', 'admin', true],
    ['fabiana', 'Fabiana', 'equipe', true],
    ['ligia', 'Lígia', 'equipe', false],
    ['lorran', 'Lorran', 'equipe', false],
  ] as const;
  for (const u of usuarios) await q.query('insert into usuarios (id, nome, perfil, pode_financeiro) values ($1,$2,$3,$4) on conflict (id) do nothing', [...u]);
  const clientes = [['aurora', 'Clínica Aurora'], ['sorriso', 'Instituto Sorriso Pleno'], ['vita', 'Dermato Vita']] as const;
  for (const c of clientes) await q.query('insert into clientes (id, nome, demo) values ($1,$2,true) on conflict (id) do nothing', [...c]);
  for (const [u, c] of [['fabiana', 'aurora'], ['fabiana', 'sorriso'], ['ligia', 'aurora'], ['lorran', 'sorriso']])
    await q.query('insert into permissoes_cliente values ($1,$2) on conflict do nothing', [u, c]);

  const tarefas: [string | null, string | null, string, string, string, string, string, string, string | null, string, string][] = [
    // cliente, area, depto, papel, dono, objetivo, estado, prazo, motivo, próximo passo, fonte
    ['vita', null, 'performance', 'midia_paga', 'tiago', 'Revisar campanha de harmonização facial', 'bloqueada', em(2), 'Integração pendente: Google Ads e Meta Ads', 'Confirmar acesso às contas autorizadas', 'Pedido interno · Demonstração'],
    ['sorriso', null, 'whatsapp', 'monitor_whatsapp', 'lorran', 'Investigar template pausado no número principal', 'na_fila', em(0, 16), null, 'Reunir status de BM, número e template', 'Alerta de operação · Demonstração'],
    ['aurora', null, 'atendimento', 'copiloto_atendimento', 'ligia', 'Retornar Paciente fictício 07 e Paciente fictício 12', 'na_fila', em(0, 17), null, 'Atendente valida a resposta sugerida', 'CRM de atendimento · Demonstração'],
    ['sorriso', null, 'performance', 'dados_atribuicao', 'lorran', 'Relatório mensal de performance de outubro', 'concluida', em(-3), null, 'Entregue ao cliente', 'Rotina mensal · Demonstração'],
    [null, 'financeiro', 'financeiro', 'faturamento_cobranca', 'fabiana', 'Conferir faturas da competência de novembro', 'na_fila', em(1), null, 'Conferir vencimentos e NF', 'Rotina financeira · Demonstração'],
    [null, 'comercial', 'comercial', 'sdr_followup', 'tiago', 'Follow-up dos leads da Vendax desta semana', 'bloqueada', em(1), 'Papel da fase 2: execução desabilitada', 'Habilitar o papel na fase 2 ou executar manualmente', 'Pedido do Tiago · Demonstração'],
    [null, 'produto', 'produto', 'qa_integracoes', 'lorran', 'Validar roteamento por número no Vendax App', 'falhou', em(-1), null, 'Repetir o teste em homologação', 'Backlog · Demonstração'],
  ];
  for (const [i, t] of tarefas.entries()) {
    const [r] = await q.query<{ id: string }>(
      `insert into tarefas (cliente_id, area_interna, departamento_id, papel_atual_id, dono_humano_id, objetivo, estado, prazo, motivo_bloqueio, proximo_passo, fonte, origem_evento_id, demo, criterio_conclusao)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,'Resultado confirmado pelo dono humano') returning id`,
      [...t, `demo-base-${i}`]);
    await q.query(`insert into eventos_tarefa (tarefa_id, tipo, descricao, ator) values ($1,'criada','Tarefa criada (Demonstração)','sistema')`, [r.id]);
  }

  const entregas = [
    ['aurora', 'Landing page de implantes', em(3), 'em_andamento'], ['aurora', 'Relatório de outubro', em(-2), 'atrasada'],
    ['sorriso', 'Fluxo de reativação de pacientes', em(6), 'planejada'], ['vita', 'Novos criativos de dezembro', em(5), 'planejada'],
  ];
  for (const e of entregas) await q.query('insert into entregas (cliente_id, titulo, prazo, estado, demo) values ($1,$2,$3,$4,true)', e);
  const incidentes: [string | null, string | null, string, string, string][] = [
    ['sorriso', null, 'Template de confirmação pausado', 'alta', 'aberto'],
    ['aurora', null, 'Formulário sem evento de conversão', 'media', 'em_tratamento'],
    [null, 'financeiro', 'Divergência de recarga na competência', 'media', 'aberto'],
  ];
  for (const x of incidentes) await q.query('insert into incidentes (cliente_id, area_interna, titulo, severidade, estado, demo) values ($1,$2,$3,$4,$5,true)', x);
}

// Apaga o que é de demonstração e semeia de novo. Não toca no catálogo nem em instruções.
export async function resetarDemonstracao(b: Banco) {
  await b.transacao(async q => {
    await q.query('delete from aprovacoes'); await q.query('delete from evidencias'); await q.query('delete from execucoes');
    await q.query('delete from entregas'); await q.query('delete from incidentes'); await q.query('delete from eventos_tarefa');
    await q.query('update tarefas set parent_id = null'); await q.query('delete from tarefas');
    await q.query('delete from permissoes_cliente'); await q.query('delete from clientes where demo');
    await semearDemonstracao(q);
  });
}

// Importa o catálogo versionado de instruções (comum + bloco individual). Versões existentes não são reescritas.
// Papéis do piloto que recebem instrução passam a "em homologação"; continuam sem executar fora da demonstração.
export async function importarInstrucoes(q: Q) {
  const ids = new Set(PAPEIS.map(p => p.id));
  for (const v of lerCatalogoInstrucoes()) {
    for (const p of v.papeis) {
      if (!ids.has(p.id)) throw new Error(`Instrução ${v.arquivo}: papel ${p.id} não existe no catálogo`);
      const r = await q.query(
        `insert into instrucoes (papel_id, versao, conteudo, estado, autor_id) values ($1,$2,$3,'em_homologacao',null) on conflict (papel_id, versao) do nothing returning id`,
        [p.id, v.versao, compor(v, p)]);
      if (r.length) await q.query(`insert into registro_configuracao (papel_id, acao, detalhe, ator) values ($1,'instrucao_importada',$2,'sistema')`,
        [p.id, `Instrução v${v.versao} importada de agentes/instrucoes/${v.arquivo}.`]);
    }
  }
  await q.query(`update papeis set estado_config = 'em_homologacao' where fase = 'piloto' and estado_config = 'aguardando_configuracao'
                 and exists (select 1 from instrucoes i where i.papel_id = papeis.id)`);
}

export async function prepararDados(b: Banco) {
  await sincronizarCatalogo(b);
  const [{ n }] = await b.query<{ n: number }>('select count(*)::int as n from usuarios');
  if (n === 0) await b.transacao(q => semearDemonstracao(q));
  await importarInstrucoes(b);
}
