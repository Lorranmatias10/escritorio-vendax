import Link from 'next/link';
import Image from 'next/image';
import { contexto } from '@/lib/sessao';
import { salas, listarTarefas, obterPapel, conversasRecentes, type Sala, type TarefaLista } from '@/lib/dados';
import { DEPARTAMENTOS, ESTADOS_TAREFA, ROTULO_ESTADO_TAREFA, ROTULO_FASE, ROTULO_CONFIG, MODOS, type EstadoTarefa } from '@/lib/catalogo';
import { dataHora } from '@/lib/formato';
import { AtualizarSozinho } from '@/components/atualizar-sozinho';
import { PredioVivo, type AgenteVivo, type EstadoAgente } from '@/components/predio-vivo';
import { EstadoConfigBadge, EstadoTarefaBadge, LinhaTarefa, Vazio, Demo, Cabecalho, Painel, Dados, campo, botaoSec, link, chip } from '@/components/ui';

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

// Estado do agente, a partir das tarefas que ele tem agora (só as que o usuário pode ver).
const ROTULO_AGENTE: Record<EstadoAgente, string> = {
  trabalhando: 'trabalhando agora', aguardando: 'aguardando aprovação', bloqueado: 'bloqueado ou com falha', fila: 'com tarefa na fila', ocioso: 'sem tarefa', desligado: 'execução desabilitada',
};
function estadoAgente(a: Sala['papeis'][number], tarefas: TarefaLista[]): EstadoAgente {
  const dele = tarefas.filter(t => t.papel_atual_id === a.id).map(t => t.estado);
  if (dele.includes('em_execucao')) return 'trabalhando';
  if (dele.includes('bloqueada') || dele.includes('falhou')) return 'bloqueado';
  if (dele.includes('aguardando_aprovacao')) return 'aguardando';
  if (dele.includes('na_fila')) return 'fila';
  return a.estado_config === 'habilitado' || (a.fase === 'piloto' && a.estado_config !== 'desabilitado') ? 'ocioso' : 'desligado';
}
const ritmo = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7);

