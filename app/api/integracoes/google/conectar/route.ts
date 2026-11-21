import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { contexto } from '@/lib/sessao';
import { lerSegredo } from '@/lib/cofre';
import { ESCOPOS_GOOGLE } from '@/lib/integracoes';

// Inicia o OAuth do Google com os escopos mínimos do alvo. Só a direção conecta contas.
export async function GET(req: Request) {
  const { b, u } = await contexto();
  const url = new URL(req.url);
  const basePublica = process.env.VX_URL_BASE?.trim() || url.origin;
  const volta = (q: string) => NextResponse.redirect(new URL(`/integracoes?${q}`, basePublica));
  if (u.perfil !== 'admin') return volta('erro=sem_permissao');
  const alvo = url.searchParams.get('alvo');
  if (alvo !== 'google-workspace' && alvo !== 'google-ads') return volta('erro=alvo_invalido');
  const clientId = await lerSegredo(b, 'GOOGLE_OAUTH_CLIENT_ID');
  if (!clientId) return volta(`erro=oauth_nao_configurado&alvo=${alvo}`);
  if (!process.env.VX_COFRE_CHAVE) return volta('erro=cofre_sem_chave');
  const state = randomBytes(24).toString('hex');
  (await cookies()).set('vx_oauth_state', `${state}:${alvo}`, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({
    client_id: clientId, redirect_uri: new URL("/api/integracoes/google/retorno", basePublica).href,
    response_type: 'code', scope: ESCOPOS_GOOGLE[alvo].join(' '), access_type: 'offline', prompt: 'consent', state,
  }).toString();
  return NextResponse.redirect(auth);
}
