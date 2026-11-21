import { NextResponse } from 'next/server';
import { banco } from '@/lib/db';
import { consumirLink, loginLigado, SESSAO_DIAS } from '@/lib/auth';
import { gravarCookieSessao } from '@/lib/sessao';

type ContextoAcesso = RouteContext<'/acesso/[token]'>;

const formatoToken = /^[A-Za-z0-9_-]{40,60}$/;
const privacidade = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

function redirecionar(req: Request, caminho: string) {
  const url = new URL(caminho, process.env.VX_URL_BASE || req.url);
  return NextResponse.redirect(url, { status: 303, headers: privacidade });
}

const confirmacao = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Primeiro acesso · Escritório Vendax</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.25rem; background: #f1f2f0; color: #182222; font-family: system-ui, sans-serif; }
    main { width: min(100%, 24rem); padding: 1.5rem; background: #fff; border: 1px solid #dce1dc; border-radius: .5rem; }
    h1 { margin: 0; font-size: 1.25rem; }
    p { margin: .75rem 0 1.25rem; }
    button { width: 100%; padding: .7rem; border: 0; border-radius: .35rem; background: #146341; color: white; font: inherit; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>Primeiro acesso ao Escritório</h1>
    <p>Continue para definir sua senha.</p>
    <form method="post"><button type="submit">Continuar</button></form>
  </main>
</body>
</html>`;

// Pré-visualizações podem abrir o endereço, mas só a confirmação consome o link.
export async function GET(req: Request, { params }: ContextoAcesso) {
  if (!loginLigado()) return redirecionar(req, '/hoje');
  const { token } = await params;
  if (!formatoToken.test(token)) return redirecionar(req, '/login?erro=link');

  return new Response(confirmacao, {
    headers: {
      ...privacidade,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function POST(req: Request, { params }: ContextoAcesso) {
  if (!loginLigado()) return redirecionar(req, '/hoje');
  const { token } = await params;
  const origemRequisicao = req.headers.get('sec-fetch-site');
  if (!formatoToken.test(token) || (origemRequisicao && origemRequisicao !== 'same-origin')) {
    return redirecionar(req, '/login?erro=link');
  }

  const sessao = await consumirLink(await banco(), token);
  if (!sessao) return redirecionar(req, '/login?erro=link');

  await gravarCookieSessao(sessao, SESSAO_DIAS);
  return redirecionar(req, '/definir-senha');
}
