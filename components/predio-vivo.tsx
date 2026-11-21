'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Personagem, PersonagemAndando, PersonagemSentado, spriteDe, CICLO_S, PASSADA_POR_ALTURA, type Base } from './personagem';
import { aberturaSala, cabine, corredor, ELEVADOR_X, peloInterior, PORTAS_SALAS, type PontoPredio as Ponto } from '@/lib/rotas-predio';
import { CirculacaoPredio, type EstadoElevador } from './circulacao-predio';
import { ALTURA_PLANTA as IH, LARGURA_PLANTA as IW, POSTOS, CadeiraDoPosto, type Posto } from './postos-predio';

// Cada roteiro parte do posto de trabalho e termina com o agente sentado.
// As coordenadas usam os pixels da planta de 1536 × 1024.

export type EstadoAgente = 'trabalhando' | 'aguardando' | 'bloqueado' | 'fila' | 'ocioso' | 'desligado';
export type SalaVivo = { id: string; andar: number; r: [number, number, number, number] };
export type AgenteVivo = {
  id: string; sala: string; nome: string; estado: EstadoAgente; base: Base; href: string; rotulo: string; titulo: string;
  semente: number; selecionado: boolean;
};
export type ConversaVivo = { id: string; de: string; para: string; objetivo: string; previa?: boolean };

const ALTURA = 88;              // pessoa de ~1,75 m na escala do prédio
const TROCA_POSTURA_S = .36;
const PORTA_S = .28;

type Lugar = Ponto & { sala: string; posto?: Posto; pausa: number; atraso: number };
type Fase = 'levantando' | 'caminhando' | 'aguardando' | 'embarcando' | 'elevador' | 'desembarcando' | 'conversando' | 'sentando';
type Viagem = { conversa: ConversaVivo; fase: Fase; pos: Ponto; dur: number; visivel: boolean; esquerda: boolean };

const FASES: Record<Fase, string> = {
  levantando: 'Saindo do posto', caminhando: 'A caminho', aguardando: 'Aguardando o elevador',
  embarcando: 'Entrando no elevador', elevador: 'Em deslocamento entre andares', desembarcando: 'Saindo do elevador',
  conversando: 'Na sala de destino', sentando: 'De volta ao posto',
};

const pessoaQueAnda = (s: number) => s % 4;           // andar-1..4 / p01–p04

