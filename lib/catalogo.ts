// Fonte única do escritório: andares, salas, papéis, fases, donos e integrações.
// Baseado em "Escritório Vendax · Organograma de agentes" (18/11/2026 · Proposta).
// Ajuste aqui; o banco é sincronizado a partir deste arquivo (lib/seed.ts) e o layout lê do banco.

export type Fase = 'piloto' | 'fase_2' | 'fase_3';
export type EstadoConfig = 'aguardando_configuracao' | 'em_homologacao' | 'habilitado' | 'desabilitado';

export const ANDARES = [
  { numero: 5, nome: '5º andar' },
  { numero: 4, nome: '4º andar' },
  { numero: 3, nome: '3º andar' },
  { numero: 2, nome: '2º andar' },
  { numero: 1, nome: '1º andar' },
] as const;

// r = retângulo da sala na imagem do prédio (px de public/escritorio-predio.png, 1536x1024)
export const DEPARTAMENTOS = [
  { id: 'direcao',     andar: 5, nome: 'Direção e Qualidade',         responsavel: 'Tiago',                                   fila: 'Prioridades, critérios de aceite e decisões estratégicas', r: [180, 95, 1078, 177] },
  { id: 'comercial',   andar: 4, nome: 'Comercial e Novos Negócios',  responsavel: 'Tiago',                                   fila: 'Quem pode contratar a Vendax',                             r: [180, 292, 570, 163] },
  { id: 'marketing',   andar: 4, nome: 'Marketing da Vendax',         responsavel: 'Tiago',                                   fila: 'Demanda e autoridade da marca',                            r: [760, 292, 498, 163] },
  { id: 'contas',      andar: 3, nome: 'Gestão de Contas e Entrega',  responsavel: 'Tiago (relacionamento e escopo) · Fabiana (coordenação)', fila: 'Contas, escopo, pendências e riscos por cliente', r: [180, 475, 445, 140] },
  { id: 'atendimento', andar: 3, nome: 'Atendimento e Conversão',     responsavel: 'Lígia (operação) · Fabiana (acompanhamento) · Tiago (estratégia)', fila: 'Leads e pacientes do cliente autorizado', r: [668, 475, 590, 140] },
  { id: 'performance', andar: 2, nome: 'Performance e Web',           responsavel: 'Tiago (estratégia e verba) · Lorran (integrações e aceite técnico)', fila: 'Mídia, dados, atribuição e web', r: [180, 645, 360, 125] },
  { id: 'whatsapp',    andar: 2, nome: 'WhatsApp, Automação e IA',    responsavel: 'Lorran',                                  fila: 'Operação de WhatsApp, fluxos e bases de IA dos clientes',   r: [572, 645, 328, 125] },
  { id: 'produto',     andar: 2, nome: 'Produto e Engenharia',        responsavel: 'Tiago (prioridade) · Lorran (validação e publicação)', fila: 'Vendax App: backlog, QA e integrações', r: [935, 645, 323, 125] },
  { id: 'financeiro',  andar: 1, nome: 'Financeiro e Administrativo', responsavel: 'Fabiana (alçada combinada com Tiago)',    fila: 'Faturamento, conciliação e contratos · acesso restrito',   r: [180, 800, 1078, 165] },
] as const;

export type DepartamentoId = (typeof DEPARTAMENTOS)[number]['id'];

type Papel = {
  id: string; departamento: DepartamentoId; nome: string; fase: Fase; responsavel: string;
  faz: string; entrega: string; vinculo?: string;
};

