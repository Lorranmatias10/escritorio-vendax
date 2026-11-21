'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, startTransition, type FormEvent, type ReactNode } from 'react';
import { acaoEnviarMensagemChat } from '@/app/acoes';
import type { AtividadeAgente, EscritorioAoVivo, EstadoDaFila, MensagemChat } from '@/lib/escritorio-ao-vivo';
import type { FluxoClaude } from '@/lib/skills-claude';
import { ChatDiretor } from './chat-diretor';
import { ChatEspecialistas } from './chat-especialistas';
import { Icone } from './nav';
import { PredioVivo, type AgenteVivo, type EstadoAgente, type SalaVivo } from './predio-vivo';

type Pessoa = { id: string; nome: string };
type Canal = 'diretor' | 'atividade' | 'equipe' | 'especialistas';
type Fluxo = { chave: string; dados: EscritorioAoVivo; conectado: boolean };
type Props = {
  inicial: EscritorioAoVivo; usuario: string; equipe: Pessoa[]; agentes: AgenteVivo[]; salas: SalaVivo[];
  filtros: ReactNode; zonas: ReactNode; lista: ReactNode; detalhes: ReactNode; legenda: ReactNode;
  mostraPredio: boolean; mostraLista: boolean;
  especialistas: FluxoClaude[]; clientes: Pessoa[];
};

const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long' });
const instante = (valor: string) => new Date(valor);
const sigla = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();

const ESTADOS: [EstadoDaFila['estado'][], EstadoAgente][] = [
  [['em_execucao'], 'trabalhando'], [['falhou', 'bloqueada'], 'bloqueado'], [['aguardando_aprovacao'], 'aguardando'], [['na_fila'], 'fila'],
];
const ROTULOS: Record<EstadoAgente, string> = {
  trabalhando: 'em execução', bloqueado: 'bloqueado ou com falha', aguardando: 'aguardando aprovação', fila: 'com tarefa na fila', ocioso: 'disponível', desligado: 'desabilitado',
};
const ATIVIDADE: Record<AtividadeAgente['tipo'], string> = {
  delegada: 'Passagem de tarefa', execucao_enfileirada: 'Entrou na fila', execucao_iniciada: 'Iniciou a execução',
  execucao_concluida: 'Concluiu a etapa', execucao_falhou: 'Execução com falha', execucao_bloqueada: 'Execução bloqueada',
};

