import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { salas, listarTarefas, obterPapel, usuarios, clientesVisiveis, type Sala, type TarefaLista } from '@/lib/dados';
import { consultarEscritorio } from '@/lib/escritorio-ao-vivo';
import { fluxosDisponiveis } from '@/lib/chat-especialistas';
import { DEPARTAMENTOS, ESTADOS_TAREFA, ROTULO_ESTADO_TAREFA, ROTULO_FASE, ROTULO_CONFIG, MODOS, type EstadoTarefa } from '@/lib/catalogo';
import { dataHora } from '@/lib/formato';
import { EscritorioInterativo } from '@/components/escritorio-interativo';
import type { AgenteVivo } from '@/components/predio-vivo';
import { EstadoConfigBadge, EstadoTarefaBadge, LinhaTarefa, Vazio, Demo, Painel, Dados, campo, botaoSec, link, chip } from '@/components/ui';

type Params = { vista?: string; sala?: string; agente?: string; estado?: string };

// Monta a URL mantendo vista e filtro selecionados (prédio e lista abrem os mesmos registros).
function url(p: Params, mudar: Partial<Params>) {
  const n = { ...p, ...mudar };
  const s = new URLSearchParams(Object.entries(n).filter(([, v]) => v) as [string, string][]);
  return `/escritorio${s.size ? `?${s}` : ''}`;
}

// Indicador principal da sala: símbolo + número + rótulo (nunca só cor).
function indicador(s: Sala) {
  const c = s.contagem;
  const bloq = (c.bloqueada ?? 0) + (c.falhou ?? 0);
  if (bloq) return { s: '■', n: bloq, rotulo: `${bloq} bloqueada(s) ou com falha`, cor: 'bg-vx-alerta-claro text-vx-alerta border-vx-alerta/30' };
  if (c.aguardando_aprovacao) return { s: '◆', n: c.aguardando_aprovacao, rotulo: `${c.aguardando_aprovacao} aguardando aprovação`, cor: 'bg-vx-aprovacao-claro text-vx-aprovacao border-vx-aprovacao/30' };
  if (s.abertas) return { s: '○', n: s.abertas, rotulo: `${s.abertas} aberta(s)`, cor: 'bg-white text-vx-grafite border-vx-linha-forte' };
  return null;
}

const ritmo = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7);

export default async function Escritorio({ searchParams }: PageProps<'/escritorio'>) {
  const sp = (await searchParams) as Params;
  const estado = ESTADOS_TAREFA.includes(sp.estado as EstadoTarefa) ? sp.estado : undefined;
  const p: Params = { vista: sp.vista === 'lista' ? 'lista' : sp.vista === 'predio' ? 'predio' : undefined, sala: sp.sala, agente: sp.agente, estado };
  const { b, u } = await contexto();
  const [lista, tarefas, agente, inicial, equipe, especialistas, clientes] = await Promise.all([
    salas(b, u, estado), listarTarefas(b, u, { estado }), p.agente ? obterPapel(b, u, p.agente) : null, consultarEscritorio(b, u, null, undefined, null), usuarios(b),
    fluxosDisponiveis(b), clientesVisiveis(b, u),
  ]);
  const agentesVivos: AgenteVivo[] = lista.flatMap(s => s.papeis.map(a => {
    const base = a.estado_config === 'habilitado' ? 'habilitado' : a.fase === 'piloto' && a.estado_config !== 'desabilitado' ? 'piloto' : 'nenhum';
    return {
      id: a.id, sala: s.id, nome: a.nome.replace(/\s*\(.*\)/, ''), estado: base === 'nenhum' ? 'desligado' : 'ocioso', semente: ritmo(a.id), selecionado: p.agente === a.id,
      base, href: `${url(p, { agente: a.id, sala: s.id })}#detalhes`, titulo: a.nome,
      rotulo: `${a.nome}, ${ROTULO_FASE[a.fase]}, ${ROTULO_CONFIG[a.estado_config]}`,
    };
  }));
  const salasVivas = DEPARTAMENTOS.map(d => ({ id: d.id, andar: d.andar, r: d.r as [number, number, number, number] }));
  const porSala = (id: string) => tarefas.filter(t => t.departamento_id === id);
  const salaSel = lista.find(s => s.id === p.sala);
  return (
    <EscritorioInterativo key={u.id} inicial={inicial} usuario={u.id} equipe={equipe.filter(p => p.id !== u.id).map(({ id, nome }) => ({ id, nome }))} agentes={agentesVivos} salas={salasVivas}
      especialistas={especialistas} clientes={clientes.filter(c => !c.demo).map(({ id, nome, status }) => ({ id, nome, status }))}
      filtros={<BarraVista p={p} estado={estado} />} zonas={lista.map(s => <SalaNoPredio key={s.id} s={s} p={p} />)}
      mostraPredio={p.vista !== 'lista'} mostraLista={p.vista === 'lista'}
      lista={p.vista === 'lista' ? <div className="space-y-5">
            {[5, 4, 3, 2, 1].map(n => (
              <section key={n} aria-labelledby={`andar-${n}`}>
                <h2 id={`andar-${n}`} className="mb-2 text-[15px] font-semibold">{n}º andar</h2>
                <div className="grid gap-3 xl:grid-cols-2">
                  {lista.filter(s => s.andar === n).map(s => <CartaoSala key={s.id} s={s} p={p} tarefas={porSala(s.id)} />)}
                </div>
              </section>
            ))}
          </div> : null}
      detalhes={agente ? <PainelAgente a={agente} fechar={url(p, { agente: undefined })} /> : salaSel ? <PainelSala s={salaSel} tarefas={porSala(salaSel.id)} p={p} /> : null}
      legenda={p.vista !== 'lista' && <Legenda />} />
  );
}

