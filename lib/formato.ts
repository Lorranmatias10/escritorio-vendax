import { FUSO } from './catalogo';

const dh = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const d = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });

export const dataHora = (v: string | Date | null) => (v ? dh.format(new Date(v)) : 'Sem prazo');
export const data = (v: string | Date | null) => (v ? d.format(new Date(v)) : 'Sem data');
export const atrasado = (v: string | null) => !!v && new Date(v) < new Date();
