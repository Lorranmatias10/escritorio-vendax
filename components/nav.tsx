'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITENS = [
  ['/hoje', 'Hoje', 'hoje'], ['/escritorio', 'Escritório', null], ['/clientes', 'Clientes', null],
  ['/aprovacoes', 'Aprovações e histórico', 'aprovacoes'], ['/agentes', 'Agentes', null], ['/integracoes', 'Integrações', 'integracoes'], ['/usuarios', 'Usuários', null], ['/demonstracao', 'Demonstração', null],
] as const;

export function Nav({ contadores, admin }: { contadores: { hoje: number; aprovacoes: number; integracoes: number }; admin: boolean }) {
  const p = usePathname();
  return (
    <nav aria-label="Principal">
      <ul className="flex flex-wrap gap-1">
        {ITENS.filter(([href]) => admin || href !== '/usuarios').map(([href, nome, k]) => {
          const ativo = p.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={ativo ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${ativo ? 'bg-vx-verde text-white' : 'hover:bg-vx-fundo'}`}>
                {nome}
                {k && contadores[k] > 0 && <span className={`rounded-full px-1.5 text-xs ${ativo ? 'bg-white/25' : 'bg-vx-fundo'}`}>{contadores[k]}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
