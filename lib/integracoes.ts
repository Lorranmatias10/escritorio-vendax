// Health checks reais das 10 integrações. Todos são chamadas SOMENTE LEITURA (GET, ou a troca de refresh token do OAuth).
// O resultado nunca carrega segredo: só status, conta, escopo e mensagem. O status nunca é fixo nem manual.
import type { Banco, Q } from './db';
import { lerSegredo } from './cofre';
import { INTEGRACOES, PAPEIS_PILOTO, type IntegracaoId } from './catalogo';

export type Status = 'conectado' | 'parcial' | 'erro' | 'nao_configurado' | 'nao_testado';
export type Resultado = {
  status: Status; conta: string | null; escopo: string | null; mensagem: string; acao: string | null;
  detalhes: Record<string, string | number | boolean | string[]>;
};
type Ctx = { segredo(nome: string): Promise<string | null>; config(nome: string): string | null };
export type Credencial = { nome: string; segredo: boolean; obrigatoria: boolean; descricao: string };
type Def = {
  id: IntegracaoId | 'openai'; metodo: string; credenciais: Credencial[];
  conexao: { tipo: 'oauth'; alvo: 'google-workspace' | 'google-ads' } | { tipo: 'manual' };
  passos: string[];
  testar(ctx: Ctx): Promise<Resultado>;
};

export const ROTULO_STATUS: Record<Status, string> = {
  conectado: 'Conectado', parcial: 'Parcial', erro: 'Erro', nao_configurado: 'Não configurado', nao_testado: 'Não testado',
};

const TIMEOUT_MS = 10_000;
const UA = 'EscritorioVendax/1.0 (health-check somente leitura)';
const r = (status: Status, mensagem: string, extra: Partial<Resultado> = {}): Resultado =>
  ({ status, mensagem, conta: null, escopo: null, acao: null, detalhes: {}, ...extra });

class FalhaRede extends Error {}
async function get(url: string, headers: Record<string, string>, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return { status: 0, timeout: true, json: null as unknown };
    throw new FalhaRede(e instanceof Error ? e.message : String(e));
  }
  let json: unknown = null;
  try { json = await res.json(); } catch { /* corpo não JSON */ }
  return { status: res.status, timeout: false, json };
}

// Tradução de falhas HTTP para linguagem simples.
function falhaHttp(nome: string, status: number, timeout: boolean, oQueFazer: string): Resultado {
  if (timeout) return r('erro', `${nome} não respondeu em ${TIMEOUT_MS / 1000} s (API fora do ar ou lenta).`, { acao: 'Tente "Testar conexão" de novo em alguns minutos.' });
  if (status === 401) return r('erro', 'Credencial inválida ou expirada.', { acao: oQueFazer });
  if (status === 403) return r('erro', 'A credencial existe, mas não tem permissão para esta leitura.', { acao: `Libere a permissão de leitura no painel do ${nome}. ${oQueFazer}` });
  if (status === 404) return r('erro', 'O endereço de verificação não foi encontrado.', { acao: 'Confirme a URL base configurada.' });
  if (status === 429) return r('erro', 'Limite de requisições atingido.', { acao: 'Aguarde alguns minutos; o teste automático roda a cada 30 min.' });
  if (status >= 500) return r('erro', `${nome} está com instabilidade (HTTP ${status}).`, { acao: 'Tente de novo mais tarde.' });
  return r('erro', `Resposta inesperada do ${nome} (HTTP ${status}).`, { acao: oQueFazer });
}

// ---------- Google (OAuth 2.0) ----------
export const ESCOPOS_GOOGLE = {
  'google-workspace': ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
  'google-ads': ['openid', 'email', 'https://www.googleapis.com/auth/adwords'],
} as const;

