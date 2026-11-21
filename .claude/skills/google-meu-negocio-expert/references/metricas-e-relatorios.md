# Métricas, posição no grid, concorrência e relatórios

Índice
1. KPIs e como ler cada um
2. Grid de posições (mapa de calor)
3. Análise competitiva
4. Baseline e expectativa de tempo
5. Relatório para cliente
6. Alertas de monitoramento

---

## 1. KPIs

| KPI | O que mede | Fonte | Leitura |
|---|---|---|---|
| Posição média no grid | Ranking médio nos N pontos do mapa para uma keyword | Localo grid / Local Falcon / manual | Meta: ≤3 no raio core (1–2 km), ≤7 no raio de 5 km |
| Share of Local Voice (SoLV) | % dos pontos em que o perfil está no top-3 | Grid | Compara com top-3 concorrentes |
| Visibilidade (impressões) | Vezes que o perfil apareceu (Busca + Maps, mobile + desktop) | GBP Desempenho / Localo | Tendência mensal; sazonalidade |
| Ações | Ligações, cliques no site, rotas, mensagens, reservas | GBP Desempenho / Localo | KPI de negócio; taxa de ação = ações/impressões |
| Buscas por termo | Quais termos geraram impressões (discovery vs. marca) | GBP Desempenho | Mostra para que está ranqueando de fato |
| Reviews: total, nota, 90d, taxa de resposta, tempo de resposta | Reputação e velocidade | Localo / GBP | Comparar com top-3 |
| Fotos adicionadas/mês, visualizações de foto | Atividade e engajamento | GBP / Localo | |
| Completude / score de auditoria | Qualidade do perfil | Localo audit score / `score_gbp.py` | Meta ≥85 |
| Citações em IA | Menções em AI Overviews/AI Mode para perguntas-chave | Manual / ferramenta de IA | Mensal |

Separar **marca** (buscas pelo nome) de **descoberta** (buscas por categoria/serviço). Crescimento em descoberta é o que o SEO local entrega; marca reflete outras mídias.

## 2. Grid de posições

- Grade de 5×5 a 9×9 pontos em raio de 1–5 km (ajustar à densidade urbana: SP capital 2–3 km; interior 5–10 km).
- Keywords: 3–8, misturando "serviço + bairro", "serviço perto de mim" (buscar com "serviço" apenas, o grid simula a localização) e "categoria".
- Ler o mapa: verde = top-3; amarelo = 4–10; vermelho = 11+. Perfil forte no centro e fraco nas bordas = distância; fraco em tudo = relevância/proeminência; fraco só numa keyword = categoria/serviço.
- Frequência: semanal para keywords principais, quinzenal para secundárias. Comparar o mesmo dia da semana e horário.

## 3. Análise competitiva

Para a keyword principal, pegar os 3 primeiros do pack no ponto central e tabular:

| | Cliente | Conc. 1 | Conc. 2 | Conc. 3 |
|---|---|---|---|---|
| Categoria primária | | | | |
| Nº categorias | | | | |
| Reviews total / nota / 90d | | | | |
| Taxa de resposta | | | | |
| Fotos | | | | |
| Serviços cadastrados | | | | |
| Site: title / página | | | | |
| Posts últimos 30d | | | | |
| Distância do centro | | | | |

Conclusão sempre em: **o que eles têm que eu não tenho** (gap) e **o que eu tenho que eles não têm** (vantagem a explorar). Com o Localo, `audit.titleProminentPhrases` e `reviewsProminentPhrases` mostram os termos que os concorrentes concentram.

## 4. Baseline e tempo

Registrar antes de qualquer mudança: score, grid, impressões/ações dos últimos 90 dias, reviews. Sem baseline não há como provar resultado.

Expectativa de efeito (direcional): categoria primária 2–3 semanas; completude/atributos/serviços 2–4 semanas; reviews e fotos 4–8 semanas; site 6–12 semanas; links/citações 8–16 semanas. Avisar que o Google reindexa perfis em ciclos e que oscilações semanais de 1–2 posições são ruído.

## 5. Relatório para cliente

Usar `assets/template-relatorio-mensal.md`. Princípios:
- Primeira página responde "estamos melhor ou pior, e por quê" em 5 linhas.
- Métricas de negócio (ligações, rotas, mensagens) antes de métricas de vaidade (impressões).
- Gráfico de posição no grid lado a lado (mês anterior vs. atual).
- O que foi feito, o que vem no próximo mês, o que precisa do cliente (pedir reviews, fotos, aprovar texto).
- Com Localo: `createSharedInsights` gera link público do relatório oficial para anexar.

## 6. Alertas

Monitorar semanalmente: queda ≥3 posições em keyword principal; review ≤2 estrelas sem resposta >24h; edição sugerida pelo Google pendente; perfil marcado como fechado; nova categoria/serviço nos concorrentes top-3; queda >20% em impressões mês a mês; perfil suspenso. Configurar e-mail de alerta no GBP e, se houver, tarefas inteligentes do Localo.

