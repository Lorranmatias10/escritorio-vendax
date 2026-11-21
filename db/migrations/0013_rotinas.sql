create table rotinas (
  id uuid primary key default gen_random_uuid(),
  chave_dedup uuid unique not null,
  nome text not null,
  papel_id text not null references papeis(id),
  cliente_id text references clientes(id),
  area_interna text references departamentos(id),
  dono_id text not null references usuarios(id),
  aprovador_id text not null references usuarios(id),
  objetivo text not null,
  fontes text[] not null,
  frequencia text not null check (frequencia in ('diaria','semanal','mensal')),
  dia integer,
  hora time not null,
  fuso text not null default 'America/Sao_Paulo' check (fuso = 'America/Sao_Paulo'),
  inclui_sazonal boolean not null default false,
  ativa boolean not null default false,
  ultima_execucao timestamptz,
  proxima_execucao timestamptz,
  check ((cliente_id is null) <> (area_interna is null)),
  check (cardinality(fontes) > 0),
  check ((frequencia = 'diaria' and dia is null) or
    (frequencia = 'semanal' and dia is not null and dia between 1 and 7) or
    (frequencia = 'mensal' and dia is not null and dia between 1 and 31)),
  check (ativa = (proxima_execucao is not null))
);
create index rotinas_vencidas on rotinas (proxima_execucao) where ativa;

create table rotinas_execucoes (
  id bigint generated always as identity primary key,
  rotina_id uuid not null references rotinas(id),
  janela text not null,
  origem text not null check (origem in ('agenda','manual')),
  estado text not null check (estado in ('disparada','ignorada')),
  motivo text not null,
  tarefa_id uuid references tarefas(id),
  criado_em timestamptz not null,
  unique (rotina_id, janela, estado, motivo),
  check ((estado = 'disparada') = (tarefa_id is not null))
);
create unique index rotinas_uma_tarefa_por_janela on rotinas_execucoes (rotina_id,janela) where estado = 'disparada';
create index rotinas_disparos_recentes on rotinas_execucoes (criado_em) where estado = 'disparada';
create index rotinas_historico on rotinas_execucoes (rotina_id,id desc);

-- Mutex compartilhado pelas réplicas, também em "Rodar agora", para aplicar o mesmo limite.
create table rotinas_controle (id boolean primary key check (id));
insert into rotinas_controle values (true);
