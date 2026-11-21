# Checklist de auditoria do perfil (com scoring)

Índice
1. Como usar
2. Pilar A — Conformidade e identidade (bloqueante)
3. Pilar B — Relevância (categoria, serviços, descrição, atributos)
4. Pilar C — Proeminência (avaliações, fotos, citações, links)
5. Pilar D — Site e conversão
6. Pilar E — Atividade e engajamento
7. Pilar F — Posição e concorrência
8. Modelo JSON para `scripts/score_gbp.py`
9. Como interpretar o score

---

## 1. Como usar

Preencha o que souber. Itens desconhecidos ficam `null` — o script calcula o score sobre o que há e lista as lacunas. Nunca invente valores. Se a única fonte for um print, descreva o que viu e marque o resto como lacuna.

Pesos por pilar no score global: A é bloqueante (zera se falhar), B 25, C 30, D 15, E 15, F 15.

## 2. Pilar A — Conformidade e identidade (bloqueante)

| Item | Pergunta | OK se |
|---|---|---|
| A1 | Perfil verificado? | Sim |
| A2 | Nome = nome real/fachada, sem cidade/palavras-chave extras? | Sim |
| A3 | Tipo correto (ponto físico / área de serviço / híbrido)? Área de serviço esconde endereço? | Sim |
| A4 | Endereço real com atendimento presencial (não coworking/virtual/PO box)? | Sim |
| A5 | Sem perfil duplicado para o mesmo ponto? | Sim |
| A6 | Sem suspensão ou alerta ativo? | Sim |
| A7 | Proprietário é a conta da empresa (não da agência/freelancer)? | Sim |

Qualquer "não" em A1, A2, A4, A5 ou A6 → score global = 0 até resolver (ver `diretrizes-e-suspensoes.md`).

## 3. Pilar B — Relevância (25 pts)

| Item | Pts | Critério de pontuação |
|---|---|---|
| B1 Categoria primária específica e alinhada à receita principal | 8 | 8 = específica e igual à dos top-3; 4 = genérica; 0 = errada |
| B2 Categorias secundárias cobrem o que oferece (sem excesso) | 4 | 4 = 2–6 relevantes; 2 = faltam; 0 = nenhuma ou irrelevantes |
| B3 Serviços cadastrados com descrição | 5 | 5 = todos os serviços principais com descrição; 3 = listados sem descrição; 0 = vazio |
| B4 Descrição (até 750c) com serviço + cidade + diferencial, sem URL | 3 | 3 = completa; 1 = genérica; 0 = vazia |
| B5 Atributos preenchidos (acessibilidade, pagamentos, público, amenidades) | 2 | 2 = sim; 0 = não |
| B6 Horários corretos, com feriados e horários especiais | 3 | 3 = sim; 1 = parcial; 0 = errado/ausente |

## 4. Pilar C — Proeminência (30 pts)

| Item | Pts | Critério |
|---|---|---|
| C1 Reviews nos últimos 90 dias | 8 | 8 = ≥12; 6 = 6–11; 3 = 1–5; 0 = nenhuma |
| C2 Nota média | 4 | 4 = ≥4,5; 3 = 4,3–4,4; 1 = 4,0–4,2; 0 = <4,0 |
| C3 Total de reviews vs. top-3 concorrentes | 4 | 4 = acima da mediana; 2 = próximo; 0 = muito abaixo |
| C4 Taxa de resposta às reviews | 5 | 5 = 100% em <48h; 3 = >80%; 1 = <50%; 0 = não responde |
| C5 Qualidade das respostas (personalizadas, citam serviço) | 2 | 2 = sim; 0 = genéricas |
| C6 Fotos: total | 3 | 3 = ≥50; 2 = 20–49; 1 = 5–19; 0 = <5 |
| C7 Fotos: recência (última adicionada) | 2 | 2 = <30 dias; 1 = <90; 0 = >90 |
| C8 Citações principais corretas (Apple, Bing, Facebook, Instagram, Waze, diretório setorial) | 2 | 2 = NAP idêntico; 1 = inconsistências; 0 = ausente |

## 5. Pilar D — Site e conversão (15 pts)

