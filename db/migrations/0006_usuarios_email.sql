-- Escritório Vendax · login (Supabase Auth, e-mail e senha)
-- usuarios.auth_id (já existe) liga a pessoa a auth.users; o e-mail é usado no primeiro login para fazer esse vínculo.
alter table usuarios add column email text;
create unique index usuarios_email_idx on usuarios (lower(email));
