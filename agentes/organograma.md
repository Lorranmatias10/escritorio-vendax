# Escritório Vendax
## Organograma de agentes e especificação para implementação

**18 de novembro de 2026 · Proposta**

**[Fato]** A Vendax atua em captação, operação comercial, CRM, atendimento, WhatsApp, automação, IA e performance. O Vendax App é um produto próprio. A empresa já desenhou uma arquitetura multiagente, documentou bases de tráfego no Relevance AI e usa o AM - Vendax como referência para gestão de contas.

**[Inferência minha]** O maior ganho inicial está nas rotinas que atravessam várias ferramentas e pessoas. O agente pode reunir as evidências, registrar a pendência, cobrar o próximo passo internamente e preparar a resposta para quem decide ou envia.

**[Suposição]** A equipe vai implementar o escritório no ambiente em nuvem que escolher. A divisão abaixo propõe donos humanos, ordem de ativação e fronteiras de acesso. Cada integração e cada permissão devem ser confirmadas no ambiente de destino.

## 1. O prédio

O escritório tem **5 andares, 9 departamentos e 23 papéis**. Cada departamento ocupa uma sala. Clicar nela abre a fila da área. Clicar em um agente mostra a tarefa atual, o que foi feito, as fontes autorizadas e o próximo responsável. O mesmo sistema de tarefas sustenta o prédio visual e a visão em lista.

| Andar | Salas | Papéis |
| --- | --- | --- |
| 5º | Direção e Qualidade | 3 |
| 4º | Comercial e Novos Negócios · Marketing da Vendax | 5 |
| 3º | Gestão de Contas e Entrega · Atendimento e Conversão | 4 |
| 2º | Performance e Web · WhatsApp, Automação e IA · Produto e Engenharia | 8 |
| 1º | Financeiro e Administrativo | 3 |
| **Total** | **9 departamentos** | **23** |

A recepção de demandas é transversal. Um pedido do Tiago, uma reunião, um evento de CRM ou uma rotina já autorizada pode criar uma tarefa. O Diretor de Operações IA encaminha demandas avulsas. Rotinas conhecidas podem ir direto ao especialista e aparecer para a direção no resumo. Os papéis rodam sob demanda, com fila e histórico comuns.

## 2. Agentes e responsabilidades

**Fases propostas:** 1 = piloto de consulta e rascunho. 2 = primeira expansão, com registros internos autorizados e módulos de apoio. 3 = expansão conforme volume, qualidade e capacidade de manutenção. A fase indica a ordem de disponibilização do papel. Cada ação continua sujeita à sua permissão.

### 5º andar · Direção e Qualidade

**Responsável proposto — Tiago.** Estabelece prioridades, critérios de aceite e decisões estratégicas.

| Agente | O que faz | Entrega | Fase |
| --- | --- | --- | --- |
| Diretor de Operações IA | Prioriza tarefas, resolve conflitos de fila e encaminha decisões. Recebe resumos conforme a permissão de quem consulta. | Briefing executivo com prioridades, donos, prazos e decisões pendentes. | 1 |
| Auditor de Qualidade | Confere amostras e entregas críticas com as fontes. Identifica divergências de cliente, período, números, escopo ou aprovação. | Parecer com evidência, correção solicitada e responsável pela revisão. | 1 |
| Curador de Conhecimento | Organiza playbooks, fichas de cliente e decisões operacionais com fonte, versão e responsável. Encaminha contradições ao dono da informação. | Base revisada e registro de orientações vencidas ou conflitantes. | 3 |

### 4º andar · Comercial e Novos Negócios

**Responsável proposto — Tiago.** A sala cuida de quem pode contratar a **Vendax**.

