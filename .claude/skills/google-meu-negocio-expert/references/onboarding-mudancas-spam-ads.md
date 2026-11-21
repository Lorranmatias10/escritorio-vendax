# Perfil novo, mudanças de endereço, spam de concorrentes e Google Ads

Índice
1. Criar um perfil do zero (onboarding de cliente novo)
2. Mudança de endereço, reabertura, fechamento
3. Denunciar spam de concorrentes (alavanca legítima de ranking)
4. GBP + Google Ads e atribuição (UTM, GA4)

---

## 1. Criar um perfil do zero

Antes de criar, **procurar**: buscar o nome e o endereço no Maps e no Localo (`listQueryPlaceSnapshots`). Se já existe um perfil não reivindicado ou de ex-dono/ex-agência, **reivindicar**, nunca duplicar.

Checklist de criação (na conta Google da empresa, não da agência):
1. Nome exato (fachada/registro), sem cidade ou serviço extra.
2. Tipo: ponto físico / área de serviço / híbrido. Endereço real (ou base oculta + áreas, para SAB).
3. Categoria primária específica (`categorias-servicos-atributos.md`), 2–6 secundárias.
4. Telefone principal (fixo ou WhatsApp Business), site (página relevante, com UTM — seção 4), horários com feriados.
5. Verificação (vídeo é o mais comum — gravar fachada com placa, interior, equipamento, prova de acesso). Preparar antes: CNPJ, alvará, conta de luz, fotos da fachada.
6. **Antes de o perfil ficar público**: descrição, serviços com descrição, atributos, logo, capa, 20+ fotos, Q&A inicial, link de agendamento/WhatsApp. Perfil que nasce completo ranqueia mais rápido do que um que "vai sendo preenchido".
7. Agência entra como **gerente**; proprietário principal é a conta da empresa. Grupo de empresas se houver mais unidades.
8. Baseline: cadastrar no Localo, adicionar keywords, rodar o primeiro grid, registrar score.
9. Semana 1–2 após verificação: não mexer em nome/categoria/endereço; só reviews, fotos, posts.
10. Ligar o sistema de reviews (`avaliacoes.md`) no dia em que o perfil ficar público.

Expectativa: perfis novos levam 2–6 semanas para aparecer com estabilidade no pack; dizer isso ao cliente.

## 2. Mudança de endereço, reabertura e fechamento

**Mudança de endereço (mudança física real):**
- Editar o endereço no **mesmo perfil** (nunca criar outro — perderia reviews e histórico). Reverificação é provável; preparar evidências do novo ponto (fachada com placa, conta de luz).
- Atualizar site, redes, citações principais com o novo NAP **na mesma semana**.
- Post "Mudamos de endereço" com mapa; atualizar foto da fachada; conferir pin no mapa.
- Grid será reiniciado para a nova área — novo baseline.
- Mudança dentro do mesmo bairro costuma manter ranking; para outro bairro/cidade, esperar 4–8 semanas de reacomodação.

**Fechamento temporário** (reforma, férias longas): marcar "Fechado temporariamente" só se > 7 dias; para menos, horário especial. Reabrir no dia exato — perfil "fechado" perde visibilidade.

**Fechamento permanente / unidade encerrada:** marcar "Fechado permanentemente", não excluir (o Google mantém o histórico e redireciona buscas). Se o negócio **se mudou**, usar mudança de endereço, não fechamento.

**Mudança de dono / nova marca no mesmo ponto:** se é o mesmo negócio com novo nome, editar nome (com evidência) — reviews ficam. Se é negócio diferente, o anterior é fechado permanentemente e o novo é criado.

## 3. Denunciar spam de concorrentes

Concorrentes que violam diretrizes (nome com keywords/bairro, perfis falsos ou duplicados, endereço fictício/coworking, categoria que não oferecem, reviews compradas) ocupam posições que seriam do cliente. Denunciar é legítimo, gratuito e frequentemente eficaz — mas exige evidência, nunca "achismo".

**Como identificar:** nome no perfil ≠ nome na fachada/site/CNPJ (Street View ajuda); vários perfis com o mesmo telefone/site; endereço em prédio de escritórios virtuais; reviews em rajada com perfis sem histórico. O rastreador de concorrentes do Localo (`auditActionsTrack`) mostra mudanças de nome/categoria/endereço ao longo do tempo.

**Como denunciar (do menos ao mais formal):**
1. **Sugerir edição** no Maps (público): corrigir nome para o real, marcar "não existe neste local" ou "duplicado". Funciona para casos simples.
2. **Formulário de Reclamação de Correção de Perfil** (Business Redressal Complaint Form) do Google: para spam sistemático; permite anexar evidências (prints da fachada, site, CNPJ, Street View) e listar vários perfis de uma vez. Prazo: semanas; sem retorno individual.
3. **Fórum da comunidade / Product Experts**: casos complexos.

Regras: denunciar só o que é comprovadamente irregular; nunca em massa contra todo concorrente; não usar a denúncia como tática de guerra. Registrar o que foi denunciado e acompanhar no grid se a posição mudou.

## 4. GBP + Google Ads e atribuição

**Vincular o perfil ao Google Ads** (conta do cliente): Ads → Recursos → "Local" (extensões/recursos de local) → vincular Business Profile. Efeitos: anúncios de Pesquisa mostram endereço/rotas/ligar; campanhas Performance Max e Pesquisa podem ter **objetivo de visitas à loja**; anúncios no Maps (local search ads) aparecem no pack patrocinado. O perfil precisa estar verificado e com NAP correto — otimização orgânica melhora a performance paga.

**Atribuição:**
- Link do site no perfil com UTM: `https://site.com.br/pagina?utm_source=google&utm_medium=organic&utm_campaign=gbp` (variar `utm_content` por unidade). Sem isso, GA4 mistura tráfego do perfil com orgânico comum.
- Botões de posts com UTM próprio (`utm_medium=gbp_post`).
- Número de telefone: considerar número rastreável **como secundário** mantendo o principal igual ao site (NAP). Nunca trocar o principal por número de rastreamento.
- Painel "Desempenho" do GBP: ligações, rotas, cliques, mensagens por período; cruzar com o GA4 e com o CRM/WhatsApp (origem "Google Maps") para fechar o funil até a venda.

**Leitura conjunta:** se o orgânico do perfil cresce, o CPC das campanhas locais tende a cair (mais cliques gratuitos para as mesmas buscas). Reportar os dois lado a lado no relatório mensal da Vendax.

