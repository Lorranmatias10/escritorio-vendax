// Cenários de demonstração (dados sintéticos). Nenhum paciente ou contato real.
import type { Banco } from './db';
import { podeVer, SemAcesso, type Usuario } from './escopo';
import { enfileirar, processarFila, receberEventoReuniao, registrarEvento, type EventoReuniao } from './orquestracao';

export function reuniaoPiloto(): EventoReuniao {
  return {
    id: 'demo-reuniao-aurora-001',
    cliente_id: 'aurora',
    titulo: 'Reunião de alinhamento · Clínica Aurora',
    dono_id: 'fabiana',
    prazo: new Date(Date.now() + 86_400_000).toISOString(),
    demo: true,
    transcricao: [
      'Cliente (contato fictício): A landing page de implantes precisa estar no ar até sexta.',
      'Fabiana: Vamos ajustar a campanha de implantes depois da landing.',
      'Cliente (contato fictício): O relatório de outubro ficou pendente, conseguem enviar?',
      'Fabiana: O relatório de outubro será enviado amanhã, prazo confirmado.',
      'Cliente (contato fictício): Queremos publicar depoimentos de pacientes fictícios no Instagram.',
    ].join('\n'),
  };
}

// Fluxo completo: evento → Gerente de Contas → Auditor → Diretor → Hoje + aprovação.
export async function dispararFluxoPiloto(b: Banco, u: Usuario) {
  const r = await receberEventoReuniao(b, u, reuniaoPiloto());
  await processarFila(b);
  return r;
}

export async function tarefaDemo(b: Banco, u: Usuario, origem: string, cliente: string, objetivo: string, fonte: string) {
  if (!podeVer(u, cliente, null)) throw new SemAcesso('Sem acesso ao cliente deste cenário.');
  const [t] = await b.query<{ id: string; novo: boolean }>(
    `insert into tarefas (cliente_id, departamento_id, papel_atual_id, dono_humano_id, objetivo, fonte, origem_evento_id, prazo, estado, demo, criterio_conclusao)
     values ($1,'contas','gerente_contas',(select id from usuarios where id in ('fabiana','tiago') order by id limit 1),$2,$3,$4, now() + interval '1 day','na_fila',true,'Fonte conferida e resumo revisado')
     on conflict (origem_evento_id) do update set origem_recebimentos = tarefas.origem_recebimentos + 1 returning id, (xmax = 0) as novo`,
    [cliente, objetivo, fonte, origem]);
  if (t.novo) await registrarEvento(b, t.id, 'criada', 'Tarefa criada pelo cenário de demonstração.', u.nome);
  return t.id;
}

export async function simularFonteAusente(b: Banco, u: Usuario) {
  const id = await tarefaDemo(b, u, 'demo-fonte-ausente-sorriso', 'sorriso', 'Consolidar o resultado de outubro do Instituto Sorriso Pleno', 'Rotina mensal (Demonstração)');
  await enfileirar(b, id, 'gerente_contas', 'consultar_fonte', {
    papel_id: 'gerente_contas', etapa: 'consultar_fonte',
    instrucao_operacional: 'Consolide o resultado do mês a partir do relatório de performance.',
    conteudo_recuperado: [{ fonte: 'Relatório mensal (Reportei)', texto: '', disponivel: false, resolve: 'Lorran (integrações)' }],
    contexto: { dono_nome: 'Fabiana' },
  }, true);
  await processarFila(b);
  return id;
}

export async function simularFalha(b: Banco, u: Usuario) {
  const id = await tarefaDemo(b, u, 'demo-falha-aurora', 'aurora', 'Resumir as pendências da semana da Clínica Aurora', 'Pedido interno (Demonstração)');
  await enfileirar(b, id, 'gerente_contas', 'resumir', {
    papel_id: 'gerente_contas', etapa: 'resumir',
    instrucao_operacional: 'Resuma as pendências abertas da semana.',
    conteudo_recuperado: [{ fonte: 'Notas internas (Demonstração)', texto: 'Landing em produção. Relatório de outubro pendente.' }],
    contexto: { dono_nome: 'Fabiana', simular_falha: true },
  }, true);
  await processarFila(b);
  return id;
}

export const dadosReuniaoDemo = {
  fonteAusente: { fonte: 'Relatório de performance (Reportei)', texto: '', disponivel: false, resolve: 'Lorran (integrações)' },
  mensagem: 'Olá! Confirmando o combinado na reunião: a landing page de implantes fica pronta até sexta-feira. Podemos considerar esse prazo?',
  intencao: 'Enviar ao cliente a confirmação do prazo da landing page',
  destinatario: 'Contato fictício da Clínica Aurora',
  alvo: 'WhatsApp · contato fictício da Clínica Aurora',
  conta: 'WhatsApp oficial Vendax (Demonstração)',
};
