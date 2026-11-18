import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { listarAprovacoes } from '@/lib/dados';
import { dataHora } from '@/lib/formato';
import { acaoDecidir } from '@/app/acoes';
import { EstadoAprovacaoBadge, Demo, Prazo, Vazio, botao, botaoSec, campo } from '@/components/ui';

export default async function Aprovacoes() {
  const { b, u } = await contexto();
  const todas = await listarAprovacoes(b, u);
  const pendentes = todas.filter(a => a.estado === 'pendente');
  const historico = todas.filter(a => a.estado !== 'pendente');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Aprovações e histórico</h1>
        <p className="text-sm text-vx-texto-2">A3 · ação supervisionada. Cada aprovação fica vinculada aos parâmetros exatos, prazo, conta e aprovador.</p>
      </div>
      <p role="note" className="rounded-xl border border-vx-alerta/40 bg-vx-alerta-claro p-3 text-sm">
        <strong>Ações externas desabilitadas na V1.</strong> Aprovar registra a decisão e a evidência de “ação solicitada”, mas nada é enviado, publicado ou alterado fora do escritório.
      </p>
      <section aria-labelledby="pend">
        <h2 id="pend" className="mb-2 text-sm font-semibold uppercase tracking-wide text-vx-texto-2">Pendentes ({pendentes.length})</h2>
        {pendentes.length ? <div className="space-y-3">{pendentes.map(a => <Cartao key={a.id} a={a} podeDecidir={u.id === a.aprovador_id || u.perfil === 'admin'} />)}</div>
          : <Vazio>Nenhuma aprovação pendente. Dispare o fluxo piloto em Demonstração para gerar uma.</Vazio>}
      </section>
      <section aria-labelledby="hist">
        <h2 id="hist" className="mb-2 text-sm font-semibold uppercase tracking-wide text-vx-texto-2">Histórico ({historico.length})</h2>
        {historico.length ? <div className="space-y-3">{historico.map(a => <Cartao key={a.id} a={a} podeDecidir={false} />)}</div> : <Vazio>Sem decisões registradas.</Vazio>}
      </section>
    </div>
  );
}

function Cartao({ a, podeDecidir }: { a: Awaited<ReturnType<typeof listarAprovacoes>>[number]; podeDecidir: boolean }) {
  return (
    <article id={a.id} className="scroll-mt-4 rounded-xl border border-vx-linha bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{a.intencao}</h3>
        <EstadoAprovacaoBadge estado={a.estado as 'pendente'} /><Demo ativo={a.demo} />
      </div>
      <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <div><dt className="inline text-vx-texto-2">Intenção registrada: </dt><dd className="inline">{a.intencao} ({a.modo})</dd></div>
        <div><dt className="inline text-vx-texto-2">Alvo: </dt><dd className="inline">{a.alvo}</dd></div>
        <div><dt className="inline text-vx-texto-2">Conta: </dt><dd className="inline">{a.conta}</dd></div>
        <div><dt className="inline text-vx-texto-2">Aprovador: </dt><dd className="inline">{a.aprovador_nome}</dd></div>
        <div><dt className="inline text-vx-texto-2">Válida até: </dt><dd className="inline"><Prazo v={a.prazo} /></dd></div>
        <div><dt className="inline text-vx-texto-2">Tarefa: </dt><dd className="inline"><Link className="underline" href={`/tarefas/${a.tarefa_id}`}>{a.objetivo}</Link></dd></div>
      </dl>
      <h4 className="mt-3 text-xs font-semibold uppercase text-vx-texto-2">Parâmetros exatos</h4>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-vx-fundo p-2 text-xs">{JSON.stringify(a.parametros, null, 2)}</pre>
      {a.estado === 'pendente' ? (
        podeDecidir ? (
          <form action={acaoDecidir} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="aprovacao" value={a.id} />
            <label className="flex flex-1 flex-col gap-1">Nota da decisão (opcional)<input name="nota" maxLength={500} className={campo} /></label>
            <button name="decisao" value="aprovada" className={botao}>Aprovar (simulado)</button>
            <button name="decisao" value="rejeitada" className={botaoSec}>Rejeitar</button>
          </form>
        ) : <p className="mt-3 text-vx-texto-2">Somente {a.aprovador_nome} ou a direção pode decidir.</p>
      ) : (
        <p className="mt-3"><strong>Decisão:</strong> {a.estado} por {a.decidido_por_nome ?? '—'} em {dataHora(a.decidido_em)}{a.decisao_nota ? ` · “${a.decisao_nota}”` : ''}. <strong>Execução externa: desabilitada (V1)</strong> — nada foi enviado.</p>
      )}
    </article>
  );
}
