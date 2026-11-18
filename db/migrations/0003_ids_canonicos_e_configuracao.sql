-- Escritório Vendax · IDs canônicos dos papéis (Instruções dos 23 agentes, v1.0)
-- Renomeia os IDs da V1 para os IDs canônicos sem criar papéis duplicados nem quebrar o histórico:
-- tarefas, execuções (incluindo chaves de deduplicação e entrada/saída), instruções e eventos são atualizados juntos.
create temporary table mapa_papeis (antigo text primary key, novo text not null);
insert into mapa_papeis values
  ('diretor-operacoes-ia', 'diretor_operacoes'),
  ('auditor-qualidade', 'auditor_qualidade'),
  ('curador-conhecimento', 'curador_conhecimento'),
  ('sdr-followup', 'sdr_followup'),
  ('propostas-negociacao', 'propostas_negociacao'),
  ('expansao-parcerias', 'expansao_parcerias'),
  ('estrategista-conteudo', 'posicionamento_conteudo'),
  ('produtor-editorial', 'produtor_editorial'),
  ('gerente-contas-ia', 'gerente_contas'),
  ('coordenador-implantacao', 'implantacao_entregas'),
  ('copiloto-atendimento', 'copiloto_atendimento'),
  ('analista-crm-conversao', 'crm_conversao'),
  ('midia-paga', 'midia_paga'),
  ('dados-atribuicao', 'dados_atribuicao'),
  ('web-presenca-local', 'web_presenca_local'),
  ('monitor-whatsapp', 'monitor_whatsapp'),
  ('fluxos-campanhas-whatsapp', 'fluxos_campanhas_whatsapp'),
  ('automacoes-bases-ia', 'automacoes_bases_ia'),
  ('produto-vendax-app', 'produto_vendax_app'),
  ('qa-integracoes', 'qa_integracoes'),
  ('faturamento-cobranca', 'faturamento_cobranca'),
  ('conciliacao-margem', 'conciliacao_margem'),
  ('administrativo-contratos', 'administrativo_contratos');

alter table instrucoes drop constraint instrucoes_papel_id_fkey;
alter table tarefas    drop constraint tarefas_papel_atual_id_fkey;
alter table execucoes  drop constraint execucoes_papel_id_fkey;

update papeis p set id = m.novo from mapa_papeis m where p.id = m.antigo;
update instrucoes i set papel_id = m.novo from mapa_papeis m where i.papel_id = m.antigo;
update tarefas t set papel_atual_id = m.novo from mapa_papeis m where t.papel_atual_id = m.antigo;
update execucoes e set
  chave_dedup = replace(e.chave_dedup, ':' || m.antigo || ':', ':' || m.novo || ':'),
  entrada = jsonb_set(e.entrada, '{papel_id}', to_jsonb(m.novo)),
  papel_id = m.novo
  from mapa_papeis m where e.papel_id = m.antigo;
update execucoes e set saida = jsonb_set(e.saida, '{papel_destino}', to_jsonb(m.novo))
  from mapa_papeis m where e.saida ->> 'papel_destino' = m.antigo;
update eventos_tarefa ev set ator = m.novo from mapa_papeis m where ev.ator = m.antigo;
update eventos_tarefa ev set descricao = replace(ev.descricao, m.antigo, m.novo) from mapa_papeis m where ev.descricao like '%' || m.antigo || '%';

alter table instrucoes add constraint instrucoes_papel_id_fkey foreign key (papel_id) references papeis(id) on update cascade;
alter table tarefas    add constraint tarefas_papel_atual_id_fkey foreign key (papel_atual_id) references papeis(id) on update cascade;
alter table execucoes  add constraint execucoes_papel_id_fkey foreign key (papel_id) references papeis(id) on update cascade;

drop table mapa_papeis;

-- Configuração por papel (fontes, ferramentas concedidas, limites, como desabilitar) e rastreio de homologação
alter table papeis add column fontes jsonb not null default '[]';
alter table papeis add column ferramentas jsonb not null default '[]';
alter table papeis add column limites text;
alter table papeis add column como_desabilitar text;
alter table execucoes add column versao_instrucao text;

create table homologacoes (
  id            bigserial primary key,
  rodada        uuid not null,
  versao        text not null,
  caso          text not null,
  esperado      text not null,
  papeis        text[] not null,
  passou        boolean not null,
  evidencia     jsonb not null,
  executado_por text not null references usuarios(id),
  executado_em  timestamptz not null default now()
);

create table registro_configuracao (
  id         bigserial primary key,
  papel_id   text not null references papeis(id) on update cascade,
  acao       text not null,
  detalhe    text not null,
  ator       text not null,
  criado_em  timestamptz not null default now()
);