async function tokenGoogle(ctx: Ctx, alvo: keyof typeof ESCOPOS_GOOGLE): Promise<{ access: string; escopos: string[] } | Resultado> {
  const [id, secret, refresh] = await Promise.all([ctx.segredo('GOOGLE_OAUTH_CLIENT_ID'), ctx.segredo('GOOGLE_OAUTH_CLIENT_SECRET'), ctx.segredo(`${alvo}:refresh_token`)]);
  if (!id || !secret) return r('nao_configurado', 'O app OAuth do Google ainda não foi criado no Google Cloud.', { acao: 'Crie o cliente OAuth e cole as credenciais no servidor (ver passo a passo).' });
  if (!refresh) return r('nao_configurado', 'Nenhuma conta Google conectada.', { acao: 'Clique em "Conectar" e entre com a conta da Vendax.' });
  let res: Response;
  try {
    res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) { throw new FalhaRede(e instanceof Error ? e.message : String(e)); }
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; scope?: string; error?: string };
  if (!res.ok || !j.access_token) {
    if (j.error === 'invalid_grant') return r('erro', 'Token expirado ou acesso revogado na conta Google.', { acao: 'Clique em "Reconectar".' });
    if (j.error === 'invalid_client') return r('erro', 'Credenciais do app OAuth do Google inválidas.', { acao: 'Confira o Client ID e o Client Secret no servidor.' });
    return r('erro', `O Google recusou a renovação do acesso (${j.error ?? `HTTP ${res.status}`}).`, { acao: 'Clique em "Reconectar".' });
  }
  return { access: j.access_token, escopos: (j.scope ?? '').split(' ').filter(Boolean) };
}

async function emailGoogle(access: string) {
  const u = await get('https://openidconnect.googleapis.com/v1/userinfo', { Authorization: `Bearer ${access}` });
  return (u.json as { email?: string } | null)?.email ?? null;
}

const faltando = (pedidos: readonly string[], concedidos: string[]) =>
  pedidos.filter(s => !['openid', 'email'].includes(s) && !concedidos.includes(s)).map(s => s.replace('https://www.googleapis.com/auth/', ''));

// ---------- Integrações sem API pública documentada (CRM, Vendax App, NextTags, Nexbox) ----------
function generica(id: IntegracaoId, nome: string, prefixo: string, passos: string[]): Def {
  return {
    id, metodo: 'Token de API (formato a confirmar com o fornecedor)',
    credenciais: [
      { nome: `${prefixo}_TOKEN`, segredo: true, obrigatoria: true, descricao: 'Token de API somente leitura' },
      { nome: `${prefixo}_BASE_URL`, segredo: false, obrigatoria: true, descricao: 'URL base da API (ex.: https://api.exemplo.com)' },
      { nome: `${prefixo}_HEALTH_PATH`, segredo: false, obrigatoria: true, descricao: 'Caminho de uma leitura simples (ex.: /v1/me)' },
      { nome: `${prefixo}_AUTH_HEADER`, segredo: false, obrigatoria: false, descricao: 'Cabeçalho do token (padrão: Authorization: Bearer)' },
    ],
    conexao: { tipo: 'manual' }, passos,
    async testar(ctx) {
      const token = await ctx.segredo(`${prefixo}_TOKEN`);
      if (!token) return r('nao_configurado', `Nenhuma credencial do ${nome} cadastrada.`, { acao: 'Siga o passo a passo em "Conectar".' });
      const base = ctx.config(`${prefixo}_BASE_URL`), caminho = ctx.config(`${prefixo}_HEALTH_PATH`);
      if (!base || !caminho) return r('nao_testado', `Há token, mas a API do ${nome} não tem endpoint de verificação documentado publicamente.`, { acao: `Informe ${prefixo}_BASE_URL e ${prefixo}_HEALTH_PATH (uma leitura simples) no servidor.` });
      const cab = ctx.config(`${prefixo}_AUTH_HEADER`) ?? 'Authorization: Bearer';
      const [h, pre] = cab.includes(':') ? [cab.split(':')[0].trim(), cab.split(':').slice(1).join(':').trim()] : [cab, ''];
      const res = await get(new URL(caminho, base).toString(), { [h]: pre ? `${pre} ${token}` : token });
      if (res.status < 200 || res.status >= 300) return falhaHttp(nome, res.status, res.timeout, 'Gere um novo token e atualize no servidor.');
      const j = (res.json ?? {}) as Record<string, unknown>;
      const conta = ['name', 'nome', 'company', 'empresa', 'email'].map(k => j[k]).find(v => typeof v === 'string') as string | undefined;
      return r('conectado', 'Leitura de teste respondeu com sucesso.', {
        conta: conta ?? new URL(base).host, escopo: 'não verificável (a API não informa o escopo)', detalhes: { endpoint: caminho },
      });
    },
  };
}

