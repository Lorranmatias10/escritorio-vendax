import type { Q } from './db';
import { lerSegredo } from './cofre';
import { tokenGoogle } from './integracoes';
import { lerApi, lerComparativoAds, lerContaAds, numeroDaMetrica, type Periodo } from './consulta-ads';
import { contasDoCliente, FONTES_CLIENTE, lacunaConta, type ContaCliente, type FonteCliente } from './ficha-cliente';
import { podeVer, SemAcesso, type Usuario } from './escopo';
import type { EntradaAgente } from './ia';

type Recurso = Pick<ContaCliente, 'integracao' | 'tipo' | 'identificador'>;
type Objeto = Record<string, unknown>;
const objeto = (x: unknown): Objeto => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Objeto : {};
const lista = (x: unknown): Objeto[] => Array.isArray(x) ? x.map(objeto) : [];
const str = (x: unknown) => typeof x === 'string' || typeof x === 'number' ? String(x) : '';
const valor = (nome: string) => process.env[nome]?.trim() || null;

function identidade(id: unknown, esperado: string) {
  if (str(id) !== esperado) throw new Error('A integração não confirmou o identificador informado.');
}

async function credencial(q: Q, nome: string) {
  const token = await lerSegredo(q,nome);
  if (!token) throw new Error('Credencial de leitura indisponível.');
  return token;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
async function mcpCrm(token: string, ferramenta: 'whoami' | 'clients_get' | 'leads_list', args: Objeto) {
  const res = objeto(await lerApi(new URL('https://uktnpcuobzpokgmdiplw.supabase.co/functions/v1/mcp-server'),
    { ...bearer(token), 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: ferramenta, arguments: args } }));
  const result = objeto(res.result);
  if (res.jsonrpc !== '2.0' || res.id !== 1 || result.isError) throw new Error('O CRM recusou a consulta de leitura.');
  return objeto(result.structuredContent);
}

async function lerCrm(q: Q, tipo: string, id: string, verificar: boolean) {
  const numero = Number(id);
  if (!Number.isSafeInteger(numero) || numero < 1 || String(numero) !== id) throw new Error('ID numérico do CRM inválido.');
  const token = await credencial(q,'CRM_VENDAX_TOKEN');
  const quem = await mcpCrm(token,'whoami',{});
  if (quem.auth_mode !== 'personal_token' || quem.read_only !== true) throw new Error('O CRM exige token exclusivamente de leitura.');
  if (tipo === 'customer_id') {
    const resposta = await mcpCrm(token,'clients_get',{ client_id: numero });
    const c = objeto(resposta.client ?? resposta);
    identidade(c.id,id);
    return { id, status: c.status ?? null };
  }
  const espaco = lista(quem.spaces).find(s => str(s.id) === id);
  if (!espaco) throw new Error('O CRM não confirmou acesso a este espaço.');
  if (verificar) return { id };
  const res = await mcpCrm(token,'leads_list',{ space_id: numero, limit: 35, offset: 0 });
  const leads = res.leads ?? res.items ?? res.data;
  if (str(res.space_id) !== id || !Array.isArray(leads) || lista(leads).some(l => l.space_id != null && str(l.space_id) !== id))
    throw new Error('O CRM não confirmou a leitura restrita ao espaço.');
  return { id, recorte: 'Até 35 leads no espaço dedicado. Datas ausentes não comprovam inatividade.',
    leads: lista(leads).map(l => ({
      id: l.id, nome: l.name ?? l.nome, status: l.status, temperatura: l.temperature,
      ultima_interacao: l.last_contact_at ?? l.last_interaction_at, proxima_acao: l.next_action,
      descadastrado: l.opted_out ?? l.unsubscribed ?? l.do_not_contact,
    })) };
}

const metricasReportei = [
  'impressions', 'clicks', 'spend', 'cost', 'conversions', 'leads', 'purchases', 'reach',
  'sessions', 'active_users', 'users', 'key_events', 'engagement', 'followers',
];

