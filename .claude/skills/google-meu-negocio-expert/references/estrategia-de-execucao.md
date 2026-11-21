# Estratégia de execução: cada ação serve a um objetivo

Índice
1. Princípio: nada se publica sem um "porquê" ligado ao diagnóstico
2. O briefing estratégico (obrigatório antes do modo J)
3. Sequenciamento: a ordem importa
4. Avaliações — responder com estratégia
5. Posts — publicar com estratégia
6. Fotos e vídeos — escolher com estratégia
7. Edições de perfil — mudar com estratégia
8. Agendamento — o calendário de 90 dias
9. Loop semanal de operação
10. Sinais para mudar de estratégia

---

## 1. Princípio

Toda ação no perfil é uma aposta: custa tempo e, se mal feita, custa ranking ou o próprio perfil. A pergunta antes de cada ação não é "o que posso postar?", é "qual gargalo do diagnóstico esta ação ataca, e como vou saber se funcionou?". Se não houver resposta, a ação não acontece.

Os gargalos vêm da auditoria (`auditoria-checklist.md`, `score_gbp.py`) e do grid (`metricas-e-relatorios.md`). Os objetivos vêm do cliente (qual serviço vende, em qual região, qual conversão importa). A estratégia é o mapa entre os dois.

## 2. Briefing estratégico (obrigatório antes de executar)

Preencher e mostrar ao usuário antes de abrir o navegador. Se a auditoria ainda não foi feita, fazer uma versão rápida (score + grid) primeiro — executar sem diagnóstico é chutar.

```
## Briefing — [negócio] — [período]
Objetivo de negócio: [ex.: +40% de ligações vindas de "implante dentário moema" em 90 dias]
Keyword(s)-alvo: [1 principal + 2 secundárias, com posição média atual]
Gargalos (do score/grid): [1] reviews 90d = 4 vs 14–22 dos top-3 · [2] 0 posts · [3] serviços sem descrição
Zona fraca no grid: [bordas sul/oeste → bairros X e Y]
Vantagem não comunicada: [ex.: tomografia no local, horário até 20h]
Concorrente de referência: [quem está no #1 e o que ele faz que o cliente não faz]
Restrições: [saúde/CFM · perfil restaurado há 2 semanas, sem edições estruturais · cliente não quer preço público]
Ações desta sessão (em ordem) e o gargalo que cada uma ataca:
  1. ... → ataca [gargalo]
  2. ... → ataca [gargalo]
Métrica de sucesso e data de leitura: [grid em 14 dias; ações no painel em 30 dias]
```

Este briefing vira o cabeçalho do registro de execução e a base do relatório mensal.

## 3. Sequenciamento

Ordem padrão, porque cada etapa prepara a próxima e porque mudanças estruturais junto com volume de atividade parecem manipulação ao Google:

1. **Conformidade** (se houver qualquer risco): resolve antes de tudo. Perfil suspenso anula o resto.
2. **Base de relevância**: categorias → serviços com descrição → atributos → descrição → horários. Uma semana. Primeiro porque define *para quais buscas* o perfil concorre; não adianta ter reviews ótimas na fila errada.
3. **Resposta ao estoque de reviews**: todas as sem resposta, das negativas para as positivas, das recentes para as antigas. Sinal rápido de atividade, sem risco.
4. **Fotos** (lote inicial para passar de 50): atividade visível, insumo de IA.
5. **Sistema de reviews** (aquisição contínua): o motor de médio prazo; liga depois que o perfil está apresentável, porque review nova traz olhar novo.
6. **Posts e Q&A** em cadência: manutenção de recência.
7. **Mudanças estruturais arriscadas** (nome, endereço, categoria primária quando não é correção óbvia): isoladas, uma por vez, com 1–2 semanas de observação, e **nunca** na mesma semana de um lote grande de edições.
8. **Site, citações, links**: em paralelo, fora do painel.

Se o diagnóstico mostrar que a categoria primária está errada, ela vira item 2 imediato mesmo sendo estrutural — porque é correção, não experimento, e é a alavanca de maior efeito.

## 4. Avaliações — responder com estratégia

Responder não é cortesia; é (a) sinal de atividade e taxa de resposta, (b) texto adicional lido por IA e buscadores, (c) conversão de quem lê antes de ligar.

**Priorização do lote:**
1. Negativas (≤3★) sem resposta, mais recentes primeiro — cada hora sem resposta custa conversão.
2. Reviews recentes (≤30 dias) de qualquer nota — recência de resposta conta.
3. Reviews com texto que citam serviço/bairro — a resposta pode reforçar o termo naturalmente.
4. Reviews antigas só com estrela — resposta curta, por último.

**Conteúdo estratégico de cada resposta:**
- Confirmar o **serviço** citado pelo nome que o cliente busca ("seu clareamento a laser") — reforça relevância para aquela keyword.
- Quando natural, confirmar o **diferencial não comunicado** ("ter tomografia aqui mesmo ajudou a resolver no mesmo dia").
- Mencionar **bairro/cidade** no máximo em 1 a cada 4 respostas — mais que isso parece spam.
- Negativas: a resposta é escrita para o *próximo* cliente que vai ler, não para quem reclamou. Mostrar processo, não desculpa vazia.
- Nunca o mesmo fechamento duas vezes seguidas.

**Quando não responder (ainda):** review com indício de ser falsa → denunciar primeiro, resposta neutra depois; review que menciona processo judicial ou dado sensível de saúde → alinhar com o cliente antes.

## 5. Posts — publicar com estratégia