// ---------- Definições ----------
export const DEFINICOES: Def[] = [
  generica('crm', 'CRM Vendax', 'CRM_VENDAX', [
    'Confirme qual sistema é o "CRM Vendax" (o próprio Vendax App ou outro).',
    'No painel desse sistema, gere um token de API com permissão SOMENTE LEITURA.',
    'Me informe a URL base da API e um caminho de leitura simples (ex.: /v1/me). Esses dois não são segredo.',
    'Cole o token em .env.local na variável CRM_VENDAX_TOKEN e reinicie o app.',
  ]),
  {
    id: 'google-workspace', metodo: 'OAuth 2.0 (Google), somente leitura',
    credenciais: [
      { nome: 'GOOGLE_OAUTH_CLIENT_ID', segredo: true, obrigatoria: true, descricao: 'Client ID do app OAuth' },
      { nome: 'GOOGLE_OAUTH_CLIENT_SECRET', segredo: true, obrigatoria: true, descricao: 'Client Secret do app OAuth' },
      { nome: 'google-workspace:refresh_token', segredo: true, obrigatoria: true, descricao: 'Obtido pelo botão "Conectar" (guardado cifrado)' },
    ],
    conexao: { tipo: 'oauth', alvo: 'google-workspace' },
    passos: [
      'Entre em console.cloud.google.com com a conta Google da Vendax e crie (ou escolha) um projeto "Escritorio Vendax".',
      'APIs e serviços → Biblioteca: ative "Google Calendar API" e "Google Drive API".',
      'APIs e serviços → Tela de consentimento OAuth: tipo "Interno" (se for Google Workspace) e adicione os escopos calendar.readonly e drive.readonly.',
      'APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth → "Aplicativo da Web". Em "URIs de redirecionamento autorizados" adicione: http://localhost:7777/api/integracoes/google/retorno',
      'Copie o Client ID e o Client Secret para .env.local (GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET) e reinicie o app.',
      'Volte nesta tela e clique em "Conectar": entre com a conta da Vendax e autorize só leitura.',
    ],
    async testar(ctx) {
      const t = await tokenGoogle(ctx, 'google-workspace');
      if ('status' in t) return t;
      const email = await emailGoogle(t.access);
      const cal = await get('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1&fields=items(id)', { Authorization: `Bearer ${t.access}` });
      const falta = faltando(ESCOPOS_GOOGLE['google-workspace'], t.escopos);
      if (cal.status !== 200 && !falta.includes('calendar.readonly')) return falhaHttp('Google Calendar', cal.status, cal.timeout, 'Clique em "Reconectar".');
      const base = { conta: email, escopo: 'leitura', detalhes: { escopos_concedidos: t.escopos.map(s => s.replace('https://www.googleapis.com/auth/', '')) } };
      if (falta.length) return r('parcial', `Conectado, mas faltam permissões: ${falta.join(', ')}.`, { ...base, acao: 'Clique em "Reconectar" e marque todas as permissões pedidas.' });
      return r('conectado', 'Agenda e Drive acessíveis em modo leitura.', base);
    },
  },
  {
    id: 'google-ads', metodo: 'OAuth 2.0 (Google) + developer token',
    credenciais: [
      { nome: 'GOOGLE_OAUTH_CLIENT_ID', segredo: true, obrigatoria: true, descricao: 'Mesmo app OAuth do Google Workspace' },
      { nome: 'GOOGLE_OAUTH_CLIENT_SECRET', segredo: true, obrigatoria: true, descricao: 'Mesmo app OAuth do Google Workspace' },
      { nome: 'GOOGLE_ADS_DEVELOPER_TOKEN', segredo: true, obrigatoria: true, descricao: 'Developer token da conta MCC' },
      { nome: 'google-ads:refresh_token', segredo: true, obrigatoria: true, descricao: 'Obtido pelo botão "Conectar" (guardado cifrado)' },
      { nome: 'GOOGLE_ADS_API_VERSION', segredo: false, obrigatoria: false, descricao: 'Versão da API (padrão v25)' },
    ],
    conexao: { tipo: 'oauth', alvo: 'google-ads' },
    passos: [
      'Faça antes o passo a passo do Google Workspace (o app OAuth é o mesmo). No Google Cloud, ative também a "Google Ads API".',
      'Entre em ads.google.com na conta de administrador (MCC) da Vendax → Admin (ícone de engrenagem) → Central de API: copie o developer token. Se ele estiver em "Acesso de teste", peça o "Acesso básico".',
      'Cole o developer token em .env.local (GOOGLE_ADS_DEVELOPER_TOKEN) e reinicie o app.',
      'Recomendado: conecte com um usuário que tenha acesso "Somente leitura" às contas no Google Ads (o escopo da API não tem versão somente leitura).',
      'Clique em "Conectar" nesta tela e autorize com esse usuário.',
    ],
    async testar(ctx) {
      const dev = await ctx.segredo('GOOGLE_ADS_DEVELOPER_TOKEN');
      const t = await tokenGoogle(ctx, 'google-ads');
      if ('status' in t) return t;
      if (!dev) return r('nao_configurado', 'Falta o developer token do Google Ads.', { acao: 'Siga o passo 2 em "Conectar".' });
      const v = ctx.config('GOOGLE_ADS_API_VERSION') ?? 'v25';
      const email = await emailGoogle(t.access);
      const res = await get(`https://googleads.googleapis.com/${v}/customers:listAccessibleCustomers`, { Authorization: `Bearer ${t.access}`, 'developer-token': dev });
      if (res.status !== 200) {
        const msg = JSON.stringify(res.json ?? '');
        if (/DEVELOPER_TOKEN_NOT_APPROVED/.test(msg)) return r('parcial', 'Conectado, mas o developer token só tem acesso de teste.', { conta: email, acao: 'Peça "Acesso básico" na Central de API do Google Ads.' });
        if (res.status === 404) return r('erro', `A versão ${v} da Google Ads API não existe mais.`, { conta: email, acao: 'Atualize GOOGLE_ADS_API_VERSION para a versão atual.' });
        return falhaHttp('Google Ads', res.status, res.timeout, 'Clique em "Reconectar".');
      }
      const contas = ((res.json as { resourceNames?: string[] })?.resourceNames ?? []).map(n => n.replace('customers/', ''));
      const base = { conta: email, escopo: 'leitura e escrita (o escopo adwords não tem versão somente leitura; o app só lê)', detalhes: { contas_acessiveis: contas.length, ids: contas.slice(0, 20) } };
      if (!contas.length) return r('parcial', 'Conectado, mas nenhuma conta de anúncios está acessível para este usuário.', { ...base, acao: 'Dê acesso às contas dos clientes para esse usuário no Google Ads.' });
      return r('conectado', `${contas.length} conta(s) de anúncios acessível(is).`, base);
    },
  },
  {
    id: 'meta-ads', metodo: 'Token de usuário do sistema (Meta Business), permissão ads_read',
    credenciais: [
      { nome: 'META_ACCESS_TOKEN', segredo: true, obrigatoria: true, descricao: 'Token do usuário do sistema' },
      { nome: 'META_GRAPH_VERSION', segredo: false, obrigatoria: false, descricao: 'Versão da Graph API (padrão v26.0)' },
    ],
    conexao: { tipo: 'manual' },
    passos: [
      'Entre em business.facebook.com com o administrador do Gerenciador de Negócios da Vendax.',
      'Configurações do negócio → Usuários → Usuários do sistema → Adicionar: nome "Escritorio Vendax", função "Funcionário".',
      'Em "Atribuir ativos", adicione as contas de anúncios dos clientes com a permissão "Visualizar desempenho" (somente leitura).',
      'Clique em "Gerar novo token", escolha um app do negócio e marque SOMENTE ads_read (e business_management só se for listar contas pelo negócio). Não marque ads_management.',
      'Cole o token em .env.local na variável META_ACCESS_TOKEN e reinicie o app.',
    ],
    async testar(ctx) {
      const tk = await ctx.segredo('META_ACCESS_TOKEN');
      if (!tk) return r('nao_configurado', 'Nenhum token da Meta cadastrado.', { acao: 'Siga o passo a passo em "Conectar".' });
      const v = ctx.config('META_GRAPH_VERSION') ?? 'v26.0';
      const h = { Authorization: `Bearer ${tk}` };
      const me = await get(`https://graph.facebook.com/${v}/me?fields=id,name`, h);
      if (me.status !== 200) {
        const code = (me.json as { error?: { code?: number } } | null)?.error?.code;
        if (code === 190) return r('erro', 'Token da Meta expirado ou inválido.', { acao: 'Gere um novo token do usuário do sistema e atualize META_ACCESS_TOKEN.' });
        return falhaHttp('Meta', me.status, me.timeout, 'Gere um novo token do usuário do sistema.');
      }
      const perms = ((await get(`https://graph.facebook.com/${v}/me/permissions`, h)).json as { data?: { permission: string; status: string }[] } | null)?.data ?? [];
      const concedidas = perms.filter(p => p.status === 'granted').map(p => p.permission);
      const contas = ((await get(`https://graph.facebook.com/${v}/me/adaccounts?fields=name&limit=100`, h)).json as { data?: { name: string }[] } | null)?.data ?? [];
      const escrita = concedidas.includes('ads_management');
      const base = {
        conta: (me.json as { name?: string }).name ?? null,
        escopo: escrita ? 'leitura e escrita (ads_management concedido: mais que o necessário)' : 'leitura',
        detalhes: { permissoes: concedidas, contas_de_anuncio: contas.length },
      };
      if (!concedidas.includes('ads_read') && !escrita) return r('parcial', 'Conectado, mas falta a permissão ads_read.', { ...base, acao: 'Gere o token de novo marcando ads_read.' });
      if (!contas.length) return r('parcial', 'Conectado, mas nenhuma conta de anúncios foi atribuída a este usuário.', { ...base, acao: 'Atribua as contas de anúncios ao usuário do sistema.' });
      return r('conectado', `${contas.length} conta(s) de anúncios acessível(is).`, base);
    },
  },
  {
    id: 'reportei', metodo: 'Token de API (Bearer) · Reportei Connect',
    credenciais: [
      { nome: 'REPORTEI_TOKEN', segredo: true, obrigatoria: true, descricao: 'Token de API do Reportei Connect' },
      { nome: 'REPORTEI_BASE_URL', segredo: false, obrigatoria: false, descricao: 'Padrão https://connect.reportei.com/api' },
    ],
    conexao: { tipo: 'manual' },
    passos: [
      'Entre no Reportei com o administrador da conta da Vendax → Configurações da empresa → API Reportei.',
      'Se a opção não existir no seu plano, a API (Reportei Connect) precisa ser liberada pelo suporte do Reportei: peça acesso de leitura.',
      'Gere o token e cole em .env.local na variável REPORTEI_TOKEN. Reinicie o app.',
    ],
    async testar(ctx) {
      const tk = await ctx.segredo('REPORTEI_TOKEN');
      if (!tk) return r('nao_configurado', 'Nenhum token do Reportei cadastrado.', { acao: 'Siga o passo a passo em "Conectar".' });
      const base = ctx.config('REPORTEI_BASE_URL') ?? 'https://connect.reportei.com/api';
      const res = await get(`${base}/merchants/settings`, { Authorization: `Bearer ${tk}` });
      if (res.status !== 200) return falhaHttp('Reportei', res.status, res.timeout, 'Gere um novo token em Configurações da empresa → API Reportei.');
      const m = (res.json as { merchant?: { name?: string; total_customers?: number; rate_limit_per_minute?: string } })?.merchant;
      return r('conectado', 'Configurações da conta lidas com sucesso.', {
        conta: m?.name ?? null, escopo: 'não verificável (o Reportei não informa o escopo do token)',
        detalhes: { clientes: m?.total_customers ?? 0, limite_por_minuto: m?.rate_limit_per_minute ?? 'não informado' },
      });
    },
  },
  generica('nexttags', 'NextTags', 'NEXTTAGS', [
    'A NextTags não publica documentação de API. Peça ao suporte (ou veja em Configurações → Integrações/API no painel) um token de API somente leitura.',
    'Peça também a URL base da API e um endpoint de leitura simples (ex.: dados da conta).',
    'Cole o token em .env.local (NEXTTAGS_TOKEN) e me passe a URL base e o caminho (não são segredo).',
  ]),
  generica('nexbox', 'Nexbox', 'NEXBOX', [
    'A Nexbox não publica documentação de API. Peça ao suporte um token de API somente leitura.',
    'Peça também a URL base da API e um endpoint de leitura simples.',
    'Cole o token em .env.local (NEXBOX_TOKEN) e me passe a URL base e o caminho.',
  ]),
  generica('vendax-app', 'Vendax App', 'VENDAX_APP', [
    'No backend do Vendax App, gere um token de serviço SOMENTE LEITURA para o Escritório (ou me diga onde ficam as chaves de API).',
    'Me informe a URL base da API e um endpoint de leitura simples (ex.: /health ou /me).',
    'Cole o token em .env.local (VENDAX_APP_TOKEN).',
  ]),
  {
    id: 'asaas', metodo: 'Chave de API (cabeçalho access_token)',
    credenciais: [
      { nome: 'ASAAS_API_KEY', segredo: true, obrigatoria: true, descricao: 'Chave de API de produção' },
      { nome: 'ASAAS_AMBIENTE', segredo: false, obrigatoria: false, descricao: '"producao" (padrão) ou "sandbox"' },
    ],
    conexao: { tipo: 'manual' },
    passos: [
      'Entre em asaas.com com a conta da Vendax (Tiago ou Fabiana) → menu do usuário → Integrações → Chaves de API.',
      'Gere uma chave nova só para o Escritório (nome "Escritorio Vendax - leitura"). O Asaas não tem chave somente leitura: o app só faz consultas (GET) e qualquer cobrança, estorno ou transferência continua exigindo a sua aprovação.',
      'Cole a chave em .env.local na variável ASAAS_API_KEY e reinicie o app.',
    ],
    async testar(ctx) {
      const tk = await ctx.segredo('ASAAS_API_KEY');
      if (!tk) return r('nao_configurado', 'Nenhuma chave do Asaas cadastrada.', { acao: 'Siga o passo a passo em "Conectar".' });
      const sandbox = ctx.config('ASAAS_AMBIENTE') === 'sandbox';
      const base = sandbox ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
      const st = await get(`${base}/myAccount/status`, { access_token: tk });
      if (st.status !== 200) return falhaHttp('Asaas', st.status, st.timeout, 'Gere uma nova chave em Integrações → Chaves de API e confira se é do ambiente certo.');
      const info = await get(`${base}/myAccount/commercialInfo/`, { access_token: tk });
      const nome = (info.json as { companyName?: string; name?: string } | null);
      return r('conectado', `Conta acessível (${sandbox ? 'sandbox' : 'produção'}).`, {
        conta: nome?.companyName ?? nome?.name ?? null,
        escopo: 'leitura e escrita (a chave do Asaas é de acesso total; o app só faz consultas)',
        detalhes: { ambiente: sandbox ? 'sandbox' : 'producao', status_cadastro: String((st.json as { general?: string } | null)?.general ?? 'não informado') },
      });
    },
  },
  {
    id: 'n8n', metodo: 'Chave de API (cabeçalho X-N8N-API-KEY)',
    credenciais: [
      { nome: 'N8N_API_KEY', segredo: true, obrigatoria: true, descricao: 'Chave da API pública do n8n' },
      { nome: 'N8N_BASE_URL', segredo: false, obrigatoria: true, descricao: 'Endereço do n8n (ex.: https://n8n.vendax.com.br)' },
    ],
    conexao: { tipo: 'manual' },
    passos: [
      'Entre no n8n da Vendax → Settings → n8n API → Create an API key ("Escritorio Vendax"). Se houver escopos, marque só leitura de workflows/executions.',
      'Cole a chave em .env.local (N8N_API_KEY) e o endereço do n8n em N8N_BASE_URL. Reinicie o app.',
    ],
    async testar(ctx) {
      const tk = await ctx.segredo('N8N_API_KEY');
      if (!tk) return r('nao_configurado', 'Nenhuma chave do n8n cadastrada.', { acao: 'Siga o passo a passo em "Conectar".' });
      const base = ctx.config('N8N_BASE_URL');
      if (!base) return r('nao_testado', 'Há chave, mas falta o endereço do n8n.', { acao: 'Defina N8N_BASE_URL no servidor.' });
      const res = await get(new URL('/api/v1/workflows?limit=1', base).toString(), { 'X-N8N-API-KEY': tk });
      if (res.status !== 200) return falhaHttp('n8n', res.status, res.timeout, 'Crie uma nova chave em Settings → n8n API.');
      return r('conectado', 'API do n8n respondeu.', { conta: new URL(base).host, escopo: 'conforme os escopos da chave (o n8n não informa na resposta)' });
    },
  },
];

