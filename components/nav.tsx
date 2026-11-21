'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Ícones em traço único (24px), desenhados aqui para não adicionar dependência.
const I = {
  hoje: <path d="M8 3v3m8-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm4 8 2 2 4-4" />,
  escritorio: <path d="M4 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16M16 9h3a1 1 0 0 1 1 1v11M3 21h18M8 8h4M8 12h4M8 16h4" />,
  clientes: <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8" />,
  aprovacoes: <path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6l-8-3Zm-3 9 2 2 4-4" />,
  agentes: <path d="M12 3v3m-5 3h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Zm2 5h.01M15 14h.01M2 13v2m20-2v2" />,
  integracoes: <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7Zm5 9v5" />,
  usuarios: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />,
  atividade: <path d="M3 12h4l3-6 4 12 3-6h4" />,
  chat: <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.6-3A7.5 7.5 0 1 1 20 11.5ZM9 11h7m-7 3h4" />,
  painel: <path d="M4 5h16v14H4zM14 5v14" />,
  expandir: <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />,
  mais: <path d="M5 12h14m-7-7v14" />,
  menos: <path d="M5 12h14" />,
  seta: <path d="M4 12h15m-5-5 5 5-5 5" />,
  enviar: <path d="m3 10 18-6-6 16-4-7-8-3Zm8 3 10-9" />,
} as const;

const ITENS = [
  ['/hoje', 'Hoje', 'hoje', 'hoje'], ['/escritorio', 'Escritório', null, 'escritorio'], ['/clientes', 'Clientes', null, 'clientes'],
  ['/aprovacoes', 'Aprovações', 'aprovacoes', 'aprovacoes'], ['/agentes', 'Agentes', null, 'agentes'], ['/integracoes', 'Integrações', 'integracoes', 'integracoes'],
  ['/usuarios', 'Usuários', null, 'usuarios'],
] as const;

export function Icone({ nome, className = 'h-[18px] w-[18px]' }: { nome: keyof typeof I; className?: string }) {
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>{I[nome]}</svg>;
}

export function Nav({ contadores, admin }: { contadores: { hoje: number; aprovacoes: number; integracoes: number }; admin: boolean }) {
  const p = usePathname();
  return (
    <nav aria-label="Principal" className="min-w-0">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-col lg:px-0 lg:overflow-visible lg:pb-0">
        {ITENS.filter(([href]) => admin || href !== '/usuarios').map(([href, nome, k, ic]) => {
          const ativo = p.startsWith(href);
          const n = k ? contadores[k] : 0;
          return (
            <li key={href} className="shrink-0">
              <Link href={href} aria-current={ativo ? 'page' : undefined}
                title={nome} className={`vx-nav-link relative flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors
                  ${ativo ? 'bg-vx-verde-claro text-vx-verde-escuro' : 'text-vx-texto-2 hover:bg-vx-fundo hover:text-vx-grafite'}`}>
                {ativo && <span aria-hidden className="absolute bottom-1 left-0 top-1 hidden w-[3px] rounded-full bg-vx-verde lg:block" />}
                <Icone nome={ic} />
                <span className="vx-nav-text whitespace-nowrap">{nome}</span>
                {n > 0 && <span className={`vx-nav-count tabular ml-auto rounded-md px-1.5 text-xs font-semibold ${k === 'integracoes' ? 'bg-vx-erro-claro text-vx-erro' : ativo ? 'bg-white text-vx-verde-escuro' : 'bg-vx-fundo text-vx-grafite'}`}>
                  {n}<span className="sr-only"> {k === 'integracoes' ? 'com erro' : 'pendentes'}</span></span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