| Agente | O que faz | Entrega | Fase |
| --- | --- | --- | --- |
| SDR e Follow-up | Confere duplicidade, qualifica leads e indica o próximo contato conforme estágio e histórico. Prepara a abordagem e mantém o funil organizado quando autorizado. | Lista priorizada, rascunho de contato e tarefa de follow-up. | 2 |
| Especialista em Propostas e Negociação | Transforma diagnóstico em proposta a partir do catálogo e das condições vigentes. Prepara escopo, opções, tratamento de objeções e passagem da venda. | Proposta revisável e registro do escopo acordado para o onboarding. | 2 |
| Analista de Expansão e Parcerias | Avalia indicações, parcerias, novos segmentos e extensões de serviço. Compara adequação, esforço e potencial usando dados disponíveis. | Priorização de oportunidades e hipótese de próximo teste. | 3 |

### 4º andar · Marketing da Vendax

**Responsável proposto — Tiago.** O foco é gerar demanda e autoridade para a marca da agência.

| Agente | O que faz | Entrega | Fase |
| --- | --- | --- | --- |
| Estrategista de Posicionamento e Conteúdo | Organiza pautas de vendas, CRM, operação comercial, atendimento, IA e automação. Prioriza assuntos por objetivo e sinais da audiência. | Pauta priorizada com ângulo, gancho, público e objetivo. | 3 |
| Produtor Editorial | Transforma pautas e casos liberados em roteiros, Reels, Stories, posts e materiais comerciais. Adapta linguagem por canal. | Rascunhos prontos para revisão e publicação autorizada. | 3 |

### 3º andar · Gestão de Contas e Entrega

**Responsabilidade proposta — Tiago nas decisões de relacionamento e escopo, Fabiana na coordenação operacional.** As áreas técnicas continuam responsáveis por executar suas entregas.

| Agente | O que faz | Entrega | Fase |
| --- | --- | --- | --- |
| Gerente de Contas IA (AM - Vendax) | Consolida reunião, escopo, pendências e riscos por cliente. Atribui internamente o próximo passo quando autorizado e prepara a comunicação para revisão. | Plano por cliente com andamento, dono, prazo, dependências e minuta de atualização. | 1 |
| Coordenador de Implantação e Entregas | Converte o escopo fechado em checklist, solicita acessos pelo fluxo autorizado e acompanha entregas, testes e validações. | Plano de onboarding, quadro de bloqueios e checklist de aceite. | 3 |

O Gerente de Contas é o papel no escritório que corresponde ao AM - Vendax. Antes de ativar uma rotina, identificar onde ela já roda e manter um único responsável por registrar seu resultado.

### 3º andar · Atendimento e Conversão

**Responsabilidade proposta — Lígia na operação de atendimento, Fabiana no acompanhamento e Tiago na estratégia comercial.** Cada fila representa os leads ou pacientes do cliente autorizado.

| Agente | O que faz | Entrega | Fase |
| --- | --- | --- | --- |
| Copiloto de Atendimento | Lê a conversa, identifica intenção comercial e sugere resposta, encaminhamento ou consulta de agenda. Segue a ficha da clínica para horários, valores e procedimentos que podem ser informados. | Resposta sugerida para o atendente e indicação da próxima ação. | 2 |
| Analista de CRM e Conversão | Localiza leads parados, follow-ups vencidos, perdas e faltas. Compara etapas do funil e monta candidatos para reativação conforme critérios do cliente. | Lista de prioridades e relatório de conversão por etapa e motivo de perda. | 3 |

### 2º andar · Performance e Web

**Responsabilidade proposta — Tiago pela estratégia e verba, Lorran pelas integrações e pelo aceite técnico.** O executor humano de mídia e web pode variar por conta.

| Agente | O que faz | Entrega | Fase |
| --- | --- | --- | --- |
| Especialista em Mídia Paga | Revê Google Ads e Meta Ads, identifica variação de desempenho, propõe testes e prepara ajustes para aprovação. | Plano de otimização com evidência, efeito esperado e escopo da mudança. | 3 |
| Analista de Dados e Atribuição | Cruza Ads e Reportei com CRM e agenda, quando o vínculo for verificável. Separa leads, agendamentos e consultas realizadas. | Relatório com período, fonte, conversão por etapa e lacunas de atribuição. | 2 |
| Especialista em Web e Presença Local | Revisa landing pages, formulário, eventos de conversão, WordPress e Perfil da Empresa no Google. Prepara copy, correções e respostas a avaliações. | Lista priorizada de ajustes e rascunhos para validação. | 3 |

