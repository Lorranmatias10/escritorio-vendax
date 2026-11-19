# Escritório Vendax · V1

Aplicativo interno (pt-BR) para a equipe acompanhar clientes, tarefas, especialistas de IA, incidentes e aprovações.
Base: `Escritorio_Vendax_Organograma_de_Agentes.md` (18/11/2026) e a imagem do prédio (`public/escritorio.png`).

## Rodar localmente

```bash
npm install
npm run build
npm start -- -p 7777        # http://localhost:7777
# ou, para desenvolvimento: npm run dev -- -p 7777
```

Não precisa de Docker nem de banco instalado. Na primeira requisição o app cria um PostgreSQL embutido (PGlite) em
`.data/pglite`, aplica as migrações de `db/migrations/` e semeia o catálogo e a equipe. O banco principal não recebe dados fictícios: registros marcados como demonstração são removidos na inicialização.
Para começar do zero: apague `.data/`. Clientes são cadastrados em **Clientes** (direção) e o acesso de cada pessoa em **Usuários**.

Testes: `npm test` (banco em memória). Verificação completa: `npm run verificar` (tipos, lint, testes e build).

## O que existe na V1

| Tela | O que mostra |
| --- | --- |
| **Hoje** | Pendências com dono e prazo, tarefas bloqueadas ou com falha, aprovações pendentes e incidentes abertos. Cada item abre o contexto. |
| **Escritório** | Prédio clicável (salas e agentes são links reais, acessíveis por teclado) e lista com a mesma fonte de dados. O filtro de estado e a sala selecionada são mantidos ao trocar de vista. Em telas pequenas a lista vem primeiro. |
| **Clientes** | Filtros por cliente, estado, responsável e período. Tarefas, entregas e incidentes que o usuário pode acessar. |
| **Aprovações e histórico** | Intenção, alvo, conta, parâmetros exatos, prazo, aprovador e decisão. Aprovar não executa nada fora do escritório. |
| **Agentes** | 23 papéis do catálogo, estado de configuração, versões de instrução e a entrada para cadastrar as instruções. Lista de integrações. |

Sem login ligado, "Ver como" troca o usuário (Tiago · direção, Fabiana, Lígia, Lorran) para testar o escopo.
Dados sintéticos só existem na homologação (banco isolado) e nos testes. Fonte indisponível aparece como **Integração pendente** ou **Sem dados**.

### Fluxo piloto (briefing de uma carteira)

1. Evento sintético de reunião da Clínica Aurora → tarefa na sala Gestão de Contas (deduplicada por `origem_evento_id`).
2. **Gerente de Contas IA** organiza entregas e pendências (cria entregas e um rascunho do plano) e delega ao Auditor.
3. **Auditor de Qualidade** encontra o prazo "até sexta" citado sem confirmação (o prazo "amanhã, confirmado" não vira achado) e registra o Reportei como **Integração pendente**.
4. **Diretor de Operações IA** prioriza, define quem decide (Fabiana), coloca o briefing em **Hoje** e abre uma aprovação A3 com os parâmetros exatos da mensagem.
5. A decisão humana fecha a tarefa de origem (critério de conclusão). A ação externa **não roda** na V1: o histórico registra "Execução externa desabilitada na V1" e a evidência fica como "ação solicitada", nunca "resultado confirmado".

## Arquitetura

```
lib/catalogo.ts       fonte única: andares, salas, 23 papéis, fases, donos, integrações, rótulos
db/migrations/        migrações SQL (PostgreSQL), aplicadas automaticamente na partida
lib/db.ts             PGlite local ou PostgreSQL (EasyPanel) via DATABASE_URL; migrações automáticas
lib/seed.ts           sincroniza o catálogo, semeia a equipe e limpa dados de demonstração do banco principal
lib/escopo.ts         regra única de visibilidade (cliente, financeiro, admin) em JS e SQL
lib/dados.ts          leituras, sempre com escopo (inclusive contadores e resumos)
lib/orquestracao.ts   fila persistida, executor sob demanda, delegação, retomada, aprovações, instruções
lib/ia.ts             contrato do agente (zod) + adaptador simulado + ponto para provedor real
lib/demo.ts           cenários sintéticos usados só pela homologação e pelos testes
app/                  telas (Next.js App Router) e ações do servidor
app/api/              API interna: GET /api/tarefas · POST /api/eventos/reuniao (desligado sem token)
tests/                testes do núcleo (vitest)
prototipo/            protótipo estático anterior (animação), só para referência
```

