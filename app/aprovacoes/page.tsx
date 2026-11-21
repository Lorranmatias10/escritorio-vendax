import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { listarAprovacoes } from '@/lib/dados';
import { dataHora } from '@/lib/formato';
import { acaoDecidir } from '@/app/acoes';
import { EstadoAprovacaoBadge, Demo, Prazo, Vazio, botao, botaoSec, campo, Cabecalho, Aviso, Dados, link } from '@/components/ui';

const Contador = ({ n }: { n: number }) => <span className="tabular rounded-md bg-vx-superficie px-1.5 text-xs font-semibold text-vx-texto-2 ring-1 ring-vx-linha">{n}</span>;

export default async function Aprovacoes() {
  const { b, u } = await contexto();
  const todas = await listarAprovacoes(b, u);
  const pendentes = todas.filter(a => a.estado === 'pendente');
  const historico = todas.filter(a => a.estado !== 'pendente');
  return (
    <div className="space-y-5">
      <Cabecalho titulo="Aprovações e histórico" descricao="Revisões internas e decisões supervisionadas, com prazo, aprovador e histórico." />
      <Aviso tom="alerta" titulo="Ações externas desabilitadas na V1.">Aprovar registra a decisão no Escritório. Ações de envio ou publicação ficam desabilitadas.</Aviso>
      <section aria-labelledby="pend">
        <h2 id="pend" className="mb-2 flex items-center gap-2 text-[15px] font-semibold">Pendentes <Contador n={pendentes.length} /></h2>
        {pendentes.length ? <div className="space-y-3">{pendentes.map(a => <Cartao key={a.id} a={a} podeDecidir={u.id === a.aprovador_id || u.perfil === 'admin'} />)}</div>
          : <div className="rounded-lg border border-vx-linha bg-vx-superficie"><Vazio>Nenhuma aprovação pendente. Elas aparecem aqui quando um agente prepara uma ação que precisa de decisão.</Vazio></div>}
      </section>
      <section aria-labelledby="hist">
        <h2 id="hist" className="mb-2 flex items-center gap-2 text-[15px] font-semibold">Histórico <Contador n={historico.length} /></h2>
        {historico.length ? <div className="space-y-3">{historico.map(a => <Cartao key={a.id} a={a} podeDecidir={false} />)}</div>
          : <div className="rounded-lg border border-vx-linha bg-vx-superficie"><Vazio>Nenhuma decisão registrada ainda.</Vazio></div>}
      </section>
    </div>
  );
}

function Cartao({ a, podeDecidir }: { a: Awaited<ReturnType<typeof listarAprovacoes>>[number]; podeDecidir: boolean }) {
  return (
    <article id={a.id} className={`scroll-mt-4 rounded-lg border bg-vx-superficie p-4 shadow-vx target:ring-2 target:ring-vx-verde/40 ${a.estado === 'pendente' ? 'border-vx-aprovacao/30' : 'border-vx-linha'}`}>
      <div className="flex flex-wrap items-start gap-2">
        <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug">{a.intencao}</h3>
        <EstadoAprovacaoBadge estado={a.estado as 'pendente'} /><Demo ativo={a.demo} />
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Dados itens={[
          ['Alvo', a.alvo], ['Conta', a.conta], ['Aprovador', a.aprovador_nome], ['Válida até', <Prazo key="p" v={a.prazo} />], ['Modo', a.modo],
          ['Tarefa', <Link key="t" className={link} href={`/tarefas/${a.tarefa_id}`}>{a.objetivo}</Link>],
        ]} />
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-vx-texto-2">Parâmetros exatos</h4>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-vx-linha bg-vx-fundo p-2 text-xs">{JSON.stringify(a.parametros, null, 2)}</pre>
        </div>
      </div>
      <div className="mt-4 border-t border-vx-linha pt-3 text-sm">
        {a.estado === 'pendente' ? (
          podeDecidir ? (
            <form action={acaoDecidir} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="aprovacao" value={a.id} />
              <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-vx-texto-2">Nota da decisão (opcional)<input name="nota" maxLength={500} className={campo} /></label>
              <button name="decisao" value="aprovada" className={botao}>{a.modo === 'A1' || a.alvo === 'Revisão interna' ? 'Aprovar rascunho' : 'Aprovar (simulado)'}</button>
              <button name="decisao" value="rejeitada" className={botaoSec}>Rejeitar</button>
            </form>
          ) : <p className="text-vx-texto-2">Somente {a.aprovador_nome} ou a direção pode decidir.</p>
        ) : (
          <p><strong className="font-semibold">Decisão:</strong> {a.estado} por {a.decidido_por_nome ?? '—'} em {dataHora(a.decidido_em)}{a.decisao_nota ? `, nota “${a.decisao_nota}”` : ''}. Execução externa desabilitada na V1: nada foi enviado.</p>
        )}
      </div>
    </article>
  );
}
