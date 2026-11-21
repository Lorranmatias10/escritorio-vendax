import { z } from 'zod';
import type { Q } from './db';
import { lerSegredo } from './cofre';
import { tokenGoogle } from './integracoes';
import type { ContaCliente } from './ficha-cliente';

export const consultaAds = z.object({ inicio: z.iso.date(), fim: z.iso.date() }).refine(({ inicio, fim }) => {
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000;
  return dias >= 0 && dias <= 89;
}, 'Escolha até 90 dias e confira as datas.');
export type Periodo = z.infer<typeof consultaAds>;
type ContaAds = Pick<ContaCliente, 'identificador'>;

export async function lerApi(url: URL, headers: Record<string, string>, body?: Record<string, unknown>) {
  const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(10_000), ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  if (!res.ok) {
    const corpo = await res.json().catch(() => null) as { error?: { status?: string } } | null;
    const codigo = corpo?.error?.status;
    const detalhe = codigo && /^[A-Z_]{3,40}$/.test(codigo) ? ` ${codigo}` : '';
    throw new Error(`HTTP ${res.status}${detalhe}`);
  }
  return res.json() as Promise<unknown>;
}

async function google(q: Q, conta: ContaAds, periodo?: Periodo) {
  const config = (nome: string) => process.env[nome]?.trim() || null;
  const v = config('GOOGLE_ADS_API_VERSION') ?? 'v25';
  const mcc = config('GOOGLE_ADS_LOGIN_CUSTOMER_ID')?.replaceAll('-', '');
  if (!/^v\d+$/.test(v) || (mcc && !/^\d{10}$/.test(mcc))) throw new Error('Configuração Google Ads inválida.');
  const token = await tokenGoogle({ config, segredo: nome => lerSegredo(q, nome) }, 'google-ads');
  if ('status' in token) throw new Error('Conexão Google Ads indisponível.');
  const url = new URL(`https://googleads.googleapis.com/${v}/customers/${conta.identificador}/googleAds:searchStream`);
  const headers: Record<string, string> = { Authorization: `Bearer ${token.access}`, 'Content-Type': 'application/json' };
  if (mcc) headers['login-customer-id'] = mcc;
  const dev = await lerSegredo(q, 'GOOGLE_ADS_DEVELOPER_TOKEN');
  if (dev) headers['developer-token'] = dev;
  if (!periodo) {
    const cru = await lerApi(url, headers, { query: 'SELECT customer.id FROM customer LIMIT 1' });
    if (!Array.isArray(cru) || !cru.some(v => v.results?.some((r: { customer?: { id?: string } }) => String(r.customer?.id) === conta.identificador)))
      throw new Error('O Google Ads não confirmou o identificador.');
    return null;
  }
  const campos = 'campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type';
  const [catalogo, desempenho] = await Promise.all([
    lerApi(url, headers, { query: `SELECT ${campos} FROM campaign WHERE campaign.status IN ('ENABLED','PAUSED') ORDER BY campaign.id DESC LIMIT 40` }),
    lerApi(url, headers, { query: `SELECT customer.id, customer.currency_code, ${campos}, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign WHERE segments.date BETWEEN '${periodo.inicio}' AND '${periodo.fim}' ORDER BY metrics.cost_micros DESC LIMIT 30` }),
  ]);
  const linhas = (v: unknown) => Array.isArray(v) ? v.flatMap(r => Array.isArray(r.results) ? r.results : []) : null;
  const inventario = linhas(catalogo), metricas = linhas(desempenho);
  if (!inventario || !metricas || metricas.some(m => String(m.customer?.id) !== conta.identificador)) throw new Error('Resposta da API sem identidade verificável.');
  return { inventario, metricas, observacao: 'Google Ads: custo em micros da moeda da conta; conversões configuradas no Google; recortes limitados.' };
}

async function meta(q: Q, conta: ContaAds, periodo?: Periodo) {
  const token = await lerSegredo(q, 'META_ACCESS_TOKEN');
  const v = process.env.META_GRAPH_VERSION?.trim() || 'v26.0';
  if (!token || !/^v\d+\.\d+$/.test(v)) throw new Error('Conexão Meta Ads indisponível.');
  const raiz = `https://graph.facebook.com/${v}/act_${conta.identificador}`;
  const headers = { Authorization: `Bearer ${token}` };
  if (!periodo) {
    const cru = await lerApi(new URL(raiz + '?fields=account_id'), headers) as { account_id?: string };
    if (String(cru.account_id) !== conta.identificador) throw new Error('O Meta Ads não confirmou o identificador.');
    return null;
  }
  const camp = new URL(`${raiz}/campaigns`);
  camp.search = new URLSearchParams({ fields: 'account_id,id,name,status,effective_status,objective', limit: '40' }).toString();
  const ins = new URL(`${raiz}/insights`);
  ins.search = new URLSearchParams({ fields: 'account_id,account_currency,campaign_id,campaign_name,spend,impressions,clicks,actions,date_start,date_stop',
    level: 'campaign', time_range: JSON.stringify({ since: periodo.inicio, until: periodo.fim }), sort: 'spend_descending', limit: '30' }).toString();
  const [cruInventario, cruMetricas] = await Promise.all([lerApi(camp, headers), lerApi(ins, headers)]);
  const linhas = (v: unknown) => {
    const rows = (v as { data?: { account_id?: string }[] } | null)?.data;
    if (!Array.isArray(rows) || rows.some(r => String(r.account_id) !== conta.identificador)) throw new Error('Resposta da API sem identidade verificável.');
    return rows;
  };
  return { inventario: linhas(cruInventario), metricas: linhas(cruMetricas),
    observacao: 'Meta Ads: investimento na moeda da conta e ações conforme a atribuição do canal. Conversas, leads e agendamentos são indicadores distintos.' };
}

export async function lerContaAds(q: Q, conta: ContaCliente, periodo?: Periodo) {
  return conta.integracao === 'google-ads' ? google(q, conta, periodo) : meta(q, conta, periodo);
}