// Barra compacta: alternância Prédio/Lista + filtro de estado.
function BarraVista({ p, estado }: { p: Params; estado?: string }) {
  return (
    <div className="vx-office-filtros">
      <nav aria-label="Forma de visualização" className="vx-office-vistas">
        {[['predio', 'Prédio'], ['lista', 'Lista']].map(([v, n]) => {
          const ativo = (p.vista ?? 'predio') === v;
          return <Link key={v} href={url(p, { vista: v })} aria-current={ativo ? 'page' : undefined}>{n}</Link>;
        })}
      </nav>
      <form className="vx-office-filtros-form" action="/escritorio">
        {p.vista && <input type="hidden" name="vista" value={p.vista} />}
        {p.sala && <input type="hidden" name="sala" value={p.sala} />}
        {p.agente && <input type="hidden" name="agente" value={p.agente} />}
        <label htmlFor="estado" className="text-[13px] font-medium text-vx-texto-2">Estado</label>
        <select id="estado" name="estado" defaultValue={estado ?? ''} className={`${campo} min-w-0 flex-1 sm:max-w-56`}>
          <option value="">Todos</option>
          {ESTADOS_TAREFA.map(e => <option key={e} value={e}>{ROTULO_ESTADO_TAREFA[e]}</option>)}
        </select>
        <button className={botaoSec}>Filtrar</button>
        {estado && <Link href={url(p, { estado: undefined })} className={`${link} px-1`}>Limpar</Link>}
      </form>
    </div>
  );
}

function SalaNoPredio({ s, p }: { s: Sala; p: Params }) {
  const [x, y, w, h] = DEPARTAMENTOS.find(d => d.id === s.id)!.r;
  const sel = s.id === p.sala;
  const ind = indicador(s);
  const alerta = (s.contagem.bloqueada ?? 0) + (s.contagem.falhou ?? 0) > 0;
  return (
    <div className={`group absolute rounded-[4px] transition-shadow ${sel ? 'shadow-[inset_0_0_0_1.5px_var(--color-vx-verde)] bg-vx-verde/[.04]' : 'hover:shadow-[inset_0_0_0_1px_rgb(23_120_76/.45)]'}`}
      style={{ left: `${(x / 1536) * 100}%`, top: `${(y / 1024) * 100}%`, width: `${(w / 1536) * 100}%`, height: `${(h / 1024) * 100}%` }}>
      {alerta && <span aria-hidden className="vx-sala-alerta pointer-events-none absolute inset-0 rounded-[4px] shadow-[inset_0_0_0_1px_rgb(154_88_0/.5)]" />}
      <Link href={`${url(p, { sala: s.id, agente: undefined })}#detalhes`} aria-current={sel ? 'true' : undefined}
        aria-label={`${s.nome}, ${s.andar}º andar${ind ? `, ${ind.rotulo}` : ', sem pendências'}`} title={`${s.nome} · ${ind?.rotulo ?? 'Sem pendências'}`}
        className="vx-sala-rotulo" data-selecionada={sel}>
        <span className="truncate">{s.nome}</span>
        {ind && <span aria-hidden className={`tabular shrink-0 rounded-[3px] border px-1 font-semibold ${ind.cor}`}>{ind.s} {ind.n}</span>}
      </Link>
    </div>
  );
}