// Provedor de IA dos agentes: fora da contagem das 10 integrações de dados, mas com o mesmo teste real.
export const PROVEDOR_IA = { id: 'openai' as const, nome: 'OpenAI · provedor de IA dos agentes', icone: 'AI', escopo: 'uso de modelo', papeis: [...PAPEIS_PILOTO] };
DEFINICOES.push({
  id: 'openai', metodo: 'Chave de API (Bearer), só no servidor',
  credenciais: [
    { nome: 'OPENAI_API_KEY', segredo: true, obrigatoria: true, descricao: 'Chave de API da OpenAI' },
    { nome: 'AI_PROVEDOR', segredo: false, obrigatoria: true, descricao: '"openai" para usar o modelo real; "simulado" para o simulador' },
    { nome: 'AI_MODELO', segredo: false, obrigatoria: false, descricao: 'Modelo (padrão gpt-5.4-mini)' },
  ],
  conexao: { tipo: 'manual' },
  passos: [
    'Em platform.openai.com → API keys, crie uma chave para o projeto do Escritório (permissão "Model capabilities").',
    'Cole em .env.local na variável OPENAI_API_KEY, defina AI_PROVEDOR=openai e AI_MODELO, e reinicie o app.',
    'Em platform.openai.com → Settings → Limits, defina um limite mensal de gasto.',
    'Depois de trocar de provedor ou de modelo, rode a homologação do piloto de novo (Agentes).',
  ],
  async testar(ctx) {
    const tk = await ctx.segredo('OPENAI_API_KEY');
    if (!tk) return r('nao_configurado', 'Nenhuma chave da OpenAI cadastrada.', { acao: 'Siga o passo a passo.' });
    const modelo = ctx.config('AI_MODELO') ?? 'gpt-5.4-mini';
    const ativo = ctx.config('AI_PROVEDOR') ?? 'simulado';
    const res = await get('https://api.openai.com/v1/models', { Authorization: `Bearer ${tk}` });
    if (res.status === 403) return r('parcial', 'A chave não pode listar modelos; o uso do modelo não foi confirmado.', { acao: 'Dê à chave a permissão de leitura de modelos.' });
    if (res.status !== 200) return falhaHttp('OpenAI', res.status, res.timeout, 'Gere uma nova chave em platform.openai.com → API keys.');
    const ids = ((res.json as { data?: { id: string }[] })?.data ?? []).map(m => m.id);
    const base = { escopo: 'uso de modelos (a API não informa o escopo da chave)', detalhes: { modelo, modelos_disponiveis: ids.length, provedor_ativo: ativo } };
    if (!ids.includes(modelo)) return r('parcial', `A chave funciona, mas o modelo ${modelo} não está disponível para ela.`, { ...base, acao: 'Ajuste AI_MODELO para um modelo da conta.' });
    if (ativo !== 'openai') return r('parcial', `Chave válida e modelo ${modelo} disponível, mas os agentes estão usando o simulador.`, { ...base, acao: 'Defina AI_PROVEDOR=openai no servidor.' });
    return r('conectado', `Chave válida; agentes usam ${modelo}.`, base);
  },
});

