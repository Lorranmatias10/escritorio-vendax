# Escritório Vendax · ponto de retomada (18/11/2026)

## Como abrir

```bash
cd Desktop/agents-vendax
npm run build
npm start -- -p 7777        # http://localhost:7777 (modo demonstração, "Ver como")
npm run verificar           # tipos + lint + 31 testes + build
```

Segredos ficam em `.env.local` (fora do git): chave do cofre, chave da OpenAI, provedor de IA. Banco local em `.data/pglite` (fora do git).

## Estado

- **V1 completa**: Hoje, Escritório (prédio + lista), Clientes, Aprovações e histórico, Agentes, Integrações, Usuários, Demonstração.
- **Catálogo**: 5 andares, 9 salas, 23 papéis (organograma em `agentes/organograma.md`), instruções v1.0 em `agentes/instrucoes/v1.0.md`.
- **Piloto** (Diretor de Operações, Gerente de Contas / AM - Vendax, Auditor de Qualidade): homologado 7/7 com `openai:gpt-5.4-mini` e habilitado em A1 (consulta e rascunho). Os outros 20 papéis estão desabilitados. Execução externa desligada.
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
3. Fase 2: casos de homologação dos 6 papéis (normal, dado ausente, duplicidade, fora de permissão).
4. Opcional: bonecos animados ligados às execuções reais; sprites no Kling (sem créditos).

## Atenção

- Ao rodar servidores pelo Claude Code, usar `node node_modules/next/dist/bin/next start -p 7777` (via `npx` o processo fica órfão na porta).
- Banco novo começa vazio: catálogo, instruções e demonstração são recriados automaticamente; homologação e histórico de testes precisam ser refeitos.
