import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { banco, type Banco } from '@/lib/db';
import { testarIntegracao, testarTodas, ultimosTestes, historicoTestes } from '@/lib/integracoes';
import { cifrar, decifrar, guardarSegredo } from '@/lib/cofre';

let b: Banco;
const ENV = ['META_ACCESS_TOKEN', 'ASAAS_API_KEY', 'NEXTTAGS_TOKEN', 'NEXTTAGS_BASE_URL', 'NEXTTAGS_HEALTH_PATH',
  'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'REPORTEI_TOKEN', 'REPORTEI_BASE_URL', 'CRM_VENDAX_TOKEN', 'VENDAX_APP_TOKEN', 'VENDAX_APP_HEALTH_PATH'];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeAll(async () => {
  process.env.VX_COFRE_CHAVE = randomBytes(32).toString('base64');
  b = await banco();
});
afterEach(() => { vi.unstubAllGlobals(); for (const k of ENV) delete process.env[k]; });

describe('cofre', () => {
  it('cifra e decifra; o texto cifrado não contém o segredo', () => {
    const c = cifrar('segredo-super-123');
    expect(c.valor_cifrado).not.toContain('segredo');
    expect(decifrar(c)).toBe('segredo-super-123');
  });
});

describe('health checks', () => {
  it('sem credencial: "Não configurado" em todas, sem chamar rede, e registra histórico', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const rs = await testarTodas(b, 'manual', 'tiago');
    expect(rs).toHaveLength(9); // 8 integrações + provedor de IA
    expect(rs.every(r => r.status === 'nao_configurado')).toBe(true);
    expect(f).not.toHaveBeenCalled();
    expect((await ultimosTestes(b))).toHaveLength(9);
  });

  it('Meta sem ads_read: "Parcial" com ação; token nunca aparece no resultado', async () => {
    process.env.META_ACCESS_TOKEN = 'EAAtoken-secreto-999';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/me/permissions')) return json(200, { data: [{ permission: 'public_profile', status: 'granted' }] });
      if (url.includes('/me/adaccounts')) return json(200, { data: [] });
      return json(200, { id: '1', name: 'Escritorio Vendax (EAAtoken-secreto-999)' });
    }));
    const r = await testarIntegracao(b, 'meta-ads', 'manual', 'tiago');
    expect(r.status).toBe('parcial');
    expect(r.acao).toMatch(/ads_read/);
    expect(JSON.stringify(r)).not.toContain('EAAtoken-secreto-999');
    const [h] = await historicoTestes(b, 1);
    expect(JSON.stringify(h)).not.toContain('EAAtoken-secreto-999');
  });

  it('Meta com ads_management: conecta mas avisa que o escopo é maior que o necessário', async () => {
    process.env.META_ACCESS_TOKEN = 'tok-123456';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/me/permissions')) return json(200, { data: [{ permission: 'ads_read', status: 'granted' }, { permission: 'ads_management', status: 'granted' }] });
      if (url.includes('/me/adaccounts')) return json(200, { data: [{ name: 'Clínica X' }] });
      return json(200, { id: '1', name: 'Vendax Sistema' });
    }));
    const r = await testarIntegracao(b, 'meta-ads', 'manual', 'tiago');
    expect([r.status, r.conta]).toEqual(['conectado', 'Vendax Sistema']);
    expect(r.escopo).toMatch(/mais que o necessário/);
  });

  it('Asaas 401: "Erro" em linguagem simples; usa só GET com cabeçalho access_token', async () => {
    process.env.ASAAS_API_KEY = '$aact_chave_teste_123';
    const f = vi.fn(async () => json(401, { errors: [{ code: 'invalid_access_token' }] }));
    vi.stubGlobal('fetch', f);
    const r = await testarIntegracao(b, 'asaas', 'manual', 'tiago');
    expect(r.status).toBe('erro');
    expect(r.mensagem).toBe('Credencial inválida ou expirada.');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.asaas.com/v3/myAccount/status');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).access_token).toBe('$aact_chave_teste_123');
  });

  it.each([true, false])('CRM valida a identidade e o escopo de leitura (%s)', async readOnly => {
    process.env.CRM_VENDAX_TOKEN = 'tok-crm';
    vi.stubGlobal('fetch', vi.fn(async (url: string, request?: RequestInit) => {
      expect(url).toBe('https://uktnpcuobzpokgmdiplw.supabase.co/functions/v1/mcp-server');
      expect(request?.method).toBe('POST');
      expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer tok-crm');
      expect(JSON.parse(String(request?.body)).params).toEqual({ name: 'whoami', arguments: {} });
      return json(200, { jsonrpc: '2.0', id: 1, result: { structuredContent: {
        auth_mode: 'personal_token', read_only: readOnly, spaces: [{ id: 1 }], display_name: 'Usuário de teste',
      } } });
    }));
    const r = await testarIntegracao(b, 'crm', 'manual', 'tiago');
    expect(r.status).toBe(readOnly ? 'conectado' : 'parcial');
    expect(JSON.stringify(r)).not.toContain('Usuário de teste');
  });

  it('Vendax App consulta um contato e descarta seus dados', async () => {
    process.env.VENDAX_APP_TOKEN = 'tok-vendax-app';
    vi.stubGlobal('fetch', vi.fn(async (url: string, request?: RequestInit) => {
      expect(url).toBe('https://vendaxapp.tech/api/v1/contacts?limit=1');
      expect(request?.method).toBe('GET');
      expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer tok-vendax-app');
      return json(200, { contacts: [{ name: 'Contato de teste' }] });
    }));
    const r = await testarIntegracao(b, 'vendax-app', 'manual', 'tiago');
    expect(r.status).toBe('conectado');
    expect(JSON.stringify(r)).not.toContain('Contato de teste');
  });

  it.each([true, false])('Vendax App só conecta quando a rota dedicada confirma disponibilidade (%s)', async ok => {
    process.env.VENDAX_APP_TOKEN = 'tok-vendax-status';
    process.env.VENDAX_APP_HEALTH_PATH = '/api/v1/escritorio/status';
    vi.stubGlobal('fetch', vi.fn(async (url: string, request?: RequestInit) => {
      expect(url).toBe('https://vendaxapp.tech/api/v1/escritorio/status');
      expect(request?.method).toBe('GET');
      expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer tok-vendax-status');
      return json(200, { ok });
    }));
    const r = await testarIntegracao(b, 'vendax-app', 'manual', 'tiago');
    expect(r.status).toBe(ok ? 'conectado' : 'erro');
    if (ok) expect(r.escopo).toBe('consulta de disponibilidade do serviço');
  });

  it('NextTags consulta a conta com o cabeçalho oficial', async () => {
    process.env.NEXTTAGS_TOKEN = 'tok-nexttags';
    const fetchAccount = vi.fn(async (url: string, request?: RequestInit) => {
      expect(url).toBe('https://app.nextagsai.com.br/api/accounts/me');
      expect(request?.method).toBe('GET');
      expect(new Headers(request?.headers).get('X-ACCESS-TOKEN')).toBe('tok-nexttags');
      return json(200, { page_id: 1, name: 'Conta de teste' });
    });
    vi.stubGlobal('fetch', fetchAccount);
    const r = await testarIntegracao(b, 'nexttags', 'manual', 'tiago');
    expect([r.status, r.conta]).toEqual(['conectado', 'Conta de teste']);
  });

  it.each([
    { base: undefined, endpoint: 'https://app.reportei.com/api/v2/companies/settings', data: { company: { name: 'Vendax' } } },
    { base: 'https://connect.reportei.com/api/', endpoint: 'https://connect.reportei.com/api/merchants/settings', data: { merchant: { name: 'Vendax' } } },
  ])('Reportei testa a API correspondente a $endpoint', async ({ base, endpoint, data }) => {
    process.env.REPORTEI_TOKEN = 'tok-reportei';
    if (base) process.env.REPORTEI_BASE_URL = base;
    vi.stubGlobal('fetch', vi.fn(async (url: string, request?: RequestInit) => {
      expect(url).toBe(endpoint);
      expect(request?.method).toBe('GET');
      expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer tok-reportei');
      return json(200, data);
    }));
    const r = await testarIntegracao(b, 'reportei', 'manual', 'tiago');
    expect([r.status, r.conta]).toEqual(['conectado', 'Vendax']);
  });

  it('sem rede: "Não testado" com o motivo', async () => {
    process.env.ASAAS_API_KEY = 'asaas-chave-teste';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const r = await testarIntegracao(b, 'asaas', 'manual', 'tiago');
    expect(r.status).toBe('nao_testado');
    expect(r.mensagem).toMatch(/não conseguiu alcançar/);
  });

  it('Google com refresh token revogado: "Erro" pedindo para reconectar; refresh token lido do cofre cifrado', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'cid'; process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'csecret';
    await guardarSegredo(b, 'google-workspace:refresh_token', 'refresh-abc');
    const f = vi.fn(async () => json(400, { error: 'invalid_grant' }));
    vi.stubGlobal('fetch', f);
    const r = await testarIntegracao(b, 'google-workspace', 'manual', 'tiago');
    expect(r.status).toBe('erro');
    expect(r.acao).toMatch(/Reconectar/);
    expect(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).toContain('refresh_token=refresh-abc');
  });

  it('Google Workspace sem drive.readonly concedido: "Parcial"', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'cid'; process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'csecret';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('oauth2.googleapis.com/token')) return json(200, { access_token: 'at', scope: 'openid email https://www.googleapis.com/auth/calendar.readonly' });
      if (url.includes('userinfo')) return json(200, { email: 'ops@vendax.example' });
      return json(200, { items: [] });
    }));
    const r = await testarIntegracao(b, 'google-workspace', 'manual', 'tiago');
    expect([r.status, r.conta]).toEqual(['parcial', 'ops@vendax.example']);
    expect(r.mensagem).toMatch(/drive.readonly/);
  });

  it.each([undefined, 'token-legado'])('Google Ads lista contas com token legado opcional (%s)', async token => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'cid';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'csecret';
    if (token) process.env.GOOGLE_ADS_DEVELOPER_TOKEN = token;
    await guardarSegredo(b, 'google-ads:refresh_token', 'refresh-ads');
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('oauth2.googleapis.com/token')) return json(200, { access_token: 'access-ads', scope: 'https://www.googleapis.com/auth/adwords' });
      if (url.includes('userinfo')) return json(200, { email: 'ops@vendax.example' });
      expect(init?.method).toBe('GET');
      expect(new Headers(init?.headers).get('developer-token')).toBe(token ?? null);
      return json(200, { resourceNames: ['customers/123'] });
    });
    vi.stubGlobal('fetch', f);

    const r = await testarIntegracao(b, 'google-ads', 'manual', 'tiago');

    expect(r.status).toBe('conectado');
  });
});