export const definicao = (id: string) => DEFINICOES.find(d => d.id === id);

// ---------- Execução e histórico ----------
// Remove qualquer segredo que a API tenha ecoado de volta antes de gravar ou exibir.
function semSegredos(res: Resultado, segredos: string[]): Resultado {
  let txt = JSON.stringify(res);
  for (const s of segredos) if (s.length >= 6) txt = txt.split(s).join('[oculto]');
  return JSON.parse(txt);
}

export async function testarIntegracao(b: Banco, id: string, origem: 'abertura' | 'manual' | 'agendado' | 'conexao', por: string | null) {
  const d = definicao(id);
  if (!d) throw new Error(`Integração desconhecida: ${id}`);
  const lidos: string[] = [];
  const ctx: Ctx = {
    async segredo(nome) { const v = await lerSegredo(b, nome); if (v) lidos.push(v); return v; },
    config: nome => process.env[nome]?.trim() || null,
  };
  const t0 = Date.now();
  let res: Resultado;
  try { res = await d.testar(ctx); }
  catch (e) {
    res = e instanceof FalhaRede
      ? r('nao_testado', 'O servidor do Escritório não conseguiu alcançar a API (sem internet, DNS ou firewall).', { acao: 'Verifique a conexão do servidor e teste de novo.', detalhes: { causa: e.message } })
      : r('nao_testado', 'O teste não pôde ser executado por um erro interno.', { acao: 'Tente de novo; se persistir, me avise.', detalhes: { causa: e instanceof Error ? e.message : String(e) } });
  }
  res = semSegredos(res, lidos);
  await b.query(
    `insert into integracoes_testes (integracao_id, status, conta, escopo, mensagem, acao, detalhes, origem, duracao_ms, testado_por) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, res.status, res.conta, res.escopo, res.mensagem, res.acao, res.detalhes, origem, Date.now() - t0, por]);
  return res;
}

export async function testarTodas(b: Banco, origem: 'abertura' | 'manual' | 'agendado', por: string | null) {
  return Promise.all([...INTEGRACOES.map(i => i.id), PROVEDOR_IA.id].map(id => testarIntegracao(b, id, origem, por)));
}

// "Ao abrir a tela": testa o que não foi testado nos últimos `ms` (protege o limite de requisições das APIs).
export async function testarDesatualizadas(b: Banco, ms: number, por: string | null) {
  const ult = new Map((await ultimosTestes(b)).map(t => [t.integracao_id, +new Date(t.testado_em)]));
  const agora = Date.now();
  await Promise.all([...INTEGRACOES.map(i => i.id), PROVEDOR_IA.id].filter(id => !ult.has(id) || agora - ult.get(id)! > ms).map(id => testarIntegracao(b, id, 'abertura', por)));
}

export type TesteGravado = Resultado & { id: number; integracao_id: string; origem: string; testado_em: string; duracao_ms: number | null };
export async function ultimosTestes(q: Q) {
  return q.query<TesteGravado>(`select distinct on (integracao_id) * from integracoes_testes order by integracao_id, testado_em desc, id desc`);
}
export async function historicoTestes(q: Q, limite = 100) {
  return q.query<TesteGravado>('select * from integracoes_testes order by testado_em desc, id desc limit $1', [limite]);
}

// Quais credenciais existem (só nomes e presença; nunca valores).
export async function presencaCredenciais(b: Banco) {
  const out: Record<string, Record<string, boolean>> = {};
  for (const d of DEFINICOES) {
    out[d.id] = {};
    for (const c of d.credenciais) out[d.id][c.nome] = c.segredo ? (await lerSegredo(b, c.nome)) !== null : !!process.env[c.nome]?.trim();
  }
  return out;
}
