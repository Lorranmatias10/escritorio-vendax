import { randomUUID } from 'node:crypto';
import type { Banco } from './db';
import { podeVer, SemAcesso, type Usuario } from './escopo';
import { adaptadorDoPapel, claudeHomologado, SaidaAgente } from './ia';
import { processarFila, receberPedido, registrarConfiguracao } from './orquestracao';
import { FLUXOS_CLAUDE, fluxosDoPapel, type FluxoClaude } from './skills-claude';
import { consultaAds } from './consulta-ads';
import type { z } from 'zod';
import { historicoEspecialista, pedidoChatEspecialista } from './chat-especialistas';

const CENARIOS: Record<FluxoClaude, { pedido: string; dados: string }> = {
  nextags: { pedido: 'Sugira um desenho de triagem no NexTags e um caso de teste.',
    dados: 'Clínica fictícia. O WhatsApp precisa distinguir primeira consulta de retorno e passar casos ambíguos para atendimento humano.' },
  perfil_google: { pedido: 'Prepare um plano de auditoria do Perfil da Empresa no Google.',
    dados: 'Clínica fictícia. O horário no site diverge do informado na ficha. Há uma avaliação recente sem resposta.' },
  google_ads: { pedido: 'Prepare uma análise de Google Ads para uma clínica fictícia.',
    dados: 'Busca: 120 cliques e 8 contatos em 7 dias. A quantidade de agendamentos e as inserções da conversão não foram verificadas.' },
  meta_ads: { pedido: 'Prepare uma análise de Meta Ads para uma clínica fictícia.',
    dados: 'Campanha de formulário: 30 contatos em 7 dias e 12 contatos em 7 dias no criativo comparado. A qualidade dos contatos não foi medida.' },
};

