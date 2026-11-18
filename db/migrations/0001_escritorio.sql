-- Escritório Vendax · esquema inicial (PostgreSQL / Supabase)
-- Horários sempre em timestamptz (UTC no banco); a interface converte para America/Sao_Paulo.
-- Valores de estado são estáveis em código (snake_case) e traduzidos na interface.

-- ---------- Cadastro (catálogo) ----------
create table andares (
  numero      int primary key,
  nome        text not null
);

create table departamentos (
  id                  text primary key,
  andar               int  not null references andares(numero),
  nome                text not null,
  responsavel_humano  text not null,
  fila                text not null,
  ordem               int  not null default 0
);

create table papeis (
  id                    text primary key,               -- ID estável
  departamento_id       text not null references departamentos(id),
  nome                  text not null,
  fase                  text not null check (fase in ('piloto', 'fase_2', 'fase_3')),
  responsavel_proposto  text not null,
  modo                  text not null default 'A1' check (modo in ('A1', 'A2', 'A3')),
  estado_config         text not null check (estado_config in ('aguardando_configuracao', 'em_homologacao', 'habilitado', 'desabilitado')),
  execucao_habilitada   boolean not null default false,
  versao_instrucao      text,                           -- versão ativa (null = sem instrução)
  vinculo_reservado     text,                           -- ex.: AM - Vendax / bases Relevance AI (reservado, sem automação duplicada)
  ordem                 int not null default 0
);

create table instrucoes (
  id          uuid primary key default gen_random_uuid(),
  papel_id    text not null references papeis(id),
  versao      text not null,
  conteudo    text not null,
  estado      text not null default 'rascunho' check (estado in ('rascunho', 'em_homologacao', 'aprovada', 'arquivada')),
  autor_id    text,
  criado_em   timestamptz not null default now(),
  unique (papel_id, versao)
);

create table integracoes (
  id          text primary key,
  nome        text not null,
  estado      text not null default 'pendente' check (estado in ('pendente', 'em_teste', 'ativa')),
  observacao  text
);

-- ---------- Pessoas e acesso ----------
create table usuarios (
  id             text primary key,
  nome           text not null,
  perfil         text not null check (perfil in ('admin', 'equipe')),
  pode_financeiro boolean not null default false,
  auth_id        uuid unique                              -- vínculo com auth.users no Supabase
);

create table clientes (
  id    text primary key,
  nome  text not null,
  demo  boolean not null default false
);

create table permissoes_cliente (
  usuario_id  text not null references usuarios(id) on delete cascade,
  cliente_id  text not null references clientes(id) on delete cascade,
  primary key (usuario_id, cliente_id)
);

-- ---------- Execução ----------
create table tarefas (
  id                  uuid primary key default gen_random_uuid(),
  parent_id           uuid references tarefas(id),
  cliente_id          text references clientes(id),
  area_interna        text references departamentos(id),  -- usado quando não há cliente
  objetivo            text not null,
  fonte               text not null,
  origem_evento_id    text unique,                        -- deduplicação de eventos repetidos
  origem_recebimentos int  not null default 1,
  dono_humano_id      text references usuarios(id),
  papel_atual_id      text references papeis(id),
  departamento_id     text not null references departamentos(id), -- sala onde a tarefa aparece
  prazo               timestamptz,
  estado              text not null check (estado in ('na_fila', 'em_execucao', 'bloqueada', 'aguardando_aprovacao', 'concluida', 'falhou', 'cancelada')),
  motivo_bloqueio     text,
  proximo_passo       text,
  criterio_conclusao  text,
  em_hoje             boolean not null default false,
  demo                boolean not null default false,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (cliente_id is not null or area_interna is not null)
);
create index tarefas_cliente_idx on tarefas (cliente_id);
create index tarefas_depto_idx on tarefas (departamento_id);
create index tarefas_parent_idx on tarefas (parent_id);

create table eventos_tarefa (
  id          bigserial primary key,
  tarefa_id   uuid not null references tarefas(id) on delete cascade,
  tipo        text not null,
  descricao   text not null,
  ator        text not null,                              -- usuário, papel ou 'sistema'
  dados       jsonb,
  criado_em   timestamptz not null default now()
);
create index eventos_tarefa_idx on eventos_tarefa (tarefa_id, criado_em);

-- Fila persistida + tentativas. chave_dedup impede efeitos duplicados.
create table execucoes (
  id            uuid primary key default gen_random_uuid(),
  tarefa_id     uuid not null references tarefas(id) on delete cascade,
  papel_id      text not null references papeis(id),
  etapa         text not null,
  chave_dedup   text not null unique,
  estado        text not null check (estado in ('na_fila', 'em_execucao', 'concluida', 'falhou', 'cancelada')),
  tentativas    int  not null default 0,
  entrada       jsonb not null,
  saida         jsonb,
  erro          text,
  provedor      text,
  demo          boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  concluido_em  timestamptz
);
create index execucoes_fila_idx on execucoes (estado, criado_em);

create table aprovacoes (
  id               uuid primary key default gen_random_uuid(),
  tarefa_id        uuid not null references tarefas(id) on delete cascade,
  chave_dedup      text not null unique,
  modo             text not null default 'A3',
  intencao         text not null,
  alvo             text not null,
  conta            text not null,
  parametros       jsonb not null,                       -- aprovação vinculada aos parâmetros exatos
  prazo            timestamptz not null,
  aprovador_id     text not null references usuarios(id),
  estado           text not null default 'pendente' check (estado in ('pendente', 'aprovada', 'rejeitada', 'expirada')),
  decisao_nota     text,
  decidido_por     text references usuarios(id),
  decidido_em      timestamptz,
  execucao_externa text not null default 'desabilitada_v1',
  demo             boolean not null default false,
  criado_em        timestamptz not null default now()
);

create table evidencias (
  id           bigserial primary key,
  tarefa_id    uuid not null references tarefas(id) on delete cascade,
  execucao_id  uuid references execucoes(id),
  chave_dedup  text unique,
  tipo         text not null check (tipo in ('fonte', 'rascunho', 'acao_solicitada', 'resultado_confirmado')),
  descricao    text not null,
  referencia   text,
  criado_em    timestamptz not null default now()
);

create table entregas (
  id           bigserial primary key,
  cliente_id   text not null references clientes(id),
  tarefa_id    uuid references tarefas(id) on delete set null,
  chave_dedup  text unique,
  titulo       text not null,
  prazo        timestamptz,
  estado       text not null check (estado in ('planejada', 'em_andamento', 'entregue', 'atrasada')),
  demo         boolean not null default false
);

create table incidentes (
  id           bigserial primary key,
  cliente_id   text references clientes(id),
  area_interna text references departamentos(id),
  tarefa_id    uuid references tarefas(id) on delete set null,
  chave_dedup  text unique,
  titulo       text not null,
  severidade   text not null check (severidade in ('baixa', 'media', 'alta')),
  estado       text not null check (estado in ('aberto', 'em_tratamento', 'resolvido')),
  demo         boolean not null default false,
  criado_em    timestamptz not null default now(),
  check (cliente_id is not null or area_interna is not null)
);