### 2º andar · WhatsApp, Automação e IA

**Responsável proposto — Lorran.** A sala cuida da operação entregue a clientes, com autorização de campanha e comunicação conforme cada conta.

| Agente | O que faz | Entrega | Fase |
| --- | --- | --- | --- |
| Monitor de WhatsApp e Incidentes | Correlaciona status de BM, número, template, carteira e entrega em fontes disponíveis. Abre ou atualiza incidente interno quando autorizado. | Linha do tempo com impacto, evidências, hipóteses e próximos testes. | 2 |
| Especialista em Fluxos e Campanhas WhatsApp | Prepara fluxos, segmentação, templates e checklists. Valida elegibilidade, histórico de entrada, descadastro, pausas e condições de saída. | Fluxo revisável e checklist de campanha para aprovação. | 3 |
| Especialista em Automações e Bases de IA | Desenha regras de roteamento, configurações de copiloto, bases por cliente e testes de integração. | Especificação testável e resultado de homologação. | 3 |

### 2º andar · Produto e Engenharia

**Responsabilidade proposta — Tiago prioriza produto e Lorran valida a solução e a publicação técnica.** A sala cuida do **Vendax App**.

| Agente | O que faz | Entrega | Fase |
| --- | --- | --- | --- |
| Analista de Produto Vendax App | Converte feedback, falhas e solicitações em itens de backlog. Prioriza pelo impacto na operação e escreve critérios de aceite. | Backlog priorizado com contexto, impacto e critério de conclusão. | 3 |
| Especialista em QA e Integrações | Reproduz falhas funcionais em homologação, valida recebimento, roteamento por número, mídia e integrações, e confere regressão. | Evidência de teste, resultado por cenário e pendências para o deploy. | 3 |

### 1º andar · Financeiro e Administrativo

**Responsabilidade proposta — Fabiana opera e aprova conforme a alçada combinada com Tiago.** O acesso financeiro fica restrito aos dois e aos agentes autorizados para cada tarefa. A direção recebe o resumo conforme o perfil de acesso.

| Agente | O que faz | Entrega | Fase |
| --- | --- | --- | --- |
| Analista de Faturamento e Cobrança | Confere contrato, competência, recorrência, vencimento, fatura e NF. Sinaliza pendências e prepara o envio ou a cobrança. | Fila de faturamento, divergências e rascunhos para a Fabiana. | 2 |
| Analista de Conciliação e Margem | Cruza registros financeiros, consumo, recargas e custos por cliente ou fornecedor, quando as fontes são compatíveis. | Conciliação com divergências, saldo verificado e margem quando calculável. | 3 |
| Assistente Administrativo e Contratos | Acompanha documentos, vigências, renovações, fornecedores e checklists internos, incluindo acessos em onboarding e desligamento. | Calendário de renovações e documentação preparada para revisão. | 3 |

## 3. Passagem de trabalho na prática