function CartaoSala({ s, p, tarefas }: { s: Sala; p: Params; tarefas: TarefaLista[] }) {
  const ind = indicador(s);
  return (
    <Painel destaque={s.id === p.sala} className="p-3">
      <div className="flex items-start gap-2">
        <Link href={`${url(p, { sala: s.id, agente: undefined })}#detalhes`} className="flex-1 text-[15px] font-semibold text-vx-grafite hover:text-vx-verde-escuro hover:underline">{s.nome}</Link>
        {ind ? <span className={`${chip} ${ind.cor}`}><span aria-hidden>{ind.s}</span>{ind.rotulo}</span> : <span className="text-xs text-vx-texto-2">Sem pendências</span>}
      </div>
      <p className="mt-0.5 text-[13px] text-vx-texto-2">Responsável: {s.responsavel_humano}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Agentes de ${s.nome}`}>
        {s.papeis.map(a => (
          <li key={a.id}><Link href={`${url(p, { agente: a.id, sala: s.id })}#detalhes`}
            className={`inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-medium ${a.estado_config === 'habilitado' ? 'border-vx-verde/30 bg-vx-verde-claro text-vx-verde-escuro' : 'border-vx-linha text-vx-texto-2 hover:bg-vx-fundo'}`}>{a.nome}</Link></li>
        ))}
      </ul>
      {tarefas.length > 0 && <ul className="-mx-1 mt-2 border-t border-vx-linha pt-1">{tarefas.slice(0, 4).map(t => <LinhaTarefa key={t.id} t={t} />)}</ul>}
      {tarefas.length > 4 && <Link href={url(p, { sala: s.id })} className={`${link} mt-1 inline-block text-sm`}>Ver as {tarefas.length} tarefas</Link>}
    </Painel>
  );
}

function PainelSala({ s, tarefas, p }: { s: Sala; tarefas: TarefaLista[]; p: Params }) {
  const contagem = Object.entries(s.contagem).filter(([, n]) => n) as [EstadoTarefa, number][];
  return (
    <Painel destaque className="overflow-hidden">
      <div className="border-b border-vx-linha p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug">{s.nome}</h2>
            <p className="text-[13px] text-vx-texto-2">{s.andar}º andar · {s.fila}</p>
          </div>
          <Link href={url(p, { sala: undefined })} className={`${botaoSec} min-h-8 px-2.5 py-1`} aria-label={`Fechar ${s.nome}`}>Fechar</Link>
        </div>
        <p className="mt-2 text-[13px]"><span className="text-vx-texto-2">Responsável</span> <span className="font-medium">{s.responsavel_humano}</span></p>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Resumo da fila">
          {contagem.length ? contagem.map(([e, n]) => <li key={e} className="flex items-center gap-1"><EstadoTarefaBadge estado={e} /><span className="tabular text-sm font-semibold">{n}</span></li>)
            : <li className="text-sm text-vx-texto-2">Fila vazia</li>}
        </ul>
      </div>
      <div className="flex items-center gap-2 px-4 pb-1 pt-3">
        <h3 className="text-sm font-semibold">Fila da sala <span className="tabular font-normal text-vx-texto-2">({tarefas.length})</span></h3>
        {tarefas.length > 0 && <Link href={url(p, { vista: 'lista' })} className={`${link} ml-auto text-sm`}>Abrir na lista</Link>}
      </div>
      <div className="px-2 pb-2">
        {tarefas.length ? <ul>{tarefas.map(t => <LinhaTarefa key={t.id} t={t} />)}</ul>
          : <Vazio acao={p.estado && <Link href={url(p, { estado: undefined })} className={link}>Limpar filtro</Link>}>Nenhuma tarefa visível{p.estado ? ' com este filtro' : ' nesta sala'}.</Vazio>}
      </div>
    </Painel>
  );
}

