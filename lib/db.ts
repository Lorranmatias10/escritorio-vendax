import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { prepararDados } from './seed';

// Uma interface para os dois bancos: PGlite (Postgres embutido, local, sem Docker)
// ou qualquer PostgreSQL (ex.: o serviço Postgres do EasyPanel) quando DATABASE_URL estiver definido.
export type Q = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> };
type Transacao = Q & { exec(sql: string): Promise<void> };
export type Banco = Q & { transacao<R>(fn: (q: Transacao) => Promise<R>): Promise<R>; exec(sql: string): Promise<void>; fechar(): Promise<void> };

async function abrirPglite(memoria: boolean): Promise<Banco> {
  const { PGlite } = await import('@electric-sql/pglite');
  let db;
  if (memoria) db = new PGlite();
  else {
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
    mkdirSync(dir, { recursive: true });
    db = new PGlite(dir);
  }
  const q: Q = { query: async (sql, params) => (await db.query(sql, params as unknown[])).rows as never };
  return {
    ...q,
    exec: async sql => { await db.exec(sql); },
    fechar: () => db.close(),
    // ponytail: PGlite tem uma conexão só; transações já ficam serializadas
    transacao: fn => db.transaction(tx => fn({
      query: async (sql, params) => (await tx.query(sql, params as unknown[])).rows as never,
      exec: async sql => { await tx.exec(sql); },
    })),
  };
}

async function abrirPostgres(url: string): Promise<Banco> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: url });
  return {
    query: async (sql, params) => (await pool.query(sql, params as unknown[])).rows,
    exec: async sql => { await pool.query(sql); },
    fechar: () => pool.end(),
    transacao: async fn => {
      const c = await pool.connect();
      try {
        await c.query('begin');
        const r = await fn({
          query: async (sql, params) => (await c.query(sql, params as unknown[])).rows,
          exec: async sql => { await c.query(sql); },
        });
        await c.query('commit');
        return r;
      } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
    },
  };
}

async function migrar(b: Banco) {
  const dir = path.join(process.cwd(), 'db', 'migrations');
  await b.transacao(async q => {
    // O lock transacional também protege o primeiro boot em duas réplicas.
    await q.query('select pg_advisory_xact_lock($1)',[2026112101]);
    await q.exec('create table if not exists schema_migrations (nome text primary key, aplicada_em timestamptz not null default now())');
    const feitas = new Set((await q.query<{ nome: string }>('select nome from schema_migrations')).map(r => r.nome));
    for (const nome of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
      if (feitas.has(nome)) continue;
      await q.exec(readFileSync(path.join(dir, nome), 'utf8'));
      await q.query('insert into schema_migrations (nome) values ($1)', [nome]);
    }
  });
}

const g = globalThis as unknown as { __vxBanco?: Promise<Banco> };

// Abre um banco pronto (migrado, catálogo sincronizado, instruções importadas).
// Dados fictícios só no banco isolado (homologação) ou em memória (testes); o principal fica limpo.
// isolado = Postgres em memória, descartável: usado pela homologação para não tocar nos dados reais.
export async function abrirBanco({ isolado = false } = {}): Promise<Banco> {
  const b = !isolado && process.env.DATABASE_URL
    ? await abrirPostgres(process.env.DATABASE_URL)
    : await abrirPglite(isolado || process.env.VX_DB === 'memoria');
  await migrar(b);
  await prepararDados(b, { demo: isolado || process.env.VX_DB === 'memoria' });
  return b;
}

export function banco(): Promise<Banco> {
  g.__vxBanco ??= abrirBanco();
  return g.__vxBanco;
}
