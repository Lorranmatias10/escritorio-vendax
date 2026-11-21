// Login próprio: e-mail e senha, sem serviço externo. Só biblioteca padrão do Node (crypto).
// - Senha: scrypt com sal aleatório; comparação em tempo constante.
// - Sessão e link de acesso: token aleatório de 32 bytes vai para o navegador; no banco fica só o SHA-256 dele.
// - Força bruta: no máximo LIMITE_FALHAS tentativas erradas por e-mail em JANELA_MIN minutos.
import { randomBytes, scrypt as scryptCb, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Q } from './db';
import { carregarUsuario, type Usuario } from './escopo';

const scrypt = promisify(scryptCb) as (s: string, sal: Buffer, n: number, o: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSAO_DIAS = 14;
export const LINK_HORAS = 24;
export const LIMITE_FALHAS = 5;
export const JANELA_MIN = 15;
export const SENHA_MINIMA = 10;

export const loginLigado = () => process.env.VX_LOGIN === 'ligado';

const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');
const novoToken = () => randomBytes(32).toString('base64url');

export async function hashSenha(senha: string) {
  const sal = randomBytes(16);
  const h = await scrypt(senha, sal, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${sal.toString('base64')}$${h.toString('base64')}`;
}

export async function conferirSenha(senha: string, guardado: string | null) {
  // Sem senha cadastrada: calcula um hash mesmo assim, para o tempo de resposta não revelar quem existe.
  const partes = (guardado ?? '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') { await hashSenha(senha); return false; }
  const [, N, r, p, sal, h] = partes;
  const esperado = Buffer.from(h, 'base64');
  const calc = await scrypt(senha, Buffer.from(sal, 'base64'), esperado.length, { N: +N, r: +r, p: +p, maxmem: PARAMS.maxmem });
  return calc.length === esperado.length && timingSafeEqual(calc, esperado);
}

export type ResultadoLogin = { ok: true; token: string; usuario: Usuario } | { ok: false; motivo: 'credenciais' | 'bloqueado' };

export async function entrarComSenha(q: Q, email: string, senha: string): Promise<ResultadoLogin> {
  const e = email.trim().toLowerCase();
  const [{ falhas }] = await q.query<{ falhas: number }>(
    `select count(*)::int falhas from tentativas_login where lower(email) = $1 and not sucesso and criado_em > now() - make_interval(mins => $2)
     and criado_em > coalesce((select max(criado_em) from tentativas_login where lower(email) = $1 and sucesso), '-infinity')`, [e, JANELA_MIN]);
  if (falhas >= LIMITE_FALHAS) return { ok: false, motivo: 'bloqueado' };
  const [p] = await q.query<{ id: string; senha_hash: string | null }>('select id, senha_hash from usuarios where lower(email) = $1', [e]);
  const certa = await conferirSenha(senha, p?.senha_hash ?? null);
  await q.query('insert into tentativas_login (email, sucesso) values ($1,$2)', [e, certa]);
  if (!p || !certa) return { ok: false, motivo: 'credenciais' };
  return { ok: true, token: await criarSessao(q, p.id), usuario: (await carregarUsuario(q, p.id))! };
}

export async function criarSessao(q: Q, usuarioId: string) {
  const token = novoToken();
  await q.query(`insert into sessoes (token_hash, usuario_id, expira_em) values ($1,$2, now() + make_interval(days => $3))`, [sha256(token), usuarioId, SESSAO_DIAS]);
  return token;
}

export async function usuarioDaSessao(q: Q, token: string | undefined, { registrarVisita = true } = {}): Promise<Usuario | null> {
  if (!token) return null;
  const [s] = await q.query<{ usuario_id: string }>(
    registrarVisita
      ? 'update sessoes set visto_em = now() where token_hash = $1 and expira_em > now() returning usuario_id'
      : 'select usuario_id from sessoes where token_hash = $1 and expira_em > now()', [sha256(token)]);
  return s ? carregarUsuario(q, s.usuario_id) : null;
}

export async function encerrarSessao(q: Q, token: string | undefined) {
  if (token) await q.query('delete from sessoes where token_hash = $1', [sha256(token)]);
}

// Link de uso único para definir/redefinir senha. Só o hash fica no banco; o link aparece uma vez para quem gerou.
export async function gerarLink(q: Q, usuarioId: string, criadoPor: string | null) {
  const token = novoToken();
  await q.query('update links_acesso set usado_em = now() where usuario_id = $1 and usado_em is null', [usuarioId]); // link novo invalida o anterior
  await q.query(`insert into links_acesso (token_hash, usuario_id, criado_por, expira_em) values ($1,$2,$3, now() + make_interval(hours => $4))`,
    [sha256(token), usuarioId, criadoPor, LINK_HORAS]);
  return token;
}

export async function consumirLink(q: Q, token: string): Promise<string | null> {
  const [l] = await q.query<{ usuario_id: string }>(
    `update links_acesso set usado_em = now() where token_hash = $1 and usado_em is null and expira_em > now() returning usuario_id`, [sha256(token)]);
  return l ? criarSessao(q, l.usuario_id) : null;
}

// Nova senha: grava o hash e encerra as outras sessões da pessoa (mantém só a atual).
export async function definirSenhaUsuario(q: Q, usuarioId: string, senha: string, tokenAtual?: string) {
  if (senha.length < SENHA_MINIMA) throw new Error(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`);
  await q.query('update usuarios set senha_hash = $2, senha_definida_em = now() where id = $1', [usuarioId, await hashSenha(senha)]);
  await q.query('delete from sessoes where usuario_id = $1 and token_hash <> $2', [usuarioId, tokenAtual ? sha256(tokenAtual) : '']);
}