export const PAPEIS: Papel[] = [
  // 5º · Direção e Qualidade
  { id: 'diretor_operacoes', departamento: 'direcao', nome: 'Diretor Geral IA', fase: 'piloto', responsavel: 'Tiago',
    faz: 'Recebe pedidos, distribui o trabalho, revisa entregas e encaminha decisões fora da alçada.', entrega: 'Resposta consolidada com evidências, responsáveis e decisões pendentes.' },
  { id: 'auditor_qualidade', departamento: 'direcao', nome: 'Auditor de Qualidade', fase: 'piloto', responsavel: 'Tiago',
    faz: 'Confere amostras e entregas críticas com as fontes e identifica divergências.', entrega: 'Parecer com evidência, correção solicitada e responsável pela revisão.' },
  { id: 'curador_conhecimento', departamento: 'direcao', nome: 'Curador de Conhecimento', fase: 'fase_3', responsavel: 'Tiago',
    faz: 'Organiza playbooks, fichas de cliente e decisões com fonte, versão e responsável.', entrega: 'Base revisada e registro de orientações vencidas ou conflitantes.' },
  // 4º · Comercial e Novos Negócios
  { id: 'sdr_followup', departamento: 'comercial', nome: 'SDR e Follow-up', fase: 'fase_2', responsavel: 'Tiago',
    faz: 'Confere duplicidade, qualifica leads e indica o próximo contato.', entrega: 'Lista priorizada, rascunho de contato e tarefa de follow-up.' },
  { id: 'propostas_negociacao', departamento: 'comercial', nome: 'Especialista em Propostas e Negociação', fase: 'fase_2', responsavel: 'Tiago',
    faz: 'Transforma diagnóstico em proposta a partir do catálogo e condições vigentes.', entrega: 'Proposta revisável e registro do escopo acordado para o onboarding.' },
  { id: 'expansao_parcerias', departamento: 'comercial', nome: 'Analista de Expansão e Parcerias', fase: 'fase_3', responsavel: 'Tiago',
    faz: 'Avalia indicações, parcerias, novos segmentos e extensões de serviço.', entrega: 'Priorização de oportunidades e hipótese de próximo teste.' },
  // 4º · Marketing da Vendax
  { id: 'posicionamento_conteudo', departamento: 'marketing', nome: 'Estrategista de Posicionamento e Conteúdo', fase: 'fase_3', responsavel: 'Tiago',
    faz: 'Organiza e prioriza pautas por objetivo e sinais da audiência.', entrega: 'Pauta priorizada com ângulo, gancho, público e objetivo.' },
  { id: 'produtor_editorial', departamento: 'marketing', nome: 'Produtor Editorial', fase: 'fase_3', responsavel: 'Tiago',
    faz: 'Transforma pautas e casos liberados em roteiros, posts e materiais comerciais.', entrega: 'Rascunhos prontos para revisão e publicação autorizada.' },
  // 3º · Gestão de Contas e Entrega
  { id: 'gerente_contas', departamento: 'contas', nome: 'Gerente de Contas IA (AM - Vendax)', fase: 'piloto', responsavel: 'Tiago e Fabiana',
    faz: 'Consolida reunião, escopo, pendências e riscos por cliente.', entrega: 'Plano por cliente com andamento, dono, prazo, dependências e minuta de atualização.',
    vinculo: 'AM - Vendax · vínculo reservado. Antes de ativar uma rotina, identificar onde ela já roda; não criar uma segunda automação para o mesmo trabalho.' },
  { id: 'implantacao_entregas', departamento: 'contas', nome: 'Coordenador de Implantação e Entregas', fase: 'fase_3', responsavel: 'Fabiana e Tiago',
    faz: 'Converte o escopo fechado em checklist e acompanha entregas, testes e validações.', entrega: 'Plano de onboarding, quadro de bloqueios e checklist de aceite.' },
  // 3º · Atendimento e Conversão
  { id: 'copiloto_atendimento', departamento: 'atendimento', nome: 'Copiloto de Atendimento', fase: 'fase_2', responsavel: 'Lígia e Fabiana',
    faz: 'Lê a conversa, identifica intenção e sugere resposta seguindo a ficha da clínica.', entrega: 'Resposta sugerida para o atendente e indicação da próxima ação.' },
  { id: 'crm_conversao', departamento: 'atendimento', nome: 'Analista de CRM e Conversão', fase: 'fase_3', responsavel: 'Lígia, Fabiana e Tiago',
    faz: 'Localiza leads parados, follow-ups vencidos, perdas e faltas.', entrega: 'Lista de prioridades e relatório de conversão por etapa e motivo de perda.' },
  // 2º · Performance e Web
  { id: 'midia_paga', departamento: 'performance', nome: 'Líder de Mídia Paga', fase: 'fase_3', responsavel: 'Tiago e Lorran',
    faz: 'Revê Google Ads e Meta Ads, propõe testes e prepara ajustes para aprovação.', entrega: 'Plano de otimização com evidência, efeito esperado e escopo da mudança.' },
  { id: 'especialista_google_ads', departamento: 'performance', nome: 'Especialista em Google Ads', fase: 'fase_3', responsavel: 'Tiago e Lorran',
    faz: 'Analisa campanhas, buscas e conversões na conta Google Ads confirmada do cliente.', entrega: 'Diagnóstico de Google Ads com período, conta, evidências e prioridades.' },
  { id: 'especialista_meta_ads', departamento: 'performance', nome: 'Especialista em Meta Ads', fase: 'fase_3', responsavel: 'Tiago e Lorran',
    faz: 'Analisa campanhas, criativos e conversões na conta Meta Ads confirmada do cliente.', entrega: 'Diagnóstico de Meta Ads com período, conta, evidências e prioridades.' },
  { id: 'dados_atribuicao', departamento: 'performance', nome: 'Analista de Dados e Atribuição', fase: 'fase_2', responsavel: 'Tiago e Lorran',
    faz: 'Cruza Ads e Reportei com CRM e agenda, quando o vínculo for verificável.', entrega: 'Relatório com período, fonte, conversão por etapa e lacunas de atribuição.',
    vinculo: 'Base Central de Tráfego (Relevance AI) · vínculo reservado, integração pendente.' },
  { id: 'web_presenca_local', departamento: 'performance', nome: 'Especialista em Web e Presença Local', fase: 'fase_3', responsavel: 'Tiago e Lorran',
    faz: 'Revisa landing pages, eventos de conversão, WordPress e Perfil da Empresa no Google.', entrega: 'Lista priorizada de ajustes e rascunhos para validação.' },
  // 2º · WhatsApp, Automação e IA
  { id: 'monitor_whatsapp', departamento: 'whatsapp', nome: 'Monitor de WhatsApp e Incidentes', fase: 'fase_2', responsavel: 'Lorran',
    faz: 'Correlaciona status de BM, número, template, carteira e entrega.', entrega: 'Linha do tempo com impacto, evidências, hipóteses e próximos testes.' },
  { id: 'fluxos_campanhas_whatsapp', departamento: 'whatsapp', nome: 'Especialista em Fluxos e Campanhas WhatsApp', fase: 'fase_3', responsavel: 'Lorran',
    faz: 'Prepara fluxos, segmentação, templates e checklists de campanha.', entrega: 'Fluxo revisável e checklist de campanha para aprovação.' },
  { id: 'automacoes_bases_ia', departamento: 'whatsapp', nome: 'Especialista em Automações e Bases de IA', fase: 'fase_3', responsavel: 'Lorran',
    faz: 'Desenha roteamento, configurações de copiloto, bases por cliente e testes de integração.', entrega: 'Especificação testável e resultado de homologação.',
    vinculo: 'Bases de IA no Relevance AI · vínculo reservado, integração pendente.' },
  // 2º · Produto e Engenharia
  { id: 'produto_vendax_app', departamento: 'produto', nome: 'Analista de Produto Vendax App', fase: 'fase_3', responsavel: 'Tiago e Lorran',
    faz: 'Converte feedback, falhas e solicitações em backlog com critérios de aceite.', entrega: 'Backlog priorizado com contexto, impacto e critério de conclusão.' },
  { id: 'qa_integracoes', departamento: 'produto', nome: 'Especialista em QA e Integrações', fase: 'fase_3', responsavel: 'Lorran',
    faz: 'Reproduz falhas em homologação e valida integrações e regressão.', entrega: 'Evidência de teste, resultado por cenário e pendências para o deploy.' },
  // 1º · Financeiro e Administrativo
  { id: 'faturamento_cobranca', departamento: 'financeiro', nome: 'Analista de Faturamento e Cobrança', fase: 'fase_2', responsavel: 'Fabiana',
    faz: 'Confere contrato, competência, vencimento, fatura e NF.', entrega: 'Fila de faturamento, divergências e rascunhos para a Fabiana.' },
  { id: 'conciliacao_margem', departamento: 'financeiro', nome: 'Analista de Conciliação e Margem', fase: 'fase_3', responsavel: 'Fabiana',
    faz: 'Cruza registros financeiros, consumo, recargas e custos por cliente.', entrega: 'Conciliação com divergências, saldo verificado e margem quando calculável.' },
  { id: 'administrativo_contratos', departamento: 'financeiro', nome: 'Assistente Administrativo e Contratos', fase: 'fase_3', responsavel: 'Fabiana',
    faz: 'Acompanha documentos, vigências, renovações, fornecedores e checklists internos.', entrega: 'Calendário de renovações e documentação preparada para revisão.' },
];

