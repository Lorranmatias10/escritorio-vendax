create table if not exists mensagens_escritorio (
  id bigserial primary key,
  autor_id text not null references usuarios(id),
  destinatario_id text references usuarios(id),
  requisicao uuid not null,
  corpo text not null check (char_length(btrim(corpo)) between 1 and 2000),
  criado_em timestamptz not null default now(),
  unique (autor_id, requisicao),
  check (autor_id <> destinatario_id)
);

create index if not exists mensagens_escritorio_equipe_idx on mensagens_escritorio (id desc) where destinatario_id is null;
create index if not exists mensagens_escritorio_diretas_idx on mensagens_escritorio (autor_id, destinatario_id, id desc) where destinatario_id is not null;
create index if not exists eventos_tarefa_escritorio_idx on eventos_tarefa (criado_em desc, id desc)
  where tipo in ('delegada', 'execucao_enfileirada', 'execucao_iniciada', 'execucao_concluida', 'execucao_falhou', 'execucao_bloqueada');