export function EscritorioInterativo({ inicial, usuario, equipe, agentes, salas, filtros, zonas, lista, detalhes, legenda, mostraPredio, mostraLista, especialistas, clientes }: Props) {
  const [canal, setCanal] = useState<Canal>('diretor');
  const [destino, setDestino] = useState('');
  const [painel, setPainel] = useState(true);
  const [apenasPassagens, setApenasPassagens] = useState(false);
  const [especialista, setEspecialista] = useState<FluxoClaude | ''>(especialistas[0] ?? '');
  const [cliente, setCliente] = useState(clientes.length === 1 ? clientes[0].id : '');
  const [fluxo, setFluxo] = useState<Fluxo>({ chave: '', dados: inicial, conectado: false });
  const dock = useRef<HTMLElement>(null);
  const router = useRouter();
  const revisao = useRef(JSON.stringify(inicial.fila));
  const temConversa = canal === 'especialistas' && especialista && cliente;
  const [clienteDiretor, setClienteDiretor] = useState('');
  const chave = canal === 'diretor'
    ? String(new URLSearchParams(clienteDiretor ? { diretor: '1', cliente: clienteDiretor } : { diretor: '1' }))
    : temConversa ? String(new URLSearchParams({ especialista, cliente })) : destino ? String(new URLSearchParams({ destino })) : '';

  useEffect(() => {
    const fonte = new EventSource(`/api/escritorio/eventos${chave ? '?' + chave : ''}`);
    fonte.onmessage = (evento) => {
      const dados = JSON.parse(evento.data) as EscritorioAoVivo;
      setFluxo({ chave, dados, conectado: true });
      const nova = JSON.stringify(dados.fila);
      if (nova !== revisao.current) {
        revisao.current = nova;
        startTransition(() => router.refresh());
      }
    };
    fonte.onerror = () => setFluxo(atual => ({ ...atual, conectado: false }));
    const expirar = () => { fonte.close(); router.replace('/login'); };
    fonte.addEventListener('sessao', expirar);
    return () => fonte.close();
  }, [chave, router]);

  const { atividade, fila } = fluxo.dados;
  const conectado = fluxo.chave === chave && fluxo.conectado;
  const mensagens = fluxo.chave === chave && !temConversa ? fluxo.dados.mensagens : [];
  const turnos = fluxo.chave === chave && temConversa ? fluxo.dados.conversa : [];
  const turnosDiretor = fluxo.chave === chave ? fluxo.dados.diretor : clienteDiretor ? [] : inicial.diretor;
  const agentesVivos = agentes.map(a => {
    const estado = ESTADOS.find(([estados]) => fila.some(l => l.papel === a.id && estados.includes(l.estado)))?.[1]
      ?? (a.base === 'nenhum' ? 'desligado' : 'ocioso');
    return { ...a, estado, titulo: `${a.nome} · ${ROTULOS[estado]}`, rotulo: `${a.nome}, ${ROTULOS[estado]}` };
  });
  const total = (...estados: EstadoDaFila['estado'][]) => fila.reduce((n, l) => n + (estados.includes(l.estado) ? l.total : 0), 0);

  function abrirChat() {
    setPainel(true);
    setCanal('diretor');
    requestAnimationFrame(() => dock.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }));
  }

  return (
    <div className="vx-office">
      <header className="vx-office-header">
        <div>
          <div className="vx-office-titulo"><h1>Escritório</h1><Conexao conectado={conectado} /></div>
          <p>{new Set(salas.map(s => s.andar)).size} andares <span>·</span> {salas.length} salas <span>·</span> {agentes.length} agentes</p>
        </div>
        <div className="vx-office-acoes">
          <button type="button" className="vx-office-button vx-office-button-chat" onClick={abrirChat}><Icone nome="chat" />Falar com o Diretor</button>
          <button type="button" className="vx-office-button vx-office-button-painel" aria-expanded={painel} aria-controls="painel-escritorio" onClick={() => setPainel(!painel)}
            aria-label={painel ? 'Ocultar painel' : 'Mostrar painel'} title={painel ? 'Ocultar painel' : 'Mostrar painel'}>
            <Icone nome="painel" /><span>{painel ? 'Ocultar painel' : 'Mostrar painel'}</span>
          </button>
        </div>
      </header>

      <div className="vx-office-toolbar">
        {filtros}
        <dl className="vx-office-metricas" aria-label="Tarefas visíveis">
          <div><span className="vx-metrica-ponto vx-metrica-verde" /><dt>Em execução</dt><dd>{total('em_execucao')}</dd></div>
          <div><span className="vx-metrica-ponto" /><dt>Na fila</dt><dd>{total('na_fila')}</dd></div>
          <div><span className="vx-metrica-ponto vx-metrica-ambar" /><dt>Para aprovar</dt><dd>{total('aguardando_aprovacao')}</dd></div>
          <div><span className="vx-metrica-ponto vx-metrica-vermelho" /><dt>Bloqueadas</dt><dd>{total('bloqueada', 'falhou')}</dd></div>
        </dl>
      </div>

      <div className="vx-office-grade" data-painel={painel}>
        <div className="vx-office-visual">
          {mostraPredio && <Palco agentes={agentesVivos} salas={salas} atividade={atividade} zonas={zonas} />}
          {mostraLista && lista}
          {detalhes && <aside id="detalhes" aria-label="Detalhes selecionados" className="vx-office-detalhes">{detalhes}</aside>}
          {legenda}
        </div>
        <aside ref={dock} id="painel-escritorio" className="vx-office-painel" aria-label="Comunicação do Escritório" hidden={!painel}>
          <nav aria-label="Comunicação" className="vx-painel-abas">
            <button type="button" aria-pressed={canal === 'diretor'} aria-controls="chat-diretor" onClick={() => setCanal('diretor')}>Diretor</button>
            <button type="button" aria-pressed={canal === 'atividade'} aria-controls="atividade-agentes" onClick={() => setCanal('atividade')}><Icone nome="atividade" /> Agentes</button>
            <button type="button" aria-pressed={canal === 'equipe'} aria-controls="chat-equipe" onClick={() => setCanal('equipe')}><Icone nome="chat" /> Equipe</button>
            <button type="button" aria-pressed={canal === 'especialistas'} aria-controls="chat-especialistas" onClick={() => setCanal('especialistas')}>Especialistas</button>
          </nav>
          <section className="vx-painel-secao" id="atividade-agentes" hidden={canal !== 'atividade'} aria-labelledby="titulo-atividade">
            <div className="vx-painel-cabecalho"><h2 id="titulo-atividade">Atividade ao vivo</h2>
              <div className="vx-atividade-filtros" aria-label="Filtrar atividade" role="group">
                <button type="button" aria-pressed={!apenasPassagens} onClick={() => setApenasPassagens(false)}>Todas</button>
                <button type="button" aria-pressed={apenasPassagens} onClick={() => setApenasPassagens(true)}>Passagens de tarefa</button>
              </div>
            </div>
            <Atividades itens={apenasPassagens ? atividade.filter(e => e.tipo === 'delegada') : atividade} apenasPassagens={apenasPassagens} />
          </section>
          <ChatDiretor visivel={painel && canal === 'diretor'} conectado={conectado} turnos={turnosDiretor}
            clientes={clientes} cliente={clienteDiretor} mudarCliente={setClienteDiretor} />
          <Chat key={destino || 'geral'} usuario={usuario} mensagens={mensagens} equipe={equipe} destino={destino} mudarDestino={setDestino} visivel={painel && canal === 'equipe'} conectado={conectado} />
          <ChatEspecialistas visivel={painel && canal === 'especialistas'} conectado={conectado} turnos={turnos} especialistas={especialistas}
            clientes={clientes} cliente={cliente} mudarCliente={setCliente} especialista={especialista} mudarEspecialista={setEspecialista} />
        </aside>
      </div>
    </div>
  );
}