export const PAPEIS_PILOTO = ['diretor_operacoes', 'gerente_contas', 'auditor_qualidade'] as const;

// Estado inicial: piloto aguarda instrução + homologação; demais papéis ficam desabilitados.
export const estadoInicial = (p: Papel): EstadoConfig => (p.fase === 'piloto' ? 'aguardando_configuracao' : 'desabilitado');

// ---------- Configuração de execução por papel ----------
// Fontes candidatas por domínio (organograma, seção 4). Na V1 só a fila interna e o conteúdo da própria tarefa
// estão confirmados; as demais aparecem como "Integração pendente".
export const FONTES_CONFIRMADAS = ['Fila de tarefas do escritório', 'Conteúdo anexado à tarefa'];
const FONTES_DEPTO: Record<DepartamentoId, string[]> = {
  direcao: ['CRM Vendax', 'Agenda', 'Incidentes', 'Bases da Vendax'],
  comercial: ['CRM Vendax', 'Agenda', 'Notas de reunião', 'Escopo vigente'],
  marketing: ['Pilares e materiais da Vendax', 'Casos liberados para uso público'],
  contas: ['CRM Vendax', 'Agenda', 'Notas de reunião', 'Escopo vigente'],
  atendimento: ['CRM de atendimento', 'Inbox por cliente', 'Agenda oficial da clínica', 'Ficha validada da clínica'],
  performance: ['Google Ads', 'Meta Ads', 'Reportei', 'WordPress', 'Perfil da Empresa no Google'],
  whatsapp: ['NextTags', 'Vendax App', 'Logs autorizados'],
  produto: ['Vendax App', 'Backlog', 'GitHub', 'Ambiente de homologação'],
  financeiro: ['Asaas', 'Notas fiscais', 'Contratos', 'Controles autorizados da Fabiana'],
};
// Ferramentas concedidas em A1 (consulta e rascunho). Papéis fora do piloto não recebem ferramentas.
const FERRAMENTAS_A1 = ['ler_tarefas_no_escopo', 'ler_conteudo_da_tarefa', 'registrar_rascunho', 'propor_delegacao'];
const FERRAMENTAS_EXTRA: Record<string, string[]> = { diretor_operacoes: ['preparar_pedido_de_aprovacao'], auditor_qualidade: ['emitir_parecer'] };
const LIMITES_EXTRA: Record<string, string> = {
  gerente_contas: 'Mantém o AM - Vendax como papel de gestão de contas: validar as rotinas existentes antes de agendar novas; não criar segunda automação para o mesmo trabalho.',
  diretor_operacoes: 'Financeiro: usar apenas o resumo permitido para quem consulta. Conflitos de prioridade, escopo ou alçada vão ao Tiago.',
  auditor_qualidade: 'Parecer de qualidade e autorização operacional são registros separados.',
};

