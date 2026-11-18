import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { acaoFluxoPiloto, acaoFonteAusente, acaoFalha, acaoResetar } from '@/app/acoes';
import { botao, botaoSec } from '@/components/ui';

export default async function Demonstracao() {
  const { b, u } = await contexto();
  const [piloto] = await b.query<{ id: string }>(`select id from tarefas where origem_evento_id = 'demo-reuniao-aurora-001'`);
  const [sorriso] = await b.query<{ id: string }>(`select id from tarefas where cliente_id = 'sorriso' order by criado_em limit 1`);
  const cenarios = [
    { t: '1. Briefing da carteira piloto', d: 'Um evento sintético de reunião da Clínica Aurora gera a tarefa. O Gerente de Contas organiza entregas e pendências, o Auditor aponta o prazo citado sem confirmação e o Diretor prioriza, define quem decide (Fabiana) e coloca o briefing em Hoje com uma aprovação A3.', a: acaoFluxoPiloto, b: piloto ? 'Repetir o evento da reunião' : 'Disparar o fluxo piloto' },
    { t: '2. Fonte ausente', d: 'O Gerente de Contas precisa do relatório do Reportei (integração pendente) para o Instituto Sorriso Pleno. A tarefa fica bloqueada com o motivo e o próximo passo.', a: acaoFonteAusente, b: 'Simular fonte ausente' },
    { t: '3. Falha e retomada', d: 'A primeira tentativa falha (provedor simulado). Na tarefa, use “Retomar execução”: a segunda tentativa conclui sem duplicar evidências.', a: acaoFalha, b: 'Simular falha' },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Demonstração</h1>
        <p className="text-sm text-vx-texto-2">Tudo aqui usa dados sintéticos e o adaptador de IA simulado local. Nenhuma ação externa roda. Você está vendo como <strong>{u.nome}</strong>.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cenarios.map(c => (
          <form key={c.t} action={c.a} className="flex flex-col rounded-xl border border-vx-linha bg-white p-4">
            <h2 className="font-semibold">{c.t}</h2>
            <p className="mt-1 flex-1 text-sm text-vx-texto-2">{c.d}</p>
            <button className={`${botao} mt-3`}>{c.b}</button>
          </form>
        ))}
      </div>
      <section className="rounded-xl border border-vx-linha bg-white p-4 text-sm">
        <h2 className="font-semibold">4. Evento repetido</h2>
        <p className="text-vx-texto-2">Depois do cenário 1, clique de novo no mesmo botão: a tarefa existente é atualizada (“recebido 2×”), sem criar outro registro nem outra aprovação.</p>
        <h2 className="mt-4 font-semibold">5. Acesso a outro cliente</h2>
        <p className="text-vx-texto-2">
          Em “Ver como”, escolha <strong>Lígia</strong> (só Clínica Aurora). Instituto Sorriso Pleno e Financeiro somem de Hoje, Escritório, Clientes e dos contadores.
          {sorriso && <> Teste o link direto: <Link href={`/tarefas/${sorriso.id}`} className="underline">tarefa do Instituto Sorriso Pleno</Link> (deve mostrar “Sem acesso”).</>}
        </p>
        <h2 className="mt-4 font-semibold">6. Aprovação sem ação externa</h2>
        <p className="text-vx-texto-2">Como <strong>Fabiana</strong> (ou Tiago), abra <Link href="/aprovacoes" className="underline">Aprovações</Link> e aprove. A decisão é registrada, a tarefa fecha pelo critério de conclusão e o histórico mostra “Execução externa desabilitada na V1: nada foi enviado”.</p>
      </section>
      {u.perfil === 'admin' && (
        <form action={acaoResetar} className="rounded-xl border border-vx-linha bg-white p-4 text-sm">
          <h2 className="font-semibold">Recomeçar</h2>
          <p className="text-vx-texto-2">Apaga tarefas, execuções, aprovações e evidências de demonstração e recria os dados iniciais. Catálogo e instruções são mantidos.</p>
          <button className={`${botaoSec} mt-2`}>Resetar dados de demonstração</button>
        </form>
      )}
    </div>
  );
}
