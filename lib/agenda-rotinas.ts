import { z } from 'zod';
import { fonteCliente } from './ficha-cliente';

export const FUSO_ROTINAS = 'America/Sao_Paulo';
export const FREQUENCIAS = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' } as const;
export const formularioRotina = z.object({
  chave_dedup: z.uuid(),
  nome: z.string().trim().min(3).max(120),
  papel_id: z.string().min(1).max(100),
  cliente_id: z.string().min(1).max(150).nullable(),
  area_interna: z.string().min(1).max(100).nullable(),
  dono_id: z.string().min(1).max(150),
  aprovador_id: z.string().min(1).max(150),
  objetivo: z.string().trim().min(5).max(4000),
  fontes: z.array(fonteCliente).min(1).transform(f => [...new Set(f)]),
  frequencia: z.enum(['diaria','semanal','mensal']),
  dia: z.number().int().min(1).max(31).nullable(),
  hora: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/),
  inclui_sazonal: z.boolean(),
}).refine(r => Boolean(r.cliente_id) !== Boolean(r.area_interna), 'Escolha um cliente ou uma área interna.')
  .refine(r => r.frequencia === 'diaria' ? r.dia === null : r.dia !== null && (r.frequencia === 'mensal' || r.dia <= 7), 'Confira o dia da frequência escolhida.');

export type ConfigRotina = z.infer<typeof formularioRotina>;
export type AgendaRotina = Pick<ConfigRotina, 'frequencia' | 'dia' | 'hora'>;
export type Rotina = ConfigRotina & { id: string; ativa: boolean; ultima_execucao: string | null; proxima_execucao: string | null };

const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_ROTINAS, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoOffset = new Intl.DateTimeFormat('en', { timeZone: FUSO_ROTINAS, timeZoneName: 'longOffset' });
const diaCivil = (data: Date) => new Date(formatoDia.format(data) + 'T00:00:00Z');
const isoDia = (data: Date) => data.toISOString().slice(0,10);
const deslocarDias = (d: Date, dias: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + dias));
const inicioSemana = (d: Date) => deslocarDias(d, -((d.getUTCDay() + 6) % 7));

export function semanaAnteriorAoPeriodo({ inicio }: { inicio: string }) {
  const primeiroDia = new Date(inicio + 'T00:00:00Z');
  return { inicio: isoDia(deslocarDias(primeiroDia,-7)), fim: isoDia(deslocarDias(primeiroDia,-1)) };
}

function instante(dia: Date, hora: string) {
  const civil = `${isoDia(dia)}T${hora.slice(0,5)}:00`;
  const offset = formatoOffset.formatToParts(new Date(civil + 'Z')).find(p => p.type === 'timeZoneName')?.value.slice(3) || '+00:00';
  return new Date(civil + offset);
}

function diaDaAgenda(r: AgendaRotina, ref: Date, deslocamento: number) {
  if (r.frequencia === 'diaria') return deslocarDias(ref, deslocamento);
  if (r.frequencia === 'semanal') return deslocarDias(inicioSemana(ref), 7 * deslocamento + r.dia! - 1);
  const y = ref.getUTCFullYear(), m = ref.getUTCMonth() + deslocamento;
  const ultimo = new Date(Date.UTC(y,m + 1,0)).getUTCDate();
  return new Date(Date.UTC(y,m,Math.min(r.dia!, ultimo)));
}

export function janelaRotina(r: AgendaRotina, dia: Date) {
  const civil = diaCivil(dia);
  if (r.frequencia === 'mensal') return isoDia(civil).slice(0,7);
  return isoDia(r.frequencia === 'semanal' ? inicioSemana(civil) : civil);
}

export function horarioRotina(r: AgendaRotina, agora: Date, tipo: 'ultima' | 'proxima') {
  const ref = diaCivil(agora);
  const atual = instante(diaDaAgenda(r,ref,0),r.hora);
  if (+atual <= +agora && tipo === 'ultima' || +atual > +agora && tipo === 'proxima') return atual;
  return instante(diaDaAgenda(r,ref,tipo === 'ultima' ? -1 : 1),r.hora);
}

export function periodoRotina(r: AgendaRotina, data: Date) {
  const ref = diaCivil(data);
  if (r.frequencia === 'mensal') {
    const y = ref.getUTCFullYear(), m = ref.getUTCMonth();
    return { inicio: isoDia(new Date(Date.UTC(y,m - 1,1))), fim: isoDia(new Date(Date.UTC(y,m,0))) };
  }
  return { inicio: isoDia(deslocarDias(ref,r.frequencia === 'semanal' ? -7 : -1)), fim: isoDia(deslocarDias(ref,-1)) };
}

export const MODELOS_ROTINA = [
  {
    id: 'relatorio', nome: 'Relatório semanal do cliente', papel_id: 'dados_atribuicao', frequencia: 'semanal', dia: 1, hora: '08:00',
    fontes: ['meta-ads','google-ads','reportei','crm'], objetivo: 'Compare os últimos sete dias completos de Meta Ads, Google Ads, Reportei e CRM. Informe conta, período, métricas confirmadas e lacunas de atribuição.',
  },
  {
    id: 'follow-up', nome: 'Follow-up de leads parados', papel_id: 'sdr_followup', frequencia: 'diaria', dia: null, hora: '09:00',
    fontes: ['crm'], objetivo: 'Identifique os leads parados do escopo autorizado e sugira uma mensagem individual por lead elegível. Respeite descadastro e registre quando a data da última interação não estiver disponível.',
  },
  {
    id: 'whatsapp', nome: 'Monitor de WhatsApp', papel_id: 'monitor_whatsapp', frequencia: 'diaria', dia: null, hora: '08:30',
    fontes: ['nexttags','vendax-app'], objetivo: 'Revise os sinais disponíveis de WhatsApp nas contas autorizadas. Se houver risco, redija uma sugestão de incidente com evidência, impacto e próximo teste.',
  },
] as const satisfies readonly (Pick<ConfigRotina,'nome'|'papel_id'|'frequencia'|'dia'|'hora'|'objetivo'> & { id: string; fontes: readonly ConfigRotina['fontes'][number][] })[];