export function configuracaoPapel(p: Papel) {
  const piloto = p.fase === 'piloto';
  const restrito = p.departamento === 'financeiro' ? ' Acesso financeiro restrito a Tiago e Fabiana.' : '';
  return {
    fontes: [...FONTES_CONFIRMADAS, ...FONTES_DEPTO[p.departamento]],
    ferramentas: piloto ? [...FERRAMENTAS_A1, ...(FERRAMENTAS_EXTRA[p.id] ?? [])] : [],
    limites: `${piloto ? 'A1: consulta, classificação, resumo e rascunho. Sem gravação em sistemas externos.' : 'Cadastrado e desabilitado até a aprovação da fase.'} Execução externa desabilitada na V1.${restrito} ${LIMITES_EXTRA[p.id] ?? ''}`.trim(),
    como_desabilitar: 'Agentes → papel → "Desabilitar papel" (registra quem e por quê). O executor passa a bloquear novas execuções com o motivo; tarefas e histórico são preservados. Reabilitar exige nova homologação.',
  };
}

// O status das integrações vem do health check em lib/integracoes.ts.
// papeis = agentes que dependem da integração. escopo = o mínimo que esses agentes precisam.
export const INTEGRACOES = [
  { id: 'crm', nome: 'CRM Vendax', icone: 'CRM', escopo: 'leitura', observacao: 'Fonte oficial de contas, etapas e histórico.',
    papeis: ['diretor_operacoes', 'gerente_contas', 'auditor_qualidade', 'sdr_followup', 'propostas_negociacao', 'implantacao_entregas', 'copiloto_atendimento', 'crm_conversao'] },
  { id: 'google-workspace', nome: 'Google Workspace', icone: 'G', escopo: 'leitura', observacao: 'Agenda e notas de reunião (evento do piloto).',
    papeis: ['diretor_operacoes', 'gerente_contas', 'auditor_qualidade', 'sdr_followup', 'implantacao_entregas', 'curador_conhecimento'] },
  { id: 'google-ads', nome: 'Google Ads', icone: 'GA', escopo: 'leitura', observacao: 'Somente contas autorizadas.',
    papeis: ['especialista_google_ads', 'midia_paga', 'dados_atribuicao'] },
  { id: 'meta-ads', nome: 'Meta Ads', icone: 'M', escopo: 'leitura', observacao: 'Somente contas autorizadas.',
    papeis: ['especialista_meta_ads', 'midia_paga', 'dados_atribuicao'] },
  { id: 'reportei', nome: 'Reportei', icone: 'R', escopo: 'leitura', observacao: 'Relatórios de performance.',
    papeis: ['dados_atribuicao', 'midia_paga', 'gerente_contas', 'auditor_qualidade'] },
  { id: 'nexttags', nome: 'NextTags', icone: 'NT', escopo: 'leitura', observacao: 'WhatsApp e operação de atendimento.',
    papeis: ['monitor_whatsapp', 'fluxos_campanhas_whatsapp', 'automacoes_bases_ia', 'copiloto_atendimento'] },
  { id: 'vendax-app', nome: 'Vendax App', icone: 'VX', escopo: 'leitura', observacao: 'Produto próprio; logs e status autorizados.',
    papeis: ['produto_vendax_app', 'qa_integracoes', 'monitor_whatsapp', 'automacoes_bases_ia'] },
  { id: 'asaas', nome: 'Asaas', icone: 'A$', escopo: 'leitura', observacao: 'Financeiro · leitura apenas; acesso restrito a Tiago e Fabiana.',
    papeis: ['faturamento_cobranca', 'conciliacao_margem'] },
] as const;
export type IntegracaoId = (typeof INTEGRACOES)[number]['id'];