**Contrato operacional.** Cadastro (departamentos, papéis, instruções) separado da execução (tarefas, eventos, execuções/tentativas,
aprovações, evidências). Estados da tarefa: `na_fila`, `em_execucao`, `bloqueada`, `aguardando_aprovacao`, `concluida`, `falhou`,
`cancelada` (rótulos em português na interface). Horários em `timestamptz`; a interface usa America/Sao_Paulo.

- **Deduplicação:** `tarefas.origem_evento_id`, `execucoes.chave_dedup`, `aprovacoes.chave_dedup`, `evidencias.chave_dedup`, `entregas.chave_dedup` são únicos. Evento repetido atualiza a tarefa e a execução correspondente; retomada não duplica efeitos.
- **Executor sob demanda:** `processarFila()` roda quando há trabalho (ação, evento, retomada). Não há serviço permanente por especialista.
- **Autorização centralizada:** toda escrita passa por `lib/orquestracao.ts` (escopo do cliente, financeiro restrito, alçada do aprovador). Toda leitura passa por `lib/escopo.ts`.
- **Comandos × conteúdo:** a entrada do agente separa `instrucao_operacional` de `conteudo_recuperado` (texto de reunião/documento é dado, não instrução).
- **Saída do agente:** afirmações classificadas (fato, inferência, suposição), fontes, lacunas, próxima ação, papel de destino, responsável humano e condição de conclusão. Validada com zod; saída inválida vira falha registrada.
- **Autonomia:** todos os papéis em A1. A2 e A3 dependem de liberação explícita; a execução externa está desligada em código (`execucao_externa = 'desabilitada_v1'`).
- **Papéis:** os 3 do piloto ficam "Aguardando configuração" e só executam no modo Demonstração com o adaptador simulado. Os outros 20 têm execução desabilitada (o executor bloqueia e registra o motivo).

### Adaptações em relação à stack proposta

- **Next.js 16 + TypeScript + Tailwind 4**, como proposto. `cacheComponents` desligado: app interno com dados por usuário, renderização dinâmica.
- **Banco:** PostgreSQL. Localmente em **PGlite** (Postgres em WebAssembly, sem Docker); na nuvem, o Postgres do EasyPanel via `DATABASE_URL`, sem mudar código.
- **Auth:** login próprio (`lib/auth.ts`), ligado por `VX_LOGIN=ligado`; sem isso, "Ver como" (demonstração).
- **IA:** `AI_PROVEDOR=simulado` (padrão, sem custo) ou `AI_PROVEDOR=openai` com `OPENAI_API_KEY`, `AI_MODELO` (ex.: `gpt-5.4-mini`) e `AI_ESFORCO` (ex.: `low`), tudo só no servidor. A instrução (comum + bloco) vai como mensagem de sistema e o conteúdo recuperado vai separado, marcado como evidência. O sistema garante partes do contrato que não dependem do modelo (fonte ausente vira lacuna, nada de efeito confirmado em A1). A habilitação vale só para o provedor/modelo homologado (`papeis.homologado_com`): trocar de modelo exige rodar a homologação de novo.

## Banco na nuvem (EasyPanel) e login

**Banco:** qualquer PostgreSQL serve; o app aplica as migrações de `db/migrations/` sozinho na primeira conexão (tabela `schema_migrations`).
No EasyPanel: crie um serviço **Postgres** no projeto, copie a *Connection String* e coloque em `DATABASE_URL`.
Com o app rodando no mesmo projeto do EasyPanel, use o endereço interno (não precisa expor porta). Para conectar do PC,
ative a porta externa do Postgres no serviço e use o IP do servidor.

**Login (próprio, sem serviço externo):** ligue com `VX_LOGIN=ligado`. E-mail e senha; senha com scrypt e sal; sessão e link de
acesso guardados só como hash SHA-256; 5 tentativas erradas por e-mail bloqueiam por 15 min. Primeiro acesso e "esqueci a senha":
a direção gera em **Usuários** um link de uso único (24 h) e envia à pessoa, que define a própria senha. Para o primeiro acesso da
direção, no servidor: `npm run link-acesso -- tiago email@dominio` (imprime o link).

**Publicar no EasyPanel:** app do tipo App (GitHub ou Dockerfile do Next/Nixpacks) com build `npm ci && npm run build`, start
`npm start -- -p 3000`, e as variáveis secretas (`DATABASE_URL`, `VX_LOGIN=ligado`, `VX_URL_BASE`, `VX_COFRE_CHAVE`,
`OPENAI_API_KEY`, `AI_PROVEDOR`, `AI_MODELO` e as das integrações). Depois de trocar de banco, rode a homologação do piloto de novo.

