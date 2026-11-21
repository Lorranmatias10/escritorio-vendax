# Conector Localo (MCP) — como puxar dados reais

Índice
1. Quando usar e regras
2. Sequência padrão (do nome do negócio ao diagnóstico)
3. Queries prontas (leitura)
3b. Ações (mutations): keywords, Smart Tasks, citações, relatórios, prospecção, concorrentes, perfis
3c. O que o conector NÃO faz
4. Como mapear o retorno para o checklist de auditoria
5. Limites

---

## 1. Quando usar

Se as ferramentas `mcp__Localo__docs`, `mcp__Localo__query` e `mcp__Localo__mutation` estiverem disponíveis (podem exigir carregar via ToolSearch com `select:mcp__Localo__docs,mcp__Localo__query`), use-as **antes** de estimar qualquer coisa. Elas trazem: perfis gerenciados, keywords monitoradas, grids (mapa de posições), auditoria competitiva com score 0–100 e 24 checks, reviews, estatísticas do GBP (impressões, ligações, cliques, rotas), citações, concorrentes, tarefas.

Regras:
- Preferir `query` (leitura). Usar `mutation` só para sincronizar reviews ou atualizar o perfil no Localo, e avisar o usuário antes.
- O Localo **não publica** no Google (posts, fotos, edições). Edições de perfil vão pelo painel do GBP.
- IDs são GUIDs de 22 caracteres; nunca inventar. Buscar sempre pela lista.
- Se um campo não existir, rodar `docs("introspection")` em vez de chutar.
- Batch com aliases para até 10–20 perfis por request.

## 2. Sequência padrão

1. `placesList` → achar o perfil pelo título; pegar `id`.
2. `place(id)` → snapshot (categoria, rating, reviewsCount, descrição, link).
3. `latestPlaceGrid(placeId)` → grid mais recente + keyword; `grid(id)` com `competitors` e `audits`.
4. Pegar um `audit.id` do grid (ponto central) → `audit(id)` com `score { checks }`, `queryPlaces` (concorrentes com categoria/rating/reviews), `titleProminentPhrases`, `reviewsProminentPhrases`, `citations`.
5. `reviewsStats` + `listReviews(replyFilter: NO_REPLY)` + `reviewsChart` → velocidade e resposta.
6. `googleMetricSeries` (últimos 30/90 dias) → impressões, ligações, cliques, rotas.
7. `publicationMetricSeries` → posts e fotos adicionadas.
8. Montar o JSON do checklist e rodar `scripts/score_gbp.py`.

## 3. Queries prontas

### Listar perfis
```graphql
query { placesList(input: {pageNo: 1, pageSize: 50, active: true}) {
  totalCount places { id latestPlaceSnapshot { title address category rating reviewsCount } } } }
```

### Detalhe do perfil
```graphql
query($id: GUID!) { place(id: $id) {
  id googlePlaceId verified isOpen country language latitude longitude
  activePlaceKeywords { id keyword visibility { current } }
  latestPlaceSnapshot { title address category description link mainImage rating reviewsCount } } }
```

### Grid mais recente + concorrentes + pontos
```graphql
query($placeId: GUID!) { grid: latestPlaceGrid(placeId: $placeId) {
  id query orderedPlacePosition sharedPermalink insertedAt centerLatitude centerLongitude
  placeKeyword { id keyword }
  competitors { orderedPosition queryPlace { position distance placeSnapshot { title category rating reviewsCount } } }
  audits { id latitude longitude position difficulty } } }
```
Posição média = média de `audits[].position` (tratar `null`/ausente como >20). Pontos com `difficulty` alto e posição ruim = zona a atacar com conteúdo por bairro.

### Histórico do grid por keyword
```graphql
query($kw: GUID!) { placeKeyword(id: $kw) { keyword
  latestGrids(limit: 12) { insertedAt orderedPlacePosition competitorsCount sharedPermalink } } }
```

### Auditoria competitiva + score
```graphql
query($auditId: GUID!) { audit(id: $auditId) {
  query position difficulty
  score { percent earnedPoints maxPoints checks { checkId status } }
  queryPlaces { position distance placeSnapshot { title category rating reviewsCount } }
  titleProminentPhrases { phrase occurrences }
  reviewsProminentPhrases { phrase occurrences }
  citations { rootDomain isWellKnown occurrences defaultPlaceHasReference } } }
```
Para os `stats` tipados de cada check, use a query completa de `docs("audits")`.

