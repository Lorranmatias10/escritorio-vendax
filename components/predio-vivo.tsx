'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Personagem, PersonagemAndando, CICLO_S, PASSADA_POR_ALTURA, type Base } from './personagem';

// Prédio vivo: cada agente fica no seu lugar trabalhando e só se levanta quando há motivo.
// Motivo = passagem de tarefa real (delegação): quem concluiu a etapa vai até o colega de destino,
// usa o elevador se for outro andar, conversa e volta. Coordenadas em px da imagem (1536x1024).

export type EstadoAgente = 'trabalhando' | 'aguardando' | 'bloqueado' | 'fila' | 'ocioso' | 'desligado';
export type SalaVivo = { id: string; andar: number; r: [number, number, number, number] };
export type AgenteVivo = {
  id: string; sala: string; nome: string; estado: EstadoAgente; base: Base; href: string; rotulo: string; titulo: string;
  semente: number; selecionado: boolean;
};
export type ConversaVivo = { id: string; de: string; para: string; objetivo: string };

const IW = 1536, IH = 1024;
const ALTURA = 88;              // pessoa de ~1,75 m na escala do prédio
const X_ELEVADOR = 1272;        // porta do elevador em cada andar (lado direito do prédio)
const ELEVADOR = { x: 1301, w: 141 };
const SEG_POR_ANDAR = 1.3;
const CONVERSA_S = 6;
const PAUSA_ENTRE = [14, 26];   // segundos entre uma passagem e a próxima

type Ponto = { x: number; base: number; andar: number };
type Viagem = { agente: string; para: string; fase: 'indo' | 'elevador' | 'conversando' | 'voltando'; pos: Ponto; dur: number; visivel: boolean; esquerda: boolean };

const pessoaParada = (s: number) => 4 + (s % 8);      // p05–p12 (em pé)
const pessoaQueAnda = (s: number) => s % 4;           // andar-1..4 / p01–p04