## Integrações (tela /integracoes)

O status de cada uma das 10 integrações vem de um **health check real e somente leitura** (`lib/integracoes.ts`), nunca de valor fixo.
Ele roda ao abrir a tela (o que não foi testado no último minuto), em "Testar conexão" e a cada 30 min (`instrumentation.ts`).
Resultados ficam em `integracoes_testes`. Status: Conectado, Parcial, Erro, Não configurado, Não testado.

- **Segredos:** no servidor, em `.env.local` (fora do git) ou nas variáveis secretas do serviço publicado. Tokens que o app obtém sozinho (refresh token do OAuth do Google) ficam cifrados (AES-256-GCM) na tabela `cofre_credenciais`, com a chave `VX_COFRE_CHAVE`. O front só recebe status, conta, escopo e mensagem; o resultado passa por uma limpeza que remove qualquer segredo ecoado pela API.
- **Testes por integração:** Google Workspace (troca do refresh token + userinfo + leitura da agenda; confere os escopos `calendar.readonly` e `drive.readonly`) · Google Ads (`customers:listAccessibleCustomers`) · Meta Ads (`/me`, `/me/permissions`, `/me/adaccounts`; exige `ads_read` e avisa se houver `ads_management`) · Reportei (`GET connect.reportei.com/api/merchants/settings`) · Asaas (`GET /v3/myAccount/status`, cabeçalho `access_token`) · n8n (`GET /api/v1/workflows?limit=1`) · CRM Vendax, Vendax App, NextTags e Nexbox (sem API pública documentada: token + URL base + caminho de leitura configuráveis; sem endpoint o status é "Não testado").
- **Conectar:** Google Workspace e Google Ads usam OAuth pelo próprio app (`/api/integracoes/google/conectar`), com a URI de retorno `http://localhost:7777/api/integracoes/google/retorno`. As demais usam chave ou token colado no servidor, com o passo a passo no card.

## Agentes: instruções, configuração e homologação

- **Catálogo versionado:** `agentes/instrucoes/v1.0.md` (cópia de `Escritorio_Vendax_Instrucoes_dos_23_Agentes.md`). `lib/instrucoes.ts` lê a instrução comum, os 23 blocos e os 7 casos de homologação. Cada papel recebe *instrução comum + bloco próprio* (tabela `instrucoes`, uma linha por papel e versão). Mudança operacional = novo arquivo `vX.Y.md` ou nova versão na tela do agente; versões antigas ficam preservadas.
- **IDs canônicos:** os do arquivo de instruções (`diretor_operacoes`, `gerente_contas`, `auditor_qualidade`...). A migração `0003` renomeou os IDs da V1 em papéis, tarefas, execuções (incluindo chaves de deduplicação), instruções e eventos, sem duplicar papéis nem perder histórico.
- **Configuração por papel** (`lib/catalogo.ts → configuracaoPapel`): versão da instrução, fase, responsável humano, fontes (confirmadas × Integração pendente), ferramentas concedidas, nível de autonomia, limites, estado e como desabilitar. Mudanças de configuração ficam em `registro_configuracao`.
- **AM - Vendax:** o Gerente de Contas IA é o papel de gestão de contas. Limite registrado: validar as rotinas existentes antes de agendar novas; nenhuma segunda automação para o mesmo trabalho.
- **Homologação** (`lib/homologacao.ts`, botão em **Agentes**): os 7 casos do arquivo rodam num Postgres isolado em memória, com contas e clientes fictícios. Resultado e verificações ficam em `homologacoes`. Se todos passam, as instruções v1.0 dos 3 papéis viram "aprovada" e Diretor de Operações, Gerente de Contas e Auditor de Qualidade ficam **habilitados em A1**. Os outros 20 continuam cadastrados e desabilitados.
- **A1 de verdade:** em A1 o agente consulta, classifica, resume e prepara rascunhos. Entregas sugeridas ficam no rascunho (não são gravadas). `efeito_confirmado` é sempre vazio e a execução externa continua desabilitada.
- **Desabilitar:** Agentes → papel → "Desabilitar papel" (com motivo). O executor bloqueia novas execuções, inclusive em demonstração. Reabilitar exige nova homologação.
- **Próximas fases:** para liberar a fase 2, criar os casos de cada fluxo (normal, dado ausente, duplicidade, fora de permissão) em `lib/homologacao.ts`, com contas fictícias, e só então habilitar os papéis.
