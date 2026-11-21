---
name: especialista-nextags
description: "Especialista na plataforma NexTags (app.nextagsai.com.br): construção de fluxos e prompts de IA, JSON Agente, agentes de comentários/direct, implantação de clientes, disparos/Broadcast com HSM da Meta e troubleshooting. Use em qualquer dúvida ou tarefa envolvendo NexTags."
---

# Especialista NexTags

Base de conhecimento consolidada da central de ajuda oficial (`ajuda.nextags.com.br`, ~45 artigos) **e do Treinamento Partner Nextags (`aulas.nextags.com.br`, curso 5964, 9 aulas — seção 14)**. A Vendax opera os fluxos de WhatsApp dos clientes nessa plataforma.

**Regra de ouro:** responda direto com o conteúdo abaixo. Só busque na web quando a pergunta cair numa lacuna sinalizada como “só no vídeo” ou envolver preço/tabela que muda. Qualquer página da central pode ser lida em Markdown puro adicionando `.md` à URL; o índice completo está em `https://ajuda.nextags.com.br/llms.txt`.

**Limitação conhecida da fonte:** a maioria dos artigos é uma página curta com vídeo Loom embutido. O passo a passo clique-a-clique e alguns valores existem só no vídeo. Quando o dado não estiver aqui, diga isso em vez de inventar nome de botão ou número.

---

## 1. Arquitetura da plataforma

Áreas do menu lateral, na ordem em que aparecem: Novidades · Dashboard · Caixa de Entrada · Fluxos · Contatos · AI Hub · Catálogo Meta · Ferramentas · Broadcasts · Configurações · Pipelines (Kanban) · WhatsApp · Central de ajuda.

Canais suportados: WhatsApp, Instagram, Facebook Messenger, Telegram, TikTok, Webchat.

---

## 2. Fluxos de conversa — blocos do construtor

| Bloco | O que faz |
|---|---|
| **Enviar Mensagem** | Texto, imagens, vídeos, arquivos, modelos de mensagem (HSM) e cartões |
| **Ações** | Adicionar/remover etiqueta, atribuir e transferir para humano, definir campo, etc. |
| **Condição** | Ramifica por etiquetas, campos personalizados ou idioma |
| **Adquirir Dados** | Pergunta e grava a resposta num campo personalizado, com validação de tipo e mensagem de erro |
| **Lista de Opções** | Menu — aceita mais botões que uma mensagem de texto padrão |
| **Dividir Tráfego** | Teste A/B: distribui o público por porcentagem |
| **Esperar** | Pausa antes da próxima mensagem (deixa a conversa mais humana) |
| **OpenAI** | Nó de agente de IA: seleção de modelo, origem dos dados, onde armazenar a resposta, funções acopláveis |
| **Atribuição Automática** | Rodízio entre administradores, com janela de balanceamento (todo o período, 8h ou 24h) |

**Regras operacionais**

- Salvar ≠ publicar. Um fluxo só entra em vigor depois de **publicado**; antes disso é rascunho.
- Fluxos, etiquetas e campos se organizam em **pastas** — a mecânica de mover é a mesma para os três.
- Cada fluxo tem: duplicar, obter link, renomear e **registro de erros** (primeiro lugar a olhar quando algo não dispara).

### Receita de fluxo de boas-vindas (sem IA)

1. Menu inicial com **Lista de Opções**.
2. Uma rota por opção.
3. **Ações** para atribuir/transferir a humano onde necessário.
4. **Adquirir Dados** para coletar o que importa em campo personalizado.
5. **Esperar** entre mensagens.
6. Testar todas as rotas.
7. Publicar e definir como **fluxo de recepção** da conta (Configurações → Configurações Gerais).

### Atendimento rotativo — duas abordagens

- **Por carteira:** Condição verifica etiqueta (“Carteira Fulano”) → atribui ao admin dono. Sem etiqueta, cai num campo personalizado numérico que faz o rodízio.
- **Nativa:** bloco de Atribuição Automática, com balanceamento em todo o histórico ou em janelas de 8h/24h para não sobrecarregar ninguém.

---

## 3. Campos personalizados e variáveis

Sintaxe: `{{nome_do_campo}}`. Criar em **Fluxo → Campos Personalizados → Adicionar** (nome, tipo, descrição → Continuar).

Tipos: Texto · Número · Data · Data e hora · Verdadeiro/Falso · Texto longo.

**Limites:** campo personalizado normal **10.000 caracteres**; campo de conta tipo texto longo até **16.000.000 de caracteres** (é onde cabe um prompt gigante).

Os CUFs são a memória permanente do bot — persistem entre conversas, ao contrário de `{{chat_history}}`. Variáveis de tempo real como `{{last_input}}` precisam ser copiadas para um CUF via ação **Definir Campo Personalizado**; o sistema não persiste sozinho.

### Variáveis do sistema mais usadas

Contato: `{{first_name}}` `{{last_name}}` `{{full_name}}` `{{email}}` `{{phone}}` `{{user_city}}` `{{user_state}}` `{{user_country}}` `{{timezone}}` `{{current_user_time}}` `{{user_id}}` `{{user_tags}}` `{{subscribed_date}}` `{{user_source}}` `{{user_channel}}` `{{user_external_id}}`

Conversa: `{{last_input}}` `{{last_text_input}}` `{{last_input_type}}` `{{last_btt_title}}` `{{last_interaction}}` `{{last_seen}}` `{{consecutive_failed_reply}}` `{{last_step}}` `{{current_step}}` `{{assigned_admin_name}}` `{{assigned_admin_id}}` `{{user_notes}}` `{{last_user_note}}` `{{inbox_link}}`

Histórico: `{{chat_history}}` (50 msgs) · `{{chat_history_large}}` (200) · `{{chat_history_details}}` (50 com remetente) · `{{chat_history_details_large}}` (200 com remetente)

Conta: `{{account_name}}` `{{account_id}}` `{{account_image}}` `{{api_key}}`

Ads/origem: `{{last_ad}}` `{{last_ref}}`

Instagram: `{{ig_user_name}}` `{{ig_followers}}` `{{ig_verified}}` `{{ig_follow_business}}` `{{ig_business_follow_user}}` `{{last_story_id}}` `{{last_commented_post_text}}` `{{last_fb_comment}}` `{{last_post_id}}` `{{last_comment_id}}`

Localização: `{{last_latitude}}` `{{last_longitude}}`

Agendamento: `{{booking_date}}` `{{booking_link}}` `{{booking_id}}` `{{booking_calendar}}`

E-commerce/Catálogo Meta: família `{{cart_*}}` (`cart_total`, `cart_subtotal`, `cart_checkout_link`, `cart_num_items`, `cart_last_item_name`…) e família `{{order_*}}` (`order_id`, `order_status`, `order_total`, `order_products`, `order_payment_method`, `order_shipping_*`, `order_coupon_code`…), além de `{{shop_link}}` e `{{money_symbol}}`.

`{{last_call_recorded}}` só funciona com Twilio.

---

## 4. AI Hub

Estrutura:

- **Agentes de IA** — o “cérebro”, configurado pelo prompt.
- **Ferramentas de IA**
  - **Arquivos** — upload de PDFs, planilhas e documentos para a IA consultar antes de responder (base de conhecimento).
  - **Funções de IA** — permitem à IA executar tarefas nos fluxos conforme a intenção do cliente.
  - **MCP** — conecta a IA a dados de e-commerce (ex. Shopify): pedidos, carrinhos abandonados.
- **Palavras-chave** — palavras ou frases que disparam fluxos ou mensagens específicas.

Provedores citados como compatíveis: OpenAI, Google Gemini, Claude, xAI e DeepSeek. Faturamento é sempre no lado do provedor (cartão na OpenAI; billing no Google Cloud para o Gemini); a NexTags não cobra os tokens.

### Framework de prompt eficiente (8 pontos da doc oficial)

1. Configurar na área de Agentes de IA.
2. **Clareza e objetividade** — escreva como para alguém muito inteligente que não lê mentes.
3. **Contexto e identidade** — público-alvo, tom, linguagem.
4. **Persona** — papel (vendedor, suporte, consultor) e objetivo.
5. **Interação e refinamento** — testar e ajustar continuamente com base nos erros observados.
6. **Palavras-chave** — acionar ações e fluxos específicos.
7. **Estrutura** — organizar com marcadores ou numeração.
8. **Limitações da plataforma** — considerar o que a NexTags integra ao escrever as instruções.

---

## 5. JSON Agente — respostas ricas e ações automáticas

A NexTags tem um middleware entre a resposta da IA e o cliente: se a IA devolver JSON no schema da Messenger Messaging Platform, a plataforma converte para o formato visual nativo do canal (nem todo formato existe em todo canal).

**Bloco para colar no fim do prompt do agente:**

```
Você é uma IA que deve sempre retornar respostas em JSON válido seguindo o padrão da Messenger Messaging Platform.

Regras:
1 - O JSON deve conter um array "messages" ou um array "actions" (ou ambos).
2 - "messages" é um array de objetos. Cada objeto deve conter um objeto "message".
3 - O objeto "message" deve seguir o schema de mensagens da Messenger Messaging Platform.
4 - Tipos de mensagem suportados: Texto, Texto com botões, Imagens, Vídeos, Carrossel (generic), Arquivos.
5 - Sempre retorne somente JSON válido. Não retornar explicações, comentários, markdown ou qualquer texto fora do JSON.
```

**Exemplos canônicos**

Várias mensagens:
```json
{"messages":[{"message":{"text":"Olá mundo"}},{"message":{"text":"Esta é a segunda mensagem"}}]}
```

Mídia (troque `type` por `image|video|audio|file`):
```json
{"messages":[{"message":{"attachment":{"type":"image","payload":{"url":"<URL_DA_IMAGEM>"}}}}]}
```

Carrossel:
```json
{"messages":[{"message":{"attachment":{"payload":{"elements":[{"title":"Título do Card 1","subtitle":"Subtítulo 1","image_url":"<URL>","buttons":[]},{"title":"Título do Card 2","subtitle":"Subtítulo 2","image_url":"<URL>","buttons":[]}],"template_type":"generic","image_aspect_ratio":"horizontal"},"type":"template"}}}]}
```

Texto com botões (link + disparo de fluxo por ID no `payload`):
```json
{"messages":[{"message":{"attachment":{"payload":{"buttons":[{"title":"Abrir Site","type":"web_url","url":"<URL>"},{"title":"Enviar Fluxo","payload":"123456789","type":"postback"}],"template_type":"button","text":"Olá mundo"},"type":"template"}}}]}
```

Indicador de digitação — um número solto no array é a pausa em segundos:
```json
{"messages":[{"message":{"text":"Olá mundo"}},4,{"message":{"text":"Esta é a segunda mensagem"}}]}
```

Mensagem + ações no mesmo retorno:
```json
{"messages":[{"message":{"text":"Olá mundo"}}],"actions":[{"action":"add_tag","tag_name":"lead"},{"action":"set_field_value","field_name":"lead_value","value":"89"},{"action":"send_flow","flow_id":"5854739484"}]}
```

**Tabela de ações disponíveis**

