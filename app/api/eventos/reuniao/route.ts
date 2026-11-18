import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { banco } from '@/lib/db';
import { carregarUsuario } from '@/lib/escopo';
import { processarFila, receberEventoReuniao } from '@/lib/orquestracao';

// Ponto de entrada para eventos de reunião (ex.: n8n + Google Workspace), desligado até a integração ser aprovada.
// Exige VX_EVENTOS_TOKEN no servidor e o cabeçalho Authorization: Bearer <token>.
const Evento = z.object({
  id: z.string().min(3).max(200), cliente_id: z.string(), titulo: z.string().min(3), dono_id: z.string(),
  transcricao: z.string().min(1).max(50_000), prazo: z.iso.datetime(), usuario_id: z.string(),
});

export async function POST(req: Request) {
  const token = process.env.VX_EVENTOS_TOKEN;
  if (!token) return Response.json({ erro: 'Integração pendente' }, { status: 503 });
  const enviado = Buffer.from((req.headers.get('authorization') ?? '').replace(/^Bearer /, ''));
  const esperado = Buffer.from(token);
  if (enviado.length !== esperado.length || !timingSafeEqual(enviado, esperado)) return Response.json({ erro: 'não autorizado' }, { status: 401 });
  const ev = Evento.safeParse(await req.json().catch(() => null));
  if (!ev.success) return Response.json({ erro: 'evento inválido', detalhes: z.treeifyError(ev.error) }, { status: 400 });
  const b = await banco();
  const u = await carregarUsuario(b, ev.data.usuario_id);
  if (!u) return Response.json({ erro: 'usuário desconhecido' }, { status: 400 });
  try {
    const r = await receberEventoReuniao(b, u, { ...ev.data, demo: false });
    await processarFila(b);
    return Response.json(r, { status: r.repetido ? 200 : 201 });
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : 'erro' }, { status: e instanceof Error && e.name === 'SemAcesso' ? 403 : 500 });
  }
}