### Reviews
```graphql
query($placeId: GUID) {
  stats: reviewsStats(placeId: $placeId) { reviewsCount repliedCount removedCount }
  chart: reviewsChart(placeId: $placeId) { month stats { total reviewsOneStars reviewsFiveStars } }
  semResposta: listReviews(input: {placeId: $placeId, replyFilter: NO_REPLY, pageSize: 20}) {
    reviewerDisplayName starRating comment reviewCreatedAt } }
```
Velocidade 90d = soma dos 3 últimos meses de `chart`. Taxa de resposta = repliedCount / reviewsCount.

### Estatísticas do GBP (ações)
```graphql
query($args: GoogleMetricSeriesArgs!) { googleMetricSeries(args: $args) { date value } }
```
```json
{"args": {"placeId": "...", "metrics": ["BUSINESS_IMPRESSIONS_MOBILE_SEARCH","BUSINESS_IMPRESSIONS_MOBILE_MAPS","CALL_CLICKS","WEBSITE_CLICKS","BUSINESS_DIRECTION_REQUESTS"], "dateStart": "2026-07-01", "dateEnd": "2026-09-30"}}
```

### Fotos e posts
```graphql
query($args: PublicationMetricSeriesArgs!) { publicationMetricSeries(args: $args) { metric points { date value } } }
```
```json
{"args": {"placeId": "...", "metrics": ["POSTS_CREATED","PHOTOS_ADDED"], "dateStart": "2026-07-01", "dateEnd": "2026-09-30"}}
```

### Relatório compartilhável
```graphql
mutation($placeId: GUID!, $s: Date!, $e: Date!) {
  createSharedInsights(placeId: $placeId, period: "month", dateStart: $s, dateEnd: $e, compareEnabled: true) { sharedPermalink } }
```

### Sincronizar reviews (mutation — avisar antes)
```graphql
mutation($placeId: GUID!) { synchronizeGoogleReviews(placeId: $placeId) { lastReviewsRefreshAt } }
```

## 3b. Ações (mutations) — o que a skill pode executar no Localo

Sempre avisar o usuário em uma linha antes de executar qualquer mutation (criam scans que consomem cota, enviam e-mails, mudam status).

### Keywords: pesquisa e monitoramento
Fluxo: termos reais do Google → sugestões com volume → adicionar → acompanhar.
```graphql
query($placeId: GUID!) { placeGoogleSearchTerms(placeId: $placeId) { keyword impressions } }
```
```graphql
query($placeId: GUID!, $q: String, $pend: [String!]!) {
  placeKeywordSuggestions(placeId: $placeId, query: $q, pendingKeywords: $pend) {
    keyword ahrefsOverview { volume intents { local commercial transactional } } } }
```
```graphql
mutation($input: AddPlaceKeywordsInput!) { addPlaceKeywords(input: $input) { id query placeKeyword { id keyword } } }
```
```json
{"input": {"placeId": "...", "keywords": ["dentista em moema", "implante dentário moema"]}}
```
Re-scan imediato: `mutation($k: GUID!) { refreshPlaceKeyword(placeKeywordId: $k) { id } }`
Parar monitoramento: `mutation($g: GUID!) { cancelMonitoring(gridId: $g) { id } }`
Regra: 3–8 keywords por perfil, misturando "serviço + bairro", "serviço" puro e categoria; começar pelos termos com impressões reais.

### Smart Tasks (tarefas de otimização geradas pelo Localo)
```graphql
query($placeId: GUID!) { listPlaceTasks(placeId: $placeId, status: PROPOSED) { id type status
  metadata { ... on UpdateMainCategoryMetadata { currentMainCategoryDisplayValue mainCategoryToAddDisplayValue }
             ... on AddAdditionalCategoryMetadata { additionalCategoryToAddDisplayValue }
             ... on AddCitationMetadata { rootDomain } } } }
```
Atenção: a primeira chamada gera tarefas (efeito colateral). Use as tarefas como insumo do plano — mas filtre com o próprio julgamento (ex.: sugestão de categoria que o negócio não oferece deve ser recusada).
Concluir: `mutation($t: GUID!) { markTaskAsCompleted(taskId: $t, completionMethod: USER_ACTION) { id status } }` — só depois que a ação foi de fato executada e verificada (por você no navegador, ou pelo usuário).
Pedir mais uma: `mutation($p: GUID!) { getOneMoreTask(placeId: $p) { id type } }`