| Ação | JSON |
|---|---|
| Adicionar tag | `{"action":"add_tag","tag_name":"<tag>"}` |
| Remover tag | `{"action":"remove_tag","tag_name":"<tag>"}` |
| Definir campo | `{"action":"set_field_value","field_name":"<campo>","value":"<valor>"}` |
| Limpar campo | `{"action":"unset_field_value","field_name":"<campo>"}` |
| Disparar fluxo | `{"action":"send_flow","flow_id":"<ID>"}` |
| Transferir para humano | `{"action":"transfer_conversation_to","value":"human"}` |
| Atribuir a admin | `{"action":"assign_conversation","admin_id":"<admin_id>"}` |
| Remover atribuição | `{"action":"unassign_conversation"}` |

---

## 6. WhatsApp, HSM e Broadcast

### Tipos de conexão

- **API oficial (direta)** — Configurações → Canais → nova conta WAB: nome de identificação, nome de exibição, categoria, número verificado por SMS ou ligação. Usar **número dedicado**. Há números de teste da Meta para validar antes.
- **Coexistente** — “Mais canais” → WhatsApp → Coexistente → ler QR Code → aguardar sincronização. Mantém o app no celular junto com a API. **Instável para disparos ativos — use só para atendimento receptivo.**
- **Novo número** — terceira opção oferecida na implantação.

### Limites e qualidade

- Escala de envio diário: **250 → 1.000 → 10.000+**.
- Verificar a conta no Gerenciador do WhatsApp Business sobe de **250 para 1.000/dia**. A verificação da empresa no Meta Business Suite é o que destrava limite e segurança.
- O que derruba a qualidade: bloqueios e denúncias de spam; **listas frias ou compradas**; alta taxa de não entregues por números inválidos.
- O que sustenta: conta verificada, base qualificada, avaliação recorrente das campanhas e um fluxo receptivo forte.

### Janela de 24 horas

Interações são gratuitas por 24h a partir da última resposta do cliente. Fora dela, só com **modelo (HSM) pré-aprovado**, que é pago. Categorias de conversa: **Autenticação, Marketing, Utilidade, Serviço** — custos diferentes. Boa prática: incluir botões no HSM para provocar resposta e reabrir a janela.

### Criar HSM

Gerenciador de Modelos (acessível pela NexTags) → nomear · idioma · cabeçalho de mídia opcional (imagem, vídeo ou documento) · variáveis · **preencher os campos de exemplo** (sem isso a Meta reprova) → submeter. A Meta classifica em Utilidade ou Marketing. Passo a passo detalhado da tela: seção 14.5.

### Broadcast

Segmentação por condicionais e etiquetas → agendamento (data/hora + escolha do HSM) → análise em três camadas: resumo na área de Broadcast (status, público estimado, taxa de entrega), análise de fluxo (funil por etapa, visualizações, cliques) e Insights do Gerenciador da Meta (entregues gratuitas vs. pagas, custo aproximado, filtros por período e por número).

### Gerenciador do WhatsApp Business — 4 seções

Visão Geral (alertas, resumo, limite diário) · Insights (mensagens enviadas e pagas) · Perfil (nome de exibição, foto, endereço, site, dados comerciais, verificação) · Configurações (conta e número).

---

## 7. Caixa de Entrada

Modos: **Todas · Bot · Humano**.

Ações por conversa: atribuir, transferir para bot, “Seguindo” (estrela), marcar como não lida, arquivar, bloquear, excluir. Suporta áudio, arquivos, emojis e **sugestão de resposta da IA**.

Enviar HSM: três pontinhos ao lado da conversa → **Modelo de Mensagem** → escolher → preencher variáveis → enviar.

**Respostas salvas:** criadas com um nome de atalho (ex. “Pix”), disponíveis dentro de qualquer conversa e editáveis antes do envio.

**Filtros:** por canal (WhatsApp/Instagram/Messenger) · por atribuição (humano, não atribuída, bot) · sem resposta do administrador · não lidas · Seguindo · arquivados · bloqueados · **Mais Opções** (etiquetas, campos personalizados e outras condições).

**Card do Cliente** (painel direito): dados editáveis (nome, e-mail, telefone), data do primeiro contato, campos personalizados preenchidos, **Pipeline** (oportunidade com valor, prioridade e responsável), **Notas** (com autor e data automáticos), **Mídias e Etiquetas**, **Ver Ações** (histórico de transferências, arquivamentos, bloqueios). É no card que se lê o conteúdo do campo `resposta_ai` para depurar o JSON devolvido pela IA.

Novo contato: telefone no formato **+55 + DDD + número**; e-mail, nome completo, apelido e gênero opcionais.

---

## 8. Contatos

Importação por **.csv**, com mapeamento de colunas para nome, telefone e e-mail. **Toda coluna precisa ter cabeçalho** — sem header a importação não mapeia. O telefone precisa estar como **DDI + DDD + número** (ex. `5511988776655`). É possível aplicar etiquetas já na importação, deixando a base segmentada de entrada, e escolher a **Fonte** do contato (ex. WhatsApp).

Ações em massa: atribuir conversas a um admin · adicionar/remover etiquetas · excluir · exportar · transferir para humano ou bot · inscrever/cancelar assinatura de transmissões.

---

## 9. Limites de arquivo por canal

| Canal | Áudio | Documento | Imagem | Vídeo |
|---|---|---|---|---|
| **Instagram** | aac, m4a, wav, mp4 — 25 MB | **não permitido** | png, jpeg, gif — 8 MB | mp4, ogg, avi, mov, webm — 25 MB |
| **Messenger** | aac, m4a, wav, mp4 — 25 MB | qualquer MIME válido — 25 MB | png, jpeg, gif — 25 MB | mp4, ogg, avi, mov, webm — 25 MB |
| **WhatsApp** | aac, m4a, ogg, mp4, mp3, amr — 16 MB | qualquer MIME válido — 25 MB | png, jpeg — 5 MB | 3gp, mp4 — 16 MB |
| **Telegram** | mpeg — 20 MB | qualquer MIME válido — 20 MB | png, jpeg, webp — 5 MB | mp4 — 20 MB |

O artigo da caixa de entrada cita “5 MB para fotos e 20 MB para vídeos e documentos” como regra geral do uploader — a tabela por canal acima é a que manda na entrega.

---

## 10. Configurações e integrações

- **Gerais:** fluxo de recepção, fuso horário, cores, modo de desenvolvimento.
- **Canais:** Facebook Messenger, WhatsApp, Instagram, TikTok, Web Chatbot, Telegram.
- **Integrações:** OpenAI, Gemini, Google Sheets, Google Ads, e-commerce e outras.
- **Administradores:** membros da equipe e permissões.
- **Customizações:** tradução e área de E-commerce (catálogos e carrinhos).

**Chave de API da NexTags:** Configurações → “Chave de API” → **Gerar**. Serve para integrar e-commerce e sistemas de gestão (Shopify, Bling etc.). O botão **Saber Mais** leva à documentação com as rotas de conta, contato e pipelines.

**Instagram:** conecta pela conta do Facebook vinculada e exige localizar o ID da página. **Messenger:** conectar página → aceitar permissões → vincular.

**Automação de comentários (Ferramentas):** mensagem privada ou fluxo após comentário · respostas públicas variadas · filtro por palavra-chave com a opção **“contém”** · ocultar comentários com palavras-chave · responder só a novos contatos, só uma vez por usuário, curtir o comentário, rastrear marcações · resposta imediata ou **aleatória** (mais humana) · salvar. Tela completa e padrão de dois agentes: seção 14.7.

**Cobrança:** modelo por número de contatos, com prorrogação ao mudar de faixa. Os valores não estão na central de ajuda — a tabela oficial é `nextags.com.br/valores`. Nunca cite preço de memória; consulte.

---

## 11. Dashboard

Filtro de data. Métricas de contatos: total, novos, ativos, **tempo médio de primeira resposta** e tempo de resposta geral. Gráficos de origem por canal (WhatsApp, Instagram, Messenger) e por fonte (importação, Ads, webchat). Desempenho por administrador: mensagens enviadas, conversas atribuídas, duração média do atendimento. Interação com bot: mensagens recebidas pelo bot e conversas movidas para humano.

---

## 12. Implantação de cliente — roteiro oficial

**Reunião 1:** validar expectativas · apresentar o documento de implementação · instalar canais · analisar a base de contatos · **definir a forma de conexão do WhatsApp (API direta, coexistente ou número novo)** · overview da ferramenta · encaminhar para integração.

**Reunião 2:** testar fluxos · instalar o número oficial · subir a base segmentada · configurar chatbot, setorização e rotativo · iniciar o treino da IA.

**Reunião 3:** treinamento completo · validações finais · disparos iniciais se solicitado · encerramento.

**Checklist para o cliente chegar pronto:** Facebook liberado, número pronto para receber SMS, modelo de conexão do WhatsApp já decidido.

**Suporte faz:** instalação de WhatsApp, Instagram e TikTok · treinamentos sob demanda · validação de fluxos · orientação de uso · ajuda na construção estrutural de fluxos e prompts · reuniões por vídeo.
**Suporte não faz:** criação de copy, edição de planilhas, disparos sem a presença do cliente.

**Time de integrações:** conecta e-commerce, CRM e sistemas externos (carrinho abandonado, pedido aprovado, webhooks). **Integração avançada leva até 10 dias úteis** após o envio das copies e acessos.

---

## 13. Troubleshooting — o que checar primeiro

| Sintoma | Verificar |
|---|---|
| Fluxo não dispara | Está **publicado**? Confira o registro de erros do fluxo |
| Mensagem não sai fora da janela | Janela de 24h fechada → precisa de HSM aprovado |
| HSM reprovado pela Meta | Campos de exemplo preenchidos? Categoria coerente (Utilidade × Marketing)? |
| Disparo com entrega ruim | Base fria/comprada, números inválidos, qualidade da conta caindo |
| Limite de envio travado em 250 | Conta não verificada no Gerenciador; verificar sobe para 1.000 |
| Coexistente falhando em disparo | Esperado — modo instável para ativo, migrar para API direta |
| Variável vindo vazia | Variável de tempo real precisa ser gravada num CUF via “Definir Campo Personalizado” |
| Importação de CSV falhou | Faltou cabeçalho em alguma coluna, ou telefone sem DDI+DDD |
| Anexo recusado | Confira a tabela de limites por canal — imagem no WhatsApp são 5 MB; Instagram não aceita documento |
| IA respondendo só texto | Falta o bloco de instrução de JSON Agente no fim do prompt |
| Agente responde mas nada chega ao cliente | Confira se o fluxo tem o bloco Enviar Mensagem com `{{resposta_ai}}` depois do bloco OpenAI |
| Fluxo transacional não dispara sozinho | Ele é acionado por integração/API — o toggle de Caixa de Entrada fica desligado de propósito |

---

## 14. Treinamento Partner Nextags (curso oficial) — o que cada aula entrega

Curso `aulas.nextags.com.br` → **Treinamento - Partner Nextags** (11 módulos; o módulo de entregáveis tem 9 aulas). Cada aula tem PDF em "Material complementar". As aulas 03 a 09 são aulões gravados no Meet — o passo a passo abaixo veio da tela; o que foi só falado não está aqui.

### 14.1 Como o parceiro é avaliado (Aula 1)

O Partner é **referência técnica** para clientes que usam recursos multicanais e estratégias avançadas: precisa conhecer a plataforma inteira e estar atualizado nas novas funcionalidades.