function PainelAgente({ a, fechar }: { a: NonNullable<Awaited<ReturnType<typeof obterPapel>>>; fechar: string }) {
  const ultima = a.historico[0];
  return (
    <Painel destaque className="overflow-hidden text-sm">
      <div className="border-b border-vx-linha p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug">{a.nome}</h2>
            <p className="text-[13px] text-vx-texto-2">{a.departamento_nome}</p>
          </div>
          <Link href={fechar} className={`${botaoSec} min-h-8 px-2.5 py-1`} aria-label={`Fechar ${a.nome}`}>Fechar</Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5"><EstadoConfigBadge estado={a.estado_config} /><span className={`${chip} border-vx-linha-forte bg-white`}>{ROTULO_FASE[a.fase]}</span></div>
      </div>
      <div className="p-4">
        <Dados itens={[
          ['Dono proposto', a.responsavel_proposto],
          ['Modo', MODOS[a.modo as keyof typeof MODOS]],
          ['Instrução', a.versao_instrucao ? `v${a.versao_instrucao}` : 'Sem instrução ativa'],
          ...(a.vinculo_reservado ? [['Vínculo', a.vinculo_reservado] as [string, React.ReactNode]] : []),
          ['Última execução', ultima ? <span key="u">{dataHora(ultima.atualizado_em ?? ultima.criado_em)} · {ultima.estado} <Demo ativo={ultima.demo} /></span> : 'Nenhuma ainda'],
          ['ID', <code key="id" className="text-xs">{a.id}</code>],
        ]} />
        <h3 className="mt-4 text-sm font-semibold">Histórico autorizado <span className="tabular font-normal text-vx-texto-2">({a.historico.length})</span></h3>
        {a.historico.length ? (
          <ul className="mt-1 divide-y divide-vx-linha">
            {a.historico.map(h => <li key={h.id} className="py-1.5"><Link className={link} href={`/tarefas/${h.tarefa_id}`}>{h.objetivo}</Link> <span className="text-[13px] text-vx-texto-2">· {h.etapa} · {h.estado}</span></li>)}
          </ul>
        ) : <Vazio>Nenhuma execução que você possa ver.</Vazio>}
        <Link href={`/agentes/${a.id}`} className={`${botaoSec} mt-3 w-full`}>Abrir ficha e instruções</Link>
      </div>
    </Painel>
  );
}

function Item({ simbolo, children }: { simbolo: React.ReactNode; children: React.ReactNode }) {
  return <li className="flex items-center gap-2">{simbolo}<span>{children}</span></li>;
}

function Legenda() {
  return (
    <Painel className="vx-office-legenda p-3 text-[13px]">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-vx-grafite">
          Legenda <span aria-hidden className="text-vx-texto-2 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-3 grid gap-3 text-vx-texto-2 sm:grid-cols-2 lg:grid-cols-1">
          <ul className="space-y-1.5">
            <Item simbolo={<span className="h-1.5 w-4 rounded-[50%] bg-vx-verde/70" />}>Base verde no chão: habilitado (A1)</Item>
            <Item simbolo={<span className="h-1.5 w-4 rounded-[50%] border border-vx-verde bg-white" />}>Base branca: piloto em homologação</Item>
            <Item simbolo={<span className="h-1.5 w-4 rounded-[50%] bg-vx-grafite/30" />}>Em cinza, sem base: execução desabilitada</Item>
          </ul>
          <ul className="space-y-1.5">
            <Item simbolo={<span className="w-4 text-center font-bold text-vx-info">•••</span>}>Trabalhando agora</Item>
            <Item simbolo={<span className="w-4 text-center font-bold text-vx-aprovacao">◆</span>}>Aguardando aprovação</Item>
            <Item simbolo={<span className="w-4 text-center font-bold text-vx-erro">!</span>}>Bloqueado ou com falha</Item>
            <Item simbolo={<span className="w-4 text-center font-bold text-vx-alerta">○</span>}>Tarefa na fila</Item>
          </ul>
          <p className="sm:col-span-2 lg:col-span-1">Nos repasses, os agentes saem pela porta da sala, passam pelo corredor e embarcam no elevador quando mudam de andar. Use Ver percurso para acompanhar uma prévia.</p>
        </div>
      </details>
    </Painel>
  );
}
