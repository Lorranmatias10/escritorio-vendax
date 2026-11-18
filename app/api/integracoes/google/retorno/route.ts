import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { contexto } from '@/lib/sessao';
import { lerSegredo, guardarSegredo } from '@/lib/cofre';
import { testarIntegracao } from '@/lib/integracoes';

// Retorno do OAuth: troca o código pelo refresh token, guarda cifrado no cofre e roda o teste de conexão.
export async function GET(req: Request) {
  const { b, u } = await contexto();
  const url = new URL(req.url);
  const volta = (q: string) => NextResponse.redirect(new URL(`/integracoes?${q}`, url.origin));
  const jar = await cookies();
  const [state, alvo] = (jar.get('vx_oauth_state')?.value ?? '').split(':');
  jar.delete('vx_oauth_state');
  if (u.perfil !== 'admin') return volta('erro=sem_permissao');
  if (!state || state !== url.searchParams.get('state') || (alvo !== 'google-workspace' && alvo !== 'google-ads')) return volta('erro=estado_invalido');
  if (url.searchParams.get('error')) return volta(`erro=autorizacao_negada&alvo=${alvo}`);
  const code = url.searchParams.get('code');
  const [id, secret] = await Promise.all([lerSegredo(b, 'GOOGLE_OAUTH_CLIENT_ID'), lerSegredo(b, 'GOOGLE_OAUTH_CLIENT_SECRET')]);
  if (!code || !id || !secret) return volta(`erro=oauth_nao_configurado&alvo=${alvo}`);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, grant_type: 'authorization_code',
      redirect_uri: `${process.env.VX_URL_BASE ?? url.origin}/api/integracoes/google/retorno` }),
  });
  const j = (await res.json().catch(() => ({}))) as { refresh_token?: string };
  if (!res.ok || !j.refresh_token) return volta(`erro=troca_falhou&alvo=${alvo}`);
  await guardarSegredo(b, `${alvo}:refresh_token`, j.refresh_token);
  await testarIntegracao(b, alvo, 'conexao', u.id);
  return volta(`ok=${alvo}`);
}