| Casos negativos | Casos aceitáveis |
|---|---|
| Só entrega automação de Instagram do tipo "Eu quero", sem fluxo de captação de lead | Subdivide as entregas estruturando **um canal por vez** |
| Monta triagem multi-atendentes mas não sabe entregar fluxo de **NPS** | Cria fluxo de triagem → testa → fluxo de atendimento → testa → fluxo de avaliação (NPS) |
| Só sabe disparo por API oficial e não tem segurança para criar um mini agente de resposta de direct | Funil de Instagram não é a especialidade, mas além da API oficial entrega os fluxos solicitados |
| Evita usar multicanal | |

**Os 4 pilares do Partner:** 1) segmentação e importação de listas · 2) multicanal · 3) construção de agentes · 4) integrações.

### 14.2 Campos personalizados e etiquetas (Aula 02)

**Campo × etiqueta:** o campo *registra a informação* (personalizado, é "do cliente", pode vir direto na importação); a etiqueta *é a informação* — condição do lead, rotativa, geralmente anexada a fluxos e gatilhos.

**Ficha cadastral do cliente — biblioteca de campos por vertical:**

| Grupo | Campos |
|---|---|
| Sistema | `Número` `Email` `Nome` `Sobrenome` |
| Atendimento | `Avaliação ⭐` `Avaliação ⭐⭐` `Avaliação ⭐⭐⭐` `Resumo_suporte` |
| Demográficos | `cep` `cidade` `rua` `numero_casa` `endereco_entrega` |
| E-commerce | `codigo_rastreio` `link_rastreio` `status_pedido` `url_carrinho` `valor_pedido` `cupom` `data_pedido` `itens_pedido` |
| Clínica | `data_agendamento` `especialidade` `procedimento` `principal_queixa` `data_orcamento1` `data_orcamento2` |
| Info-produtor | `produto` `etapa_esteira` `data_matricula` `valor_pedido` `status_pedido` `taxa_conclusao` |

Com dados precisos dá para regular a oferta certa, para o cliente certo, no momento em que ele está propenso a comprar (ex.: 22 anos, tamanho M, última compra pelo site, gosta de azul → vestido azul de R$ 219,90 por R$ 136,90).

**Como aumentar leads (4 frentes):** 1) **importação automática** — conectar o site na Nextags para importar contatos sozinho · 2) **importação manual** — baixar a lista antiga e subir na Nextags · 3) **tratamento do atendimento** — tratar com campos personalizados e etiquetas quem já chega · 4) **captação** — conteúdo, parcerias com influenciadores, rede de parceiros, indicações e tráfego pago.

**Importação de CSV (tela real):** Arquivo → Fonte (ex. WhatsApp) → aviso da plataforma: *antes de importar confirme a formatação do número: DDI + DDD + telefone, ex. `5511988776655`* → mapear cada coluna do CSV para Número de telefone / Endereço de e-mail / Nome / Sobrenome.

### 14.3 Agentes de IA (Aula 03)

**Definição usada no treinamento:** agente de IA é um *sistema de regras autônomo* que usa base de conhecimento, contexto e cognição para atingir objetivos específicos — gerar respostas, ler e interpretar contextos, correlacionar contextos com históricos e base de conhecimento, registrar dados, tomar decisões e ativar ferramentas externas.

| Mini agentes | Agentes MCP |
|---|---|
| Usa **dados internos**: prompt, contexto e base de dados da conta | Além do prompt/contexto/base interna, **puxa dados de sites externos** por integração |
| Precisa de: LLM conectado · árvore de decisões (fluxo decisor) · prompt no IA Hub · campos de resposta e contexto | Precisa de: tudo do mini agente · integração com o site · ações de Get, Post, Delete etc. · **sistema de segurança no prompt** |

**O maior erro ao criar agentes:** querer montar o megazord inteiro de uma vez. Monte por partes (um leão de cada vez).

**Os 6 passos para criar o Mini Agente:**

1. Conecte o LLM na Nextags
2. Crie o campo personalizado **`resposta_ai`**
3. Cole o prompt no IA Hub
4. Crie o fluxo que aciona a IA
5. Acione o fluxo no recurso de **Boas Vindas**
6. Teste as respostas e adeque o seu prompt

O fluxo mínimo é: `Início` → **Enviar Mensagem** (bloco OpenAI, com saídas Sucesso / Falhado) → **Enviar Mensagem #1** com `{{resposta_ai}}`.

**Ferramenta de briefing:** `briefing-ia.nextags.com.br` — formulário em 4 etapas (**Contexto · Fluxo · Conhecimento · Controle**) que gera um briefing completo de configuração do agente. No fim ele monta o texto pronto (identidade, regras de handoff/transferência para humano, mensagens padrão) com botão **Copiar/Baixar**, e instrui: 1) copie o briefing, 2) envie para a equipe, 3) acompanhe a configuração. Use como formulário de descoberta com o cliente em vez de partir do zero.

### 14.4 MCP na prática (Aula 04 — caso M.Officer)

- Fluxo de trabalho mostrado: abrir o site/catálogo do cliente, pedir a uma IA externa (Claude) para **ler o site, categorias e produtos e ajudar a escrever o prompt** do agente comercial — no caso, "Mister M", tom informal, público jovial — e só depois colar o prompt no IA Hub.
- O **MCP** conecta o agente ao catálogo (Shopify): ele consulta produtos reais, monta o look e devolve botão "Ver no site" / "Ver Novidades".
- Teste na **Caixa de Entrada** com o bot ativo; no card do contato o campo `resposta_ai` mostra o JSON devolvido (`{"messages":[{"message":{"text":...}}]}`) — é assim que se depura o JSON Agente.
- Atendimento humano organizado em **Pipelines (Kanban)** — ex. Painel de Suporte com as etapas *Aguardando Atendimento · Em Atendimento · Pendência · Crítico · Concluído*, com ticket por contato.
- Ponto de entrada por link: `api.whatsapp.com/send/?phone=55DDDNÚMERO&text=...`.

### 14.5 Template de utilidade + disparo (Aula 05)

**No Gerenciador do WhatsApp (Meta) → Criar modelo:** nome do modelo (ex. `07_05`) · idioma Portuguese (BR) · **Tipo de variável: Número** · amostra de mídia (opcional) · cabeçalho de texto opcional (0/60) · corpo (0/1024) com variáveis · **Amostras de variáveis** (obrigatório — a Meta reprova sem exemplo) · rodapé opcional · **Enviar para análise**. A prévia do modelo aparece à direita.

Exemplo de corpo aprovado como **Utilidade**:

```
Oi {{1}}! Tenho uma {{2}} 🎁
A Nextags está com {{3}} 🚀
Dura {{4}} •• 👇
Abre agora mesmo ⏳
```
Rodapé: `Nextags | Para sair da nossa lista, digite STOP`

**No fluxo (campanha):** bloco Enviar Mensagem com o modelo `pt_BR - 07_05_26`, mapeando `{{1}} → {{first_name}}`, `{{2}} → condição especial hoje`, etc., **Imagem URL** para o cabeçalho e botão **CLIQUE AQUI**.

**Editar botão** → *Rótulo do botão* + *Quando este botão é pressionado*: Enviar Mensagem · Abrir site · Telefonar · Executar ação · Iniciar Outro Fluxo · Iniciar Outra Etapa · Iniciar Etapa Externa.

### 14.6 Escalar atendimento (Aula 06)

Demonstração de fluxos de produção com dezenas de blocos ramificados (triagem → atendimento → pós) e uso de blocos de **Ação com Google Sheets** (saídas Sucesso/Falha) gravando os dados do atendimento na planilha do cliente. A mensagem: escala vem de estruturar ramificações e integrações, não de um fluxo linear gigante.

### 14.7 Agente de IA para Social Mídia (Aula 07)

Como automatizar **comentários e direct do Instagram/Facebook** com dois agentes distintos.

**Agente "BIA — NEXTAGS SOCIAL MEDIA (Comentários IG/FB)"** — estrutura do prompt usada na aula:

```
# PROMPT — BIA | NEXTAGS SOCIAL MEDIA (Comentários IG/FB)

## IDENTIDADE
Você é a **Bia**, social media da **Nextags**. Sua função é responder **comentários públicos**
em posts do **Instagram e Facebook** da Nextags, transformando engajamento em oportunidade
de venda OU filtrando dúvidas de suporte pro privado.

**Posicionamento da Nextags**: CRM de conversas com IA. Centraliza WhatsApp, Instagram,
Messenger, TikTok e Webchat em um único painel, com agentes de IA que atendem, vendem e
automatizam fluxos 24/7. Slogan: "Se tem conversa, tem Nextags".

**Tom**: leve, próximo, simpático, com energia de comunidade. Você é a voz da marca
conversando publicamente. **Não é vendedora insistente nem SAC.** Pense em comentários reais
de Instagram, não em atendimento formal.

## CONTEXTO QUE VOCÊ RECEBE
| Variável | Significado |
...
```

**Configuração do modelo (painel lateral do agente):** Modelo (OpenAI) **GPT-5 mini** · Temperatura **0.4** · Max tokens **32768** · Reasoning effort **Média** · Verbosity **Baixa**. Ferramentas de IA acopláveis ao agente: `connect_user_to_human`, `Image Reader`, `Document Reader`.

**Onde ligar (Ferramentas):** o menu Ferramentas traz *Automações de Comentários do Facebook · Automações de Comentários do Instagram · Automações de Histórias do Instagram · Automação de anúncios de leads · Acionadores e Ações · Sequências de Mensagens · Links de pontos de entrada · Magic Links · Gerador de Código QR*.

**Tela de configuração da automação de comentários:**

| Campo | Opções |
|---|---|
| Acompanhar comentários em | Todas as publicações · Postagem específica |
| Envie mensagem privada com | AI Agent · Texto · Fluxo · Nenhum |
| Responder ao comentário com um comentário público | AI Agent · Texto · Fluxo · Nenhum |
| Responder a | Todos os comentários · Comentários iguais a · Comentários que contêm |

O padrão da aula é **dois agentes separados**: `IG - Comentários` no comentário público (resposta curta, tom de comunidade) e `IG - Mensagem no privado` no direct (venda/suporte). Em *Mais Opções* ficam os filtros extras (responder só a novos contatos, uma vez por usuário, curtir o comentário etc. — seção 10).

### 14.8 Transacionais na prática (Aula 08)

Pasta de fluxos **AULA TRANSACIONAIS** com quatro fluxos que espelham o ciclo do pedido:

| Fluxo | Papel |
|---|---|
| `Pedido enviado` | dispara o HSM de utilidade "Seu pedido está no caminho!" |
| `Pedido Aprovado` | confirmação de compra |
| `Principal - chuveirinho` | fluxo distribuidor que recebe o gatilho e ramifica |
| `Pedido entregue` | pós-entrega |

O template de utilidade traz botões **VER RASTREIO** e **Preciso de ajuda**; cada botão cai num Enviar Mensagem e o de ajuda encerra em **Transferir conversa para humano**. Fluxos transacionais ficam com o toggle de **Caixa de Entrada desligado** — quem os aciona é a integração/API, não o cliente digitando.

### 14.9 Integração (Aula 09)

Sessão de mentoria/perguntas com o time de integrações, sem demonstração de tela: use como referência a seção 12 (prazo de até 10 dias úteis, o que o time conecta) e a chave de API da seção 10.

---

## 15. Índice de artigos por área