async function lerMetricasReportei(api: (rota: string, parametros?: Record<string, string>) => URL,
  headers: Record<string, string>, projeto: string, periodo: Periodo) {
  const integracoes: Objeto[] = [];
  for (let page = 1; ; page++) {
    const retorno = objeto(await lerApi(api('/v2/integrations', { project_id: projeto, per_page: '100', page: String(page) }), headers));
    const linhas = lista(retorno.data);
    if (!Array.isArray(retorno.data) || linhas.some(i => str(i.project_id) !== projeto))
      throw new Error('O Reportei não confirmou as integrações do projeto.');
    integracoes.push(...linhas.filter(i => i.status === 'active'));
    if (page >= (Number(objeto(retorno.meta).last_page) || 1)) break;
  }
  const catalogos = new Map<string, Promise<Objeto[]>>();
  const lacunas: string[] = [];
  const resultados = [];
  for (const integracao of integracoes) {
    const id = Number(integracao.id), slug = str(integracao.slug);
    if (!Number.isSafeInteger(id) || id < 1 || !/^[a-z0-9_]{1,80}$/.test(slug)) {
      lacunas.push('O Reportei retornou uma integração ativa sem identificador válido.');
      continue;
    }
    try {
      if (!catalogos.has(slug)) {
        catalogos.set(slug, lerApi(api('/v2/metrics', { integration_slug: slug, per_page: '100' }), headers)
          .then(res => lista(objeto(res).data)));
      }
      const catalogo = (await catalogos.get(slug)!).filter(m => typeof m.id === 'string' && typeof m.reference_key === 'string'
        && m.component === 'number_v1' && Array.isArray(m.metrics) && m.metrics.length > 0);
      const prioridade = (m: Objeto) => {
        const ordem = metricasReportei.indexOf(str(m.reference_key).split(':').at(-1) ?? '');
        return ordem === -1 ? metricasReportei.length : ordem;
      };
      const definicoes = [...new Map(catalogo.map(m => [m.reference_key, m])).values()]
        .sort((a, b) => prioridade(a) - prioridade(b))
        .slice(0, 20);
      if (!definicoes.length) {
        lacunas.push(`${slug} · ${id}: sem indicadores numéricos no catálogo.`);
        continue;
      }
      // O Reportei usa POST para a consulta de métricas sem criar relatórios nem gravar dados.
      const retorno = objeto(await lerApi(api('/v2/metrics/get-data'), { ...headers, 'Content-Type': 'application/json' }, {
        integration_id: id, start: periodo.inicio, end: periodo.fim,
        metrics: definicoes.map(({ id, reference_key, component, metrics, type }) => ({ id, reference_key, component, metrics, type })),
      }));
      const dados = objeto(retorno.data);
      const metricas = definicoes.map(m => ({ indicador: str(m.reference_key), valor: numeroDaMetrica(objeto(dados[str(m.id)]).values) }));
      if (!metricas.some(m => m.valor !== null)) {
        lacunas.push(`${slug} · ${id}: sem valores numéricos retornados para o período.`);
        continue;
      }
      resultados.push({ integracao_id: id, integracao: slug, nome: str(integracao.name), metricas });
    } catch (erro) {
      lacunas.push(`${slug} · ${id}: ${falhaDaLeitura(erro)}`);
    }
  }
  if (!integracoes.length) lacunas.push('Nenhuma integração ativa no projeto.');
  return { integracoes: resultados, lacunas };
}

async function lerReportei(q: Q, id: string, verificar: boolean, periodo?: Periodo) {
  const headers = bearer(await credencial(q,'REPORTEI_TOKEN'));
  const base = new URL(valor('REPORTEI_BASE_URL') || 'https://app.reportei.com/api');
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash
    || !['app.reportei.com','connect.reportei.com'].includes(base.hostname)) throw new Error('URL do Reportei inválida.');
  const caminho = base.pathname.replace(/\/+$/,'');
  const connect = base.hostname === 'connect.reportei.com';
  const api = (rota: string, parametros?: Record<string, string>) => {
    const url = new URL(base.origin);
    url.pathname = caminho + rota;
    if (parametros) url.search = new URLSearchParams(parametros).toString();
    return url;
  };
  const dados = objeto(await lerApi(api(`${connect ? '/customers/' : '/v2/projects/'}${encodeURIComponent(id)}`), headers));
  const c = objeto(connect ? dados.customer : dados.project);
  identidade(connect ? c.uuid : c.id,id);
  if (verificar) return { id, nome: c.name };
  if (connect) return { id, nome: c.name, disponivel: false, lacunas: ['Métricas do Reportei Connect exigem credencial própria do cliente.'] };
  if (periodo) {
    const metricas = await lerMetricasReportei(api, headers, id, periodo);
    return { id, nome: c.name, ...metricas, disponivel: metricas.integracoes.length > 0 };
  }
  const retorno = objeto(await lerApi(api('/v2/reports', { project_id: id, per_page: '15' }), headers));
  const linhas = lista(retorno.data);
  if (!Array.isArray(retorno.data) || linhas.some(x => str(x.project_id ?? x.client_id) !== id))
    throw new Error('O Reportei não identificou o projeto dos relatórios retornados.');
  return { id, nome: c.name, relatorios: linhas.map(x => ({ id: x.id, nome: x.name ?? x.title, periodo: x.period, atualizado_em: x.updated_at })) };
}

