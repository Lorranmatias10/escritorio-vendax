# Escritório Vendax · ponto de retomada (19/11/2026)

## Como abrir

```bash
cd Desktop/agents-vendax
npm run build
npm start -- -p 7777        # http://localhost:7777 (sem login: "Ver como" troca o usuário)
npm run verificar           # tipos + lint + 33 testes + build
```

Segredos ficam em `.env.local` (fora do git): chave do cofre, chave da OpenAI, provedor de IA. Banco local em `.data/pglite` (fora do git).

## Estado

- **V1 completa**: Hoje, Escritório (prédio + lista), Clientes, Aprovações e histórico, Agentes, Integrações, Usuários.
- **Sem dados fictícios** (19/11): o banco principal só tem a equipe (Tiago, Fabiana, Lígia, Lorran), o catálogo e o histórico de homologação. Clientes são cadastrados pela direção em Clientes, e o acesso de cada pessoa é definido em Usuários. Dados fictícios existem só no banco isolado da homologação e nos testes.
- **Catálogo**: 5 andares, 9 salas, 23 papéis (organograma em `agentes/organograma.md`), instruções v1.0 em `agentes/instrucoes/v1.0.md`.
- **Piloto** (Diretor de Operações, Gerente de Contas / AM - Vendax, Auditor de Qualidade): homologado 7/7 com `openai:gpt-5.4-mini` e habilitado em A1 (consulta e rascunho). Execução externa desligada.
- **Fase 2** (SDR, Propostas, Copiloto de Atendimento, Dados e Atribuição, Monitor de WhatsApp, Faturamento): homologada 24/24 com `openai:gpt-5.4-mini` (4 casos por fluxo: normal, dado ausente, duplicidade, fora de permissão) e habilitada em A1 no banco local. Entrada genérica `receberPedido` → etapa `analisar` → rascunho + revisão do dono. Botão em `/agentes#fase2`.
- **Fase 3** (os 14 papéis restantes: Curador, Expansão, Posicionamento, Editorial, Implantação, CRM e Conversão, Mídia Paga, Web e Presença Local, Fluxos WhatsApp, Automações e Bases de IA, Produto, QA, Conciliação, Administrativo): homologada 56/56 com `openai:gpt-5.4-mini`, mesmos 4 casos por fluxo, e habilitada em A1 no banco local. Botão em `/agentes#fase3`. **Os 23 papéis estão habilitados em A1.**
- **Integrações** (`/integracoes`): health check real a cada 30 min. Provedor de IA conectado; as 10 integrações de dados estão "Não configurado" (aguardando credenciais).
- **Login próprio** (`lib/auth.ts`): pronto e testado, liga com `VX_LOGIN=ligado`. Primeiro acesso: `npm run link-acesso -- tiago email@dominio`.
- **Banco na nuvem**: decidido EasyPanel (Postgres via `DATABASE_URL`). Supabase foi descartado e removido.

## Pendências que dependem do Tiago/Lorran

1. **Postgres no EasyPanel**: criar o serviço `escritorio-db`, copiar a Connection String para `DATABASE_URL` no `.env.local` (ativar porta externa para acessar do PC).
2. **E-mails de login** de Tiago, Fabiana, Lígia e Lorran.
3. **Credenciais das integrações**, por prioridade: Google Workspace (piloto), CRM Vendax (qual sistema é?), Reportei, n8n, Meta Ads, Google Ads, Asaas, Vendax App / NextTags / Nexbox (precisam de URL + endpoint de leitura). Passo a passo de cada uma nos cards da tela Integrações.
4. **Limite de gasto na OpenAI** (a chave foi colada no chat).

## Próximos passos (eu faço quando houver o item acima)

1. Com `DATABASE_URL`: reiniciar o app (migrações rodam sozinhas), conferir tabelas, rodar a homologação do piloto no banco novo, cadastrar e-mails e gerar o primeiro link de acesso.
2. Publicar o app no EasyPanel com `VX_LOGIN=ligado` e `VX_URL_BASE` (atualizar a URI de retorno do OAuth do Google para o domínio novo).
3. Fases 2 e 3 no banco novo: rodar as homologações de novo (`/agentes#fase2` e `/agentes#fase3`).
4. Ligar os pedidos das fases 2 e 3 a fontes reais quando as integrações tiverem credenciais (hoje os casos usam dados fictícios).
5. Opcional: bonecos animados ligados às execuções reais; sprites no Kling (sem créditos).

## Atenção

- Ao rodar servidores pelo Claude Code, usar `node node_modules/next/dist/bin/next start -p 7777` (via `npx` o processo fica órfão na porta).
- Banco novo começa vazio: catálogo, instruções e equipe são recriados automaticamente (sem dados fictícios); homologação (piloto, fase 2 e fase 3) e histórico de testes precisam ser refeitos.
