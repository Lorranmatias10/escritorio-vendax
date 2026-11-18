import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { banco, type Banco } from '@/lib/db';
import { testarIntegracao, testarTodas, ultimosTestes, historicoTestes } from '@/lib/integracoes';
import { cifrar, decifrar, guardarSegredo } from '@/lib/cofre';

let b: Banco;
const ENV = ['META_ACCESS_TOKEN', 'ASAAS_API_KEY', 'NEXTTAGS_TOKEN', 'NEXTTAGS_BASE_URL', 'NEXTTAGS_HEALTH_PATH', 'N8N_API_KEY', 'N8N_BASE_URL',
  'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'REPORTEI_TOKEN'];
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
    expect(rs).toHaveLength(11); // 10 integrações + provedor de IA
    expect(rs.every(r => r.status === 'nao_configurado')).toBe(true);
    expect(f).not.toHaveBeenCalled();
    expect((await ultimosTestes(b))).toHaveLength(11);
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

  it('API sem endpoint documentado (NextTags): token sem URL = "Não testado", nunca "Conectado"', async () => {
    process.env.NEXTTAGS_TOKEN = 'tok-nexttags';
    vi.stubGlobal('fetch', vi.fn());
    const r = await testarIntegracao(b, 'nexttags', 'manual', 'tiago');
    expect(r.status).toBe('nao_testado');
  });

  it('sem rede: "Não testado" com o motivo', async () => {
    process.env.N8N_API_KEY = 'n8n-key'; process.env.N8N_BASE_URL = 'https://n8n.exemplo.com';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const r = await testarIntegracao(b, 'n8n', 'manual', 'tiago');
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
});