| Caso | Encaminhamento | Condição de conclusão |
| --- | --- | --- |
| Novo médico contratado pela Vendax | Comercial entrega o escopo fechado → AM assume a conta → Implantação aciona Atendimento, Performance e Tecnologia conforme o contratado → Financeiro assume o faturamento. | Escopo confirmado, itens de implantação com dono e prazo e faturamento encaminhado com os dados validados. |
| Paciente quer marcar consulta | Copiloto consulta a conversa, a ficha da clínica e a agenda autorizada → Lígia ou atendente autorizado valida a resposta e o horário → CRM recebe o resultado confirmado. | Agendamento registrado na fonte oficial da clínica, ou próxima ação atribuída com motivo. |
| Template pausado durante operação da Service Premium | Monitor reúne status e logs por carteira → Lorran valida o diagnóstico e decide a ação técnica → AM prepara a atualização ao cliente. Comparação entre Carrefour, DM e demais carteiras fica no incidente com fontes e período. | Impacto e status verificados, dono da ação seguinte e comunicação conforme autorização. Coincidência entre carteira, BM e queda entra como hipótese até validação. |
| Fechamento mensal da Lefil | Performance consolida o período por conta → Financeiro cruza consumo e recargas com os registros da competência → Fabiana revisa → AM acompanha a entrega ao cliente conforme o combinado. | Contas e competências identificadas, divergências registradas e documentos conferidos. |

A tarefa de origem reúne as subtarefas e o seu estado. Quando falta acesso, dado ou decisão, o agente registra o motivo, aponta a fonte esperada e atribui o próximo passo. O responsável pela entrega original acompanha até a confirmação. Demandas repetidas devem atualizar o item correspondente.

## 4. Fontes, permissões e autonomia

| Domínio | Fontes candidatas | Informações e ações |
| --- | --- | --- |
| Contas e comercial | CRM Vendax, agenda, notas de reunião e escopo vigente | Dono, etapa, prazo, proposta e histórico de conta. |
| Atendimento | CRM de atendimento, inbox por cliente, agenda oficial e ficha validada da clínica | Conversa, status do lead e agendamento. A ficha orienta as sugestões, e a agenda confirma o horário. |
| Mídia e web | Google Ads, Meta Ads, Reportei, WordPress e Perfil da Empresa no Google | Contas autorizadas, indicadores, eventos e mudanças propostas. |
| WhatsApp e tecnologia | NextTags, Nexbox, Vendax App, demais plataformas em uso e logs autorizados | Status de conta, número, template, campanha, incidentes e disponibilidade da integração. |
| Conhecimento e produto | Bases da Vendax, Relevance AI, backlog, GitHub e ambiente de homologação | Políticas versionadas, escopo por cliente, testes e histórico técnico. |
| Financeiro e administrativo | Asaas, notas fiscais, contratos e controles autorizados da Fabiana | Vencimento, situação da fatura, vigência, recibo, consumo e custo. |

**A1 · Consulta e rascunho.** Agentes consultam fontes autorizadas, resumem, classificam, preparam respostas e levantam divergências. Informação ausente aparece como indisponível. Deduções são identificadas como hipótese.

**A2 · Registro interno.** Tarefas, notas, incidentes e campos não críticos podem ser gravados por fluxos autorizados. Cada registro leva fonte, cliente, responsável e identificador para evitar duplicação. O CRM e os sistemas operacionais seguem como fontes oficiais.

**A3 · Aprovação específica.** Envio externo, disparos, publicação, alteração de campanha ou verba, preço, contrato, fatura e deploy seguem a revisão de quem tem alçada. A tela de aprovação exibe o conteúdo e os parâmetros exatos da ação, incluindo cliente, destinatário ou conta, horário e impacto. A ação só roda com autorização válida e confirmação registrada. Pagamentos e transferências ficam com os responsáveis humanos. Em clínicas, o copiloto sugere a resposta e o atendente envia. Perguntas clínicas seguem para a equipe da clínica.

Identificar o cliente e validar o perfil antes de qualquer leitura ou ação. Separar bases, filas, logs e acessos por cliente e restringir o acesso financeiro. Exibir no prédio somente os dados que aquele usuário pode ver, inclusive nos resumos, contadores e notificações. Aplicar permissões na camada que executa as ações. Se só houver acesso de leitura em um conector, entregar o rascunho ou checklist ao responsável.

## 5. O que implementar primeiro

