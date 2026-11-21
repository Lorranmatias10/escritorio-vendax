# Publicação da ficha e das rotinas

## Escritório Vendax

1. Confirme a aprovação do Tiago e tire um backup do PostgreSQL. Guarde a versão ativa e a receita do serviço `vendax/escritorio` para reversão.
2. Use o código integral da branch de revisão. Ele inclui a base recuperada que já roda em produção e a mudança da ficha e das rotinas. No EasyPanel, substitua o ZIP de origem por um ZIP da revisão completa, incluindo as pastas `.claude/skills`, `agentes`, `db/migrations` e `public`. Para essa origem, use `npm ci` e `npm run build` sem as transformações da origem anterior. Mantenha o comando de início, as credenciais, o PostgreSQL e o domínio do serviço.
3. No ambiente do Escritório, prepare as variáveis abaixo. Inicie a primeira implantação com `VX_ROTINAS=desligado`.
4. Inicie a versão aprovada. O aplicativo executa as migrações no primeiro acesso ao banco, com trava transacional. Confira em `schema_migrations` a aplicação de `0012_ficha_clientes.sql` e `0013_rotinas.sql`. A primeira migração atualiza os status dos cadastros reais e cria os vínculos e o histórico de auditoria. A segunda cria as tabelas do agendador. Elas preservam os IDs da carteira, a memória, as tarefas e as aprovações existentes.
5. Confira Clientes, abra uma ficha e valide os grupos de status no chat do Diretor. A operação interna e os produtos próprios da Vendax têm agrupamento próprio. Cadastre e verifique os identificadores manualmente. As referências antigas da memória ficam disponíveis para conferência.
6. Configure uma rotina a partir de um modelo, selecione seu dono e aprovador e confirme que ambos podem acessar o escopo. Para usar um modelo, o papel precisa estar homologado em A1 no provedor ativo. Após conferir as fontes e a próxima data, ajuste `VX_ROTINAS=ligado`, reinicie o serviço e ligue somente as rotinas desejadas. O agendador consulta as rotinas vencidas a cada minuto. Se o servidor ficou fora do ar, ele pega a janela vencida mais recente de cada rotina. Use **Rodar agora** para validar uma execução em A1 e confira o histórico, o rascunho e o aprovador em Hoje e Aprovações.

| Variável | Valor e uso |
|---|---|
| `VX_ROTINAS` | `desligado` na primeira publicação. `ligado` habilita o agendador e o disparo manual. |
| `VX_ROTINAS_LIMITE_HORA` | `20` por padrão. Limite conjunto em uma janela móvel de uma hora. |
| `CRM_VENDAX_ESPACO_COMERCIAL_ID` | ID numérico do espaço exclusivo do comercial da Vendax. O token atual precisa ter acesso de leitura a esse espaço. O follow-up de cliente usa um espaço exclusivo verificado na ficha. |
| `VENDAX_APP_READER_TOKEN` | Credencial de leitura dedicada, igual à configurada no Vendax App. A URL padrão é `https://vendaxapp.tech/api/v1/escritorio/recurso`. |
| `VENDAX_APP_READER_URL` | Opcional para a mesma origem do Vendax App. |
| `NEXTTAGS_READER_URL` e `NEXTTAGS_READER_TOKEN` | Opcionais para leitura de um WABA ou número na API do fornecedor. O tipo **Conta NextTags** já usa a consulta de identidade `/api/accounts/me` com o token da conexão existente. |

A verificação confirma que a integração retornou o identificador informado. A associação comercial daquele ID ao cliente é feita pela direção. Alterar integração, tipo ou identificador invalida a verificação.

## Leitura no Vendax App

A rota dedicada de disponibilidade é reutilizada nos testes de conexão do Escritório. O Monitor de WhatsApp usa a rota de recursos para consultar WABA ou ID do número específico.

1. Publique a revisão auxiliar do Vendax App após a aprovação. Configure `VENDAX_OFFICE_READER_TOKEN` com 32 bytes aleatórios em Base64URL. A chave antiga de disponibilidade tem uso separado.
2. Na variável `VENDAX_OFFICE_READER_RECURSOS`, cadastre somente os recursos aprovados com o ID da conta interna correspondente. Cada entrada tem os campos `tipo`, `identificador` e `conta`. Os tipos aceitos são `funil`, `waba` e `numero_whatsapp`. Para telefone, use o ID do número na API.
3. Configure a mesma chave de leitura em `VENDAX_APP_READER_TOKEN` no Escritório e verifique o vínculo na ficha. O monitor retorna o estado registrado no Vendax App e a evidência de canal desabilitado. A qualidade e a entrega real na Meta dependem de uma fonte que forneça esses dados.

O Reportei V2 consulta indicadores numéricos das integrações ativas do projeto verificado no período da rotina. A fonte inclui o ID do projeto. No Connect, a credencial do merchant confirma o ID do customer. A leitura de métricas nessa modalidade exige a credencial própria do customer.

### Reversão

Desligue `VX_ROTINAS` e volte à versão anterior do serviço se houver regressão. Preserve as tabelas novas e o histórico. Use o backup para uma restauração do banco somente quando ela for necessária e aprovada.