function Conexao({ conectado }: { conectado: boolean }) {
  return <span className="vx-office-conexao" data-conectado={conectado} role="status"><span aria-hidden />{conectado ? 'Ao vivo' : 'Conectando'}</span>;
}

function Palco({ agentes, salas, atividade, zonas }: { agentes: AgenteVivo[]; salas: SalaVivo[]; atividade: AtividadeAgente[]; zonas: ReactNode }) {
  const [zoom, setZoom] = useState(100);
  const [circulacao, setCirculacao] = useState(true);
  const [pedidoPercurso, setPedidoPercurso] = useState(0);
  const [percorrendo, setPercorrendo] = useState(false);
  const plano = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLElement>(null);
  const andares = [...new Set(salas.map(s => s.andar))].sort((a, b) => b - a);
  const passagens = atividade.flatMap(c => c.tipo === 'delegada' && c.para ? [{ id: c.id, de: c.de, para: c.para, objetivo: c.objetivo }] : []);
  function irAndar(n: number) {
    const tela = plano.current;
    const y = salas.find(s => s.andar === n)?.r[1];
    const planta = tela?.firstElementChild;
    if (!tela || !planta || y === undefined) return;
    const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    tela.scrollTo({ top: (y / 1024) * planta.clientHeight - tela.clientHeight * .12, behavior: reduzido ? 'auto' : 'smooth' });
  }
  async function expandir() {
    if (document.fullscreenElement === palco.current) await document.exitFullscreen();
    else if (palco.current?.requestFullscreen) await palco.current.requestFullscreen().catch(() => {});
    else setZoom(125);
  }
  return (
    <section ref={palco} className="vx-office-palco" aria-labelledby="planta-titulo">
      <div className="vx-palco-barra">
        <h2 id="planta-titulo"><Icone nome="escritorio" /> Planta do prédio</h2>
        <div className="vx-palco-controles" aria-label="Visualização da planta">
          <button type="button" className="vx-percurso-controle" disabled={percorrendo} title="Prévia de uma passagem pelo elevador" onClick={() => setPedidoPercurso(n => n + 1)}>
            <Icone nome="seta" />Ver percurso
          </button>
          <button type="button" className="vx-circulacao-controle" aria-pressed={circulacao} title="Pausas breves ao lado do posto" onClick={() => setCirculacao(ativa => !ativa)}>
            <span aria-hidden />Circulação
          </button>
          <button type="button" aria-label="Diminuir zoom" title="Diminuir zoom" onClick={() => setZoom(n => Math.max(70, n - 15))} disabled={zoom === 70}><Icone nome="menos" /></button>
          <button type="button" title="Restaurar zoom" aria-label={`Zoom ${zoom}%, restaurar para 100%`} className="vx-zoom-valor" onClick={() => setZoom(100)}>{zoom}%</button>
          <button type="button" aria-label="Aumentar zoom" title="Aumentar zoom" onClick={() => setZoom(n => Math.min(160, n + 15))} disabled={zoom === 160}><Icone nome="mais" /></button>
          <button type="button" aria-label="Alternar tela cheia" title="Tela cheia" onClick={() => void expandir()}><Icone nome="expandir" /></button>
        </div>
      </div>
      <div className="vx-palco-mapa">
        <div className="vx-palco-scroll" ref={plano} tabIndex={0} role="region" aria-label="Andares do prédio">
          <div className="vx-planta-imagem" style={{ '--escala-planta': zoom / 100 } as React.CSSProperties}>
            <Image src="/escritorio-predio.png" alt="Prédio da Vendax com cinco andares e elevador de vidro" fill priority unoptimized sizes="100vw" className="object-contain" />
            {zonas}
            <PredioVivo salas={salas} agentes={agentes} conversas={passagens} circulacao={circulacao} pedidoPercurso={pedidoPercurso} mudarPercorrendo={setPercorrendo} />
          </div>
        </div>
        <nav className="vx-andares" aria-label="Escolher andar">
          {andares.map(n => <button type="button" key={n} aria-label={`Ir para o ${n}º andar`} title={`${n}º andar`} onClick={() => irAndar(n)}>{n}</button>)}
        </nav>
      </div>
    </section>
  );
}

