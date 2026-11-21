create table memoria_vendax (
  chave text primary key,
  cliente_id text unique references clientes(id) on delete cascade,
  situacao text not null,
  texto text not null,
  fonte text not null,
  data_fonte date not null,
  versao integer not null default 1,
  atualizado_por text not null references usuarios(id),
  atualizado_em timestamptz not null default now(),
  check ((chave = 'vendax') = (cliente_id is null))
);

create table contas_anuncio (
  plataforma text not null check (plataforma in ('google_ads','meta_ads')),
  conta_id text not null,
  cliente_id text not null references clientes(id) on delete cascade,
  nome text not null,
  situacao text not null check (situacao in ('principal','historica','verificar')),
  fonte text not null,
  data_fonte date not null,
  primary key (plataforma, conta_id)
);
create index contas_anuncio_cliente_idx on contas_anuncio (cliente_id, plataforma);
create unique index contas_anuncio_principal_idx on contas_anuncio (cliente_id, plataforma) where situacao = 'principal';
