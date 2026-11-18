import Link from 'next/link';
import { ROTULO_ESTADO_TAREFA, ROTULO_CONFIG, ROTULO_APROVACAO, type EstadoTarefa, type EstadoConfig } from '@/lib/catalogo';
import { dataHora, atrasado } from '@/lib/formato';
import type { TarefaLista } from '@/lib/dados';

// Estado sempre com rótulo e símbolo, além da cor.
const ESTILO_TAREFA: Record<EstadoTarefa, [string, string]> = {
  na_fila: ['○', 'bg-white text-vx-grafite border-vx-linha'],
  em_execucao: ['◐', 'bg-vx-info-claro text-vx-info border-vx-info/30'],
  bloqueada: ['■', 'bg-vx-alerta-claro text-vx-alerta border-vx-alerta/30'],
  aguardando_aprovacao: ['◆', 'bg-vx-aprovacao-claro text-vx-aprovacao border-vx-aprovacao/30'],
  concluida: ['✓', 'bg-vx-verde-claro text-vx-verde-escuro border-vx-verde/30'],
  falhou: ['✕', 'bg-vx-erro-claro text-vx-erro border-vx-erro/30'],
  cancelada: ['–', 'bg-vx-fundo text-vx-texto-2 border-vx-linha'],
};

const chip = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap';

export function EstadoTarefaBadge({ estado }: { estado: EstadoTarefa }) {
  const [s, c] = ESTILO_TAREFA[estado];
  return <span className={`${chip} ${c}`}><span aria-hidden>{s}</span>{ROTULO_ESTADO_TAREFA[estado]}</span>;
}

export function EstadoConfigBadge({ estado }: { estado: EstadoConfig }) {
  const c = estado === 'habilitado' ? 'bg-vx-verde-claro text-vx-verde-escuro border-vx-verde/30'
    : estado === 'desabilitado' ? 'bg-vx-fundo text-vx-texto-2 border-vx-linha' : 'bg-vx-alerta-claro text-vx-alerta border-vx-alerta/30';
  const s = estado === 'habilitado' ? '✓' : estado === 'desabilitado' ? '⊘' : '…';
  return <span className={`${chip} ${c}`}><span aria-hidden>{s}</span>{ROTULO_CONFIG[estado]}</span>;
}

export function EstadoAprovacaoBadge({ estado }: { estado: keyof typeof ROTULO_APROVACAO }) {
  const c = estado === 'aprovada' ? 'bg-vx-verde-claro text-vx-verde-escuro border-vx-verde/30'
    : estado === 'pendente' ? 'bg-vx-aprovacao-claro text-vx-aprovacao border-vx-aprovacao/30' : 'bg-vx-fundo text-vx-texto-2 border-vx-linha';
  return <span className={`${chip} ${c}`}>{ROTULO_APROVACAO[estado]}</span>;
}

export function Demo({ ativo = true }: { ativo?: boolean }) {
  if (!ativo) return null;
  return <span className={`${chip} border-vx-alerta/40 bg-vx-alerta-claro text-vx-alerta`} title="Dado ou execução sintética">Demonstração</span>;
}

export function Prazo({ v }: { v: string | null }) {
  const late = atrasado(v);
  return <span className={late ? 'font-semibold text-vx-erro' : ''}>{late && <span className="sr-only">Atrasado: </span>}{dataHora(v)}{late && ' · atrasado'}</span>;
}

export function Secao({ titulo, total, children, id }: { titulo: string; total?: number; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-vx-linha bg-vx-superficie p-4">
      <h2 id={id} className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-vx-texto-2">
        {titulo}{total !== undefined && <span className="rounded-full bg-vx-fundo px-2 py-0.5 text-vx-grafite">{total}</span>}
      </h2>
      {children}
    </section>
  );
}

export function Vazio({ children = 'Sem dados' }: { children?: React.ReactNode }) {
  return <p className="text-sm text-vx-texto-2">{children}</p>;
}

export function LinhaTarefa({ t }: { t: TarefaLista }) {
  return (
    <li className="border-b border-vx-linha last:border-0">
      <Link href={`/tarefas/${t.id}`} className="block rounded-md px-2 py-2.5 hover:bg-vx-fundo">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t.objetivo}</span>
          <EstadoTarefaBadge estado={t.estado} />
          <Demo ativo={t.demo} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-vx-texto-2">
          <span>{t.cliente_nome ?? `Área interna · ${t.departamento_nome}`}</span>
          <span>Dono: {t.dono_nome ?? 'Sem dono'}</span>
          <span>Prazo: <Prazo v={t.prazo} /></span>
          {t.papel_nome && <span>Papel: {t.papel_nome}</span>}
        </div>
        {(t.motivo_bloqueio || t.proximo_passo) && (
          <p className="mt-1 text-sm">{t.motivo_bloqueio ? <>Motivo: {t.motivo_bloqueio}</> : <>Próximo passo: {t.proximo_passo}</>}</p>
        )}
      </Link>
    </li>
  );
}

export const botao = 'inline-flex items-center justify-center gap-2 rounded-lg bg-vx-verde px-3.5 py-2 text-sm font-semibold text-white hover:bg-vx-verde-escuro disabled:cursor-not-allowed disabled:bg-vx-linha disabled:text-vx-texto-2';
export const botaoSec = 'inline-flex items-center justify-center gap-2 rounded-lg border border-vx-linha bg-white px-3.5 py-2 text-sm font-semibold text-vx-grafite hover:bg-vx-fundo';
export const campo = 'rounded-lg border border-vx-linha bg-white px-3 py-2 text-sm';