**Fluxo completo — executar Smart Tasks de ponta a ponta:**
1. `listPlaceTasks(status: PROPOSED)` → listar.
2. Triar cada tarefa com o próprio julgamento e o briefing estratégico: aceitar (verdadeira e alinhada ao objetivo), adaptar (ex.: categoria sugerida é próxima, mas existe uma mais específica) ou recusar (falsa, irrelevante, arriscada — ex.: categoria que o negócio não oferece, diretório irrelevante para o Brasil). Mostrar a triagem ao usuário.
3. Executar as aceitas no painel do Google via Chrome (`execucao-no-navegador.md`), com as mesmas regras de confirmação. Mapa tarefa → ação:

| Tipo de tarefa | Onde executar |
|---|---|
| Atualizar categoria principal / adicionar ou remover secundária | Painel → Editar perfil → Sobre → Categorias (primária: confirmação individual) |
| Adicionar citação (`rootDomain`) | Criar/atualizar o cadastro no diretório (navegador) com NAP idêntico; depois `changeCitationStatus → ACTIVE` ou `createNewPlaceCitation` |
| Links de redes sociais | Painel → Editar perfil → Contato → Perfis sociais |
| Telefone | Painel → Contato → Telefone (conferir no site) |
| Horário / descrição / site | Painel → Editar perfil, campo correspondente |
| Post / foto / oferta | Painel → Adicionar atualização / Fotos (ou agendar no Localo web), seguindo o papel estratégico do post |
| Responder avaliações | Painel → Avaliações, pela priorização de `estrategia-de-execucao.md` |

4. Verificar na página que a mudança persistiu → `markTaskAsCompleted`.
5. Registrar no log da sessão: tarefa, decisão (aceita/adaptada/recusada e por quê), execução, verificação.
6. Quando a fila esvaziar e ainda houver gargalos no score, `getOneMoreTask` — mas as tarefas do Localo são insumo, nunca substituem o plano priorizado da auditoria.

### Citações
```graphql
query($placeId: GUID!) { fetchPlaceCitations(placeId: $placeId, orderBy: COMPETITORS_OCCURRENCES_DESC) {
  id status isNew competitorsOccurrencesCount placeCitationDomain { rootDomain domainRating isWellKnown activationLink } } }
```
Status: `ACTIVE`, `PENDING`, `IGNORED`, `NOT_FOUND`. Priorizar: domínios onde os concorrentes estão (`competitorsOccurrencesCount` alto) e `isWellKnown`. Para o Brasil, ignorar diretórios irrelevantes (Yelp etc.) com `ignoreReason`.
Mudar status: `mutation($p: GUID!, $c: GUID!, $s: PlaceCitationStatus!) { changeCitationStatus(placeId: $p, placeCitationGuid: $c, toStatus: $s) { id status } }`
Registrar citação feita: `createNewPlaceCitation(placeId, rootDomain, canBeLinked, status: ACTIVE, linksToTarget: [url])`.

### Relatórios (gerar, compartilhar, enviar por e-mail)
1. Listar existentes: `query($p: GUID!) { placeReports(placeId: $p) { id startDate endDate status readyForEmail sharedPermalink } }` — reutilizar se já cobre o período.
2. Criar (nome com um "p"): `mutation($input: CreateSingleRaportInput!) { createSingleRaport(input: $input) }` com `{"input": {"placeId": "...", "startDate": "2026-09-01", "endDate": "2026-09-30"}}`. Retorna `true` = enfileirado. Não repetir.
3. Pollar `placeReports` até achar o novo; `report(reportId)` até `readyForEmail: true`. Se falhar, ler `sections.*.errorMessage`.
4. Ler o conteúdo (`sections.statistics/keywords/reviews/keyActions`) e usá-lo no relatório da Vendax.
5. Link público: `mutation($r: GUID!) { createReportSharedPermalink(reportId: $r) }` → URL `https://app.localo.com/shared-reports/<token>/reports/<reportId>`.
6. PDF: `query($r: GUID!) { reportPrintUrl(reportId: $r, format: A4, language: "pt") }`.
7. E-mail (só com `readyForEmail` true e com destinatário confirmado pelo usuário): `sendReportEmail(reportId, toEmails, sendCopyToMe, language: "pt", subject)`. Pollar status; `SENT` + `emailSentAt` = aceito pelo servidor. Nunca reenviar automaticamente.

