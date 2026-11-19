import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { obterTarefa } from '@/lib/dados';
import { ROTULO_EVIDENCIA } from '@/lib/catalogo';
import { dataHora } from '@/lib/formato';
import { acaoRetomar } from '@/app/acoes';
import { EstadoTarefaBadge, EstadoAprovacaoBadge, Demo, Prazo, Secao, Vazio, LinhaTarefa, botaoSec, link, Cabecalho, Aviso } from '@/components/ui';

const TIPO_AFIRMACAO = { fato: 'Fato', inferencia: 'Inferência', suposicao: 'Suposição' } as const;

export default async function Tarefa({ params, searchParams }: PageProps<'/tarefas/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  const { b, u } = await contexto();
  const t = await obterTarefa(b, u, id);
  if (!t) {
    return (
      <div className="rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-6" role="alert">
        <h1 className="text-xl font-bold">Sem acesso</h1>
        <p className="mt-1 text-vx-texto-2">Esta tarefa não existe ou pertence a um cliente ou área que <strong>{u.nome}</strong> não pode ver.</p>
        <Link href="/hoje" className={`${botaoSec} mt-4`}>Voltar para Hoje</Link>
      </div>
    );
  }
  const eventosDemo = t.demo;
  return (
    <div className="space-y-5">
      {sp.repetido && <Aviso tom="alerta">Evento repetido recebido: a tarefa existente foi atualizada, sem criar outro registro.</Aviso>}
      <Cabecalho titulo={t.objetivo}
        trilha={<><Link href="/escritorio" className={link}>Escritório</Link> <span aria-hidden>/</span> <Link href={`/escritorio?sala=${t.departamento_id}`} className={link}>{t.departamento_nome}</Link>
          {t.parent_id && <> <span aria-hidden>/</span> <Link href={`/tarefas/${t.parent_id}`} className={link}>Tarefa de origem</Link></>}</>}
        extra={<><EstadoTarefaBadge estado={t.estado} /><Demo ativo={eventosDemo} /></>}
        descricao={<span className="tabular text-xs">ID {t.id}</span>}
        acoes={<Link href={`/escritorio?sala=${t.departamento_id}`} className={botaoSec}>Ver na sala</Link>} />

      <dl className="grid gap-3 rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Cliente ou área', t.cliente_nome ?? `Área interna · ${t.departamento_nome}`],
          ['Dono humano', t.dono_nome ?? 'Sem dono'],
          ['Papel atual', t.papel_nome ?? '—'],
          ['Prazo', <Prazo key="p" v={t.prazo} />],
          ['Origem', `${t.fonte}${t.origem_evento_id ? ` · evento ${t.origem_evento_id}` : ''}${t.origem_recebimentos > 1 ? ` · recebido ${t.origem_recebimentos}×` : ''}`],
          ['Sala', <Link key="s" className={link} href={`/escritorio?sala=${t.departamento_id}`}>{t.departamento_nome}</Link>],
          ['Critério de conclusão', t.criterio_conclusao ?? '—'],
          ['Criada em', dataHora(t.criado_em)],
        ].map(([k, v]) => <div key={String(k)}><dt className="text-vx-texto-2">{k}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>

      <div className={`rounded-lg border p-4 shadow-vx ${t.motivo_bloqueio ? 'border-vx-alerta/40 bg-vx-alerta-claro' : 'border-vx-verde/30 bg-vx-verde-claro'}`}>
        <h2 className="text-[15px] font-semibold">Quem precisa agir</h2>
        {t.motivo_bloqueio && <p className="mt-1"><strong>Motivo:</strong> {t.motivo_bloqueio}</p>}
        <p className="mt-1"><strong>Próximo passo:</strong> {t.proximo_passo ?? '—'} <span className="text-vx-texto-2">· responsável: {t.dono_nome ?? 'sem dono'}</span></p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Subtarefas (delegação)" total={t.subtarefas.length} id="sub">
          {t.subtarefas.length ? <ul>{t.subtarefas.map(s => <LinhaTarefa key={s.id} t={s} />)}</ul> : <Vazio>Sem subtarefas.</Vazio>}
        </Secao>
        <Secao titulo="Evidências" total={t.evidencias.length} id="evid">
          {t.evidencias.length ? (
            <ul className="space-y-2 text-sm">
              {t.evidencias.map(e => (
                <li key={e.id} className="rounded-lg border border-vx-linha p-2">
                  <span className="text-xs font-semibold text-vx-texto-2">{ROTULO_EVIDENCIA[e.tipo as keyof typeof ROTULO_EVIDENCIA]}</span>
                  <p className="whitespace-pre-line">{e.descricao}</p>
                  {e.referencia && <p className="text-xs text-vx-texto-2">Referência: {e.referencia}</p>}
                </li>
              ))}
            </ul>
          ) : <Vazio>Sem evidências registradas.</Vazio>}
        </Secao>
      </div>

      {t.aprovacoes.length > 0 && (
        <Secao titulo="Aprovações" total={t.aprovacoes.length} id="ap">
          <ul className="space-y-2 text-sm">
            {t.aprovacoes.map(a => (
              <li key={a.id}><Link href={`/aprovacoes#${a.id}`} className="flex flex-wrap items-center gap-2 underline">{a.intencao}</Link>
                <span className="ml-2"><EstadoAprovacaoBadge estado={a.estado as 'pendente'} /></span> <span className="text-vx-texto-2">· aprovador {a.aprovador_nome} · ação externa desabilitada na V1</span></li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Execuções e tentativas" total={t.execucoes.length} id="exec">
        {t.execucoes.length ? (
          <ul className="space-y-3">
            {t.execucoes.map(e => (
              <li key={e.id} className="rounded-lg border border-vx-linha p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{e.papel_nome}</strong><span>· etapa “{e.etapa}”</span>
                  <span className="rounded-full border border-vx-linha px-2 text-xs">{e.estado === 'concluida' ? 'Concluída' : e.estado === 'falhou' ? 'Falhou' : e.estado === 'na_fila' ? 'Na fila' : 'Em execução'}</span>
                  <span className="text-vx-texto-2">tentativas: {e.tentativas} · provedor: {e.provedor ?? '—'} · instrução {e.versao_instrucao ? `v${e.versao_instrucao}` : '—'}</span><Demo ativo={e.demo} />
                </div>
                {e.erro && <p className="mt-1 text-vx-erro">Erro: {e.erro}</p>}
                {e.estado === 'falhou' && (
                  <form action={acaoRetomar} className="mt-2"><input type="hidden" name="execucao" value={e.id} /><button className={botaoSec}>Retomar execução</button></form>
                )}
                {e.saida?.resumo && (
                  <p className="mt-2"><strong>Resumo:</strong> {e.saida.resumo}
                    {e.saida.parecer && <> · <strong>Parecer:</strong> {({ aprovada: 'Aprovada', corrigir: 'Corrigir', bloqueada: 'Bloqueada' })[e.saida.parecer]}{e.saida.gravidade && ` (gravidade ${e.saida.gravidade === 'media' ? 'média' : e.saida.gravidade})`}</>}
                  </p>
                )}
                {e.saida?.trilha && (
                  <p className="text-vx-texto-2">Trilha: <strong>{({ preparado: 'Preparado (rascunho)', solicitado: 'Solicitado (aguarda decisão humana)', concluido: 'Concluído' })[e.saida.trilha]}</strong> · Efeito confirmado: {e.saida.efeito_confirmado ?? 'nenhum (A1: nada foi executado)'}</p>
                )}
                {e.saida && (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-semibold text-vx-texto-2">Afirmações</h3>
                      <ul className="list-disc pl-5">{e.saida.afirmacoes.map((a, i) => <li key={i}><strong>{TIPO_AFIRMACAO[a.tipo]}:</strong> {a.texto}</li>)}</ul>
                      <h3 className="mt-2 text-xs font-semibold text-vx-texto-2">Fontes</h3>
                      <ul className="list-disc pl-5">{e.saida.fontes.map((f, i) => <li key={i}>{f.nome}{!f.disponivel && <strong> · Integração pendente</strong>}</li>)}</ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-vx-texto-2">Lacunas</h3>
                      {e.saida.lacunas.length ? <ul className="list-disc pl-5">{e.saida.lacunas.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p>Nenhuma</p>}
                      <p className="mt-2"><strong>Próxima ação:</strong> {e.saida.proxima_acao}</p>
                      <p><strong>Papel de destino:</strong> {e.saida.papel_destino ?? 'Nenhum (decisão humana)'}</p>
                      <p><strong>Responsável humano:</strong> {e.saida.responsavel_humano}</p>
                      <p><strong>Condição de conclusão:</strong> {e.saida.condicao_conclusao}</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <Vazio>Sem execuções nesta tarefa.</Vazio>}
      </Secao>

      <Secao titulo="Histórico" total={t.eventos.length} id="hist">
        <ol className="space-y-1.5 text-sm">
          {t.eventos.map(e => (
            <li key={e.id} className="flex gap-3"><time className="w-24 shrink-0 tabular-nums text-vx-texto-2">{dataHora(e.criado_em)}</time><span><strong>{e.ator}</strong> · {e.descricao}</span></li>
          ))}
        </ol>
      </Secao>
    </div>
  );
}