Post não ranqueia por si; serve para recência, conversão e para dar à IA fatos citáveis. Logo, cada post precisa de um **papel**:

| Papel | Quando usar | Exemplo |
|---|---|---|
| Serviço-alvo | Keyword principal está fraca | "Implante dentário com tomografia no local" + CTA Ligar |
| Cobertura geográfica | Grid fraco numa região | "Atendemos moradores de Campo Belo — 8 min de carro, estacionamento conveniado" |
| Diferencial | Concorrente não comunica | "Atendimento até 20h" |
| Prova social | Pós-lote de reviews novas | Depoimento com permissão (sem resultado clínico garantido) |
| Oferta sazonal | Calendário (volta às aulas, Black Friday, verão) | Oferta com validade |
| FAQ | Q&A ou reviews mostram dúvida recorrente | "Aceitamos Pix e parcelamos em até 10x" |
| Resposta a concorrente | Rastreador mostra que o #1 lançou algo | Post sobre o mesmo tema, com o ângulo próprio |

Regras: 1 por semana, alternando papéis; foto real específica do tema (não a fachada em todo post); CTA que leva à conversão que importa (WhatsApp/ligação para serviços, reserva para restaurantes); texto curto; nada de "o melhor", preço promocional em saúde, ou telefone no corpo.

Medir: cliques no CTA (UTM) e, após 4 semanas, se a keyword do post moveu no grid.

## 6. Fotos — escolher com estratégia

Fotos atacam volume (piso de 50), recência e a leitura da IA. Antes de subir, perguntar: **o que o concorrente #1 mostra que o cliente não mostra?** e **o que a IA precisaria ver para responder "tem X?"**

Prioridade de upload:
1. Lacunas de prova: fachada legível (verificação + confiança), interior, equipe — se faltam.
2. Fotos por **serviço-alvo** (uma por serviço cadastrado): a IA e o usuário conectam serviço ↔ imagem.
3. Diferenciais físicos (equipamento, estacionamento, acessibilidade).
4. Fotos que sustentam atributos marcados.
5. Cadência: 2–4 por semana depois do lote inicial, nunca 60 num dia e zero por dois meses.

Vídeo: 1–2/mês, "como chegar" e bastidor — tempo no perfil.

## 7. Edições de perfil — mudar com estratégia

Cada campo tem um papel e um risco:

| Campo | Papel estratégico | Risco | Quando mexer |
|---|---|---|---|
| Categoria primária | Define a fila de concorrência | Reinicia sinal; reverificação rara | Se errada: já. Se "teste": nunca sem 3 semanas de baseline. |
| Secundárias | Amplia buscas elegíveis | Diluição se irrelevantes | Após mapear categorias dos top-3 |
| Serviços | Relevância de cauda longa + IA | Baixo | Cedo; revisar mensalmente com termos reais do Google |
| Descrição | Conversão + IA | Baixo (análise do Google) | Cedo; reescrever a cada 6 meses ou quando mudar o foco |
| Atributos | Filtros de IA + conversão | Denúncia se falso | Cedo |
| Horários | Conversão + sinal comportamental | Ligações perdidas se errado | Cedo; feriados com 2 semanas de antecedência |
| Nome | Conformidade | Suspensão | Só para corrigir irregularidade |
| Endereço/área | Distância | Reverificação | Só mudança real |

Regra de ouro: edições de relevância (serviços, descrição, atributos) podem ir em lote numa semana; edições estruturais (nome, endereço, categoria primária) vão sozinhas.

## 8. Agendamento — calendário de 90 dias

Agendar não é "encher o calendário"; é distribuir papéis ao longo do tempo para manter recência e cobrir todos os gargalos.

```
Semana 1–2  | Base: categorias, serviços, descrição, atributos, horários · responder estoque de reviews · lote de fotos
Semana 3–4  | Ligar sistema de reviews · post "serviço-alvo" · post "diferencial" · 2 fotos/sem · Q&A
Semana 5–8  | Posts alternando papéis (geográfico, FAQ, prova social) · fotos por serviço · primeira leitura do grid
Semana 9–12 | Ajuste por grid: reforçar região fraca com post + foto + página no site · oferta sazonal · relatório
```

Agendar no Localo com dia e hora fixos (ex.: terça 10h) para o cliente saber quando pedir material. Posts de oferta/evento com validade; "novidade" pode ser perene.

## 9. Loop semanal

1. Ler: grid da keyword principal, reviews novas, Smart Tasks, rastreador de concorrentes, edições sugeridas pelo Google.
2. Decidir: o que mudou? O #1 fez algo? Alguma região caiu? Alguma review negativa?
3. Executar: responder reviews da semana · post da semana (papel escolhido pelo que o passo 2 mostrou) · fotos da semana · 1 melhoria de perfil.
4. Registrar: ações feitas, com o gargalo que atacam.
5. Mensal: relatório com baseline → atual, e revisão do briefing.

## 10. Sinais para mudar de estratégia

- Grid subiu no centro e não nas bordas → problema é distância: conteúdo por bairro, páginas no site, posts geográficos; não adianta mais review.
- Reviews subiram, posição não → provável categoria/serviços (relevância) ou concorrente mais forte: refazer análise competitiva.
- Impressões subiram, ações não → problema de conversão: fotos, horário, descrição, CTA, nota.
- Posição subiu para uma keyword e caiu para outra → categoria primária favoreceu uma fila; decidir qual vale mais em receita.
- Tudo subiu e caiu de repente → checar edições sugeridas/pendentes do Google, suspensão suave, mudança de algoritmo (pesquisar na web).