// Rótulos em português para valores estáveis do código
export const ROTULO_ESTADO_TAREFA = {
  na_fila: 'Na fila', em_execucao: 'Em execução', bloqueada: 'Bloqueada', aguardando_aprovacao: 'Aguardando aprovação',
  concluida: 'Concluída', falhou: 'Falhou', cancelada: 'Cancelada',
} as const;
export type EstadoTarefa = keyof typeof ROTULO_ESTADO_TAREFA;
export const ESTADOS_TAREFA = Object.keys(ROTULO_ESTADO_TAREFA) as EstadoTarefa[];
export const ESTADOS_ABERTOS: EstadoTarefa[] = ['na_fila', 'em_execucao', 'bloqueada', 'aguardando_aprovacao', 'falhou'];

export const ROTULO_CONFIG: Record<EstadoConfig, string> = {
  aguardando_configuracao: 'Aguardando configuração', em_homologacao: 'Em homologação', habilitado: 'Habilitado', desabilitado: 'Execução desabilitada',
};
export const ROTULO_FASE: Record<Fase, string> = { piloto: 'Fase 1 · Piloto', fase_2: 'Fase 2', fase_3: 'Fase 3' };
export const ROTULO_APROVACAO = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada', expirada: 'Expirada' } as const;
export const ROTULO_EVIDENCIA = {
  fonte: 'Fonte consultada', rascunho: 'Rascunho', acao_solicitada: 'Ação solicitada', resultado_confirmado: 'Resultado confirmado',
} as const;
export const MODOS = {
  A1: 'A1 · Assistido (consulta, rascunho e recomendações)',
  A2: 'A2 · Registro interno (após liberação explícita do fluxo)',
  A3: 'A3 · Ação supervisionada (aprovação específica; execução externa desabilitada na V1)',
} as const;

export const FUSO = 'America/Sao_Paulo';