Base: `https://ajuda.nextags.com.br/` — adicione `.md` a qualquer URL para ler em Markdown. Áreas: `/dashboard/`, `/caixa-de-entrada/`, `/contatos/`, `/fluxos-de-conversa/`, `/campos-personalizados/`, `/ia-hub/`, `/whatsapp/`, `/configuracoes/`, `/facebook-instagram/`, `/ferramentas/`, `/implementacao/`. O índice completo com todos os títulos e URLs está em `https://ajuda.nextags.com.br/llms.txt`. Curso Partner: `https://aulas.nextags.com.br/curso/5964`.

---

## 16. Complemento da central — variáveis que faltavam na seção 3

Fonte: `campos-personalizados/campos-personalizados-campos-do-sistema-e-entrada-do-usuario.md` (o artigo mais longo da central, sem vídeo — é texto puro). A seção 3 acima já traz as mais usadas; estas completam a lista oficial.

**Os três tipos de campo (nomenclatura oficial):**

- **Campos do sistema** — coletados automaticamente (nome, sobrenome, e-mail); servem para personalização imediata.
- **Campos da conta** — guardam configurações e preferências do bot (é aqui que mora o campo texto longo de 16 milhões de caracteres, ideal para o prompt).
- **Campos de usuário personalizados (CUFs)** — dados únicos do contato, criados por você.

> Nem todos os CUFs aparecem nos menus suspensos da plataforma (são muitos), mas **todos os listados na documentação funcionam** onde quer que você os escreva no fluxo.

**Contato / conta — complementos:**

| Variável | O que traz |
|---|---|
| `{{gender}}` | Gênero do contato |
| `{{locale}}` | Locale completo (ex. `en_US`) — idioma + região |
| `{{locale2}}` | Locale abreviado (ex. `en`) — só o idioma |
| `{{username}}` | Nome de usuário do Instagram |
| `{{profile_pic}}` | URL da foto de perfil |
| `{{user_code}}` | Código único do contato para rastreio interno |
| `{{user_hash}}` | Hash único do contato (rastreio seguro entre plataformas) |
| `{{fb_chat_link}}` | Link direto para a conversa no Messenger |
| `{{webchat}}` | Link de webchat compartilhável, aceita payload |
| `{{me}}` | Link para o contato ver/excluir os próprios dados (LGPD/GDPR) |
| `{{last_order}}` | Detalhes do último pedido (bots transacionais/e-commerce) |
| `{{last_points}}` | Última pontuação de quiz — recomendam gravar num CUF após cada conclusão |

**Facebook/Instagram — complementos:** `{{page_user_name}}` (nome do usuário que fala pelo Messenger) · `{{total_new_tagged}}` (marcados no comentário que **não** estão na sua base — só Facebook) · `{{total_tagged}}` (contagem de marcações — só Facebook).

**Carrinho — complementos:** `{{cart_last_item_quantity}}` · `{{cart_other_fees}}` · `{{cart_shipping_cost}}`.

**Pedido — lista completa dos complementos:** `{{order_coupon_discount}}` · `{{order_discount}}` · `{{order_taxes}}` · `{{order_subtotal}}` · `{{order_email}}` · `{{order_name}}` · `{{order_phone}}` · `{{order_shipping_address1}}` · `{{order_shipping_address2}}` · `{{order_shipping}}` (bloco completo) · `{{order_date_utc}}` · `{{order_date_timestamp}}` · `{{order_date_account_timezone}}`.

**Produto (usado com gatilhos "Produto Pedido", "Produto adicionado ao carrinho", "Produto removido do carrinho"):** `{{product_name}}` · `{{product_quantity}}` · `{{product_id}}`.

**Criar campo personalizado — caminho exato da tela:** entrar na conta → **Fluxo** → **Campos Personalizados** → **Adicionar** → definir **Nome**, **Tipo** e **Descrição** → **Continuar**. A tela também mostra a **análise de preenchimento** de cada campo, ou seja, com que frequência aquele dado está sendo realmente capturado na base — use isso para descobrir campo que ninguém preenche.

---

## 17. Complemento da central — detalhes por área que não estavam mapeados

Nenhum item abaixo substitui as seções 1–15; são acréscimos vindos da varredura completa dos 45 artigos.

### 17.1 Meta Business Suite (área `facebook-instagram`)

O artigo cobre a navegação do Business Suite pelo lado da Meta, não da NexTags:

- **Configurações da empresa** — onde fica a **verificação da empresa**, que é o que aumenta o limite de mensagens e dá mais segurança à conta.
- **Usuários** — gerenciar *pessoas*, *parceiros* e *usuários do sistema* (é aqui que se dá acesso a agência/parceiro).
- **Contas** — centraliza páginas do Facebook, contas do Instagram e, principalmente, as **contas de WhatsApp vinculadas ao portfólio**; é onde se confere o status da conta.

### 17.2 Integrações de IA (área `configuracoes`)

- **OpenAI:** Configurações → Integrações → OpenAI. Gerar a chave no site da OpenAI, dar um nome a ela, copiar e colar na NexTags. Na própria NexTags dá para ajustar a **temperatura** da IA. O faturamento é por tokens: **cadastrar cartão na OpenAI** é obrigatório para o serviço não parar, e lá mesmo se acompanha o histórico de consumo.
- **Google Gemini:** Configurações → Integrações → Google Gemini. Gerar a chave logando na conta Google, copiar e colar na NexTags. O faturamento é configurado no **Google Cloud** (cartão ou outra forma de pagamento) — sem isso a cobrança de tokens não passa.
- O artigo "Como configurar a IA para atendimento" lista os provedores compatíveis como **OpenAI, Google Gemini, Cloud (Claude), XAE (xAI) e DeepSeek** — a grafia no texto original é essa; leia como Claude e xAI.
- Sequência recomendada no artigo: obter chave → inserir → ajustar configurações → **configurar faturamento** → criar **agentes** (propósito e perfil da IA) → usar **acionadores** para executar fluxos → criar **assistentes** para focar a IA em áreas específicas (comercial, suporte).

### 17.3 Cobrança por contatos (área `configuracoes`)

- A tabela oficial fica em **`nextags.com.br/valores`** — nunca cite valor de memória.
- Lógica: **o preço por mil contatos cai conforme a base cresce** (quanto mais volume, mais barato o mil).
- **Prorrogação:** ao estourar uma faixa no meio do mês, o sistema calcula **por dia** a diferença da faixa nova e lança na fatura. Se você atravessar **mais de uma faixa no mesmo período, mais de uma cobrança de prorrogação** pode ser lançada.

### 17.4 Chave de API da NexTags

Além do que a seção 10 já diz: o botão **Saber Mais** abre a documentação com as rotas de **conta, contato e pipelines**, e a própria documentação permite **testar a chave ali mesmo** — o exemplo do artigo é uma requisição de dados de um contato para confirmar que a conexão responde.

### 17.5 Instagram e Messenger como canal

- **Instagram:** a conexão passa pela conta do Facebook vinculada e exige **localizar o ID da página** no Facebook e colar na NexTags — é o passo em que a maioria trava.
- **Messenger:** Configurações → conectar página → **aceitar as permissões de acesso** → escolher qual página vincular.

### 17.6 Fluxos — detalhes finos

- **Adquirir Dados:** dá para definir o **tipo da resposta** (ex. `número` para CNPJ) e uma **mensagem de erro** exibida quando o cliente digita em formato inválido. Exemplo do artigo: etiquetar o contato como "nacional" ou "estrangeiro" conforme o botão clicado e, na sequência, pedir o CNPJ e gravar no CUF.
- **Etiquetas:** podem ser criadas já dentro de uma pasta, aplicadas **durante a importação**, usadas como **filtro na área de Contatos** e lidas pelo bloco **Condição** para abrir caminhos diferentes por grupo.
- **Fluxo de boas-vindas com IA:** no bloco **OpenAI** você escolhe o modelo (os exemplos da central citam GPT-4 mini e 5.1 mini), define **de onde a IA busca a informação** e **em que campo salva a resposta**. O padrão recomendado é **híbrido**: botões do chatbot direcionam para a área (ex. vendas) e só a partir dali a IA assume. Funções acopláveis ao agente — como **transferir para humano** — entram nesse mesmo bloco. Testar antes de publicar.
- **Modelos de mensagem no fluxo:** o HSM é a **primeira interação** que abre a janela; incluir **botões** é o que provoca a resposta do cliente e mantém o fluxo andando sem interrupção.

### 17.7 Caixa de entrada — detalhes finos

- **Card do cliente:** além de dados, pipeline, notas, mídias, etiquetas e "Ver Ações", o card também expõe **Sequências**.
- **Notas:** ficam com registro de **quem adicionou, data e horário**.
- **Ver Ações:** histórico de transferências entre atendentes, arquivamentos e bloqueios — é o lugar para auditar "quem mexeu nesse atendimento".
- **Envio de arquivos:** ícone **Anexar Arquivo**, que aceita fotos, vídeos, documentos e **catálogos**. A **Biblioteca de Mídia** permite subir **várias fotos de uma vez**. O uploader trabalha com **5 MB para fotos e 20 MB para vídeos e documentos**, mas quem manda na entrega é a tabela por canal da seção 9.
- **Filtros:** o filtro "sem resposta do administrador" significa **nem bot nem humano responderam** — é o filtro de fila abandonada.
- **Respostas salvas:** o nome é um **atalho** (ex. "Pix"); o texto pode ser complementado dentro da conversa antes de enviar.

### 17.8 Implementação — regras de atendimento que não estavam na seção 12

O guia de implementação também fixa **regras gerais de atendimento** com o cliente:

- limite de tolerância para atraso em reuniões;
- **acesso obrigatório por desktop** durante as reuniões;
- **conversas centralizadas no grupo** do cliente;
- **informar previamente o assunto** de cada reunião.

E fecha o ciclo da **integração avançada**: até **10 dias úteis** após o envio de copies e acessos, incluindo criação dos fluxos automatizados, **testes de disparo** e **entrega final no grupo do cliente**. Cada tipo de demanda tem SLA próprio (detalhado só no vídeo).

---

## 18. Índice completo dos 45 artigos da central + vídeos

Todos abrem em Markdown puro acrescentando `.md` à URL. Base: `https://ajuda.nextags.com.br/`. O `id` é o final de `https://www.loom.com/share/<id>`.