export default async function Escritorio({ searchParams }: PageProps<'/escritorio'>) {
  const sp = (await searchParams) as Params;
  const estado = ESTADOS_TAREFA.includes(sp.estado as EstadoTarefa) ? sp.estado : undefined;
  const p: Params = { vista: sp.vista === 'lista' ? 'lista' : sp.vista === 'predio' ? 'predio' : undefined, sala: sp.sala, agente: sp.agente, estado };
  const { b, u } = await contexto();
  const [lista, tarefas, agente, conversas] = await Promise.all([
    salas(b, u, estado), listarTarefas(b, u, { estado }), p.agente ? obterPapel(b, u, p.agente) : null, conversasRecentes(b, u),
  ]);
  // Agentes para o prédio vivo: estado real, crachá (base no chão) e link para o painel do papel.
  const agentesVivos: AgenteVivo[] = lista.flatMap(s => s.papeis.map(a => {
    const ea = estadoAgente(a, tarefas);
    return {
      id: a.id, sala: s.id, nome: a.nome.replace(/\s*\(.*\)/, ''), estado: ea, semente: ritmo(a.id), selecionado: p.agente === a.id,
      base: ea === 'desligado' ? 'nenhum' : a.estado_config === 'habilitado' ? 'habilitado' : 'piloto',
      href: `${url(p, { agente: a.id, sala: s.id })}#detalhes`, titulo: `${a.nome} · ${ROTULO_AGENTE[ea]}`,
      rotulo: `${a.nome}, ${ROTULO_FASE[a.fase]}, ${ROTULO_CONFIG[a.estado_config]}, ${ROTULO_AGENTE[ea]}`,
    };
  }));
  const salasVivas = DEPARTAMENTOS.map(d => ({ id: d.id, andar: d.andar, r: d.r as [number, number, number, number] }));
  const porSala = (id: string) => tarefas.filter(t => t.departamento_id === id);
  const salaSel = lista.find(s => s.id === p.sala);
  const totalPapeis = lista.reduce((n, s) => n + s.papeis.length, 0);

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Escritório"
        descricao={`5 andares, 9 salas e ${totalPapeis} papéis. Selecione uma sala para ver a fila ou um agente para ver o papel.`}
        filtros={<BarraVista p={p} estado={estado} />} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="min-w-0">
          {p.vista !== 'lista' && (
            <Painel className={`${p.vista === 'predio' ? '' : 'hidden md:block'} overflow-hidden`}>
              <div className="relative aspect-[3/2] w-full bg-[#f4f4f2]">
                <Image src="/escritorio-predio.png" alt="Corte frontal do prédio da Vendax com cinco andares, nove salas e elevador de vidro à direita" fill priority sizes="(min-width: 1024px) 960px, 100vw" className="object-contain" />
                <AtualizarSozinho />
                {lista.map(s => <SalaNoPredio key={s.id} s={s} p={p} />)}
                <PredioVivo salas={salasVivas} agentes={agentesVivos} conversas={conversas.map(c => ({ id: c.id, de: c.de, para: c.para, objetivo: c.objetivo }))} />
              </div>
            </Painel>
          )}

          {/* Lista: mesma fonte de dados */}
          <div className={p.vista === 'lista' ? 'space-y-5' : p.vista === 'predio' ? 'hidden' : 'space-y-5 md:hidden'}>
            {[5, 4, 3, 2, 1].map(n => (
              <section key={n} aria-labelledby={`andar-${n}`}>
                <h2 id={`andar-${n}`} className="mb-2 text-[15px] font-semibold">{n}º andar</h2>
                <div className="grid gap-3 xl:grid-cols-2">
                  {lista.filter(s => s.andar === n).map(s => <CartaoSala key={s.id} s={s} p={p} tarefas={porSala(s.id)} />)}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside id="detalhes" aria-label="Detalhes" className="scroll-mt-4 space-y-4 lg:sticky lg:top-4">
          {agente ? <PainelAgente a={agente} fechar={url(p, { agente: undefined })} />
            : salaSel ? <PainelSala s={salaSel} tarefas={porSala(salaSel.id)} p={p} />
            : (
              <Painel className="p-4 text-sm">
                <h2 className="text-[15px] font-semibold">Nenhuma sala selecionada</h2>
                <p className="mt-1 text-vx-texto-2">Clique no nome de uma sala ou em um agente no prédio para ver a fila, o responsável e o próximo passo.</p>
                {estado && <p className="mt-2">Filtro ativo: <EstadoTarefaBadge estado={estado as EstadoTarefa} /></p>}
              </Painel>
            )}
          <Legenda />
        </aside>
      </div>
    </div>
  );
}

// Barra compacta: alternância Prédio/Lista + filtro de estado.
function BarraVista({ p, estado }: { p: Params; estado?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-vx-linha bg-vx-superficie p-1.5 shadow-vx">
      <nav aria-label="Forma de visualização" className="flex rounded-md bg-vx-fundo p-0.5 text-sm">
        {[['predio', 'Prédio'], ['lista', 'Lista']].map(([v, n]) => {
          const ativo = (p.vista ?? 'predio') === v;
          // Sem escolha explícita: lista ativa em telas pequenas, prédio a partir de md.
          const cls = p.vista ? (ativo ? 'bg-white text-vx-grafite shadow-vx' : 'text-vx-texto-2')
            : v === 'lista' ? 'bg-white text-vx-grafite shadow-vx md:bg-transparent md:text-vx-texto-2 md:shadow-none' : 'text-vx-texto-2 md:bg-white md:text-vx-grafite md:shadow-vx';
          return <Link key={v} href={url(p, { vista: v })} aria-current={p.vista ? (ativo ? 'page' : undefined) : undefined}
            className={`grid min-h-9 min-w-20 place-items-center rounded-[5px] px-3 font-medium ${cls}`}>{n}</Link>;
        })}
      </nav>
      <span aria-hidden className="hidden h-6 w-px bg-vx-linha sm:block" />
      <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm" action="/escritorio">
        {p.vista && <input type="hidden" name="vista" value={p.vista} />}
        {p.sala && <input type="hidden" name="sala" value={p.sala} />}
        <label htmlFor="estado" className="text-[13px] font-medium text-vx-texto-2">Estado</label>
        <select id="estado" name="estado" defaultValue={estado ?? ''} className={`${campo} min-w-0 flex-1 sm:max-w-56`}>
          <option value="">Todos</option>
          {ESTADOS_TAREFA.map(e => <option key={e} value={e}>{ROTULO_ESTADO_TAREFA[e]}</option>)}
        </select>
        <button className={botaoSec}>Filtrar</button>
        {estado && <Link href={url(p, { estado: undefined })} className={`${link} px-1`}>Limpar</Link>}
      </form>
      <span className="px-1 text-xs text-vx-texto-2" title="Os dados são recarregados a cada 15 segundos enquanto a aba está aberta">
        <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-vx-verde align-middle" />Ao vivo
      </span>
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
      <Link href={url(p, { sala: s.id, agente: undefined })} aria-current={sel ? 'true' : undefined}
        aria-label={`${s.nome}, ${s.andar}º andar${ind ? `, ${ind.rotulo}` : ', sem pendências'}`} title={`${s.nome} · ${ind?.rotulo ?? 'Sem pendências'}`}
        className={`absolute left-[1.5%] top-[4%] flex max-w-[94%] items-center gap-1 rounded-[4px] border px-1.5 py-px text-[clamp(8px,0.72vw,11px)] font-medium leading-tight shadow-vx
          ${sel ? 'border-vx-verde bg-vx-verde text-white' : 'border-vx-linha bg-white/90 text-vx-grafite backdrop-blur-[2px] hover:bg-white'}`}>
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
    <Painel className="p-4 text-[13px]">
      <details className="group" open>
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
          <p className="sm:col-span-2 lg:col-span-1">Cada agente fica no seu lugar. Ele só se levanta para levar uma tarefa a outro agente (passagem real da tarefa): vai até o colega, usa o elevador se for outro andar, conversa e volta. Passe o mouse para ver o nome. A tela se atualiza sozinha a cada 15 segundos.</p>
        </div>
      </details>
    </Painel>
  );
}