function Atividades({ itens, apenasPassagens }: { itens: AtividadeAgente[]; apenasPassagens: boolean }) {
  if (!itens.length) return <div className="vx-painel-vazio"><Icone nome="atividade" /><strong>{apenasPassagens ? 'Nenhuma passagem recente' : 'Nenhuma atividade recente'}</strong><p>Os registros das tarefas que você pode ver aparecem aqui.</p></div>;
  return (
    <ol className="vx-atividade-lista" aria-label="Registros de atividade dos agentes">
      {itens.map(e => <li key={e.id} data-tipo={e.tipo}>
        <span className="vx-atividade-icone"><Icone nome={e.tipo === 'delegada' ? 'seta' : 'atividade'} /></span>
        <div><div className="vx-atividade-momento"><span>{ATIVIDADE[e.tipo]}</span><time dateTime={instante(e.quando).toISOString()} title={dia.format(instante(e.quando))}>{hora.format(instante(e.quando))}</time></div>
          <p className="vx-atividade-agentes"><Link href={`/agentes/${e.de}`}>{e.origem}</Link>{e.para && <><span aria-label="para"> → </span><Link href={`/agentes/${e.para}`}>{e.destino}</Link></>}</p>
          <Link className="vx-atividade-tarefa" href={`/tarefas/${e.tarefa}`}>{e.objetivo}</Link>
        </div>
      </li>)}
    </ol>
  );
}

function mesclarMensagens(...listas: MensagemChat[][]) {
  return [...new Map(listas.flat().map(m => [m.id, m])).values()].sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id));
}