| Área | Artigo (slug) | Vídeo Loom |
|---|---|---|
| — | `central-de-ajuda-nextags` (boas-vindas) | sem vídeo |
| Dashboard | `dashboard/visao-geral-conheca-o-dashboard-da-nextags` | `9e0866b9334b4446aac08f5b5a118d56` |
| Campos | `campos-personalizados/campos-personalizados-campos-do-sistema-e-entrada-do-usuario` | sem vídeo (texto completo) |
| Meta | `facebook-instagram/visao-geral-do-meta-business-suite-e-como-ele-se-integra-a-nextags` | `881d220090214aed8628a23b9f7a3a78` |
| Config | `configuracoes/visao-geral-conheca-a-area-de-configuracoes-da-nextags` | `0db2eb654cee4ddb8e48b9e3d38edd2e` |
| Config | `configuracoes/tipos-de-arquivos-e-limites-nos-canais` | sem vídeo (tabela completa) |
| Config | `configuracoes/como-configurar-o-instagram-como-canal-de-atendimento-na-nextags` | `af67a5d79b2c46de991952df6feaf729` |
| Config | `configuracoes/como-conectar-o-facebook-messenger-na-nextags` | `bb9fc80e05fd43f697c3c1482b692917` |
| Config | `configuracoes/como-gerar-e-usar-uma-chave-de-api-na-nextags` | `4629af0cc77c4bcc92c34e91f869cf8a` |
| Config | `configuracoes/como-conectar-a-api-do-openai-chatgpt-na-nextags` | `310c0ac4516b44a7b809cc93df9b36fc` |
| Config | `configuracoes/como-gerar-a-chave-de-api-e-configurar-o-faturamento-do-google-gemini` | `51a332df9f324be5ab8bde0ba8c2c9f7` |
| Config | `configuracoes/entenda-a-cobranca-da-nextags-por-numero-de-contatos-e-a-prorrogacao-de-valores` | `8798d4be428d40208322e66c596c1114` |
| Config | `configuracoes/como-configurar-a-inteligencia-artificial-para-atendimento-na-nextags` | `701cb33a37b843f28beb44085b008023` |
| Contatos | `contatos/como-gerenciar-contatos-e-importar-listas-na-nextags` | `138cae6aa4344e45adead215f7b3e74b` |
| Ferramentas | `ferramentas/como-automatizar-comentarios-no-facebook-e-instagram-na-nextags` | `db1049a2fbe745c5aa746eb770517bcf` |
| WhatsApp | `whatsapp/como-conectar-o-whatsapp-business-api-oficial-na-nextags` | `b252b2dab1184ef69c78fa2f917113a2` |
| WhatsApp | `whatsapp/como-instalar-o-whatsapp-coexistente-na-nextags` | `f075ba9bde194f0abb2909e06cf431a5` |
| WhatsApp | `whatsapp/como-verificar-sua-conta-no-gerenciador-do-whatsapp-business` | `24400af1b2d94b9a9494bd1b57412ca4` |
| WhatsApp | `whatsapp/visao-geral-conheca-o-gerenciador-do-whatsapp-business` | `407cc2361ae349e9832d2b1ff4e83d61` |
| WhatsApp | `whatsapp/como-criar-modelos-de-mensagem-do-whatsapp-na-meta-e-usa-los-na-nextags` | `f64a38305b8c4c09ad485a4b7004cf33` |
| WhatsApp | `whatsapp/janela-de-atendimento-do-whatsapp-entenda-a-janela-de-24-horas-e-os-custos` | `9a3b5b3ad14f4806b03b7239c8fded38` |
| WhatsApp | `whatsapp/como-analisar-e-avaliar-os-disparos-de-broadcast-e-seus-custos` | `21e8eff2ee2f444db758ba8540766ed8` |
| WhatsApp | `whatsapp/boas-praticas-do-whatsapp-dicas-para-manter-a-qualidade-da-sua-conta` | `854eb506e47546be9762adf13f43805d` |
| Fluxos | `fluxos-de-conversa/visao-geral-guia-completo-da-area-de-fluxos-de-conversa` | `f732985592534dde8c84916ab2a5ed10` |
| Fluxos | `fluxos-de-conversa/como-criar-e-gerenciar-campos-personalizados-na-nextags` | `02abe9d0657d474a8402cc1997ac52bf` |
| Fluxos | `fluxos-de-conversa/como-usar-etiquetas-e-campos-personalizados-em-fluxos-de-conversa` | `bb93ab8cb22d4ad28e3a00c4e897d936` |
| Fluxos | `fluxos-de-conversa/como-organizar-fluxos-etiquetas-e-campos-em-pastas` | `305366fc65f84063997a3a744c437b89` |
| Fluxos | `fluxos-de-conversa/como-criar-e-usar-etiquetas-para-segmentar-seus-contatos` | `d5edcf350eab48158bc6382e11c816f3` |
| Fluxos | `fluxos-de-conversa/como-usar-modelos-de-mensagem-em-fluxos-de-conversa-na-nextags` | `a313b421a7f84d5da571135015b2c377` |
| Fluxos | `fluxos-de-conversa/como-criar-um-fluxo-de-boas-vindas-e-recepcao-de-clientes-sem-ia` | `80ccbb3698364c689a9a1c727d1abcab` |
| Fluxos | `fluxos-de-conversa/como-criar-um-fluxo-de-atendimento-rotativo-para-sua-equipe` | `7ff55c2396b0498ebcb1cdbbf7ce3ea8` |
| Fluxos | `fluxos-de-conversa/como-criar-um-fluxo-de-boas-vindas-com-ia-na-nextags` | `577fcc12aec74b5db2d7bb8490edabf0` |
| Fluxos | `fluxos-de-conversa/guia-completo-da-area-de-broadcast-disparo-de-mensagens-e-analise-de-resultados` | `83f0e0f861d64e37a62251ec010b681f` |
| Caixa | `caixa-de-entrada/guia-completo-visao-geral-da-caixa-de-entrada-da-nextags` | `3a917cc7ef9d4c389687cda5be3ccaf9` |
| Caixa | `caixa-de-entrada/visao-geral-conheca-o-card-do-cliente-e-suas-funcionalidades` | `f11f08e1315749b989dec8425cfc65ed` |
| Caixa | `caixa-de-entrada/como-enviar-arquivos-na-nextags-fotos-videos-e-documentos` | `d1df16b651744c9c8ce92e2adfbe3bb7` |
| Caixa | `caixa-de-entrada/como-criar-e-usar-respostas-salvas-na-nextags` | `e84cd4bf6f994ecfbc0cd629acc911b1` |
| Caixa | `caixa-de-entrada/como-enviar-modelos-de-mensagem-na-caixa-de-entrada-da-nextags` | `7c4a5413494c4ffab8768c1bd3bfdae6` |
| Caixa | `caixa-de-entrada/como-adicionar-um-novo-contato-na-caixa-de-entrada-da-nextags` | `594acd5a37824c639f8677a96dc75fce` |
| Caixa | `caixa-de-entrada/como-usar-os-filtros-da-caixa-de-entrada-para-otimizar-o-atendimento` | `cee46e0a580844b58e6c379313adb9ef` |
| Caixa | `caixa-de-entrada/como-usar-as-opcoes-de-atendimento-na-caixa-de-entrada-bot-humano-e-todas` | `d3da4f1b05934df69364084b92469e02` |
| IA Hub | `ia-hub/visao-geral-conheca-a-area-de-ia-hub-da-nextags` | `9f748512941448bfa4c90cee81abfef8` |
| IA Hub | `ia-hub/como-criar-um-prompt-de-ia-eficiente-guia-completo` | `47adc9d2164247fcbdd5d822f46da2fa` |
| IA Hub | `ia-hub/json-agente-para-respostas-visualmente-mais-elaboradas` | sem vídeo (texto completo) |
| Implantação | `implementacao/guia-completo-de-implementacao-nexttags-etapas-conexoes-suporte-e-boas-praticas` | `5c2160a277cf40a58a5db1cbceecc622` |

**Os três artigos sem vídeo são os únicos 100% textuais da central** — campos personalizados, tabela de arquivos por canal e JSON Agente. Todo o resto tem o passo a passo clique-a-clique apenas no Loom, e é aí que mora a limitação avisada no topo desta skill.

---

## 19. O que só existia nos vídeos — passo a passo de tela

As seções 1 a 18 vieram do texto dos artigos. Esta seção fecha a lacuna anunciada no topo: é o conteúdo falado e demonstrado nos 41 vídeos Loom da central, transcrito e destilado. Quando houver conflito, o vídeo mostra a tela real; o artigo é só o resumo.

### 19.1 Dashboard

- No topo ficam os canais configurados, cada um com **Testar Agora** — gera um **QR Code** e um **link copiável** que leva direto à conversa com aquele canal. É o jeito rápido de dar um link de atendimento para o cliente. Ao lado fica **Mais canais**, atalho para instalar outro canal.
- Filtro de data: faixa personalizada · todos os períodos · mês passado · este mês · últimos 30 dias · últimos 7 dias · ontem.
- Painéis que a seção 11 não lista: **o horário em que os contatos entram** · tempo médio de primeira resposta **por administrador** (uma cor por admin) · **duração média da conversa** · **conversas únicas por administrador** (falou uma vez e não teve continuidade) · conversas de acompanhamento (as favoritadas), arquivadas e bloqueadas · **contatos por país** e novos contatos por país · novos contatos por fonte (importado, mensagem de entrada, ads, direto, webchat).

### 19.2 Meta Business Suite — o caminho real

Atalho: NexTags → **WhatsApp** → *Análise* → cai no Gerenciador do WhatsApp → menu do canto → **Configurações**.

- **Configurações do portfólio:** lista as pessoas e o tipo de controle de cada uma; **Informações da empresa** (sites, CNPJ e o **status da verificação**); **Histórico da empresa exportável** — relatório de quem fez o quê dentro do portfólio; limite de criação de contas; quem está logado agora.
- **Usuários:** pessoas · **parceiros** (atribuir e retirar atribuições — é aqui que a agência entra) · usuários do sistema.
- **Contas:** páginas do Facebook · contas de anúncio · grupos · apps · **contas do Instagram vinculadas** · **contas de WhatsApp do portfólio**, com verificação de empresa, status da conta, configurações de pagamento e atalho para o Gerenciador do WhatsApp.

### 19.3 Configurações — o que o overview mostra a mais