| Fase | Núcleo | Fluxo de validação | Critério para avançar |
| --- | --- | --- | --- |
| Preparação | Cadastro de salas, papéis, donos, fontes e permissões. | Inventariar rotinas do AM - Vendax, automações e bases existentes, incluindo as de tráfego do Relevance AI. Verificar conectores e os respectivos escopos. | Um dono por fluxo, fonte oficial identificada e permissão conferida. |
| 1 · Piloto | Diretor de Operações IA, Gerente de Contas IA e Auditor de Qualidade. | Briefing da direção a partir de CRM, agenda e pendências autorizadas de uma carteira piloto. | Cada item tem evidência ou lacuna explícita, cliente, dono e próximo passo. A visão respeita o perfil de cada pessoa. |
| 2 · Primeira expansão | Adicionar SDR, Propostas, Copiloto de Atendimento, Dados e Atribuição, Monitor de WhatsApp e Faturamento. **9 papéis disponíveis ao todo.** | Testar, em escopo pequeno, follow-up da Vendax, atendimento de uma clínica, incidentes e fechamento financeiro. Escrita interna por fluxo autorizado. | Tarefa repetida não gera registro duplicado. Rascunhos seguem para a pessoa certa e ações externas passam pela alçada aplicável. |
| 3 · Escala | Adicionar os demais papéis conforme volume e capacidade por área. | Onboarding, automações, rotinas de marketing, produto e controles aprofundados. | Dono definido, fontes validadas e benefício medido na rotina piloto. |

Medir desde o piloto o **tempo de execução humana**, as **pendências sem dono ou fora do prazo** e o **retrabalho após revisão**. Depois ligar essas medidas ao resultado de cada operação, como tempo de resposta, conversão em agendamento, tempo para registrar um incidente ou divergências no fechamento. Usar a rotina manual como linha de base.

Começar com três papéis reduz o trabalho de supervisão e testa o fluxo comum. A contrapartida é adiar ganhos nas áreas da segunda fase. Se uma área já tiver um processo repetitivo com volume alto, fonte confiável e dono disponível, faz sentido testar esse fluxo em paralelo, dentro do mesmo mecanismo de permissões e auditoria.

## 6. Instrução para construir o escritório

> Construa o Escritório Vendax em português do Brasil com os cinco andares, as nove salas e os 23 papéis deste documento. Use a imagem anexada como referência espacial para o prédio, as salas e os cartões de agentes. Dê prioridade para a fila de hoje, as aprovações, os clientes, os incidentes e o histórico. O prédio e a lista devem mostrar as mesmas tarefas. Exiba o estado real de cada execução e identifique os papéis que aguardam configuração.
>
> Implemente o piloto com Diretor de Operações IA, Gerente de Contas IA e Auditor de Qualidade. Cadastre os demais papéis no organograma. Toda tarefa deve carregar identificação, cliente ou escopo interno, evento de origem, objetivo, papel responsável, dono humano, prazo, estado, evidências e próximo passo. Mostre quando uma tarefa está na fila, em execução, bloqueada, em aprovação, concluída ou com falha. Dentro de cada tarefa, mostre o histórico e quem precisa agir.
>
> Comece pelo briefing de uma carteira piloto. Use os conectores disponíveis e autorizados e registre quando uma fonte ainda está pendente. Vincule as tarefas às ferramentas em que a Vendax já opera. Separe os dados por cliente e por perfil. Aplique os níveis de autonomia descritos acima. Teste a visibilidade, a passagem de tarefa e a deduplicação antes de ampliar o escopo. Use o blueprint técnico existente como referência para integração, autorização e registro de execução.

## Referências internas

- Imagem do escritório de agentes enviada por Tiago, usada como referência para o prédio e a navegação.
- [Vendax AI — Blueprint de arquitetura multiagente](https://chatgpt.com/library?file_id=libfile_7e9a06decee88191b1aae17bb2e2086e&account_id=personal).
- [Vendax — Base Central de Tráfego](https://chatgpt.com/library?file_id=libfile_ddd1e4cb467481919361024c14742445&account_id=personal).

