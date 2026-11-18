import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { hoje } from '@/lib/dados';
import { LinhaTarefa, Secao, Vazio, Demo, Prazo, EstadoAprovacaoBadge } from '@/components/ui';

export default async function Hoje() {
  const { b, u } = await contexto();
  const h = await hoje(b, u);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hoje</h1>
        <p className="text-sm text-vx-texto-2">O que precisa de alguém agora, visto como <strong>{u.nome}</strong>. Os contadores mostram só o que você pode acessar.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Pendências com dono e prazo" total={h.pendencias.length} id="pendencias">
          {h.pendencias.length ? <ul>{h.pendencias.map(t => <LinhaTarefa key={t.id} t={t} />)}</ul> : <Vazio>Nenhuma pendência.</Vazio>}
        </Secao>
        <Secao titulo="Bloqueadas ou com falha" total={h.bloqueadas.length} id="bloqueadas">
          {h.bloqueadas.length ? <ul>{h.bloqueadas.map(t => <LinhaTarefa key={t.id} t={t} />)}</ul> : <Vazio>Nada bloqueado.</Vazio>}
        </Secao>
        <Secao titulo="Aprovações pendentes" total={h.aprovacoes.length} id="aprovacoes">
          {h.aprovacoes.length ? (
            <ul>
              {h.aprovacoes.map(a => (
                <li key={a.id} className="border-b border-vx-linha py-2.5 last:border-0">
                  <Link href={`/aprovacoes#${a.id}`} className="block rounded-md px-2 hover:bg-vx-fundo">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{a.intencao}</span><EstadoAprovacaoBadge estado="pendente" /><Demo ativo={a.demo} /></div>
                    <div className="text-sm text-vx-texto-2">Aprovador: {a.aprovador_nome} · Alvo: {a.alvo} · Até <Prazo v={a.prazo} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Vazio>Nenhuma aprovação pendente.</Vazio>}
        </Secao>
        <Secao titulo="Incidentes abertos" total={h.incidentes.length} id="incidentes">
          {h.incidentes.length ? (
            <ul>
              {h.incidentes.map(i => (
                <li key={i.id} className="border-b border-vx-linha py-2.5 last:border-0">
                  <Link href={i.tarefa_id ? `/tarefas/${i.tarefa_id}` : '/clientes'} className="block rounded-md px-2 hover:bg-vx-fundo">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{i.titulo}</span>
                      <span className="text-xs font-semibold uppercase">Severidade {i.severidade === 'media' ? 'média' : i.severidade}</span>
                      <span className="text-xs">· {i.estado === 'em_tratamento' ? 'Em tratamento' : 'Aberto'}</span>
                      <Demo ativo={i.demo} />
                    </div>
                    <div className="text-sm text-vx-texto-2">{i.cliente_nome ?? 'Área interna · Financeiro e Administrativo'}</div>
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
