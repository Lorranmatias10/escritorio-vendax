export type ZonaPredio = 'sala' | 'corredor' | 'cabine';
export type PontoPredio = { x: number; base: number; andar: number; zona: ZonaPredio };

export const ANDARES_PREDIO: Record<number, { piso: number; corredor: number; porta: number }> = {
  1: { piso: 977, corredor: 987, porta: 868 },
  2: { piso: 784, corredor: 793, porta: 669 },
  3: { piso: 627, corredor: 636, porta: 504 },
  4: { piso: 454, corredor: 464, porta: 323 },
  5: { piso: 274, corredor: 284, porta: 126 },
};

export const PORTAS_SALAS: Record<string, { x: number; andar: number }> = {
  direcao: { x: 1218, andar: 5 },
  comercial: { x: 714, andar: 4 },
  marketing: { x: 809, andar: 4 },
  contas: { x: 617, andar: 3 },
  atendimento: { x: 669, andar: 3 },
  performance: { x: 534, andar: 2 },
  whatsapp: { x: 886, andar: 2 },
  produto: { x: 942, andar: 2 },
  financeiro: { x: 826, andar: 1 },
};

export const ELEVADOR_X = 1366;
export const PORTA_ELEVADOR_LARGURA = 84;

export function corredor(andar: number, x: number): PontoPredio {
  return { andar, x, base: ANDARES_PREDIO[andar].corredor, zona: 'corredor' };
}

export function cabine(andar: number): PontoPredio {
  return { andar, x: ELEVADOR_X, base: ANDARES_PREDIO[andar].piso - 5, zona: 'cabine' };
}

export function aberturaSala(sala: string) {
  const { x, andar } = PORTAS_SALAS[sala];
  const deDentro: PontoPredio = { x, andar, base: ANDARES_PREDIO[andar].piso - 3, zona: 'sala' };
  return { deDentro, deFora: corredor(andar, x) };
}

export function peloInterior(origem: PontoPredio, destino: PontoPredio): PontoPredio[] {
  const faixa = ANDARES_PREDIO[origem.andar].piso - 3;
  return [{ ...origem, base: faixa }, { ...destino, base: faixa }, destino];
}
