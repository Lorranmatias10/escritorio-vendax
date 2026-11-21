import { ALTURA_PLANTA, LARGURA_PLANTA } from './postos-predio';
import { ANDARES_PREDIO, PORTAS_SALAS, ELEVADOR_X, PORTA_ELEVADOR_LARGURA } from '@/lib/rotas-predio';

export type EstadoElevador = { andar: number; dur: number; aberto: boolean };

export function CirculacaoPredio({ salaAberta, elevador }: { salaAberta: string | null; elevador: EstadoElevador }) {
  const caixa = (x: number, y: number, w: number, h: number) => ({
    left: `${100 * x / LARGURA_PLANTA}%`, top: `${100 * y / ALTURA_PLANTA}%`,
    width: `${100 * w / LARGURA_PLANTA}%`, height: `${100 * h / ALTURA_PLANTA}%`,
  });
  const piso = ANDARES_PREDIO[elevador.andar];
  return <div aria-hidden className="pointer-events-none absolute inset-0">
    {Object.entries(ANDARES_PREDIO).map(([andar, d]) =>
      <span key={andar} className="vx-corredor-frontal" style={caixa(116, d.piso + 2, 1302, d.corredor - d.piso - 2)} />)}
    {Object.entries(PORTAS_SALAS).map(([sala, p]) =>
      <span key={sala} className="vx-porta-sala" data-sala={sala} data-aberta={salaAberta === sala}
        style={caixa(p.x - 18, ANDARES_PREDIO[p.andar].piso - 91, 36, 91)}><i /></span>)}
    <div className="vx-cabine-elevador" data-andar={elevador.andar} data-porta-aberta={elevador.aberto}
      style={{ ...caixa(ELEVADOR_X - PORTA_ELEVADOR_LARGURA / 2, piso.porta, PORTA_ELEVADOR_LARGURA, piso.piso - piso.porta), transition: `top ${elevador.dur}s ease-in-out, height ${elevador.dur}s ease-in-out` }}>
      <span className="vx-cabine-visor">{elevador.andar}</span>
      <span className="vx-cabine-acesso"><i /><i /></span>
    </div>
  </div>;
}
