import Link from 'next/link';
import { ROTULO_ESTADO_TAREFA, ROTULO_CONFIG, ROTULO_APROVACAO, type EstadoTarefa, type EstadoConfig } from '@/lib/catalogo';
import { dataHora, atrasado } from '@/lib/formato';
import type { TarefaLista } from '@/lib/dados';

// Sistema visual do Escritório. Estado sempre com rótulo e símbolo, além da cor.
const ESTILO_TAREFA: Record<EstadoTarefa, [string, string]> = {
  na_fila: ['○', 'bg-white text-vx-grafite border-vx-linha-forte'],
  em_execucao: ['◐', 'bg-vx-info-claro text-vx-info border-vx-info/25'],
  bloqueada: ['■', 'bg-vx-alerta-claro text-vx-alerta border-vx-alerta/25'],
  aguardando_aprovacao: ['◆', 'bg-vx-aprovacao-claro text-vx-aprovacao border-vx-aprovacao/25'],
  concluida: ['✓', 'bg-vx-verde-claro text-vx-verde-escuro border-vx-verde/25'],
  falhou: ['✕', 'bg-vx-erro-claro text-vx-erro border-vx-erro/25'],
  cancelada: ['–', 'bg-vx-fundo text-vx-texto-2 border-vx-linha'],
};

export const chip = 'inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-xs font-medium whitespace-nowrap';

export function EstadoTarefaBadge({ estado }: { estado: EstadoTarefa }) {
  const [s, c] = ESTILO_TAREFA[estado];
  return <span className={`${chip} ${c}`}><span aria-hidden>{s}</span>{ROTULO_ESTADO_TAREFA[estado]}</span>;
}

export function EstadoConfigBadge({ estado }: { estado: EstadoConfig }) {
  const c = estado === 'habilitado' ? 'bg-vx-verde-claro text-vx-verde-escuro border-vx-verde/25'
    : estado === 'desabilitado' ? 'bg-vx-fundo text-vx-texto-2 border-vx-linha' : 'bg-vx-alerta-claro text-vx-alerta border-vx-alerta/25';
  const s = estado === 'habilitado' ? '✓' : estado === 'desabilitado' ? '⊘' : '…';
  return <span className={`${chip} ${c}`}><span aria-hidden>{s}</span>{ROTULO_CONFIG[estado]}</span>;
}

export function EstadoAprovacaoBadge({ estado }: { estado: keyof typeof ROTULO_APROVACAO }) {
  const c = estado === 'aprovada' ? 'bg-vx-verde-claro text-vx-verde-escuro border-vx-verde/25'
    : estado === 'pendente' ? 'bg-vx-aprovacao-claro text-vx-aprovacao border-vx-aprovacao/25' : 'bg-vx-fundo text-vx-texto-2 border-vx-linha';
  const s = estado === 'aprovada' ? '✓' : estado === 'pendente' ? '◆' : estado === 'rejeitada' ? '✕' : '–';
  return <span className={`${chip} ${c}`}><span aria-hidden>{s}</span>{ROTULO_APROVACAO[estado]}</span>;
}

export function Demo({ ativo = true }: { ativo?: boolean }) {
  if (!ativo) return null;
  return <span className={`${chip} border-dashed border-vx-linha-forte bg-white text-vx-texto-2`} title="Dado ou execução sintética">Demonstração</span>;
}

// Prazo com rótulo explícito quando atrasado (não depende só da cor).
export function Prazo({ v }: { v: string | null }) {
  const late = atrasado(v);
  if (!v) return <span className="text-vx-texto-2">Sem prazo</span>;
  return (
    <span className={`tabular ${late ? 'font-semibold text-vx-erro' : ''}`}>
      {dataHora(v)}{late && <span className={`${chip} ml-1.5 border-vx-erro/25 bg-vx-erro-claro text-vx-erro`}><span aria-hidden>!</span>Atrasado</span>}
    </span>
  );
}

