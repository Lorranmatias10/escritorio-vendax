import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { clientesVisiveis, listarTarefas, listarEntregas, listarIncidentes, usuarios } from '@/lib/dados';
import { ESTADOS_TAREFA, ROTULO_ESTADO_TAREFA, type EstadoTarefa } from '@/lib/catalogo';
import { LinhaTarefa, Secao, Vazio, Demo, Prazo, campo, botao } from '@/components/ui';

const data = /^\d{4}-\d{2}-\d{2}$/;

export default async function Clientes({ searchParams }: PageProps<'/clientes'>) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { b, u } = await contexto();
  const [clientes, pessoas] = await Promise.all([clientesVisiveis(b, u), usuarios(b)]);
  // Filtros validados: cliente só entre os permitidos (o escopo também é aplicado na consulta).
  const f = {
    cliente: clientes.some(c => c.id === sp.cliente) ? sp.cliente : undefined,
    estado: ESTADOS_TAREFA.includes(sp.estado as EstadoTarefa) ? sp.estado : undefined,
    dono: pessoas.some(p => p.id === sp.dono) ? sp.dono : undefined,
    de: data.test(sp.de ?? '') ? sp.de : undefined,
    ate: data.test(sp.ate ?? '') ? sp.ate : undefined,
  };
  const [tarefas, entregas, incidentes] = await Promise.all([
    listarTarefas(b, u, { ...f, raiz: false }).then(ts => ts.filter(t => t.cliente_id)),
    listarEntregas(b, u, { cliente: f.cliente, de: f.de, ate: f.ate }),
    listarIncidentes(b, u, { cliente: f.cliente }),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-vx-texto-2">Tarefas, entregas e incidentes dos clientes que <strong>{u.nome}</strong> pode acessar ({clientes.length}).</p>
      </div>
      <form action="/clientes" className="flex flex-wrap items-end gap-3 rounded-xl border border-vx-linha bg-white p-4 text-sm">
        <label className="flex flex-col gap-1">Cliente
          <select name="cliente" defaultValue={f.cliente ?? ''} className={campo}>
            <option value="">Todos os permitidos</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.demo ? ' (Demonstração)' : ''}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Estado
          <select name="estado" defaultValue={f.estado ?? ''} className={campo}>
            <option value="">Todos</option>
            {ESTADOS_TAREFA.map(e => <option key={e} value={e}>{ROTULO_ESTADO_TAREFA[e]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Responsável
          <select name="dono" defaultValue={f.dono ?? ''} className={campo}>
            <option value="">Todos</option>
            {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">De<input type="date" name="de" defaultValue={f.de} className={campo} /></label>
        <label className="flex flex-col gap-1">Até<input type="date" name="ate" defaultValue={f.ate} className={campo} /></label>
        <button className={botao}>Aplicar filtros</button>
        <Link href="/clientes" className="py-2 underline">Limpar</Link>
      </form>
      {clientes.length === 0 && <Vazio>Você não tem clientes liberados.</Vazio>}
      <Secao titulo="Tarefas" total={tarefas.length} id="tarefas">
        {tarefas.length ? <ul>{tarefas.map(t => <LinhaTarefa key={t.id} t={t} />)}</ul> : <Vazio>Nenhuma tarefa com estes filtros.</Vazio>}
      </Secao>
      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Entregas" total={entregas.length} id="entregas">
          {entregas.length ? (
            <ul className="divide-y divide-vx-linha text-sm">
              {entregas.map(e => (
                <li key={e.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{e.titulo}</span><Demo ativo={e.demo} /></div>
                  <div className="text-vx-texto-2">{e.cliente_nome} · {({ planejada: 'Planejada', em_andamento: 'Em andamento', entregue: 'Entregue', atrasada: 'Atrasada' } as Record<string, string>)[e.estado]} · Prazo: <Prazo v={e.prazo} />
                    {e.tarefa_id && <> · <Link className="underline" href={`/tarefas/${e.tarefa_id}`}>tarefa</Link></>}</div>
                </li>
              ))}
            </ul>
          ) : <Vazio>Sem dados</Vazio>}
        </Secao>
        <Secao titulo="Incidentes" total={incidentes.length} id="incidentes">
          {incidentes.length ? (
            <ul className="divide-y divide-vx-linha text-sm">
              {incidentes.map(i => (
                <li key={i.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{i.titulo}</span><Demo ativo={i.demo} /></div>
                  <div className="text-vx-texto-2">{i.cliente_nome ?? 'Área interna'} · severidade {i.severidade === 'media' ? 'média' : i.severidade} · {({ aberto: 'Aberto', em_tratamento: 'Em tratamento', resolvido: 'Resolvido' } as Record<string, string>)[i.estado]}</div>
                </li>
              ))}
            </ul>
          ) : <Vazio>Sem dados</Vazio>}
        </Secao>
      </div>
    </div>
  );
}
