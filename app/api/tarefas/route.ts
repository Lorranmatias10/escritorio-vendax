import { contexto } from '@/lib/sessao';
import { listarTarefas } from '@/lib/dados';
import { ESTADOS_TAREFA, type EstadoTarefa } from '@/lib/catalogo';

// API interna tipada: tarefas visíveis para o usuário da sessão (mesmo escopo das telas).
export async function GET(req: Request) {
  const { b, u } = await contexto();
  const estado = new URL(req.url).searchParams.get('estado') ?? undefined;
  if (estado && !ESTADOS_TAREFA.includes(estado as EstadoTarefa)) return Response.json({ erro: 'estado inválido' }, { status: 400 });
  return Response.json({ usuario: u.id, tarefas: await listarTarefas(b, u, { estado }) });
}
