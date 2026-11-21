-- A homologação da mídia legada cobria os dois pacotes. Preserve a instrução
-- homologada e transfira o vínculo sem alterar o histórico do papel original.
insert into papeis (id, departamento_id, nome, fase, responsavel_proposto, estado_config,
                    execucao_habilitada, claude_homologado_com, claude_versao_instrucao)
select novo.id, p.departamento_id, novo.nome, p.fase, p.responsavel_proposto, p.estado_config,
       p.execucao_habilitada, p.claude_homologado_com, p.claude_versao_instrucao
from papeis p
cross join (values ('especialista_google_ads', 'Especialista em Google Ads'),
                   ('especialista_meta_ads', 'Especialista em Meta Ads')) novo(id, nome)
where p.id = 'midia_paga' and p.claude_homologado_com is not null
  and exists (select 1 from instrucoes i where i.papel_id = p.id and i.versao = p.claude_versao_instrucao)
on conflict (id) do nothing;

insert into instrucoes (papel_id, versao, conteudo, estado, autor_id)
select novo.id, i.versao, i.conteudo, i.estado, i.autor_id
from papeis novo
join instrucoes i on i.papel_id = 'midia_paga' and i.versao = novo.claude_versao_instrucao
where novo.id in ('especialista_google_ads', 'especialista_meta_ads')
on conflict (papel_id, versao) do nothing;

alter table execucoes add column disponivel_em timestamptz not null default now();
create index execucoes_ativas_idx on execucoes (estado, disponivel_em)
  where estado in ('na_fila', 'em_execucao');
