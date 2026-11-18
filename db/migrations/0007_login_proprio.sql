-- Escritório Vendax · login próprio (e-mail e senha), sem serviço externo.
-- Senha: hash scrypt com sal (nunca o texto). Sessão e link de acesso: só o hash SHA-256 do token fica no banco.
alter table usuarios drop column if exists auth_id;
alter table usuarios add column senha_hash text;
alter table usuarios add column senha_definida_em timestamptz;

create table sessoes (
  token_hash  text primary key,
  usuario_id  text not null references usuarios(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  visto_em    timestamptz not null default now()
);
create index sessoes_usuario_idx on sessoes (usuario_id);

-- Link de uso único para definir ou redefinir a senha (gerado pela direção).
create table links_acesso (
  token_hash  text primary key,
  usuario_id  text not null references usuarios(id) on delete cascade,
  criado_por  text references usuarios(id),
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  usado_em    timestamptz
);

-- Tentativas de login, para limitar força bruta.
create table tentativas_login (
  id         bigserial primary key,
  email      text not null,
  sucesso    boolean not null,
  criado_em  timestamptz not null default now()
);
create index tentativas_login_idx on tentativas_login (lower(email), criado_em desc);