| Item | Pts | Critério |
|---|---|---|
| D1 Link do perfil aponta para página relevante (serviço/cidade) | 3 | 3 = sim; 1 = home genérica; 0 = sem site |
| D2 Title/H1 com serviço + cidade | 3 | |
| D3 NAP idêntico ao perfil e schema LocalBusiness | 3 | |
| D4 Mobile rápido (LCP < 2,5s) | 2 | |
| D5 Link de agendamento e/ou WhatsApp no perfil | 2 | |
| D6 Telefone correto e atendido | 2 | |

## 6. Pilar E — Atividade e engajamento (15 pts)

| Item | Pts | Critério |
|---|---|---|
| E1 Último post | 4 | 4 = <7 dias; 2 = <30; 0 = >30/nenhum |
| E2 Q&A com perguntas e respostas do dono | 3 | 3 = ≥5; 1 = 1–4; 0 = nenhuma |
| E3 Produtos/cardápio/catálogo (se aplicável) | 2 | n/a → redistribuir |
| E4 Atualização recente de qualquer campo (<30 dias) | 3 | |
| E5 Mensagens/chat habilitado e respondido | 3 | |

## 7. Pilar F — Posição e concorrência (15 pts)

| Item | Pts | Critério |
|---|---|---|
| F1 Posição média no grid para a keyword principal (raio 3–5 km) | 6 | 6 = ≤3; 4 = 4–7; 2 = 8–15; 0 = >15/ausente |
| F2 Share of local voice vs. top-3 | 4 | 4 = líder; 2 = empatado; 0 = atrás |
| F3 Gap de categoria/serviços vs. concorrentes acima | 3 | 3 = nenhum gap; 0 = concorrentes têm categorias/serviços que faltam |
| F4 Gap de reviews (velocidade) vs. concorrentes acima | 2 | |

Fonte preferida: grid do Localo (`localo-mcp.md`). Sem grid, estimar com buscas manuais em 3 pontos (centro, 2 km, 5 km) e marcar como estimativa.

## 8. Modelo JSON para o script

```json
{
  "negocio": "Clínica Exemplo",
  "cidade": "São Paulo",
  "keyword_principal": "dermatologista em moema",
  "A": {"verificado": true, "nome_conforme": true, "tipo_correto": true, "endereco_real": true, "sem_duplicado": true, "sem_suspensao": true, "dono_e_empresa": null},
  "B": {"categoria_primaria": 8, "categorias_secundarias": 2, "servicos": 3, "descricao": 1, "atributos": 0, "horarios": 3},
  "C": {"reviews_90d": 4, "nota_media": 4.6, "total_reviews": 87, "mediana_top3_reviews": 140, "taxa_resposta_pct": 40, "resposta_em_48h": false, "respostas_personalizadas": false, "fotos_total": 23, "dias_desde_ultima_foto": 60, "citacoes": 1},
  "D": {"link_relevante": 1, "title_servico_cidade": 0, "nap_schema": null, "mobile_rapido": null, "agendamento_whatsapp": 2, "telefone_ok": 2},
  "E": {"dias_desde_ultimo_post": 45, "qa_count": 0, "produtos_aplicavel": false, "produtos": 0, "campo_atualizado_30d": false, "chat_ativo": false},
  "F": {"posicao_media_grid": 9, "share_of_voice": 0, "gap_categoria": 0, "gap_reviews": 0}
}
```

Rodar: `python scripts/score_gbp.py auditoria.json` → imprime score por pilar, global, lacunas e os 3 maiores gargalos. Use `--json` para saída estruturada.

## 9. Interpretação

| Score | Leitura |
|---|---|
| 0 | Bloqueado por conformidade. Nada mais importa. |
| 1–40 | Perfil negligenciado. Quick wins de completude e categoria devem gerar ganho visível em 30 dias. |
| 41–65 | Perfil mediano. Ganho vem de reviews (velocidade + respostas) e fotos. |
| 66–85 | Perfil bom. Ganho vem de site, links, cobertura geográfica e consistência. |
| 86–100 | Perfil excelente. Foco em defesa (monitorar concorrentes, spam, reviews) e expansão (IA, novos perfis legítimos). |

Na entrega, mostre o score global, o pilar mais fraco e os 3 itens que mais pontos devolveriam por menor esforço.

