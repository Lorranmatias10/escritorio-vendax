import type { CSSProperties } from 'react';

export const LARGURA_PLANTA = 1536;
export const ALTURA_PLANTA = 1024;

type Recorte = readonly [x: number, y: number, largura: number, altura: number];
type TipoCadeira = 'direcao' | 'giratória' | 'estofada' | 'lateral';
export type Posto = {
  x: number;
  base: number;
  cadeira: TipoCadeira;
  fundo?: number;
  esquerda?: boolean;
};

const MODELOS: Record<TipoCadeira, Recorte> = {
  direcao: [588, 212, 52, 62],
  giratória: [291, 720, 55, 64],
  estofada: [457, 395, 66, 59],
  lateral: [270, 905, 45, 72],
};

// Os postos seguem as mesas da planta. A coordenada de fundo amostra a mesma mesa ao lado da cadeira.
export const POSTOS: Record<string, readonly Posto[]> = {
  direcao: [
    { x: 613, base: 274, cadeira: 'direcao', fundo: 636 },
    { x: 761, base: 274, cadeira: 'direcao', fundo: 787, esquerda: true },
    { x: 911, base: 274, cadeira: 'direcao', fundo: 932 },
  ],
  comercial: [
    { x: 376, base: 453, cadeira: 'giratória' },
    { x: 490, base: 453, cadeira: 'estofada', fundo: 399, esquerda: true },
    { x: 558, base: 453, cadeira: 'estofada', fundo: 586 },
  ],
  marketing: [
    { x: 968, base: 453, cadeira: 'estofada', fundo: 873 },
    { x: 1036, base: 453, cadeira: 'estofada', fundo: 1061, esquerda: true },
  ],
  contas: [
    { x: 355, base: 626, cadeira: 'estofada', fundo: 377 },
    { x: 434, base: 627, cadeira: 'estofada', fundo: 446, esquerda: true },
  ],
  atendimento: [
    { x: 790, base: 625, cadeira: 'giratória', fundo: 823 },
    { x: 1008, base: 625, cadeira: 'giratória', fundo: 1032, esquerda: true },
  ],
  performance: [
    { x: 319, base: 783, cadeira: 'giratória', fundo: 348 },
    { x: 387, base: 783, cadeira: 'giratória' },
    { x: 457, base: 783, cadeira: 'giratória', fundo: 475, esquerda: true },
    { x: 228, base: 783, cadeira: 'giratória' },
    { x: 270, base: 783, cadeira: 'giratória', esquerda: true },
  ],
  whatsapp: [
    { x: 692, base: 783, cadeira: 'giratória', fundo: 711 },
    { x: 751, base: 783, cadeira: 'giratória' },
    { x: 808, base: 783, cadeira: 'giratória', fundo: 826, esquerda: true },
  ],
  produto: [
    { x: 1006, base: 783, cadeira: 'giratória', fundo: 1030 },
    { x: 1131, base: 783, cadeira: 'giratória', fundo: 1148, esquerda: true },
  ],
  financeiro: [
    { x: 293, base: 976, cadeira: 'lateral', fundo: 232 },
    { x: 447, base: 975, cadeira: 'lateral', fundo: 364, esquerda: true },
    { x: 605, base: 975, cadeira: 'lateral', fundo: 541 },
  ],
};

function enquadrar(x: number, y: number, largura: number, altura: number): CSSProperties {
  return { left: `${100 * x / LARGURA_PLANTA}%`, top: `${100 * y / ALTURA_PLANTA}%`,
    width: `${100 * largura / LARGURA_PLANTA}%`, height: `${100 * altura / ALTURA_PLANTA}%` };
}

function textura(x: number, y: number, largura: number, altura: number): CSSProperties {
  return {
    backgroundSize: `${100 * LARGURA_PLANTA / largura}% ${100 * ALTURA_PLANTA / altura}%`,
    backgroundPosition: `${100 * x / (LARGURA_PLANTA - largura)}% ${100 * y / (ALTURA_PLANTA - altura)}%`,
  };
}

export function CadeiraDoPosto({ posto, afastada, emPausa, atraso }: {
  posto: Posto; afastada: boolean; emPausa: boolean; atraso: number;
}) {
  const [x, y, w, h] = MODELOS[posto.cadeira];
  const posicao = enquadrar(posto.x - w / 2, posto.base - h, w, h);
  const original = posto.fundo !== undefined;
  const estilo = { ...posicao, '--vx-atraso': `${atraso}s`, '--vx-recuo': posto.esquerda ? '23%' : '-23%', '--vx-sentido': posto.esquerda ? -1 : 1 } as CSSProperties;
  return <>
    <div aria-hidden className="vx-cadeira-posto" data-original={original} data-afastada={afastada} data-pausa={emPausa} style={estilo}>
      {posto.fundo !== undefined && <span className="vx-textura-planta vx-fundo-posto" style={textura(posto.fundo, posto.base - h, w, h)} />}
      <span className="vx-cadeira-movel" data-afastada={afastada} data-pausa={emPausa}>
        <span className="vx-textura-planta vx-cadeira-recorte" data-modelo={posto.cadeira} style={textura(x, y, w, h)} />
      </span>
    </div>
    {original && posto.cadeira !== 'lateral' && <span aria-hidden className="vx-textura-planta vx-cadeira-encosto"
      data-afastada={afastada} data-pausa={emPausa}
      style={{ ...estilo, ...textura(posto.x - w / 2, posto.base - h, w, h) }} />}
  </>;
}