async function lerCalendar(q: Q, id: string, verificar: boolean) {
  const t = await tokenGoogle({config: valor, segredo: nome => lerSegredo(q,nome)},'google-workspace');
  if ('status' in t || !t.escopos.includes('https://www.googleapis.com/auth/calendar.readonly'))
    throw new Error('Acesso de leitura do Google Calendar indisponível.');
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}`);
  const cal = objeto(await lerApi(url,bearer(t.access)));
  identidade(cal.id,id);
  if (verificar) return { id };
  const eventos = new URL(url.href + '/events');
  eventos.search = new URLSearchParams({ maxResults: '20', timeMin: new Date().toISOString(), singleEvents: 'true', orderBy: 'startTime', fields: 'items(start,end,status),nextPageToken' }).toString();
  const dados = objeto(await lerApi(eventos,bearer(t.access)));
  return { id, agenda: lista(dados.items) };
}

async function lerContaNextTags(q: Q, id: string) {
  const base = new URL(valor('NEXTTAGS_BASE_URL') || 'https://app.nextagsai.com.br');
  if (base.protocol !== 'https:' || !['app.nextagsai.com.br','app.nextags.com.br'].includes(base.hostname)) throw new Error('URL do NextTags inválida.');
  const dados = objeto(await lerApi(new URL('/api/accounts/me',base),{'X-ACCESS-TOKEN': await credencial(q,'NEXTTAGS_TOKEN')}));
  identidade(dados.page_id,id);
  return { id, nome: dados.name, status: dados.status ?? null,
    limite: 'A consulta de identidade do NextTags não confirma entrega de mensagens ou qualidade do número.' };
}

// A rota do provedor deve devolver o recurso exato e somente os dados de leitura do recurso.
async function lerRecursoWhatsapp(q: Q, r: Recurso) {
  const prefixo = r.integracao === 'nexttags' ? 'NEXTTAGS' : 'VENDAX_APP';
  const configurada = valor(`${prefixo}_READER_URL`) ||
    (r.integracao === 'vendax-app' ? 'https://vendaxapp.tech/api/v1/escritorio/recurso' : null);
  if (!configurada) throw new Error(`${FONTES_CLIENTE[r.integracao].nome} não tem uma rota de leitura por recurso configurada.`);
  const url = new URL(configurada);
  const permitidos = r.integracao === 'nexttags' ? ['app.nextagsai.com.br','app.nextags.com.br'] : ['vendaxapp.tech'];
  if (url.protocol !== 'https:' || !permitidos.includes(url.hostname) || url.username || url.password || url.search || url.hash)
    throw new Error('URL de leitura por recurso inválida.');
  url.search = new URLSearchParams({ tipo: r.tipo, identificador: r.identificador }).toString();
  const d = objeto(await lerApi(url,bearer(await credencial(q,`${prefixo}_READER_TOKEN`))));
  identidade(d.identificador,r.identificador);
  if (d.tipo !== r.tipo) throw new Error('O provedor não confirmou o tipo de recurso.');
  const dados = objeto(d.dados);
  return { identificador: r.identificador, status: dados.status, qualidade: dados.qualidade, etapas: dados.etapas,
    situacao: dados.situacao, disponivel: dados.disponivel, incidentes: lista(dados.incidentes).slice(0,20).map(i => ({ tipo: i.tipo, data: i.data, status: i.status })) };
}

async function lerRecurso(q: Q, conta: ContaCliente, periodo?: Periodo, verificar = false) {
  switch (conta.integracao) {
    case 'google-ads':
    case 'meta-ads': return lerContaAds(q,conta,periodo);
    case 'crm': return lerCrm(q,conta.tipo,conta.identificador,verificar);
    case 'reportei': return lerReportei(q,conta.identificador,verificar,periodo);
    case 'google-workspace': return lerCalendar(q,conta.identificador,verificar);
    case 'nexttags':
      if (conta.tipo === 'conta_nexttags') return lerContaNextTags(q,conta.identificador);
      return lerRecursoWhatsapp(q,conta);
    case 'vendax-app': return lerRecursoWhatsapp(q,conta);
  }
}

export async function confirmarIdentidadeConta(q: Q, conta: ContaCliente) {
  await lerRecurso(q,conta,undefined,true);
}

export async function planoFontes(q: Q, u: Usuario, cliente: string | null, area: string | null, fontes: FonteCliente[], papel: string, pedido?: string) {
  if (!podeVer(u,cliente,area)) throw new SemAcesso();
  const contas = cliente ? (await contasDoCliente(q,u,cliente)).filter(c => c.verificado_em && c.verificado_por) : [];
  const candidato = !cliente && area === 'comercial' && fontes.includes('crm') ? valor('CRM_VENDAX_ESPACO_COMERCIAL_ID') : null;
  const espacoComercial = candidato && !(await q.query(
    "select 1 from contas_cliente where integracao='crm' and tipo='espaco_crm' and identificador=$1",[candidato])).length ? candidato : null;
  return fontes.map(fonte => {
    const ads = fonte === 'meta-ads' || fonte === 'google-ads';
    const ids = pedido && ads ? [...pedido.matchAll(/(?:^|[^\w])(?:act_)?(\d{3}-\d{3}-\d{4}|\d{10,24})(?!\d)/gi)]
      .map(x => x[1].replaceAll('-','')).filter(id => fonte === 'meta-ads' || id.length === 10) : [];
    return {
      fonte,
      contas: contas.filter(c => c.integracao === fonte && (!ids.length || ids.includes(c.identificador)) &&
        (fonte !== 'crm' || !['sdr_followup','crm_conversao'].includes(papel) || c.tipo === 'espaco_crm')),
      interno: !cliente && area === 'comercial' && fonte === 'crm' && espacoComercial ? espacoComercial : null,
    };
  });
}

export async function confirmarFontesInternas(q: Q, plano: Awaited<ReturnType<typeof planoFontes>>) {
  for (const p of plano) {
    if (p.interno) await lerCrm(q,'espaco_crm',p.interno,true);
  }
}

export function pendenciasFontes(plano: Awaited<ReturnType<typeof planoFontes>>, cliente: string | null) {
  return plano.filter(p => !p.contas.length && !p.interno).map(p => ({
    fonte: FONTES_CLIENTE[p.fonte].nome,
    texto: cliente ? lacunaConta(p.fonte) : `Conta de ${FONTES_CLIENTE[p.fonte].nome} não configurada para a operação interna - quem resolve: direção`,
    disponivel: false as const, resolve: 'direção',
  }));
}

function falhaDaLeitura(erro: unknown) {
  const texto = erro instanceof Error ? erro.message : '';
  return /^(?:HTTP \d{3}(?: [A-Z_]{3,40})?|[^\n]{1,180}(?:indisponível|configurada|inválida)\.)$/.test(texto) ? texto : 'Leitura não confirmada pela integração.';
}

export async function consultarFontes(q: Q, plano: Awaited<ReturnType<typeof planoFontes>>, periodo?: Periodo,
  comparacao?: Periodo): Promise<EntradaAgente['conteudo_recuperado']> {
  return (await Promise.all(plano.map(async p => {
    const nome = FONTES_CLIENTE[p.fonte].nome;
    if (p.interno) {
      try {
        const dados = await lerCrm(q,'espaco_crm',p.interno,false);
        return [{ fonte: `${nome} · ${p.interno}`, identificador: p.interno, texto: JSON.stringify(dados).slice(0,20_000) }];
      } catch (e) {
        return [{ fonte: nome, texto: falhaDaLeitura(e), disponivel: false, resolve: 'direção' }];
      }
    }
    return (await Promise.all(p.contas.slice(0,8).map(async c => {
      const fonte = `${nome} · ${c.identificador}`;
      if (periodo && comparacao && (c.integracao === 'meta-ads' || c.integracao === 'google-ads')) {
        const leituras = await lerComparativoAds(q,c,periodo,comparacao);
        const periodos = [{ tipo: 'principal', datas: periodo }, { tipo: 'de comparação', datas: comparacao }];
        return leituras.map((r,i) => {
          const { tipo, datas } = periodos[i];
          const nome = `${fonte} · Período ${tipo}`;
          return r.status === 'fulfilled'
            ? { fonte: nome, identificador: c.identificador, texto: JSON.stringify({ conta: c.identificador, periodo: datas,
              consultado_em: new Date().toISOString(), dados: r.value }) }
            : { fonte: nome, identificador: c.identificador, texto: `${datas.inicio} a ${datas.fim}: ${falhaDaLeitura(r.reason)}`,
              disponivel: false, resolve: 'direção' };
        });
      }
      try {
        const dados = await lerRecurso(q,c,periodo);
        const texto = JSON.stringify({ conta: c.identificador, periodo, consultado_em: new Date().toISOString(), dados });
        if (c.integracao === 'reportei' && dados && 'lacunas' in dados && Array.isArray(dados.lacunas)) {
          const pendencia = { fonte: dados.disponivel ? `${fonte} · Lacunas de leitura` : fonte, identificador: c.identificador,
            texto: `Projeto ${c.identificador}: ${dados.lacunas.join(' · ')}`, disponivel: false, resolve: 'direção' };
          if (!dados.disponivel) return [pendencia];
          if (dados.lacunas.length) return [{ fonte, identificador: c.identificador, texto }, pendencia];
        }
        return [{ fonte, identificador: c.identificador, texto: c.integracao === 'reportei' ? texto : texto.slice(0,28_000) }];
      } catch (e) {
        return [{ fonte, identificador: c.identificador, texto: falhaDaLeitura(e), disponivel: false, resolve: 'Lorran (integrações)' }];
      }
    }))).flat();
  }))).flat();
}
