// Cofre de credenciais do backend. Nada daqui vai para o front.
// Ordem de leitura: variável de ambiente do servidor (.env.local / secrets do EasyPanel) → tabela cofre_credenciais
// (cifrada com AES-256-GCM; usada para o que o próprio app obtém, como refresh tokens de OAuth).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Q } from './db';

function chave(): Buffer {
  const k = process.env.VX_COFRE_CHAVE;
  if (!k) throw new Error('Cofre sem chave: defina VX_COFRE_CHAVE no servidor (32 bytes em base64).');
  const b = Buffer.from(k, 'base64');
  if (b.length !== 32) throw new Error('VX_COFRE_CHAVE precisa ter 32 bytes em base64.');
  return b;
}

export function cifrar(valor: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave(), iv);
  const dado = Buffer.concat([c.update(valor, 'utf8'), c.final()]);
  return { valor_cifrado: dado.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') };
}

export function decifrar(r: { valor_cifrado: string; iv: string; tag: string }) {
  const d = createDecipheriv('aes-256-gcm', chave(), Buffer.from(r.iv, 'base64'));
  d.setAuthTag(Buffer.from(r.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(r.valor_cifrado, 'base64')), d.final()]).toString('utf8');
}

export async function lerSegredo(q: Q, nome: string): Promise<string | null> {
  const env = process.env[nome]?.trim();
  if (env) return env;
  const [r] = await q.query<{ valor_cifrado: string; iv: string; tag: string }>('select valor_cifrado, iv, tag from cofre_credenciais where nome = $1', [nome]);
  if (!r) return null;
  try { return decifrar(r); } catch { return null; } // chave trocada ou dado corrompido = credencial indisponível
}

export async function guardarSegredo(q: Q, nome: string, valor: string) {
  const c = cifrar(valor);
  await q.query(
    `insert into cofre_credenciais (nome, valor_cifrado, iv, tag) values ($1,$2,$3,$4)
     on conflict (nome) do update set valor_cifrado = excluded.valor_cifrado, iv = excluded.iv, tag = excluded.tag, atualizado_em = now()`,
    [nome, c.valor_cifrado, c.iv, c.tag]);
}

export async function temSegredo(q: Q, nome: string) {
  return (await lerSegredo(q, nome)) !== null;
}