export async function homologarEspecialista(b: Banco, u: Usuario, papel: string) {
  if (u.perfil !== 'admin') throw new SemAcesso('Somente a direção homologa especialistas.');
  const fluxos = fluxosDoPapel(papel);
  if (!fluxos.length) throw new Error('Este papel não possui Skills do Claude.');
  const [instrucao] = await b.query<{ versao: string; conteudo: string }>(
    `select versao, conteudo from instrucoes where papel_id = $1 order by criado_em desc, id desc limit 1`, [papel]);
  if (!instrucao) throw new Error('Registre a instrução do papel antes de homologar.');
  const adaptador = await adaptadorDoPapel(papel);
  const resultados = await Promise.all(fluxos.map(async fluxo => {
    const caso = CENARIOS[fluxo];
    try {
      const saida = SaidaAgente.parse(await adaptador.executar({ papel_id: papel, etapa: 'analisar',
        instrucao_operacional: caso.pedido, contexto: { fluxo_claude: fluxo, dono_nome: u.nome },
        conteudo_recuperado: [{ fonte: 'Dados fictícios de homologação', texto: caso.dados }] }, instrucao, 1));
      const skills_confirmadas = FLUXOS_CLAUDE[fluxo].skills.every(nome => saida.fontes.some(f => f.nome === `Skill: ${nome}` && f.disponivel));
      const em_A1 = saida.efeito_confirmado === null && saida.trilha === 'preparado';
      const entregou_rascunho = Boolean(saida.rascunho?.trim());
      return { fluxo, passou: skills_confirmadas && em_A1 && entregou_rascunho, evidencia: { skills_confirmadas, em_A1, entregou_rascunho } };
    } catch (e) {
      return { fluxo, passou: false, evidencia: { erro: e instanceof Error ? e.message : 'Falha na homologação.' } };
    }
  }));
  const rodada = randomUUID();
  const aprovado = resultados.every(x => x.passou);
  await b.transacao(async q => {
    for (const x of resultados) await q.query(
      `insert into homologacoes (rodada, versao, caso, esperado, papeis, passou, evidencia, executado_por) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [rodada, instrucao.versao, FLUXOS_CLAUDE[x.fluxo].nome, 'Carrega as Skills e prepara um rascunho interno em A1.', [papel], x.passou, { ...x.evidencia, provedor: adaptador.provedor }, u.id]);
    if (aprovado) {
      const [confirmada] = await q.query<{ conteudo: string }>(
        'select conteudo from instrucoes where papel_id = $1 and versao = $2 for update', [papel, instrucao.versao]);
      if (confirmada?.conteudo !== instrucao.conteudo) throw new Error('A instrução foi alterada. Rode a homologação novamente.');
      await q.query(`update instrucoes set estado = 'aprovada' where papel_id = $1 and versao = $2`, [papel, instrucao.versao]);
      await q.query(`update papeis set claude_versao_instrucao = $2, claude_homologado_com = $3,
        estado_config = 'habilitado', execucao_habilitada = true, modo = 'A1' where id = $1`, [papel, instrucao.versao, adaptador.provedor]);
    }
    await registrarConfiguracao(q, papel, aprovado ? 'habilitado' : 'homologacao_reprovada',
      `Claude em A1 · ${resultados.filter(x => x.passou).length}/${resultados.length} fluxos aprovados · ${adaptador.provedor}.`, u.nome);
  });
}

type PedidoEspecialista = { id: string; fluxo: FluxoClaude; cliente: string; objetivo: string; dados: string; consulta_ads?: z.infer<typeof consultaAds> };

async function registrarPedidoEspecialista(b: Banco, u: Usuario, pedido: PedidoEspecialista, mensagemChat?: string) {
  const { papel } = FLUXOS_CLAUDE[pedido.fluxo];
  if (!podeVer(u, pedido.cliente, null)) throw new SemAcesso('Sem acesso a este cliente.');
  const [cliente] = await b.query<{ id: string }>('select id from clientes where id = $1 and not demo', [pedido.cliente]);
  if (!cliente) throw new SemAcesso('Cliente indisponível para esta análise.');
  const [config] = await b.query<{ execucao_habilitada: boolean; claude_homologado_com: string | null }>(
    'select execucao_habilitada, claude_homologado_com from papeis where id = $1', [papel]);
  if (!config?.execucao_habilitada || !process.env.ANTHROPIC_API_KEY || !await claudeHomologado(papel, config.claude_homologado_com, (await adaptadorDoPapel(papel)).provedor))
    throw new Error('Este especialista precisa ser homologado antes de receber pedidos.');
  const fontes = pedido.dados ? [{ fonte: 'Dados anexados à tarefa', texto: pedido.dados }] : [];
  if (mensagemChat) {
    const contexto = (await historicoEspecialista(b, u, pedido, 6)).filter(t => t.resposta).slice(-3);
    if (contexto.length) fontes.push({ fonte: 'Histórico recente deste chat', texto: contexto.map(t =>
      `Pedido anterior: ${t.mensagem.slice(0, 1500)}\nRascunho anterior: ${t.resposta?.slice(0, 2200)}`).join('\n\n') });
  }
  const { tarefaId } = await receberPedido(b, u, {
    id: `${mensagemChat ? 'chat-claude' : 'claude'}:${u.id}:${pedido.id}`, papel_id: papel, cliente_id: cliente.id, area_interna: null,
    dono_id: u.id, objetivo: pedido.objetivo, fluxo_claude: pedido.fluxo, demo: false,
    conteudo_recuperado: fontes, mensagem_chat: mensagemChat, consulta_ads: pedido.consulta_ads,
  });
  return tarefaId;
}

export async function registrarChatEspecialista(b: Banco, u: Usuario, entrada: unknown) {
  const { mensagem, ...pedido } = pedidoChatEspecialista.parse(entrada);
  const assunto = mensagem.replace(/\s+/g, ' ');
  const objetivo = assunto.length > 300 ? `${assunto.slice(0, 299)}…` : assunto;
  return registrarPedidoEspecialista(b, u, { ...pedido, objetivo }, mensagem);
}

export async function pedirAoEspecialista(b: Banco, u: Usuario, pedido: PedidoEspecialista) {
  const tarefaId = await registrarPedidoEspecialista(b, u, pedido);
  await processarFila(b, undefined, 1, tarefaId);
  return tarefaId;
}