function Chat({ usuario, mensagens, equipe, destino, mudarDestino, visivel, conectado }: {
  usuario: string; mensagens: MensagemChat[]; equipe: Pessoa[]; destino: string; mudarDestino: (id: string) => void; visivel: boolean; conectado: boolean;
}) {
  const [corpo, setCorpo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvas, setSalvas] = useState<MensagemChat[]>([]);
  const [anteriores, setAnteriores] = useState<MensagemChat[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [esgotou, setEsgotou] = useState(false);
  const requisicao = useRef<{ texto: string; id: string } | null>(null);
  const pendente = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const ultimaAltura = useRef<number | null>(null);
  const acompanhar = useRef(true);
  const exibidas = mesclarMensagens(anteriores, mensagens, salvas);
  const ultima = exibidas.at(-1)?.id;
  const primeira = exibidas[0]?.id;
  const conversa = equipe.find(u => u.id === destino);

  useLayoutEffect(() => {
    const el = log.current;
    if (!el || !visivel) return;
    if (ultimaAltura.current !== null) {
      el.scrollTop += el.scrollHeight - ultimaAltura.current;
      ultimaAltura.current = null;
    } else if (acompanhar.current) el.scrollTop = el.scrollHeight;
  }, [ultima, primeira, visivel]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const texto = corpo.trim();
    if (!texto || pendente.current) return;
    const id = requisicao.current?.texto === texto ? requisicao.current.id : crypto.randomUUID();
    requisicao.current = { texto, id };
    pendente.current = true;
    setEnviando(true);
    setErro('');
    try {
      const enviada = await acaoEnviarMensagemChat({ destinatario: destino || null, requisicao: id, corpo: texto });
      acompanhar.current = true;
      setSalvas(lista => [...lista.slice(-49), enviada]);
      setCorpo(atual => atual === corpo ? '' : atual);
      requisicao.current = null;
    } catch {
      setErro('A mensagem não pôde ser enviada. Tente novamente.');
    } finally {
      setEnviando(false);
      pendente.current = false;
    }
  }

  async function lerAnteriores() {
    if (carregando || !primeira) return;
    setCarregando(true);
    setErro('');
    const qs = new URLSearchParams({ antes: primeira });
    if (destino) qs.set('destino', destino);
    try {
      const resp = await fetch(`/api/escritorio/eventos?${qs}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error();
      const antigas = await resp.json() as MensagemChat[];
      ultimaAltura.current = antigas.length ? log.current?.scrollHeight ?? null : null;
      setAnteriores(atuais => mesclarMensagens(antigas, atuais));
      setEsgotou(antigas.length < 50);
    } catch {
      setErro('Não foi possível carregar as mensagens anteriores.');
    } finally { setCarregando(false); }
  }

  return (
    <section className="vx-painel-secao vx-chat" id="chat-equipe" hidden={!visivel} aria-labelledby="titulo-chat">
      <div className="vx-painel-cabecalho">
        <h2 id="titulo-chat">Chat da equipe</h2>
        <label className="vx-chat-canal">
          <span className="sr-only">Conversar com</span>
          <select value={destino} disabled={enviando} onChange={e => mudarDestino(e.target.value)}>
            <option value="">Equipe Vendax · canal geral</option>
            {equipe.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>
        <p>{conversa ? `Conversa privada com ${conversa.nome}` : 'Visível para toda a equipe'}</p>
      </div>
      <div className="vx-chat-log" ref={log} role="log" aria-label="Mensagens da conversa" onScroll={e => {
        const el = e.currentTarget;
        acompanhar.current = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
      }}>
        {!esgotou && exibidas.length >= 50 && <button type="button" className="vx-chat-anteriores" onClick={() => void lerAnteriores()} disabled={carregando}>{carregando ? 'Carregando' : 'Mensagens anteriores'}</button>}
        {exibidas.length === 0 && <div className="vx-painel-vazio"><Icone nome="chat" /><strong>{conectado ? 'Comece a conversa' : 'Conectando ao chat'}</strong>{conectado && <p>Envie a primeira mensagem neste canal.</p>}</div>}
        {exibidas.map((m, i) => {
          const daVez = instante(m.criado_em);
          const separador = !i || dia.format(daVez) !== dia.format(instante(exibidas[i - 1].criado_em));
          return <div key={m.id}>
            {separador && <p className="vx-chat-dia"><span>{dia.format(daVez)}</span></p>}
            <article className="vx-mensagem" data-minha={m.autor_id === usuario}>
              {m.autor_id !== usuario && <span aria-hidden className="vx-chat-avatar">{sigla(m.autor)}</span>}
              <div><header><strong>{m.autor_id === usuario ? 'Você' : m.autor}</strong><time dateTime={daVez.toISOString()}>{hora.format(daVez)}</time></header><p>{m.corpo}</p></div>
            </article>
          </div>;
        })}
      </div>
      <form className="vx-chat-editor" onSubmit={enviar}>
        {erro && <p className="vx-chat-erro" role="alert">{erro}</p>}
        <div>
          <textarea name="mensagem" aria-label="Mensagem" placeholder="Escreva uma mensagem" rows={2} value={corpo} maxLength={2000} onChange={e => setCorpo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
          <button type="submit" aria-label="Enviar mensagem" title="Enviar mensagem" disabled={!corpo.trim() || enviando}><Icone nome="enviar" /></button>
        </div>
      </form>
    </section>
  );
}