export function PredioVivo({ salas, agentes, conversas }: { salas: SalaVivo[]; agentes: AgenteVivo[]; conversas: ConversaVivo[] }) {
  const porSala = useMemo(() => new Map(salas.map(s => [s.id, s])), [salas]);
  const andaveis = useMemo(() => new Set(conversas.map(c => c.de)), [conversas]);

  // Lugar de cada agente: espalhados na largura da sala, pés no chão da sala.
  // Depende só da disposição (quem está em qual sala): a atualização automática não reinicia o roteiro.
  const disposicao = salas.map(s => `${s.id}:${s.r.join(',')}`).join('|') + '#' + agentes.map(a => `${a.id}@${a.sala}`).join('|');
  const casa = useMemo(() => {
    const m = new Map<string, Ponto>();
    for (const s of salas) {
      const dela = agentes.filter(a => a.sala === s.id);
      const [x, y, w, h] = s.r;
      dela.forEach((a, i) => m.set(a.id, { x: x + w * (0.14 + (dela.length > 1 ? (i * 0.72) / (dela.length - 1) : 0.36)), base: y + h * 0.975, andar: s.andar }));
    }
    return m;
  }, [disposicao]); // eslint-disable-line react-hooks/exhaustive-deps
  const altura = (andar: number) => Math.min(ALTURA, (salas.find(s => s.andar === andar)?.r[3] ?? 120) * 0.72);

  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [elevador, setElevador] = useState<{ andar: number; dur: number }>({ andar: 1, dur: 0 });
  const andarElevador = useRef(1);
  const moverElevador = (andar: number) => { const dur = Math.abs(andar - andarElevador.current) * SEG_POR_ANDAR; andarElevador.current = andar; setElevador({ andar, dur }); return dur; };
  const [visto] = useState(() => new Set<string>());
  const fila = useRef<ConversaVivo[]>([]);
  const ocupado = useRef(false);

  // Novas passagens entram na frente da fila; as recentes repetem como atividade do dia.
  useEffect(() => {
    const novas = conversas.filter(c => !visto.has(c.id));
    novas.forEach(c => visto.add(c.id));
    fila.current = [...novas, ...fila.current.filter(c => conversas.some(x => x.id === c.id) && !novas.includes(c))];
    if (!fila.current.length) fila.current = [...conversas];
  }, [conversas, visto]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelado = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const esperar = (s: number) => new Promise<void>(r => { timers.push(setTimeout(r, s * 1000)); });
    const velocidade = (andar: number) => (PASSADA_POR_ALTURA * altura(andar)) / CICLO_S;

    async function andar(id: string, para: string, de: Ponto, ate: Ponto, fase: Viagem['fase']) {
      const d = Math.abs(ate.x - de.x) / velocidade(de.andar);
      setViagem({ agente: id, para, fase, pos: ate, dur: d, visivel: true, esquerda: ate.x < de.x });
      await esperar(d);
    }
    async function trocarDeAndar(id: string, para: string, de: Ponto, ate: Ponto, fase: Viagem['fase']) {
      const naPorta = { ...de, x: X_ELEVADOR };
      const busca = moverElevador(de.andar); // o elevador vem buscar enquanto o agente caminha até a porta
      const ida = andar(id, para, de, naPorta, fase);
      await Promise.all([ida, esperar(busca)]);
      if (cancelado) return naPorta;
      setViagem(v => v && { ...v, fase: 'elevador', visivel: false, dur: 0 });
      await esperar(0.6);
      const t = moverElevador(ate.andar);
      await esperar(t + 0.4);
      const saida = { x: X_ELEVADOR, base: ate.base, andar: ate.andar };
      setViagem(v => v && { ...v, fase, pos: saida, visivel: true, dur: 0, esquerda: true });
      await esperar(0.5);
      return saida;
    }

    async function visita(c: ConversaVivo) {
      const origem = casa.get(c.de), destino = casa.get(c.para);
      if (!origem || !destino) return;
      // Para ao lado do colega, a uma distância de conversa, do lado de onde veio.
      const vemDaDireita = origem.andar !== destino.andar || origem.x > destino.x;
      const encontro = { ...destino, x: destino.x + (vemDaDireita ? 1 : -1) * altura(destino.andar) * 0.42 };
      let pos = origem;
      if (origem.andar !== destino.andar) pos = await trocarDeAndar(c.de, c.para, pos, destino, 'indo');
      if (cancelado) return;
      await andar(c.de, c.para, pos, encontro, 'indo');
      if (cancelado) return;
      setViagem(v => v && { ...v, fase: 'conversando', dur: 0, esquerda: vemDaDireita });
      await esperar(CONVERSA_S);
      if (cancelado) return;
      pos = encontro;
      if (origem.andar !== destino.andar) pos = await trocarDeAndar(c.de, c.para, pos, origem, 'voltando');
      if (cancelado) return;
      await andar(c.de, c.para, pos, origem, 'voltando');
      setViagem(null);
    }

    (async () => {
      await esperar(3);
      while (!cancelado) {
        const c = fila.current.shift();
        if (c) { fila.current.push(c); ocupado.current = true; await visita(c); ocupado.current = false; }
        await esperar(PAUSA_ENTRE[0] + Math.random() * (PAUSA_ENTRE[1] - PAUSA_ENTRE[0]));
      }
    })();
    return () => { cancelado = true; timers.forEach(clearTimeout); setViagem(null); };
    // A rotina recomeça só se a disposição das salas mudar; a fila é lida por referência.
  }, [casa]); // eslint-disable-line react-hooks/exhaustive-deps

  const elevadorSala = salas.filter(s => s.andar === elevador.andar)[0];
  return (
    <>
      {/* Elevador: só se move quando alguém o usa */}
      {elevadorSala && (
        <div aria-hidden className="absolute rounded-[3px] border border-vx-verde/50 bg-vx-verde/[.07]"
          style={{ left: `${(ELEVADOR.x / IW) * 100}%`, width: `${(ELEVADOR.w / IW) * 100}%`, top: `${(elevadorSala.r[1] / IH) * 100}%`, height: `${(elevadorSala.r[3] / IH) * 100}%`,
            transition: `top ${elevador.dur}s cubic-bezier(.45,0,.3,1), height ${elevador.dur}s cubic-bezier(.45,0,.3,1)` }} />
      )}
      <ul aria-label="Agentes no prédio" className="pointer-events-none absolute inset-0">
        {agentes.map(a => {
          const lugar = casa.get(a.id);
          if (!lugar) return null;
          const v = viagem?.agente === a.id ? viagem : null;
          const visitado = viagem?.para === a.id && viagem.fase === 'conversando' ? viagem : null;
          const pos = v ? v.pos : lugar;
          const h = altura(pos.andar);
          const anda = !!v && (v.fase === 'indo' || v.fase === 'voltando') && v.dur > 0;
          const sala = porSala.get(a.sala);
          // Quem visita vira o rosto para o colega; o visitado vira para quem chegou.
          const olhaEsquerda = v ? v.esquerda : visitado ? !visitado.esquerda : (sala ? lugar.x > sala.r[0] + sala.r[2] / 2 : false);
          return (
            <li key={a.id} className="absolute -translate-x-1/2"
              style={{ left: `${(pos.x / IW) * 100}%`, top: `${((pos.base - h) / IH) * 100}%`, height: `${(h / IH) * 100}%`,
                transition: v ? `left ${v.dur}s linear, opacity .3s` : 'opacity .3s', opacity: v && !v.visivel ? 0 : 1, zIndex: v ? 3 : 2 }}>
              <Link href={a.href} title={a.titulo} aria-label={a.rotulo}
                className={`pointer-events-auto group relative block h-full rounded-[3px] ${a.selecionado ? 'ring-2 ring-vx-verde ring-offset-1' : ''}`}>
                <span className={`block h-full ${olhaEsquerda ? '-scale-x-100' : ''}`}>
                  {andaveis.has(a.id)
                    ? <PersonagemAndando pessoa={pessoaQueAnda(a.semente)} base={a.base} andando={anda} />
                    : <Personagem sprite={visitado ? 4 + (a.semente % 4) : pessoaParada(a.semente)} base={a.base} apagado={a.estado === 'desligado'} />}
                </span>
                <span aria-hidden className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-vx-grafite px-1.5 py-px text-[10px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{a.nome}</span>
                {(v?.fase === 'conversando' || visitado) && (
                  <span aria-hidden className={`vx-fala ${visitado ? 'vx-fala-b' : ''} pointer-events-none absolute -top-[6%] left-1/2 rounded-full bg-white px-1 text-[clamp(6px,0.6vw,9px)] font-bold leading-[11px] text-vx-grafite shadow ring-1 ring-vx-linha`}>•••</span>
                )}
                <Selo estado={a.estado} />
              </Link>
            </li>
          );
        })}
      </ul>
      {viagem && (
        <p aria-live="polite" className="sr-only">
          {agentes.find(a => a.id === viagem.agente)?.nome} {viagem.fase === 'conversando' ? 'conversa com' : 'vai até'} {agentes.find(a => a.id === viagem.para)?.nome}
        </p>
      )}
    </>
  );
}

function Selo({ estado }: { estado: EstadoAgente }) {
  const base = 'pointer-events-none absolute -right-1 top-0 grid min-w-[13px] place-items-center rounded-full px-0.5 text-[clamp(6px,0.6vw,9px)] font-bold leading-[13px] text-white shadow ring-1 ring-white';
  if (estado === 'trabalhando') return <span aria-hidden className={`${base} bg-vx-info`}><span className="flex gap-px"><span className="vx-ponto">•</span><span className="vx-ponto">•</span><span className="vx-ponto">•</span></span></span>;
  if (estado === 'aguardando') return <span aria-hidden className={`${base} bg-vx-aprovacao`}>◆</span>;
  if (estado === 'bloqueado') return <span aria-hidden className={`${base} bg-vx-erro`}>!</span>;
  if (estado === 'fila') return <span aria-hidden className={`${base} bg-vx-alerta`}>○</span>;
  return null;
}
