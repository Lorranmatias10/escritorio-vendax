import type { Q } from './db';

export type Usuario = { id: string; nome: string; perfil: 'admin' | 'equipe'; pode_financeiro: boolean; clientes: string[] };

export async function carregarUsuario(q: Q, id: string): Promise<Usuario | null> {
  const [u] = await q.query<Omit<Usuario, 'clientes'>>('select id, nome, perfil, pode_financeiro from usuarios where id = $1', [id]);
  if (!u) return null;
  const cs = await q.query<{ cliente_id: string }>('select cliente_id from permissoes_cliente where usuario_id = $1', [id]);
  return { ...u, clientes: cs.map(c => c.cliente_id) };
}

// Regra única de visibilidade, usada em toda leitura, escrita, busca, contador e aprovação:
// admin vê tudo; com cliente → precisa de permissão no cliente; área Financeiro → só quem pode_financeiro; demais áreas internas → toda a equipe.
export function podeVer(u: Usuario, cliente: string | null, area: string | null): boolean {
  if (u.perfil === 'admin') return true;
  if (cliente) return u.clientes.includes(cliente);
  if (area === 'financeiro') return u.pode_financeiro;
  return true;
}

// Mesma regra em SQL. Adiciona os parâmetros em `params` e devolve o trecho do WHERE.
export function filtroSql(u: Usuario, params: unknown[], colCliente: string, colArea: string | null): string {
  if (u.perfil === 'admin') return 'true';
  params.push(u.clientes, u.pode_financeiro);
  const c = `$${params.length - 1}`, f = `$${params.length}`;
  const area = colArea ?? 'null';
  return `(${colCliente} = any(${c}::text[]) or (${colCliente} is null and (coalesce(${area}, '') <> 'financeiro' or ${f}::boolean)))`;
}

export class SemAcesso extends Error {
  constructor(msg = 'Sem acesso a este registro.') { super(msg); this.name = 'SemAcesso'; }
}
