import Link from 'next/link';
import Image from 'next/image';
import { contexto } from '@/lib/sessao';
import { salas, listarTarefas, obterPapel, type Sala, type TarefaLista } from '@/lib/dados';
import { DEPARTAMENTOS, ESTADOS_TAREFA, ROTULO_ESTADO_TAREFA, ROTULO_FASE, ROTULO_CONFIG, MODOS, type EstadoTarefa } from '@/lib/catalogo';
import { dataHora } from '@/lib/formato';
import { EstadoConfigBadge, EstadoTarefaBadge, LinhaTarefa, Vazio, Demo, campo, botaoSec } from '@/components/ui';

type Params = { vista?: string; sala?: string; agente?: string; estado?: string };

// Monta a URL mantendo vista e filtro selecionados (prédio e lista abrem os mesmos registros).
function url(p: Params, mudar: Partial<Params>) {
  const n = { ...p, ...mudar };
  const s = new URLSearchParams(Object.entries(n).filter(([, v]) => v) as [string, string][]);
  return `/escritorio${s.size ? `?${s}` : ''}`;
}

function resumo(s: Sala) {
  const c = s.contagem;
  if ((c.bloqueada ?? 0) + (c.falhou ?? 0)) return `■ ${(c.bloqueada ?? 0) + (c.falhou ?? 0)} bloqueada(s) ou com falha`;
  if (c.aguardando_aprovacao) return `◆ ${c.aguardando_aprovacao} aguardando aprovação`;
  if (s.abertas) return `○ ${s.abertas} aberta(s)`;
  return 'Sem pendências';
}
const iniciais = (nome: string) => nome.replace(/\(.*\)/, '').split(/\s+/).filter(w => w.length > 2 && !/^(de|em|e|da|do)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export default async function Escritorio({ searchParams }: PageProps<'/escritorio'>) {
  const sp = (await searchParams) as Params;
  const estado = ESTADOS_TAREFA.includes(sp.estado as EstadoTarefa) ? sp.estado : undefined;
  const p: Params = { vista: sp.vista === 'lista' ? 'lista' : sp.vista === 'predio' ? 'predio' : undefined, sala: sp.sala, agente: sp.agente, estado };
  const { b, u } = await contexto();
  const [lista, tarefas, agente] = await Promise.all([
    salas(b, u, estado), listarTarefas(b, u, { estado }), p.agente ? obterPapel(b, u, p.agente) : null,
  ]);
  const porSala = (id: string) => tarefas.filter(t => t.departamento_id === id);
  const salaSel = lista.find(s => s.id === p.sala);
  const andares = [5, 4, 3, 2, 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Escritório</h1>
          <p className="text-sm text-vx-texto-2">5 andares · 9 salas · {lista.reduce((n, s) => n + s.papeis.length, 0)} papéis. Clique numa sala para abrir a fila ou num agente para ver o papel.</p>
        </div>
        <div role="tablist" aria-label="Forma de visualização" className="flex rounded-lg border border-vx-linha bg-white p-0.5 text-sm">
          {[['predio', 'Prédio'], ['lista', 'Lista']].map(([v, n]) => {
            const ativo = (p.vista ?? 'predio') === v;
            // Sem escolha explícita: lista ativa em telas pequenas, prédio a partir de md.
            const cls = p.vista ? (ativo ? 'bg-vx-verde text-white' : '')
              : v === 'lista' ? 'bg-vx-verde text-white md:bg-transparent md:text-inherit' : 'md:bg-vx-verde md:text-white';
            return <Link key={v} role="tab" aria-selected={ativo} href={url(p, { vista: v })} className={`rounded-md px-3 py-1.5 font-medium ${cls}`}>{n}</Link>;
          })}
        </div>
        <form className="flex items-center gap-2 text-sm" action="/escritorio">
          {p.vista && <input type="hidden" name="vista" value={p.vista} />}
          {p.sala && <input type="hidden" name="sala" value={p.sala} />}
          <label htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={estado ?? ''} className={campo}>
            <option value="">Todos</option>
            {ESTADOS_TAREFA.map(e => <option key={e} value={e}>{ROTULO_ESTADO_TAREFA[e]}</option>)}
          </select>
          <button className={botaoSec}>Filtrar</button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          {/* Prédio: em telas pequenas a lista vem primeiro (o prédio fica escondido até escolher "Prédio") */}
          {p.vista !== 'lista' && (
            <div className={`${p.vista === 'predio' ? '' : 'hidden md:block'} relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-vx-linha bg-white`}>
              <Image src="/escritorio.png" alt="Corte frontal do prédio da Vendax com cinco andares e elevador lateral" fill priority sizes="(min-width: 1024px) 900px, 100vw" className="object-contain" />
              {lista.map(s => {
                const [x, y, w, h] = DEPARTAMENTOS.find(d => d.id === s.id)!.r;
                const sel = s.id === p.sala;
                return (
                  <div key={s.id} className={`absolute rounded-md border-2 ${sel ? 'border-vx-verde bg-vx-verde/10' : 'border-transparent hover:border-vx-verde/60'}`}
                    style={{ left: `${(x / 1536) * 100}%`, top: `${(y / 1024) * 100}%`, width: `${(w / 1536) * 100}%`, height: `${(h / 1024) * 100}%` }}>
                    <Link href={url(p, { sala: s.id, agente: undefined })} aria-current={sel ? 'true' : undefined}
                      className="absolute left-1 top-1 max-w-[95%] rounded-md bg-vx-grafite/85 px-2 py-1 text-[clamp(8px,0.85vw,12px)] leading-tight text-white">
                      <span className="block font-semibold">{s.nome}</span>
                      <span className="block opacity-90">{resumo(s)}</span>
                    </Link>
                    <ul className="absolute bottom-1 left-1 flex flex-wrap gap-1" aria-label={`Agentes de ${s.nome}`}>
                      {s.papeis.map(a => (
                        <li key={a.id}>
                          <Link href={url(p, { agente: a.id, sala: s.id })} title={`${a.nome} · ${ROTULO_CONFIG[a.estado_config]}`}
                            aria-label={`${a.nome}, ${ROTULO_FASE[a.fase]}, ${ROTULO_CONFIG[a.estado_config]}`}
                            className={`grid h-[clamp(18px,2.2vw,30px)] w-[clamp(18px,2.2vw,30px)] place-items-center rounded-full border-2 text-[clamp(7px,0.7vw,10px)] font-bold
                              ${a.estado_config === 'habilitado' ? 'border-white bg-vx-verde text-white' : a.fase === 'piloto' && a.estado_config !== 'desabilitado' ? 'border-vx-verde bg-white text-vx-verde-escuro' : 'border-white/70 bg-vx-grafite/70 text-white/80'} ${p.agente === a.id ? 'ring-2 ring-vx-verde' : ''}`}>
                            {iniciais(a.nome)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lista: mesma fonte de dados */}
          <div className={p.vista === 'lista' ? 'space-y-4' : p.vista === 'predio' ? 'hidden' : 'space-y-4 md:hidden'}>
            {andares.map(n => (
              <section key={n} aria-labelledby={`andar-${n}`}>
                <h2 id={`andar-${n}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-vx-texto-2">{n}º andar</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {lista.filter(s => s.andar === n).map(s => <CartaoSala key={s.id} s={s} p={p} tarefas={porSala(s.id)} />)}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside aria-label="Detalhes" className="space-y-4">
          {agente ? <PainelAgente a={agente} fechar={url(p, { agente: undefined })} />
            : salaSel ? <PainelSala s={salaSel} tarefas={porSala(salaSel.id)} p={p} />
            : <div className="rounded-xl border border-vx-linha bg-white p-4 text-sm text-vx-texto-2">Selecione uma sala ou um agente. {estado && <>Filtro ativo: <strong>{ROTULO_ESTADO_TAREFA[estado as EstadoTarefa]}</strong>.</>}</div>}
          <Legenda />
        </aside>
      </div>
    </div>
  );
}

function CartaoSala({ s, p, tarefas }: { s: Sala; p: Params; tarefas: TarefaLista[] }) {
  return (
    <div className={`rounded-xl border bg-white p-3 ${s.id === p.sala ? 'border-vx-verde' : 'border-vx-linha'}`}>
      <Link href={url(p, { sala: s.id, agente: undefined })} className="font-semibold text-vx-verde-escuro underline">{s.nome}</Link>
      <p className="text-sm text-vx-texto-2">{resumo(s)} · {s.responsavel_humano}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Agentes de ${s.nome}`}>
        {s.papeis.map(a => (
          <li key={a.id}><Link href={url(p, { agente: a.id, sala: s.id })} className={`inline-block rounded-full border px-2 py-0.5 text-xs ${a.fase === 'piloto' ? 'border-vx-verde text-vx-verde-escuro' : 'border-vx-linha text-vx-texto-2'}`}>{a.nome}</Link></li>
        ))}
      </ul>
      {tarefas.length > 0 && <ul className="mt-2">{tarefas.slice(0, 4).map(t => <LinhaTarefa key={t.id} t={t} />)}</ul>}
    </div>
  );
}

function PainelSala({ s, tarefas, p }: { s: Sala; tarefas: TarefaLista[]; p: Params }) {
  return (
    <div className="rounded-xl border border-vx-verde bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold">{s.nome}</h2>
        <Link href={url(p, { sala: undefined })} className="text-sm underline">Fechar</Link>
      </div>
      <p className="text-sm text-vx-texto-2">{s.andar}º andar · Responsável: {s.responsavel_humano}</p>
      <p className="mt-1 text-sm"><strong>Fila:</strong> {s.fila}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {Object.entries(s.contagem).map(([e, n]) => <li key={e} className="flex items-center gap-1 text-sm"><EstadoTarefaBadge estado={e as EstadoTarefa} />{n}</li>)}
      </ul>
      <h3 className="mt-3 text-sm font-semibold">Fila da sala ({tarefas.length})</h3>
      {tarefas.length ? <ul>{tarefas.map(t => <LinhaTarefa key={t.id} t={t} />)}</ul> : <Vazio>Sem tarefas visíveis{p.estado ? ' com este filtro' : ''}.</Vazio>}
      <Link href={url(p, { vista: 'lista' })} className="mt-2 inline-block text-sm underline">Abrir na lista</Link>
    </div>
  );
}

function PainelAgente({ a, fechar }: { a: NonNullable<Awaited<ReturnType<typeof obterPapel>>>; fechar: string }) {
  const ultima = a.historico[0];
  return (
    <div className="rounded-xl border border-vx-verde bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold">{a.nome}</h2>
        <Link href={fechar} className="underline">Fechar</Link>
      </div>
      <p className="text-vx-texto-2">{a.departamento_nome} · ID <code>{a.id}</code></p>
      <div className="mt-2 flex flex-wrap gap-1.5"><EstadoConfigBadge estado={a.estado_config} /><span className="rounded-full border border-vx-linha px-2 py-0.5 text-xs">{ROTULO_FASE[a.fase]}</span></div>
      <dl className="mt-3 space-y-1">
        <div><dt className="inline text-vx-texto-2">Dono proposto: </dt><dd className="inline">{a.responsavel_proposto}</dd></div>
        <div><dt className="inline text-vx-texto-2">Modo: </dt><dd className="inline">{MODOS[a.modo as keyof typeof MODOS]}</dd></div>
        <div><dt className="inline text-vx-texto-2">Instrução: </dt><dd className="inline">{a.versao_instrucao ?? 'Sem instrução ativa'}</dd></div>
        {a.vinculo_reservado && <div><dt className="inline text-vx-texto-2">Vínculo: </dt><dd className="inline">{a.vinculo_reservado}</dd></div>}
        <div><dt className="inline text-vx-texto-2">Última execução: </dt><dd className="inline">{ultima ? <>{dataHora(ultima.atualizado_em ?? ultima.criado_em)} · {ultima.estado} <Demo ativo={ultima.demo} /></> : 'Sem dados'}</dd></div>
      </dl>
      <h3 className="mt-3 font-semibold">Histórico autorizado ({a.historico.length})</h3>
      {a.historico.length ? (
        <ul className="mt-1 space-y-1">
          {a.historico.map(h => <li key={h.id}><Link className="underline" href={`/tarefas/${h.tarefa_id}`}>{h.objetivo}</Link> <span className="text-vx-texto-2">· {h.etapa} · {h.estado}</span></li>)}
        </ul>
      ) : <Vazio>Sem execuções que você possa ver.</Vazio>}
      <Link href={`/agentes/${a.id}`} className={`${botaoSec} mt-3`}>Ficha e instruções</Link>
    </div>
  );
}

function Legenda() {
  return (
    <div className="rounded-xl border border-vx-linha bg-white p-4 text-xs text-vx-texto-2">
      <p className="font-semibold text-vx-grafite">Legenda</p>
      <p className="mt-1"><span className="inline-block h-3 w-3 rounded-full bg-vx-verde align-middle" /> Habilitado (A1) · <span className="inline-block h-3 w-3 rounded-full border-2 border-vx-verde bg-white align-middle" /> Piloto em homologação · <span className="inline-block h-3 w-3 rounded-full bg-vx-grafite/70 align-middle" /> Execução desabilitada</p>
      <p className="mt-1">○ aberta · ■ bloqueada ou falha · ◆ aguardando aprovação</p>
    </div>
  );
}