### Prospecção comercial (Research Mode / Sales Mode / Leads)
Uso Vendax: mostrar a um prospect onde ele está no mapa antes da proposta.
1. Checar cota: `query { organization { hasResearchMode researchModeQuota } researchModeUsage }`.
2. Achar o negócio: `listQueryPlaceSnapshots(input: {query: "clínica estética moema", country: "br", language: "pt"})` → pegar `id` do snapshot.
3. Importar: `mutation($s: GUID!) { importGooglePlaceFromPlaceSnapshot(placeSnapshotId: $s) { id } }`.
4. Scan único (não cria monitoramento): `createResearchGrid(input: {placeId, query, country: "br", language: "pt", latitude, longitude, gridSize: 5, areaWidth: 4000, areaHeight: 4000, sales: {city: "São Paulo"}})`. `gridSize` 0 = smart; 3/5/7/9 = quadrado. Área em metros.
5. Lead: `upsertSalesProspect(input: {googlePlaceId: "ChIJ...", status: TODO, comment: "..."})`; fluxo `TODO → CONTACTED → CONVERTED/IGNORED`. Listar com `listSalesGrids` / `listResearchPlaces`.
Avisar o custo em cota antes de cada scan.

### Rastreador de concorrentes
Favoritar: `setPlaceActionTrackerFavoriteCompetitor(placeId, googlePlaceId: "ChIJ...")`.
Histórico de mudanças (paginação para trás com `auditInsertedBefore`):
```graphql
query($p: GUID!, $before: DateTime) { auditActionsTrack(placeId: $p, auditInsertedBefore: $before) {
  audit { insertedAt } changedPlaces { queryPlace { position placeSnapshot { title } } previousQueryPlace { position }
    title { current previous } categories { current previous } reviewsCount { current previous } imagesCount { current previous }
    freshPosts { placePost { title createdAt } } } } }
```
Use para explicar "por que o concorrente subiu" (mudou categoria, surto de reviews, posts novos) no relatório mensal.

### Conteúdo (somente leitura)
`listGooglePosts(placeId, topicType: STANDARD|EVENT|OFFER)`, `listScheduledLocalPosts`, `getSchedules` (agenda de fotos). Serve para auditar cadência; publicar é no painel do Google ou na interface do Localo.

### Perfis
`importGooglePlaceFromPlaceSnapshot` (adicionar perfil), `refreshPlace` (re-fetch do Google), `setPlaceTags` (organizar carteira: ex. "clinica", "cury", "prioridade"), `synchronizeGoogleReviews`.

## 3c. O que o conector NÃO faz (e a skill nunca promete)
Publicar posts, subir fotos, responder avaliações no Google, editar nome/categoria/horário/descrição/serviços no Google Business Profile, agendar conteúdo. Para isso: painel do GBP (ou a interface web do Localo, fora do MCP). A skill **escreve** o texto; o humano publica.

## 4. Mapeamento para o checklist

| Checklist | Fonte Localo |
|---|---|
| B1 categoria primária vs top-3 | `audit.queryPlaces[].placeSnapshot.category` + check `PRIMARY_CATEGORY` |
| B2 categorias secundárias | check `ADDITIONAL_CATEGORIES_COUNT` (stats: target, irrelevantCategoryIds) |
| B4 descrição | checks `BUSINESS_DESCRIPTION_LENGTH/KEYWORDS` |
| B6 horários | check `OPENING_HOURS` |
| C1 reviews 90d | `reviewsChart` últimos 3 meses; check `REVIEWS_GROWTH` |
| C2 nota | `latestPlaceSnapshot.rating` |
| C3 total vs top-3 | `reviewsCount` vs `queryPlaces[].reviewsCount` |
| C4 taxa de resposta | `reviewsStats`; check `REVIEWS_RESPONSE_RATE` |
| C6/C7 fotos | checks `PHOTOS_COUNT`, `PHOTOS_GROWTH`; `publicationMetricSeries PHOTOS_ADDED` |
| C8 citações | `audit.citations` (defaultPlaceHasReference=false = falta) |
| D1 site | check `WEBSITE` |
| E1 posts | checks `POSTS_COUNT`, `POSTS_FREQUENCY` |
| F1 posição média | média de `grid.audits[].position` |
| F2 share of voice | posição vs. `competitors[].orderedPosition` |
| F3 gap de categoria | categorias dos top-3 que o perfil não tem |

## 5. Limites

- Dados do grid dependem de monitoramento ativo da keyword; se não houver grid, propor criar keyword (`docs("keywords")`) e aguardar a primeira varredura.
- Métricas do GBP exigem o perfil conectado ao Google no Localo.
- `score` pode vir `null` em auditorias antigas ou em processamento.

