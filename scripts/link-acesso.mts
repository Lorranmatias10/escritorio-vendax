// Primeiro acesso da direção (antes de existir alguém logado para gerar links na tela Usuários).
// Uso: npm run link-acesso -- tiago tiago@exemplo.com   → cadastra o e-mail (se informado) e imprime um link de uso único.
import { banco } from '../lib/db';
import { gerarLink, LINK_HORAS } from '../lib/auth';

const [id, email] = process.argv.slice(2);
if (!id) { console.error('Uso: npm run link-acesso -- <usuario> [email]'); process.exit(1); }
const b = await banco();
if (email) await b.query('update usuarios set email = lower($2) where id = $1', [id, email]);
const [u] = await b.query<{ nome: string; email: string | null }>('select nome, email from usuarios where id = $1', [id]);
if (!u?.email) { console.error(`Usuário "${id}" não existe ou não tem e-mail.`); process.exit(1); }
const token = await gerarLink(b, id, null);
console.log(`Link de acesso de ${u.nome} (${u.email}), uso único, válido por ${LINK_HORAS} h:\n${process.env.VX_URL_BASE ?? 'http://localhost:7777'}/acesso/${token}`);
await b.fechar();
