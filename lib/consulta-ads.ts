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
type Linha = Record<string, unknown>;

export function numeroDaMetrica(valor: unknown) {
  if (typeof valor !== 'number' && (typeof valor !== 'string' || !valor.trim())) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

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

async function abrirGoogle(q: Q, conta: ContaAds) {
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
  const buscar = async (query: string) => {
    const cru = await lerApi(url, headers, { query });
    if (!Array.isArray(cru)) throw new Error('Resposta da API sem identidade verificável.');
    return cru.flatMap(lote => Array.isArray(lote.results) ? lote.results : []);
  };
  const campos = 'campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type';
  const conferirConta = (linhas: { customer?: { id?: unknown } }[]) => {
    if (linhas.some(m => String(m.customer?.id) !== conta.identificador)) throw new Error('Resposta da API sem identidade verificável.');
    return linhas;
  };
  async function desempenho(periodo: Periodo, completo = false) {
    const linhas = await buscar(`SELECT customer.id, customer.currency_code, ${campos}, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign WHERE segments.date BETWEEN '${periodo.inicio}' AND '${periodo.fim}' ORDER BY metrics.cost_micros DESC${completo ? '' : ' LIMIT 30'}`);
    conferirConta(linhas);
    return linhas;
  }
  return {
    async confirmar() {
      const linhas = await buscar('SELECT customer.id FROM customer LIMIT 1');
      if (!linhas.some(m => String(m.customer?.id) === conta.identificador)) throw new Error('O Google Ads não confirmou o identificador.');
    },
    async inventario(comparativo = false) {
      const linhas = await buscar(`SELECT ${comparativo ? 'customer.id, ' : ''}${campos} FROM campaign
        WHERE campaign.status IN ('ENABLED','PAUSED') ORDER BY campaign.id DESC LIMIT 40`);
      return comparativo ? conferirConta(linhas) : linhas;
    },
    desempenho,
    observacao: 'Google Ads: custo em micros da moeda da conta; conversões configuradas no Google; recortes limitados.',
    async comparar(periodo: Periodo) {
      return (await desempenho(periodo, true)).map(m => {
        const micros = numeroDaMetrica(m.metrics?.costMicros);
        return { id: m.campaign?.id, nome: m.campaign?.name, moeda: m.customer?.currencyCode,
          impressoes: numeroDaMetrica(m.metrics?.impressions), cliques: numeroDaMetrica(m.metrics?.clicks),
          custo: micros === null ? null : micros / 1_000_000, conversoes: numeroDaMetrica(m.metrics?.conversions) };
      });
    },
    observacaoComparacao: 'Google Ads: custo na moeda da conta e conversões configuradas no Google. Campanhas ausentes do retorno não têm métricas confirmadas.',
  };
}

async function abrirMeta(q: Q, conta: ContaAds) {
  const token = await lerSegredo(q, 'META_ACCESS_TOKEN');
  const v = process.env.META_GRAPH_VERSION?.trim() || 'v26.0';
  if (!token || !/^v\d+\.\d+$/.test(v)) throw new Error('Conexão Meta Ads indisponível.');
  const raiz = `https://graph.facebook.com/${v}/act_${conta.identificador}`;
  const headers = { Authorization: `Bearer ${token}` };
  function linhas(pagina: unknown) {
    const rows = (pagina as { data?: Linha[] } | null)?.data;
    if (!Array.isArray(rows) || rows.some(r => String(r.account_id) !== conta.identificador)) throw new Error('Resposta da API sem identidade verificável.');
    return rows;
  }
  async function desempenho(periodo: Periodo, completo = false) {
    const ins = new URL(`${raiz}/insights`);
    const campos = 'account_id,account_currency,campaign_id,campaign_name,spend,impressions,clicks,actions,date_start,date_stop';
    ins.search = new URLSearchParams({ fields: completo ? `${campos},conversions` : campos, level: 'campaign',
      time_range: JSON.stringify({ since: periodo.inicio, until: periodo.fim }), sort: 'spend_descending', limit: completo ? '100' : '30' }).toString();
    const campanhas: Linha[] = [];
    const cursores = new Set<string>();
    for (;;) {
      const pagina = await lerApi(ins, headers) as { paging?: { next?: string; cursors?: { after?: string } } };
      const dados = linhas(pagina);
      if (completo && dados.some(c => (c.date_start != null && c.date_start !== periodo.inicio)
        || (c.date_stop != null && c.date_stop !== periodo.fim))) throw new Error('O Meta Ads não confirmou o período solicitado.');
      campanhas.push(...dados);
      if (!completo || !pagina.paging?.next) return campanhas;
      const cursor = pagina.paging.cursors?.after;
      if (!cursor || cursores.has(cursor)) throw new Error('Paginação do Meta Ads indisponível.');
      cursores.add(cursor);
      ins.searchParams.set('after',cursor);
    }
  }
  const acoes = (v: unknown) => Array.isArray(v) ? (v as Linha[])
    .filter(a => typeof a?.action_type === 'string').map(a => ({ tipo: String(a.action_type), valor: numeroDaMetrica(a.value) })) : [];
  return {
    async confirmar() {
      const cru = await lerApi(new URL(raiz + '?fields=account_id'), headers) as { account_id?: string };
      if (String(cru.account_id) !== conta.identificador) throw new Error('O Meta Ads não confirmou o identificador.');
    },
    async inventario() {
      const camp = new URL(`${raiz}/campaigns`);
      camp.search = new URLSearchParams({ fields: 'account_id,id,name,status,effective_status,objective', limit: '40' }).toString();
      return linhas(await lerApi(camp,headers));
    },
    desempenho,
    observacao: 'Meta Ads: investimento na moeda da conta e ações conforme a atribuição do canal. Conversas, leads e agendamentos são indicadores distintos.',
    async comparar(periodo: Periodo) {
      return (await desempenho(periodo,true)).map(m => ({
        id: m.campaign_id, nome: m.campaign_name, moeda: m.account_currency,
        impressoes: numeroDaMetrica(m.impressions), cliques: numeroDaMetrica(m.clicks), custo: numeroDaMetrica(m.spend),
        conversoes: acoes(m.conversions), acoes_atribuidas: acoes(m.actions).filter(a => /lead|purchase|messaging|conversion/i.test(a.tipo)),
      }));
    },
    observacaoComparacao: 'Meta Ads: custo na moeda da conta. Conversões e ações atribuídas são eventos por tipo, sem soma entre tipos que podem se sobrepor. Campos vazios ou campanhas ausentes ficam sem valor confirmado.',
  };
}

function abrirCanalAds(q: Q, conta: ContaCliente) {
  return conta.integracao === 'google-ads' ? abrirGoogle(q,conta) : abrirMeta(q,conta);
}

export async function lerContaAds(q: Q, conta: ContaCliente, periodo?: Periodo) {
  const canal = await abrirCanalAds(q,conta);
  if (!periodo) {
    await canal.confirmar();
    return null;
  }
  const [inventario, metricas] = await Promise.all([canal.inventario(), canal.desempenho(periodo)]);
  return { inventario, metricas, observacao: canal.observacao };
}

export async function lerComparativoAds(q: Q, conta: ContaCliente, principal: Periodo, comparacao: Periodo) {
  const abertura = abrirCanalAds(q,conta);
  return Promise.allSettled([
    abertura.then(async canal => {
      const [metricas,inventario] = await Promise.all([canal.comparar(principal),canal.inventario(true).catch(() => null)]);
      return { metricas, inventario, observacao: canal.observacaoComparacao };
    }),
    abertura.then(async canal => ({ metricas: await canal.comparar(comparacao), observacao: canal.observacaoComparacao })),
  ]);
}
