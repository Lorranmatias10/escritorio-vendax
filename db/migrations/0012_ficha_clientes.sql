alter table clientes
  add column status text check (status in ('ativo','sazonal','proposta','inativo')),
  add column responsavel_id text references usuarios(id),
  add column contato_nome text,
  add column contato_whatsapp text check (contato_whatsapp ~ '^\+[1-9][0-9]{7,14}$');

-- Operações próprias conservam o tratamento interno. Nenhuma conta é criada nesta migração.
update clientes set status = case
  when id in ('dr-renato-bittar','dra-silvia-forster','lefil-beauty','lefil-shopping','dra-maira') then 'ativo'
  when id in ('service-premium','grb-service','cury-vendas','marcio-luis-tennis') then 'sazonal'
  else 'proposta'
end
where not demo and id not in ('vendax','vendax-produtos','operacao-interna-vendax');
alter table clientes alter column status set default 'proposta';
alter table clientes add constraint clientes_status_externo
  check (demo or id in ('vendax','vendax-produtos','operacao-interna-vendax') or status is not null);

create table contas_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null references clientes(id) on delete cascade,
  integracao text not null references integracoes(id),
  tipo text not null check (tipo in ('conta_anuncio','customer_id','funil','waba','numero_whatsapp','projeto_reportei','calendario','espaco_crm','conta_nexttags')),
  identificador text not null,
  rotulo text not null,
  verificado_em timestamptz,
  verificado_por text references usuarios(id),
  versao integer not null default 1,
  unique (cliente_id, integracao, tipo, identificador),
  unique (integracao, tipo, identificador),
  check ((verificado_em is null) = (verificado_por is null))
);

create table clientes_auditoria (
  id bigint generated always as identity primary key,
  cliente_id text not null references clientes(id) on delete cascade,
  acao text not null,
  detalhe text not null,
  ator_id text not null references usuarios(id),
  criado_em timestamptz not null default now()
);
create index clientes_auditoria_cliente on clientes_auditoria (cliente_id,id desc);