// Cabeçalho padrão de tela: título, descrição curta, ação principal à direita e filtros abaixo.
export function Cabecalho({ titulo, descricao, acoes, filtros, trilha, extra }: {
  titulo: React.ReactNode; descricao?: React.ReactNode; acoes?: React.ReactNode; filtros?: React.ReactNode; trilha?: React.ReactNode; extra?: React.ReactNode;
}) {
  return (
    <header className="space-y-3">
      {trilha && <nav aria-label="Trilha" className="text-sm text-vx-texto-2">{trilha}</nav>}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-vx-grafite">{titulo}</h1>
            {extra}
          </div>
          {descricao && <p className="mt-1 max-w-3xl text-sm text-vx-texto-2">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {filtros}
    </header>
  );
}

// Barra compacta de filtros (formulário GET).
export function BarraFiltros({ action, children }: { action: string; children: React.ReactNode }) {
  return (
    <form action={action} role="search" className="flex flex-wrap items-end gap-2 rounded-lg border border-vx-linha bg-vx-superficie p-2.5 shadow-vx">
      {children}
    </form>
  );
}

export function CampoFiltro({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-vx-texto-2">{rotulo}{children}</label>;
}

export function Painel({ children, className = '', destaque = false, ...r }: React.HTMLAttributes<HTMLDivElement> & { destaque?: boolean }) {
  return <div {...r} className={`rounded-lg border bg-vx-superficie shadow-vx ${destaque ? 'border-vx-verde/50' : 'border-vx-linha'} ${className}`}>{children}</div>;
}

export function Secao({ titulo, total, children, id, acao }: { titulo: string; total?: number; children: React.ReactNode; id?: string; acao?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-vx-linha bg-vx-superficie shadow-vx">
      <div className="flex items-center gap-2 border-b border-vx-linha px-4 py-2.5">
        <h2 id={id} className="text-[15px] font-semibold text-vx-grafite">{titulo}</h2>
        {total !== undefined && <span className="tabular rounded-md bg-vx-fundo px-1.5 text-xs font-semibold text-vx-texto-2">{total}</span>}
        {acao && <div className="ml-auto">{acao}</div>}
      </div>
      <div className="px-2 py-1.5">{children}</div>
    </section>
  );
}

// Estado vazio: diz o que aconteceu e, quando houver, o que fazer.
export function Vazio({ children = 'Nada por aqui.', acao }: { children?: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-2 py-4 text-sm text-vx-texto-2">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-vx-linha-forte text-xs">–</span>
      <span className="flex-1">{children}</span>
      {acao}
    </div>
  );
}

export function Aviso({ tom = 'info', titulo, children }: { tom?: 'info' | 'alerta' | 'erro'; titulo?: string; children: React.ReactNode }) {
  const c = tom === 'erro' ? 'border-vx-erro/30 bg-vx-erro-claro text-vx-erro' : tom === 'alerta' ? 'border-vx-alerta/30 bg-vx-alerta-claro text-vx-grafite' : 'border-vx-linha bg-vx-superficie text-vx-grafite';
  return (
    <div role={tom === 'erro' ? 'alert' : 'note'} className={`flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${c}`}>
      <span aria-hidden className="font-bold">{tom === 'erro' ? '✕' : tom === 'alerta' ? '!' : 'i'}</span>
      <div>{titulo && <strong className="font-semibold">{titulo} </strong>}{children}</div>
    </div>
  );
}

// Linha de tarefa: título e estado primeiro; depois responsável, prazo e próximo passo.
export function LinhaTarefa({ t }: { t: TarefaLista }) {
  return (
    <li className="border-b border-vx-linha last:border-0">
      <Link href={`/tarefas/${t.id}`} className="block rounded-md px-2 py-2.5 hover:bg-vx-fundo">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 font-medium leading-snug text-vx-grafite">{t.objetivo}</span>
          <EstadoTarefaBadge estado={t.estado} />
        </div>
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-vx-texto-2">
          <div><dt className="sr-only">Cliente ou área</dt><dd>{t.cliente_nome ?? `Interno · ${t.departamento_nome}`}</dd></div>
          <div className="flex gap-1"><dt>Responsável</dt><dd className="font-medium text-vx-grafite">{t.dono_nome ?? 'Sem dono'}</dd></div>
          <div className="flex gap-1"><dt>Prazo</dt><dd><Prazo v={t.prazo} /></dd></div>
          {t.demo && <dd><Demo /></dd>}
        </dl>
        {t.motivo_bloqueio
          ? <p className="mt-1.5 text-[13px] text-vx-alerta"><span className="font-semibold">Bloqueio:</span> {t.motivo_bloqueio}</p>
          : t.proximo_passo && <p className="mt-1.5 text-[13px]"><span className="font-semibold">Próximo passo:</span> {t.proximo_passo}</p>}
      </Link>
    </li>
  );
}

// Linha de definição compacta (rótulo à esquerda, valor à direita).
export function Dados({ itens }: { itens: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {itens.map(([k, v]) => <div key={k} className="contents"><dt className="text-vx-texto-2">{k}</dt><dd className="min-w-0">{v}</dd></div>)}
    </dl>
  );
}

const base = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed';
export const botao = `${base} bg-vx-verde text-white shadow-vx hover:bg-vx-verde-escuro disabled:bg-vx-linha disabled:text-vx-texto-2`;
export const botaoSec = `${base} border border-vx-linha-forte bg-white text-vx-grafite hover:bg-vx-fundo`;
export const botaoPerigo = `${base} border border-vx-erro/40 bg-white text-vx-erro hover:bg-vx-erro-claro`;
export const campo = 'min-h-9 rounded-md border border-vx-linha-forte bg-white px-2.5 py-1.5 text-sm text-vx-grafite';
export const link = 'font-medium text-vx-verde-escuro underline decoration-vx-verde/40 hover:decoration-vx-verde';
