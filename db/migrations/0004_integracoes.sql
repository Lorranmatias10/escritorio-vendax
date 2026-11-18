-- Escritório Vendax · status real das integrações
-- Cofre: credenciais obtidas pelo próprio app (ex.: refresh token do OAuth) ficam cifradas (AES-256-GCM, chave
-- VX_COFRE_CHAVE só no servidor). Chaves digitadas pela equipe ficam nas variáveis de ambiente do servidor.
create table cofre_credenciais (
  nome           text primary key,
  valor_cifrado  text not null,
  iv             text not null,
  tag            text not null,
  atualizado_em  timestamptz not null default now()
);

-- Histórico de health checks (somente leitura). Nunca guarda segredo, só o resultado.
create table integracoes_testes (
  id             bigserial primary key,
  integracao_id  text not null,
  status         text not null check (status in ('conectado', 'parcial', 'erro', 'nao_configurado', 'nao_testado')),
  conta          text,
  escopo         text,
  mensagem       text not null,
  acao           text,
  detalhes       jsonb not null default '{}',
  origem         text not null check (origem in ('abertura', 'manual', 'agendado', 'conexao')),
  duracao_ms     int,
  testado_por    text,
  testado_em     timestamptz not null default now()
);
create index integracoes_testes_idx on integracoes_testes (integracao_id, testado_em desc);