- O campo do fluxo de recepção aparece na tela como **fluxo de fallback**.
- Gerais também têm: país, fuso, **cor da empresa** (deixa os botões alinhados à marca), **modo desenvolvimento** (só administradores interagem com o bot enquanto você constrói), excluir conta, renomear conta, trocar o logotipo, **user ID e account ID**.
- Integrações citadas na tela, além das IAs: chave de API da NexTags, **rastreamento de conversões do Facebook**, Google Sheets, **WooCommerce** e **ActiveCampaign**.
- **Administradores:** Adicionar → escolher **superadministrador** (acesso a tudo) ou marcar só as áreas → Continuar → o sistema **gera um link de convite** que a pessoa acessa e entra por Google, Facebook etc. Na mesma área ficam as **Equipes de caixa de entrada**, para agrupar admins por time.
- **Customizações → Traduções:** você **carrega um documento** que substitui os textos exibidos pelo sistema — serve para outro idioma ou só para trocar o vocabulário.
- **Opt-out:** quem escreve **STOP** ou **unsubscribe** para de receber transmissões; **start**/**subscribe** reinscreve. Dá para trocar essas palavras por outras via acionadores e fluxos.
- A área de **E-commerce** (catálogo + carrinho para quem não tem site) segue **em desenvolvimento**.

### 19.4 Conectar Instagram e Messenger

**Instagram:** Dashboard → *Mais Canais* (ou Configurações → Canais → Instagram) → **Conectar** (ou *Reconectar* se já houve conexão) → login do Facebook onde está a página → ele pede o **ID da página do Facebook**. Onde achar: BM → **Páginas** → escolher a página → **Ver no Facebook** → **Sobre** → **Transparência da página** → copiar o ID → colar na NexTags → Continuar.

**Messenger:** Dashboard → *Mais canais* → **Facebook Messenger** → **Conectar** → Iniciar sessão no Facebook → escolher entre **"todas as páginas atuais e futuras"** ou **"apenas as páginas atuais"** → selecionar a página → Continuar → revisar as permissões que o sistema pede → **Salvar**.

### 19.5 Chave de API — como testar antes de entregar ao dev

Configurações → **Integrações** → *Chave de API da NexTags AI* → o campo vem vazio → **Gerar**. Serve para Shopify, Bling e afins.

Para validar sem escrever código: **Saber Mais** abre a documentação → botão **Authorize** → colar a chave no campo **Value** → Authorize de novo → fechar no **X** → escolher um endpoint (ex. contato) → **Try out** → informar um ID → **Execute**. **Código 200 = conexão autorizada** e devolve os dados do contato. A doc tem rotas de conta, contato, pipelines e e-commerce.

### 19.6 Conectar as IAs — números que só aparecem no vídeo

**OpenAI:** Configurações → Integrações → OpenAI → Conectar. A chave sai em *Create an OpenAI API key* → login → **Create new secret key** → nomear (a recomendação da NexTags é `NexTags + nome da empresa`; esse nome não aparece para o cliente) → copiar → colar. Em **Mais opções**: escolher o modelo (o vídeo usa GPT-4o mini), **temperatura entre 0,5 e 0,7** — abaixo disso ela não flui, acima começa a alucinar — e **zerar o máximo de tokens de saída**. Faturamento: a OpenAI trabalha por token (**1 milhão de tokens ≈ 750 mil palavras**), exige **cartão que aceite cobrança em dólar**, e a tela de billing se acha por *API Reference* → busca **payment**.

**Gemini:** Configurações → Integrações → Google Gemini → Conectar. A chave sai no **Google AI Studio → Criar chave de API** (se já houver projeto, ele pede para escolher) — **copie antes de fechar a janela**. Depois de colar, **atualize a tela** da NexTags para o botão **Configurar faturamento** aparecer; ele leva ao **Google Cloud**, onde entram dados de contato, organização/CNPJ e forma de pagamento.

**Regra geral das cinco IAs:** colar a chave → **Mais opções** → modelo → temperatura 0,5–0,7 → limpar o máximo de tokens → Continuar → **configurar o faturamento** → criar o **agente** → criar os **acionadores** → (na OpenAI) criar **assistentes**. O vídeo define os três: o **agente é o cérebro** (nome, perfil, propósito, exemplos de conversa); o **acionador** é o gatilho que a IA dispara quando entende a intenção (ex.: cliente pede foto do produto → a IA aciona o fluxo de fotos); o **assistente** é um agente focado numa área — comercial, suporte, uma promoção específica.

### 19.7 Cobrança — o exemplo numérico do vídeo

Valores citados na gravação (⚠️ **sempre confira `nextags.com.br/valores`, a tabela muda**): 2.500 contatos **R$ 147** · 5.000 contatos **R$ 267** · 10.000 contatos **R$ 397** — e o custo por mil caindo (≈ R$ 58,80 → R$ 53,40 → R$ 39,70). Ou seja: a mensalidade sobe, mas **o preço por mil contatos desce**.

Prorata, o exemplo da tela: você está na faixa de 2.500 (R$ 147) e no **dia 22** a base chega a 2.700. O sistema faz `147 ÷ 30 × 21 dias` + `267 ÷ 30 × 9 dias`, subtrai os R$ 147 já pagos (a ferramenta é **pré-paga**) e lança a diferença — no exemplo, **R$ 27,10 no próprio dia 22**. No mês seguinte cobra os R$ 267 cheios. Estourar duas faixas no mesmo mês gera **duas prorratas**.

### 19.8 Contatos e importação — as dicas de tela

- **Dica de ouro do vídeo:** não baixe o CSV do Excel. Suba a planilha no **Google Drive** e baixe de lá como *CSV separado por vírgulas* — o Excel gera variações de CSV que quebram o mapeamento; o Drive só gera um formato.
- Todas as colunas com cabeçalho.
- Na tela de importação: **Fonte** (ex. WhatsApp) e **código do país +55** — ele **adiciona o +55 em quem não tem e apenas confere em quem já tem**.
- Mapear coluna a coluna (número, e-mail, nome, sobrenome); o que não existir fica com tracinho.
- **Mais opções:** aplicar etiqueta já na importação **e** mapear campos personalizados — mas os campos precisam **existir antes**.
- Ações em massa, lista completa da tela: atribuir conversas ao administrador · adicionar etiqueta · definir campo personalizado · excluir · exportar · importar · e em **Mais opções**: remover etiqueta · limpar campo personalizado · transferir conversa para humano · transferir para bot · arquivar · **inscrever para receber transmissões** · **cancelar assinatura de todas as transmissões**.

### 19.9 Automação de comentários — a tela inteira

Ferramentas → *Automações de Comentários* (Facebook ou Instagram — funcionam igual) → **Criar novo** → nomear → Continuar.

- **Todas as publicações** ou **Postagem específica** (ao escolher, aparece o seletor de posts e depois um botão **Ver postagem** para conferir que é o post certo).
- **Mensagem privada:** Texto ou **Fluxo** (o padrão da NexTags é jogar num fluxo que recepciona o lead).
- **Resposta pública:** uma ou **várias respostas** cadastradas — o sistema **alterna entre elas** para não repetir o mesmo texto embaixo de todos os comentários.
- **Responder a:** todos os comentários · comentários **iguais a** · comentários que **contêm**. O vídeo recomenda **contém** com todas as letras: se você pede "digite AMEI" e a pessoa escreve "eu amei", o *iguais a* não dispara.
- **Ocultar comentários** por palavra-chave, adicionadas uma a uma (ex. reclamações de preço).
- Opções finas: responder apenas a **novos contatos** · **apenas uma vez por usuário por postagem** · **curtir o comentário** · responder a usuários que já comentaram em **outras postagens** · **não responder às respostas do seu próprio comentário** (senão o fluxo reentra à toa) · **rastrear se o usuário marca outros usuários**.
- **Tempo de resposta:** imediatamente · após X segundos/minutos/horas · **aleatório dentro de um intervalo**. O aleatório é o truque de humanização: entre quatro comentários chegados em 3 minutos, ele responde um em 15s, outro em 1min, outro em 2min.
- **Salvar**.

### 19.10 WhatsApp API oficial — clique a clique

Mais canais (ou Configurações → Canais) → WhatsApp → **Conectar** → **Continuar sem marcar nenhuma das opções** → pop-up da Meta → Continuar → Começar → **selecionar o portfólio** → Avançar → escolher a opção de baixo, **"um novo número de telefone"** → deixar em *criar uma conta e criar um novo perfil* → **nome da conta WAB** (só identificação interna — o vídeo sugere `Nome da empresa - NexTags`, para você saber qual é o provedor) → **nome de exibição** (esse o cliente vê) → **categoria** (e-commerce: *Compras e varejo* ou *Roupas e acessórios*; há *Beleza, spa e salão*) → Avançar → **adicionar um novo número** → método: **SMS** para linha móvel, **ligação** para linha fixa (SMS não chega em fixo; em linha móvel dá para pedir ligação também) → Adicionar número → Avançar → **Concluir**.

Sobre o número de teste da Meta: vem com prefixo **+1 555**, fica com cara de número internacional e **não serve para disparo**. O recomendado é comprar um chip dedicado.

### 19.11 WhatsApp Coexistente — clique a clique e o risco real

Mais canais → WhatsApp → Conectar → **Continuar** (a mesma tela também oferece *remover o acesso de outro parceiro e trazer a conta existente* e *transferir de outro provedor*, ex. Dialog) → pop-up da Meta → selecionar portfólio → Avançar → escolher **Coexistente** → Avançar → informar o número → aparece o **QR Code** e chega uma **mensagem da Meta no aparelho** → abrir a mensagem → **"Conecte-se à plataforma do WhatsApp Business"** → escolher **compartilhar todas as conversas** → confirmar → ler o QR Code → escolher o fuso → Avançar → Continuar → Concluir.

**O problema concreto do coexistente:** o token cai com frequência e a sincronia se perde. Sintoma: chega mensagem no app do celular e **não** chega na ferramenta. Solução: desconectar o número da NexTags e conectar de novo. Por isso ele serve para receptivo, não para disparo.

### 19.12 Verificação da conta — caminho exato

NexTags → **WhatsApp** → clicar em qualquer um dos itens → abre o Gerenciador do WhatsApp → menu do canto esquerdo → **Configurações** → aguardar carregar → **Contas do WhatsApp** → selecionar a conta → **Verificar a empresa** → seguir o passo a passo da Meta. Sem verificar, o número **fica preso em 250/dia por muito mais tempo** e o escalonamento é bem mais lento.

### 19.13 Gerenciador do WhatsApp — detalhes da tela

- Atalhos dentro da NexTags (menu WhatsApp): **Análise · Modelo de mensagem · Método de pagamento · Histórico** — todos caem no Gerenciador; de qualquer um dá para ir a *Visão geral*.
- A **Visão Geral** mostra alertas (ex. forma de pagamento não cadastrada) e, por número, o **limite de conversas por dia** e a **classificação de qualidade**.
- A cobrança é **sempre por mensagem entregue**.
- **Perfil:** foto, nome, telefone, endereço (opcional), e-mail, sites, **certificado**, automações, link de mensagem, categorias, descrição e o **nome de exibição** — que pode ser reprovado; usar o nome do site facilita a aprovação, e as regras ficam na ajuda da Meta.

### 19.14 Criar HSM — os truques que só estão no vídeo

- **Escreva a copy antes**, fora da Meta, e cole — o vídeo trabalha com o texto pronto no editor ao lado.
- Criar modelos → categoria **Marketing / Utilidade / Autenticação**; tipo **Padrão** (as outras são *Flow* e *Solicitação de permissão para ligação*) → Avançar.
- Nome do modelo · idioma **Português (BR)** · **Tipo de variável: Número** — a NexTags sempre trabalha com variável numérica, nunca nomeada.
- **Truque da mídia:** se o cabeçalho for imagem, suba uma **imagem genérica só para a aprovação** (o vídeo usa uma ampulheta). O campo volta vazio e a imagem real é carregada dentro da NexTags na hora de usar.
- **Cabeçalho de imagem e cabeçalho de texto ocupam o mesmo espaço** — se usar imagem, o de texto some.
- Inserir variável: botão *Adicionar variável* (ela nasce no fim do texto, você recorta e cola no lugar certo) **ou simplesmente digitar `{{`**, que a plataforma completa. É o caminho mais rápido.
- **Amostras das variáveis são obrigatórias**; a **prévia à direita atualiza conforme você digita**.
- Boa prática: deixar **a última frase também como variável**. O modelo fica genérico, passa mais fácil como Utilidade e você reescreve o final dentro da NexTags sem precisar de novo modelo.
- **Enviar para análise** → status *Em análise* → **atualizar o navegador** para ver mudar para *Ativo — qualificado*. Se reprovar, a tela indica e você volta a ajustar a copy para caber em Utilidade.
- **Usar no fluxo:** bloco Enviar Mensagem → *Adicionar conteúdo* → **WhatsApp → Modelo de mensagem** → escolher → mapear cada variável pelo **ícone preto `< / >`** que lista os campos do sistema (ex. `{{1}} → first_name`) → carregar a imagem (vira URL) → **Publicar**.
- **Usar na caixa de entrada:** três pontinhos → **Enviar fluxo** (manda o fluxo inteiro já preenchido) ou **Modelo de mensagem** (permite trocar a imagem e reescrever as variáveis na hora, mensagem a mensagem).

### 19.15 Janela de 24h — como enxergar e quanto custa

- **Janela aberta:** o campo de digitação aceita texto e todos os ícones (áudio, anexo, emoji) ficam disponíveis.
- **Janela fechada:** ao passar o mouse sobre o campo aparece o **sinal de proibido em vermelho**, e o sistema escreve que **o usuário ficou inativo por mais de 24 horas**.
- Reabrir: três pontinhos → enviar um **fluxo cujo primeiro bloco é um HSM**, ou o **Modelo de mensagem** direto (preenchendo imagem e variáveis).
- A janela só abre **quando o cliente responde**. Cada resposta dele renova outras 24h — quanto mais ele conversa, mais tempo aberto.
- Custos citados no vídeo, cobrados **em dólar** (⚠️ tabela da Meta muda por região e período — confira antes de orçar): **Autenticação US$ 0,068 · Marketing US$ 0,0625 · Utilidade US$ 0,068 · Serviço: sem custo**. O cartão cadastrado na Meta precisa **aceitar cobrança em dólar**.
- Ver a categoria de um modelo: NexTags → **WhatsApp → Modelo de mensagem** (lista nome + categoria), ou **Links úteis → Modelo de mensagem** para abrir no Gerenciador.
- Depois que a janela abriu, mandar mensagem **não é cobrado** — o HSM só é cobrado quando não há interação.

### 19.16 Construtor de fluxos — o que a tela oferece de verdade

- O bloco Enviar Mensagem tem seletor de canal: **omnichannel** (todos) ou um canal específico.
- **Adicionar conteúdo**, lista completa: texto · imagem · **cartão** · **adquirir dados** · vídeos · **lista de opções** · modelos de mensagem · **digitando** · arquivos · ações · **fluxo do WhatsApp** · **ver catálogos** · **enviar produtos** · **localização**.
- Blocos do botão azul **+**: **Iniciar fluxo** (encadeia outro fluxo, inclusive aleatório) · Ações · Condição · Dividir tráfego · Esperar · **Link Page** · **Adicionar notas** · **Enviar e-mail**.
- **Dividir tráfego:** as variações têm de somar **100%**; dá para criar quantas quiser (ex. 4 × 25%).
- Em cada bloco: **definir como bloco inicial do fluxo** (não precisa ser o primeiro Enviar Mensagem) · obter link publicado · **obter o ID da etapa** · renomear · **duplicar**.
- **Publicar exige todos os blocos ligados.** Bloco solto, mensagem incompleta ou variável não mapeada travam a publicação — e o sistema aponta qual bloco é o problema.
- Três pontinhos do fluxo: renomear · duplicar · **obter link do rascunho** · obter link publicado · **copiar para outra conta** · excluir.
- **Bolinha amarela = rascunho não publicado.** Ao lado ficam a data de criação, o estado **Ativo/Inativo** e o toggle de **Caixa de Entrada**.
- Existe **Lixeira**: fluxo excluído vai para lá e pode voltar.
- O **registro de erros** mostra cada mensagem não enviada **e o motivo**.

### 19.17 Campos personalizados, etiquetas e pastas — detalhes de tela

- Tipos completos na tela de criação: Texto · Número · Data · Data e hora · Verdadeiro/Falso · Texto longo · **Seleção única** · **Seleção múltipla**.
- Cada campo tem **Editar**, **Excluir** e **Ver análise** — gráfico de quantos contatos preencheram aquele campo por dia dentro de um período.
- No bloco **Adquirir Dados**, o botão **Editar** define o tipo de resposta e o campo de destino, e permite a mensagem de erro para formato inválido. O rótulo do botão vem preenchido como **"Saltar"** por padrão: **apague o rótulo** se não quiser botão nenhum, e depois **Salvar**.
- Dá para criar o campo na hora, de dentro do fluxo, pelo **Adicionar novo**.
- **Pastas:** Fluxos → *Nova pasta* → nome → Continuar. Mover qualquer item (fluxo, etiqueta ou campo) pelos **três pontinhos → Mover para a pasta**. Fluxos e etiquetas podem ser criados já dentro da pasta; **campo personalizado se cria fora e depois se move**. A Lixeira é uma pasta nativa.

### 19.18 Fluxo de boas-vindas sem IA — o método demonstrado

O vídeo constrói uma loja de vestidos de noiva do zero. O que dá para copiar como método:

1. **Escreva o fluxo no papel antes** de abrir o construtor — o vídeo chega com o roteiro pronto e só transcreve.
2. Fluxo de recepção **não precisa de HSM** (não há disparo).
3. Menu com 4 opções → use **Lista de Opções**; botões dentro de um bloco de texto comum só aceitam **3**.
4. Ligue botões a blocos **arrastando a setinha do botão** até o bloco de destino — ele fica azul e circulado quando engata.
5. "Voltar ao menu principal" é literalmente **ligar o botão de volta ao bloco do menu**, sem duplicar nada.
6. Transferir para humano são **duas ações**: *Ações → Caixa de entrada → **Atribuir conversa ao administrador*** e *Ações → Caixa de entrada → **Transferir conversa para humano***.
7. Coloque uma mensagem **"estou transferindo você para uma de nossas consultoras"** ANTES da transferência — senão o cliente fica no vazio.
8. Número do pedido: **Adquirir Dados** com tipo número, salvando num campo criado na hora.
9. **Digitando** de 3–5 segundos antes da resposta simula a busca; **Esperar** de ~20 minutos antes de perguntar *"isso resolveu sua dúvida?"*.
10. Rotas iguais: **duplique o bloco** e só troque o atendente dentro dele.
11. Publicar → **testar mandando "oi" para o próprio número** e percorrer todas as rotas na Caixa de Entrada → só então **Configurações → Geral** e selecionar o fluxo como recepção.

### 19.19 Rotativo — a lógica exata do campo numérico

Estrutura demonstrada, com três atendentes:

1. Condicionais de **carteira** primeiro: *tem a etiqueta Carteira Robson?* → atribui ao Robson e transfere. Idem Luiz, idem Guilherme.
2. Sem nenhuma etiqueta, cai num campo personalizado numérico chamado **`atendente da vez`**.
3. Se `atendente da vez = 1` → **define o campo aumentando em 1** e transfere ao 1º. Se `= 2` → aumenta e transfere ao 2º. Se `= 3` → **define de volta para 1** e transfere ao 3º. É o *define no último* que fecha o ciclo.

Alternativa nativa: bloco **Atribuição Automática** → *distribuir igualmente entre os administradores* → janela de balanceamento **todo o tempo · última hora · últimas 8h · últimas 24h**. Cuidado com "todo o tempo": um admin antigo com muito histórico **fica parado** até os outros o alcançarem; janelas curtas equalizam só o período recente.

Boa prática mostrada: **depois** da atribuição automática, use uma condição por *conversa atribuída é X* para **gravar a etiqueta de carteira** do admin que recebeu — assim, no próximo contato, o cliente cai direto com a mesma pessoa.

### 19.20 Bloco OpenAI — configuração campo a campo

Adicionar conteúdo → **Ações → OpenAI**. Dentro do bloco:

| Campo | O que colocar |
|---|---|
| Tipo | **Gerador de texto** ou **Agentes** — para atendimento, Agentes |
| Agentes de IA | o agente já criado no IA Hub |
| Modelo | a NexTags trabalha com **GPT-4 mini, 4.1 mini ou 5.1 mini** |
| Mensagem do usuário | `{{last_input}}` — é o que a IA lê para responder |
| Campo de resposta | o campo personalizado **`resposta_ai`** |
| Funções | acionadores, consulta a planilha, transferência para humano |
| Lembrar da conversa | **Sim** para boas-vindas; Não para agentes de tarefa única |
| Temperatura | quanto ela pode se afastar do prompt |

Depois: bloco **Enviar Mensagem** com `{{resposta_ai}}`, inserido pelo **ícone `< / >`** do editor. Esse é o fluxo mínimo. O híbrido é o chatbot com botões na frente e o bloco OpenAI só a partir da rota escolhida (ex. "falar com a consultora").

### 19.21 Broadcast — a sequência de telas

Broadcast → **Enviar** → escolher o canal → escolher entre **Modelo de mensagem** (custo por entregue) e **Contatos ativos em 24 horas** (sem custo, só quem está com janela aberta) → Continuar → escolher o **fluxo** que será enviado → **agora** ou **agendar data e hora** → Continuar → **segmentar por condicional** (ex. etiqueta = Carteira Robson) → Salvar → a tela mostra o **número de receptores** → **Enviar**.

Na listagem de cada disparo: Estado (enviado/cancelado) · público estimado · quantos foram enviados · **% de entregues** (passar o mouse mostra o número absoluto — **é esse número que a Meta cobra**) · visualizados · cliques · falhas · data e hora. Para o funil por etapa: Fluxos → abrir o fluxo → três pontinhos → **Ver análise** (o exemplo do vídeo: entregue a 81%, 21.108 pessoas; 31% viram; 2,1% clicaram).

### 19.22 Caixa de entrada — o que a visão geral mostra a mais

- Barra de envio completa: **modelo de mensagem · enviar fluxo · enviar produtos · criar compromisso · emoji · respostas salvas · áudio · anexos**. O áudio pede **permissão de microfone** do navegador; a bolinha indica gravação e a setinha envia.
- **Sugestão de resposta da IA:** gera um rascunho no campo do bate-papo, você edita e envia.
- Card do cliente, na ordem: nome (editável) · e-mail · telefone · **Hora local do cliente** (atualiza sozinha) · **Contato** (data e hora do primeiro contato) · país · campos personalizados preenchidos (e dá para **adicionar campo manualmente**, útil em teste) · **Pipeline** · **Bloco de notas** · **Mídias** · **Etiquetas** · **Sequências** · **Ver ações**.
- **Criar oportunidade pelo card:** *Adicionar novo* → escolher a pipeline → Continuar → **nome da oportunidade · valor · descrição · anexar documento · administrador atribuído · prioridade (baixa/média/alta) · estado (aberto/fechado) · etapa** (as colunas do Kanban) → Salvar. O card passa a exibir oportunidade, etapa e prioridade.
- **Ver ações** é um botão que **liga e desliga** a exibição do histórico (transferências, arquivamentos, bloqueios, etiquetas) dentro do próprio bate-papo.
- Filtro **"sem resposta do administrador"**: pega quem mandou a última mensagem e **não foi respondido nem pelo bot nem por humano**. Assim que alguém responde, o contato some do filtro. É o filtro de fila abandonada.

### 19.23 AI Hub — palavras-chave e MCP na prática

- **Palavras-chave:** IA Hub → Palavras-chave → **Adicionar** → campo **Mensagem do usuário** (uma ou várias entradas esperadas) → responder com **Mensagem de texto** ou **Fluxo** → **Salvar**. O disparo acontece quando o cliente escreve algo **igual ou muito parecido** — não precisa ser exato.
- **MCP:** hoje o provedor disponível é o **Shopify**. Com ele ligado, você pede **em linguagem natural dentro do prompt** que a IA consulte carrinho abandonado e dados do pedido do cliente.
- **Funções de IA** também permitem que a IA leia o que o cliente manda (imagem, documento) além de disparar fluxos por intenção.

---

## 20. Playbook de prompt — a aula completa em formato de checklist

Onde: **IA Hub → Agentes → Adicionar → nome → Continuar**. Os 8 pontos da seção 4 são o índice; abaixo está o conteúdo que só foi falado.

**1. Clareza e objetividade.** Escreva como para alguém muito inteligente que não lê mentes. Sem jargão e sem frase ambígua. Seja específico no objetivo — *"escreva um post de blog com X palavras e as 3 principais estratégias de marketing digital para empresas Y"* em vez de *"escreva sobre marketing"*. E **defina o formato de saída**: lista, parágrafo, tabela, "liste 5 ideias", "escreva um parágrafo introdutório".

**2. Contexto e identidade.** Diga o **público-alvo** — ele muda tom, vocabulário e nível de detalhe (profissional experiente ≠ iniciante). Diga o estilo. E resolva explicitamente os quatro pontos de roteamento: **a quem ela responde direto**, **quando transfere para humano**, **quando pede mais informação** e **como lida com o que está fora do escopo**. Inclua **respostas prontas para as perguntas frequentes** — prazo de entrega, troca, "onde está meu pedido" — em vez de deixar a IA improvisar.

**3. Restrições e limitações.** Diga o que ela **não** pode fazer, com exemplos: não falar de política; resposta de no máximo 200 palavras; nunca compartilhar link de troca antes de entender o motivo; se a pergunta não for sobre produto ou serviço, avisar que vai transferir para atendimento humano.

**4. Persona.** Nome; se assume ser assistente virtual ou fica humanizada; **papel** (vendedora, suporte, consultora); e **objetivo da persona** — em venda, conduzir à compra; em suporte, resolver o problema.

**5. Interação e refinamento.** O prompt **nunca sai pronto na primeira**. Teste conversando bastante com ela, **usando uma etiqueta só sua** para nenhum cliente real cair no meio do teste. Observe os erros concretos: falta de clareza, ausência de contexto, informação que faltou. Isso é curadoria contínua, não ajuste único.

**6. Palavras-chave.** Use **verbos de ação** (gerar, resumir, comparar, listar, analisar) e a **terminologia do nicho** — se o cliente é do setor, escreva como o setor escreve.

**7. Estrutura.** Instrução principal **no início**. Marcadores, numeração hierárquica (1, 1.1, 1.2) ou **Markdown**. Separe em seções. Vale escrever tudo cru e **pedir ao ChatGPT/Gemini para formatar e apontar inconsistências** — o vídeo recomenda isso abertamente.

**8. Limitações da plataforma.** Verifique quais integrações existem e **escreva no prompt a instrução de acionar as funções** — a IA não descobre sozinha que existe um acionador.

### Modelo canônico da aula (loja de vestidos de noiva)

A estrutura que o vídeo monta, na ordem:

```
OBJETIVO
Gerar respostas personalizadas e úteis para perguntas frequentes de clientes,
com a capacidade de acionar uma função para enviar fotos de modelos de vestidos,
simulando um atendimento atencioso e profissional.

PERSONA
Atue como uma consultora de vendas de vestidos de noiva, experiente e empática.
Seu objetivo é ajudar a noiva a se sentir compreendida, informada e entusiasmada,
guiando-a pelos próximos passos da sua jornada. Seja amigável, acolhedora e profissional.

CONTEXTO
Uma noiva em potencial entrou em contato com a loja com uma pergunta sobre
agendamento, estilos de vestido ou prazo de entrega.

INSTRUÇÕES GERAIS
- Mantenha um tom caloroso e convidativo.
- Sugira agendar uma consulta presencial como próximo passo, quando aplicável.
- Forneça informações claras e concisas, adaptadas ao tipo de pergunta.

ACIONAMENTO DE FUNÇÃO
- Se a cliente solicitar fotos de modelos ou tipos de vestido, acione a função
  enviar_fotos_modelos com o parâmetro estilo_vestido.

EXEMPLO
Cliente: "Amo estilo princesa, vocês poderiam me enviar fotos e como agendo uma visita?"
Resposta: "Que maravilha que você ama o estilo princesa, ele é um dos favoritos!
Estou enviando algumas fotos para você dar uma olhadinha. Para agendar sua visita
e experimentar esses e outros modelos, o agendamento é pelo nosso site: <link>."
```

Dois pontos que fazem esse modelo funcionar: **o exemplo de pergunta e resposta dentro do próprio prompt** (a IA copia o padrão), e a **regra de acionamento nomeando a função e o parâmetro**. Atrás da função existe um fluxo na NexTags que filtra as imagens pelo estilo e dispara as fotos.

---

## 21. Playbook de implantação — o documento oficial na íntegra

O vídeo de implementação é o mais denso da central. A seção 12 tem o resumo; aqui está o que muda a conversa com o cliente.

### 21.1 Prazos oficiais

- **Implementação: 15 dias úteis contados da primeira reunião.**
- **Integração avançada: 10 dias úteis** contados do momento em que o cliente **envia o documento preenchido com as copies e os acessos** — não da reunião.
- No documento de implementação, **azul = responsabilidade da NexTags, marrom = responsabilidade do cliente**.

### 21.2 SLA do time de integrações

| Demanda | Prazo |
|---|---|
| Ajuste de fluxo simples | 1 hora |
| Ajuste de fluxo complexo | 3 horas |
| Ajuste de prompt de IA | 1 dia |
| Criação de novos fluxos | 1 a 3 dias |
| Novas integrações (fora a inicial) | 1 semana |
| Migração de plataforma | 1 semana |

A **primeira** integração fica fora dessa conta porque exige criar acessos e webhooks do zero — por isso os 10 dias úteis.

### 21.3 O que o suporte não faz — e por quê

- **Criação de copy.** Motivo declarado: "se der errado a culpa é nossa, porque não conhecemos seu negócio a fundo".
- **Edição de planilhas, remoção de duplicados, ajuste de colunas.** Há clientes com planilhas de mais de 20 mil números, e mexer em coluna pode deturpar o documento. Eles orientam como fazer, mas não fazem.
- **Programação e realização de disparos sozinhos.** Só com o cliente **online junto** — WhatsApp, ligação ou Meet — mostrando por print ou vídeo qual base foi selecionada e fazendo um **teste antes**. O motivo é evitar que um agendamento esquecido cause prejuízo.

**Time de integrações faz:** integração da NexTags com outras plataformas · ajuste e **criação** de fluxos ligados a essas integrações · reunião para dúvidas técnicas · ajuste de prompt ligado às integrações.
**Time de integrações não faz:** integrar o e-commerce do cliente a plataformas que não sejam a NexTags · disparos · **criação de BM na Meta** (o cliente chega com a BM montada) · conectar o número (isso é do primeiro suporte) · resolver tudo na Meta — parte exige o titular do perfil presente.

### 21.4 Regras de atendimento

- **Tolerância de 5 minutos** de atraso em reunião; passou disso sem aviso, reagenda — e o horário pode ser dado a outro cliente. Avisar no grupo se for atrasar. O atraso **encurta a reunião** (45 min com 15 de atraso = 30 min).
- **Entrar por desktop ou notebook.** Verificação de empresa e cadastro de cartão na Meta exigem ações que só o titular consegue fazer, e não dá pelo celular.
- **Não mandar mensagem no privado.** Tudo no grupo: se a pessoa está em treinamento, doente ou de férias, a demanda no privado fica parada; no grupo, financeiro, integrações e suporte geral veem e a equipe do cliente fica informada junto.
- **Informar o motivo da reunião no agendamento.** Se for preciso cruzar a agenda de outro profissional ou pesquisar a instância antes, eles precisam saber com antecedência.

### 21.5 As três formas de conectar o número — e o que se perde

O que a API oficial **tira**, em qualquer das opções: **chamada de vídeo**, **status do WhatsApp** e **grupos** (não entra nem cria). Ligação de voz já existe via API oficial, mas **exige autorização prévia do cliente** antes de você ligar.

1. **Número novo direto na API oficial.** Compra um chip, conecta, todo o atendimento passa a viver na ferramenta.
2. **Trazer o número antigo.** Compra-se um chip novo, faz-se a **mudança de número no WhatsApp sem notificar os contatos** (o chip novo guarda o backup) e o número antigo entra na API da NexTags. Sem esse passo, **você perde o backup** das conversas.
3. **Coexistente.** Ferramenta e app do celular sincronizados. Bom para receptivo; o token cai com mais frequência e exige reconectar.
4. **Híbrido prático:** número novo só para disparo na ferramenta, número antigo no app para grupos, e o fluxo direciona quem quiser grupo para o outro número.

### 21.6 O roteiro reunião a reunião, como é executado

**Reunião 1** — call inicial: entender o que a plataforma faz pelo cliente e o que ele precisa · apresentar o documento de implementação · **validar expectativas** (disparo? atendimento? uma IA ou várias?) · criar os acessos da equipe **e ensinar o cliente a criar** · alinhar a forma de conexão do número · **instalar um número de teste do WhatsApp** para já construir modelos e fluxos enquanto o número real não entra · instalar **Instagram e Facebook** (conectar não impede continuar respondendo pelos apps; o direct e o Messenger passam a cair na caixa de entrada e os comentários viram automação) · overview da ferramenta (caixa de entrada, pipeline, Broadcast) · indicar a central de ajuda · conversar sobre **tamanho e segmentação da base** e ensinar o CSV separado por vírgulas · explicar o prompt e suas etapas · encaminhar para o time de integrações.

**Levar para a reunião 2:** a lista de contatos · o **chip/número já ativado, só para receber SMS e ligação** (não precisa instalar WhatsApp nele; se já houver WhatsApp criado, terá de ser deletado e isso leva 3–5 minutos na hora) · o **fluxo de boas-vindas escrito** · o **prompt**. A NexTags envia antes um **modelo de comunicação de fluxo** e um **modelo de prompt junto com um chat do ChatGPT** preparado para ajudar a montar o agente. Mandando no grupo antes, a equipe já chega com os fluxos prontos.

**Reunião 2** — conexão do chip · liberar **primeiro o chatbot**, não a IA: a IA precisa de **10 a 15 dias úteis de treino e correção** antes de encostar em cliente · **fluxo de inatividade** (resgatar quem abandona a jornada no meio) · **rotativo** · **setorização** (vendas, financeiro, suporte) com rotativo dentro de cada setor · **importação da base etiquetada**, incluindo as carteiras dos vendedores — o rotativo checa a etiqueta antes de distribuir, para que cliente antigo volte ao vendedor dele · primeira ação de disparo começa a ser preparada.

**Reunião 3** — adicionar o número oficial · configurar o perfil do número · **treinamento completo** (modelos de mensagem, bate-papo, automações, disparos) · validação do funcionamento e conferência na conta da Meta · primeira ação junto ao cliente, se solicitado · encerramento com orientações finais e **cadastro do cartão de cobrança**.

**Etapas do time de integrações:** call inicial (entender a demanda, apresentar possibilidades, entregar o **guia de automação** com as copies) → entrega do documento preenchido com as copies → desenvolvimento (integrar a plataforma escolhida e gerar os fluxos padrão: status do pedido, carrinho abandonado, pedido aprovado, pedido entregue, PIX) → **teste de disparo sem liberar para todos os clientes** → finalização informada no grupo → ajustes pontuais depois.

### 21.7 Checklist do cliente antes da primeira reunião

- **Facebook com controle total** e as páginas liberadas — o login acontece **dentro da NexTags**, então precisa ter login e senha à mão.
- **TikTok com usuário e senha**, se for usar o canal.
- **Modelo de conexão do WhatsApp já decidido** entre as três opções acima.
- **Número ativado só para receber SMS e ligação**, sem WhatsApp instalado nele.