export function PredioVivo({ salas, agentes, conversas, circulacao, pedidoPercurso, mudarPercorrendo }: {
  salas: SalaVivo[]; agentes: AgenteVivo[]; conversas: ConversaVivo[]; circulacao: boolean;
  pedidoPercurso: number; mudarPercorrendo: (ativo: boolean) => void;
}) {
  // O lugar usa a cadeira registrada na planta e aceita papéis adicionais sem sobrepor postos.
  // Depende só da disposição (quem está em qual sala): a atualização automática não reinicia o roteiro.
  const disposicao = salas.map(s => `${s.id}:${s.andar}:${s.r.join(',')}`).join('|') + '#' + agentes.map(a => `${a.id}@${a.sala}`).join('|');
  const casa = useMemo(() => {
    const m = new Map<string, Lugar>();
    const porAndar = new Map<number, string[]>();
    for (const s of salas) {
      const nomes = porAndar.get(s.andar) ?? [];
      nomes.push(...agentes.filter(a => a.sala === s.id).map(a => a.id));
      porAndar.set(s.andar, nomes);
    }
    for (const s of salas) {
      const dela = agentes.filter(a => a.sala === s.id);
      const [x, y, w, h] = s.r;
      const ordem = porAndar.get(s.andar)!;
      const espaco = w * .72 / Math.max(1, dela.length - 1);
      dela.forEach((a, i) => {
        const dx = dela.length > 1 ? w * .14 + i * espaco : w / 2;
        const posto = POSTOS[s.id]?.[i];
        const pausa = posto?.esquerda ? 40 : -40;
        m.set(a.id, { x: posto?.x ?? x + dx, base: posto?.base ?? y + h * .975, andar: s.andar, zona: 'sala', sala: s.id, posto, pausa,
          atraso: .48 + (5 - s.andar) * .34 + ordem.indexOf(a.id) * (48 / ordem.length),
        });
      });
    }
    return m;
  }, [disposicao]); // eslint-disable-line react-hooks/exhaustive-deps
  const altura = (andar: number) => Math.min(ALTURA, (salas.find(s => s.andar === andar)?.r[3] ?? 120) * 0.72);

  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [elevador, setElevador] = useState<EstadoElevador>({ andar: 5, dur: 0, aberto: false });
  const [salaAberta, setSalaAberta] = useState<string | null>(null);
  const andarElevador = useRef(5);
  const [visto] = useState(() => new Set(conversas.map(c => c.id)));
  const fila = useRef<ConversaVivo[]>([]);
  const previa = useRef(pedidoPercurso);

  useEffect(() => {
    if (previa.current === pedidoPercurso) return;
    previa.current = pedidoPercurso;
    if (viagem || fila.current.length) return;
    const a = agentes.find(a => a.sala === 'direcao');
    const b = agentes.find(a => a.sala === 'marketing');
    if (a && b) fila.current.push({ id: `previa-${pedidoPercurso}`, de: a.id, para: b.id, objetivo: 'Prévia de percurso', previa: true });
  }, [agentes, pedidoPercurso, viagem]);

  // O histórico alimenta o painel. Só os registros novos geram movimento.
  useEffect(() => {
    const novas = conversas.filter(c => !visto.has(c.id));
    novas.forEach(c => visto.add(c.id));
    fila.current.push(...novas.reverse());
  }, [conversas, visto]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelado = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const esperar = (s: number) => new Promise<void>(r => {
      const id = setTimeout(() => { timers.delete(id); r(); }, s * 1000);
      timers.add(id);
    });
    async function caminhar(c: ConversaVivo, de: Ponto, ate: Ponto, fase: Fase = 'caminhando') {
      if (cancelado) return;
      const dx = ate.x - de.x;
      const dy = ate.base - de.base;
      if (dx === 0 && dy === 0) return;
      const velocidade = ALTURA * PASSADA_POR_ALTURA / CICLO_S;
      const dur = Math.hypot(dx, dy * 3) / velocidade;
      setViagem(v => ({ conversa: c, fase, pos: ate, dur, visivel: true, esquerda: dx === 0 ? v?.esquerda ?? false : dx < 0 }));
      await esperar(dur);
    }
    async function interior(c: ConversaVivo, de: Ponto, ate: Ponto) {
      let anterior = de;
      for (const p of peloInterior(de, ate)) {
        await caminhar(c, anterior, p);
        anterior = p;
      }
    }
    async function cruzar(c: ConversaVivo, sala: string, saindo: boolean) {
      const { deDentro, deFora } = aberturaSala(sala);
      if (cancelado) return;
      setSalaAberta(sala);
      await esperar(PORTA_S);
      await caminhar(c, saindo ? deDentro : deFora, saindo ? deFora : deDentro);
      if (!cancelado) setSalaAberta(null);
    }
    function moverElevador(andar: number) {
      const saltos = Math.abs(andarElevador.current - andar);
      const dur = saltos ? .24 + saltos * .52 : 0;
      andarElevador.current = andar;
      setElevador({ andar, dur, aberto: false });
      return esperar(dur);
    }
    function portasElevador(aberto: boolean) {
      setElevador(v => ({ ...v, aberto }));
      return esperar(PORTA_S);
    }
    async function elevadorEntre(c: ConversaVivo, de: Ponto, ate: number) {
      const embarque = corredor(de.andar, ELEVADOR_X);
      const desembarque = corredor(ate, ELEVADOR_X);
      await Promise.all([caminhar(c, de, embarque), moverElevador(de.andar)]);
      if (cancelado) return desembarque;
      setViagem(v => v && { ...v, fase: 'aguardando', dur: 0 });
      await portasElevador(true);
      await caminhar(c, embarque, cabine(de.andar), 'embarcando');
      if (cancelado) return desembarque;
      setViagem(v => v && { ...v, fase: 'elevador', visivel: false, dur: 0 });
      await portasElevador(false);
      if (cancelado) return desembarque;
      await moverElevador(ate);
      if (cancelado) return desembarque;
      setViagem(v => v && { ...v, pos: cabine(ate), fase: 'elevador', dur: 0 });
      await portasElevador(true);
      await caminhar(c, cabine(ate), desembarque, 'desembarcando');
      if (!cancelado) await portasElevador(false);
      return desembarque;
    }
    async function percurso(c: ConversaVivo, de: Lugar, ate: Lugar) {
      if (de.sala === ate.sala) {
        await interior(c, de, ate);
        return;
      }
      const saida = aberturaSala(de.sala);
      const entrada = aberturaSala(ate.sala);
      await interior(c, de, saida.deDentro);
      await cruzar(c, de.sala, true);
      if (cancelado) return;
      const piso = de.andar === ate.andar ? saida.deFora : await elevadorEntre(c, saida.deFora, ate.andar);
      await caminhar(c, piso, entrada.deFora);
      await cruzar(c, ate.sala, false);
      await interior(c, entrada.deDentro, ate);
    }
    async function visita(c: ConversaVivo) {
      const origem = casa.get(c.de), destino = casa.get(c.para);
      if (!origem || !destino || !PORTAS_SALAS[origem.sala] || !PORTAS_SALAS[destino.sala]) return;
      const veioDaDireita = (origem.sala === destino.sala ? origem.x : PORTAS_SALAS[destino.sala].x) > destino.x;
      const encontro = { ...destino, x: destino.x + (veioDaDireita ? 38 : -38) };
      setViagem({ conversa: c, fase: 'levantando', pos: origem, dur: 0, visivel: true, esquerda: origem.x > destino.x });
      await esperar(TROCA_POSTURA_S);
      if (cancelado) return;
      await percurso(c, origem, encontro);
      if (cancelado) return;
      setViagem(v => v && { ...v, fase: 'conversando', dur: 0, esquerda: veioDaDireita });
      await esperar(c.previa ? .9 : 1.8);
      if (cancelado) return;
      await percurso(c, encontro, origem);
      if (cancelado) return;
      setViagem(v => v && { ...v, fase: 'sentando', dur: 0, esquerda: !!origem.posto?.esquerda });
      await esperar(TROCA_POSTURA_S);
      if (!cancelado) setViagem(null);
    }

    (async () => {
      while (!cancelado) {
        const c = fila.current.shift();
        if (c) {
          mudarPercorrendo(true);
          await visita(c);
          if (!cancelado) mudarPercorrendo(false);
        }
        await esperar(c ? .28 : .14);
      }
    })();
    return () => { cancelado = true; timers.forEach(clearTimeout); setViagem(null); mudarPercorrendo(false); };
    // A rotina recomeça só se a disposição das salas mudar; a fila é lida por referência.
  }, [casa, mudarPercorrendo]);

  return (
    <>
      <CirculacaoPredio salaAberta={salaAberta} elevador={elevador} />
      {agentes.map(a => {
        const lugar = casa.get(a.id);
        if (!lugar?.posto) return null;
        const v = viagem?.conversa.de === a.id ? viagem : null;
        const visitado = viagem?.conversa.para === a.id && viagem.fase === 'conversando';
        return <CadeiraDoPosto key={a.id} posto={lugar.posto} afastada={!!v && v.fase !== 'sentando'}
          emPausa={circulacao && !v && !visitado && a.estado === 'ocioso' && a.base !== 'nenhum'} atraso={lugar.atraso} />;
      })}
      <ul aria-label="Agentes no prédio" className="pointer-events-none absolute inset-0">
        {agentes.map(a => {
          const lugar = casa.get(a.id);
          if (!lugar) return null;
          const v = viagem?.conversa.de === a.id ? viagem : null;
          const visitado = viagem?.conversa.para === a.id && viagem.fase === 'conversando' ? viagem : null;
          const pos = v ? v.pos : lugar;
          const h = altura(pos.andar);
          const anda = !!v && (['caminhando', 'embarcando', 'desembarcando'].includes(v.fase));
          const emPausa = circulacao && !!lugar.posto && !v && !visitado && a.estado === 'ocioso' && a.base !== 'nenhum';
          const sentado = !!lugar.posto && (!v || v.fase === 'sentando');
          const esquerda = v ? v.esquerda : visitado ? !visitado.esquerda : !!lugar.posto?.esquerda;
          const pessoa = pessoaQueAnda(a.semente);
          const estilo = {
            left: `${(pos.x / IW) * 100}%`, top: `${((pos.base - h) / IH) * 100}%`, height: `${(h / IH) * 100}%`, width: `${(h * .57 / IW) * 100}%`,
            transition: v ? `left ${v.dur}s linear, top ${v.dur}s linear, opacity .16s` : 'opacity .3s',
            opacity: v && !v.visivel ? 0 : 1, zIndex: v?.pos.zona === 'corredor' ? 8 : v ? 5 : 2,
            ...(emPausa ? {
              '--vx-lugar': `${(lugar.x / IW) * 100}%`,
              '--vx-pausa': `${((lugar.x + lugar.pausa) / IW) * 100}%`,
              '--vx-atraso': `${lugar.atraso}s`,
              '--vx-ida': Math.sign(lugar.pausa), '--vx-volta': -Math.sign(lugar.pausa),
            } : {}),
          } as CSSProperties;
          return (
            <li key={a.id} className="absolute -translate-x-1/2" data-pausa-posto={emPausa} data-postura={sentado ? 'sentado' : 'em-pe'} data-zona={pos.zona} style={estilo}>
              <Link href={a.href} title={a.titulo} aria-label={a.rotulo}
                className={`pointer-events-auto group relative block h-full rounded-[3px] ${a.selecionado ? 'ring-2 ring-vx-verde ring-offset-1' : ''}`}>
                <span aria-hidden className="vx-figura-posto vx-em-pe">
                  <span className={`block h-full ${esquerda ? '-scale-x-100' : ''}`}>
                    {anda || v?.fase === 'elevador'
                      ? <PersonagemAndando pessoa={pessoa} base={a.base} andando={anda} />
                      : <Personagem sprite={spriteDe(v?.fase === 'conversando' ? 'conversa' : 'trabalha', a.semente)} base={a.base} apagado={a.estado === 'desligado'} />}
                  </span>
                </span>
                {lugar.posto && <span aria-hidden className="vx-figura-posto vx-sentado" data-esquerda={esquerda}>
                  <span className={`block h-full ${a.estado === 'trabalhando' ? 'vx-digitando' : ''}`}>
                    <PersonagemSentado pessoa={pessoa} base={a.base} apagado={a.estado === 'desligado'} />
                  </span>
                </span>}
                {emPausa && <span aria-hidden className="vx-figura-posto vx-andando-pausa">
                  <PersonagemAndando pessoa={pessoa} base={a.base} ciclo={1.8} />
                </span>}
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
        <p aria-live="polite" className="vx-predio-passagem" data-fase={viagem.fase}>
          <span aria-hidden />{viagem.conversa.previa && <strong>Prévia</strong>}<span>{FASES[viagem.fase]}</span>
          <span aria-hidden>·</span><span>{agentes.find(a => a.id === viagem.conversa.de)?.nome}</span>
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
