-- Escritório Vendax · a habilitação vale para o provedor/modelo com que o papel foi homologado.
-- Trocar de provedor ou de modelo exige nova homologação antes de executar fora da demonstração.
alter table papeis add column homologado_com text;
update papeis set homologado_com = 'simulado-local' where execucao_habilitada;
