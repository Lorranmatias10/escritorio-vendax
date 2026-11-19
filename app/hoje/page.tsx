import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { hoje } from '@/lib/dados';
import { LinhaTarefa, Secao, Vazio, Demo, Prazo, EstadoAprovacaoBadge, Cabecalho, link, botaoSec, chip } from '@/components/ui';

const severidade = (s: string) => `${chip} ${s === 'alta' ? 'border-vx-erro/25 bg-vx-erro-claro text-vx-erro' : 'border-vx-alerta/25 bg-vx-alerta-claro text-vx-alerta'}`;

export default async function Hoje() {
  const { b, u } = await contexto();
  const h = await hoje(b, u);
  const totais = [
    ['Pendências', h.pendencias.length, '#pendencias', 'text-vx-grafite'],
    ['Bloqueadas ou com falha', h.bloqueadas.length, '#bloqueadas', 'text-vx-alerta'],
    ['Aprovações pendentes', h.aprovacoes.length, '#aprovacoes', 'text-vx-aprovacao'],
    ['Incidentes abertos', h.incidentes.length, '#incidentes', 'text-vx-erro'],
  ] as const;
  return (
    <div className="space-y-5">
      <Cabecalho titulo="Hoje"
        descricao={<>O que precisa de alguém agora, visto como <strong className="font-semibold text-vx-grafite">{u.nome}</strong>. Os números mostram só o que você pode acessar.</>}
        acoes={<Link href="/escritorio" className={botaoSec}>Abrir o escritório</Link>} />
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do dia">
        {totais.map(([k, n, href, cor]) => (
          <li key={k}>
            <a href={href} className="block rounded-lg border border-vx-linha bg-vx-superficie px-4 py-3 shadow-vx hover:border-vx-linha-forte">
              <span className="block text-[13px] text-vx-texto-2">{k}</span>
              <span className={`tabular block text-2xl font-semibold ${n ? cor : 'text-vx-texto-2'}`}>{n}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Pendências com dono e prazo" total={h.pendencias.length} id="pendencias">
          {h.pendencias.length ? <ul>{h.pendencias.map(t => <LinhaTarefa key={t.id} t={t} />)}</ul> : <Vazio>Nenhuma pendência com você agora.</Vazio>}
        </Secao>
        <Secao titulo="Bloqueadas ou com falha" total={h.bloqueadas.length} id="bloqueadas">
          {h.bloqueadas.length ? <ul>{h.bloqueadas.map(t => <LinhaTarefa key={t.id} t={t} />)}</ul> : <Vazio>Nada bloqueado ou com falha.</Vazio>}
        </Secao>
        <Secao titulo="Aprovações pendentes" total={h.aprovacoes.length} id="aprovacoes">
          {h.aprovacoes.length ? (
            <ul>
              {h.aprovacoes.map(a => (
                <li key={a.id} className="border-b border-vx-linha last:border-0">
                  <Link href={`/aprovacoes#${a.id}`} className="block rounded-md px-2 py-2.5 hover:bg-vx-fundo">
                    <div className="flex items-start gap-2"><span className="flex-1 font-medium leading-snug">{a.intencao}</span><EstadoAprovacaoBadge estado="pendente" /></div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-vx-texto-2">
                      <span>Aprovador <strong className="font-medium text-vx-grafite">{a.aprovador_nome}</strong></span>
                      <span>{a.alvo}</span><span>Válida até <Prazo v={a.prazo} /></span><Demo ativo={a.demo} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Vazio acao={<Link href="/aprovacoes" className={link}>Ver histórico</Link>}>Nenhuma aprovação pendente.</Vazio>}
        </Secao>
        <Secao titulo="Incidentes abertos" total={h.incidentes.length} id="incidentes">
          {h.incidentes.length ? (
            <ul>
              {h.incidentes.map(i => (
                <li key={i.id} className="border-b border-vx-linha last:border-0">
                  <Link href={i.tarefa_id ? `/tarefas/${i.tarefa_id}` : '/clientes'} className="block rounded-md px-2 py-2.5 hover:bg-vx-fundo">
                    <div className="flex items-start gap-2">
                      <span className="flex-1 font-medium leading-snug">{i.titulo}</span>
                      <span className={severidade(i.severidade)}>Severidade {i.severidade === 'media' ? 'média' : i.severidade}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-vx-texto-2">
                      <span>{i.cliente_nome ?? 'Interno · Financeiro e Administrativo'}</span><span>{i.estado === 'em_tratamento' ? 'Em tratamento' : 'Aberto'}</span><Demo ativo={i.demo} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Vazio>Nenhum incidente aberto.</Vazio>}
        </Secao>
      </div>
    </div>
  );
}
