import { cookies } from 'next/headers';
import { usuarioDaSessao } from '@/lib/auth';
import { carregarUsuario, podeVer } from '@/lib/escopo';
import { clienteDiretor } from '@/lib/diretor';
import { conversaEspecialista } from '@/lib/chat-especialistas';
import { consultarEscritorio, destinoChat, listarMensagensChat } from '@/lib/escritorio-ao-vivo';
import { contextoOpcional, COOKIE_SESSAO } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await contextoOpcional();
  if (!ctx) return new Response(null, { status: 401 });
  const { b, u: usuario, modo } = ctx;
  const { searchParams } = new URL(req.url);
  const destino = destinoChat.safeParse(searchParams.get('destino'));
  const antes = searchParams.get('antes');
  const diretor = searchParams.has('diretor');
  const cliente = diretor ? clienteDiretor.safeParse(searchParams.get('cliente')) : undefined;
  if (diretor && (!cliente?.success || antes || searchParams.has('destino') || searchParams.has('especialista')))
    return new Response(null, { status: 400 });
  if (cliente?.success && !podeVer(usuario, cliente.data, 'direcao')) return new Response(null, { status: 403 });
  const canal = !diretor && (searchParams.has('especialista') || searchParams.has('cliente'))
    ? conversaEspecialista.safeParse({ fluxo: searchParams.get('especialista'), cliente: searchParams.get('cliente') }) : undefined;
  if (canal && (!canal.success || antes || searchParams.has('destino'))) return new Response(null, { status: 400 });
  if (canal?.success && !podeVer(usuario, canal.data.cliente, null)) return new Response(null, { status: 403 });
  if (!destino.success || destino.data === usuario.id || (antes && (!/^[1-9]\d{0,18}$/.test(antes) || BigInt(antes) > BigInt('9223372036854775807'))))
    return new Response(null, { status: 400 });
  const destinatario = destino.data;
  if (antes) return Response.json(await listarMensagensChat(b, usuario, destinatario, antes), { headers: { 'Cache-Control': 'private, no-store' } });

  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  const codificar = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ignorar = false;
  let aoInterromper: () => void;
  function parar() {
    ignorar = true;
    clearTimeout(timer);
    req.signal.removeEventListener('abort', aoInterromper);
  }

  const eventos = new ReadableStream<Uint8Array>({
    start(controller) {
      let anterior = '';
      let ultimoEnvio = 0;
      const fim = Date.now() + 50_000;
      aoInterromper = () => { parar(); controller.close(); };
      if (req.signal.aborted) { aoInterromper(); return; }
      req.signal.addEventListener('abort', aoInterromper, { once: true });
      controller.enqueue(codificar.encode('retry: 1500\n\n'));
      async function publicar() {
        if (ignorar || req.signal.aborted) return;
        try {
          const u = modo === 'login' ? await usuarioDaSessao(b, token, { registrarVisita: false }) : await carregarUsuario(b, usuario.id);
          if (ignorar) return;
          if (!u || Date.now() >= fim) {
            if (!u) controller.enqueue(codificar.encode('event: sessao\ndata: expirada\n\n'));
            parar();
            controller.close();
            return;
          }
          const atual = JSON.stringify(await consultarEscritorio(b, u, destinatario, canal?.data, cliente?.data));
          if (ignorar) return;
          if (atual !== anterior) {
            controller.enqueue(codificar.encode(`data: ${atual}\n\n`));
            anterior = atual;
            ultimoEnvio = Date.now();
          } else if (Date.now() - ultimoEnvio >= 12_000) {
            controller.enqueue(codificar.encode(': conexão ativa\n\n'));
            ultimoEnvio = Date.now();
          }
          timer = setTimeout(publicar, 1500);
        } catch {
          if (ignorar) return;
          parar();
          controller.close();
        }
      }
      void publicar();
    },
    cancel: parar,
  });

  return new Response(eventos, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'private, no-store, no-transform', 'X-Accel-Buffering': 'no' },
  });
}
