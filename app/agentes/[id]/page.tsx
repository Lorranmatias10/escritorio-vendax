import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contexto } from '@/lib/sessao';
import { obterPapel } from '@/lib/dados';
import { PAPEIS, ROTULO_FASE, MODOS, FONTES_CONFIRMADAS, INTEGRACOES } from '@/lib/catalogo';
import { ultimosTestes, ROTULO_STATUS } from '@/lib/integracoes';
import { dataHora } from '@/lib/formato';
import { acaoSalvarInstrucao, acaoDesabilitarPapel } from '@/app/acoes';
import { EstadoConfigBadge, Secao, Vazio, Demo, botao, botaoSec, campo } from '@/components/ui';

const ESTADO_INSTRUCAO: Record<string, string> = { rascunho: 'Rascunho', em_homologacao: 'Em homologação', aprovada: 'Aprovada (ativa)', arquivada: 'Arquivada' };

export default async function Agente({ params }: PageProps<'/agentes/[id]'>) {
  const { id } = await params;
  const { b, u } = await contexto();
  const a = await obterPapel(b, u, id);
  if (!a) notFound();
  const ficha = PAPEIS.find(p => p.id === id);
  const testes = new Map((await ultimosTestes(b)).map(t => [t.integracao_id, t.status]));
  const integ = INTEGRACOES.filter(i => (i.papeis as readonly string[]).includes(id));
  const atual = a.instrucoes.find(i => i.versao === a.versao_instrucao) ?? a.instrucoes[0];
  const [maior, menor] = (a.instrucoes[0]?.versao ?? '1.0').split('.').map(Number);
  return (
    <div className="space-y-5">
      <nav className="text-sm text-vx-texto-2"><Link href="/agentes" className="underline">Agentes</Link> › {a.nome}</nav>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{a.nome}</h1>
        <EstadoConfigBadge estado={a.estado_config} />
        <span className="rounded-full border border-vx-linha px-2 py-0.5 text-xs">{ROTULO_FASE[a.fase]}</span>
      </div>

      <Secao titulo="Configuração" id="config">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-vx-texto-2">ID canônico</dt><dd><code>{a.id}</code></dd></div>
          <div><dt className="text-vx-texto-2">Sala</dt><dd><Link className="underline" href={`/escritorio?sala=${a.departamento_id}&agente=${a.id}`}>{a.departamento_nome}</Link></dd></div>
          <div><dt className="text-vx-texto-2">Responsável humano</dt><dd>{a.responsavel_proposto}</dd></div>
          <div><dt className="text-vx-texto-2">Nível de autonomia</dt><dd>{a.execucao_habilitada ? MODOS[a.modo as keyof typeof MODOS] : 'Sem execução até a aprovação'}</dd></div>
          <div><dt className="text-vx-texto-2">Homologado com</dt><dd>{a.homologado_com ?? '—'}</dd></div>
          <div><dt className="text-vx-texto-2">Instrução ativa</dt><dd>{a.versao_instrucao ? `v${a.versao_instrucao}` : 'Nenhuma (v1.0 importada, aguardando homologação ou fase)'}</dd></div>
          <div><dt className="text-vx-texto-2">Execução</dt><dd>{a.execucao_habilitada ? 'Habilitada · execução externa desabilitada na V1' : a.fase === 'piloto' && a.estado_config !== 'desabilitado' ? 'Só em Demonstração até a homologação' : 'Desabilitada'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-vx-texto-2">Entrega</dt><dd>{ficha?.entrega}</dd></div>
          <div>
            <dt className="text-vx-texto-2">Fontes</dt>
            <dd>
              <ul className="mt-1 space-y-0.5">{a.fontes.filter(f => FONTES_CONFIRMADAS.includes(f)).map(f => <li key={f}>✓ {f}</li>)}</ul>
              <ul className="mt-1 space-y-0.5">{integ.map(i => <li key={i.id}><Link href={`/integracoes#${i.id}`} className="underline">{i.nome}</Link> · {ROTULO_STATUS[testes.get(i.id) ?? 'nao_testado']}</li>)}</ul>
            </dd>
          </div>
          <div>
            <dt className="text-vx-texto-2">Ferramentas concedidas</dt>
            <dd>{a.ferramentas.length ? <ul className="mt-1 space-y-0.5">{a.ferramentas.map(f => <li key={f}><code>{f}</code></li>)}</ul> : 'Nenhuma (papel fora da fase ativa)'}</dd>
          </div>
          <div className="sm:col-span-2"><dt className="text-vx-texto-2">Limites da execução</dt><dd>{a.limites}</dd></div>
          {a.vinculo_reservado && <div className="sm:col-span-2"><dt className="text-vx-texto-2">Vínculo reservado</dt><dd>{a.vinculo_reservado}</dd></div>}
          <div className="sm:col-span-2"><dt className="text-vx-texto-2">Como desabilitar</dt><dd>{a.como_desabilitar}</dd></div>
        </dl>
        {u.perfil === 'admin' && a.estado_config !== 'desabilitado' && (
          <form action={acaoDesabilitarPapel} className="mt-4 flex flex-wrap items-end gap-2 border-t border-vx-linha pt-3 text-sm">
            <input type="hidden" name="papel" value={a.id} />
            <label className="flex flex-1 flex-col gap-1">Motivo para desabilitar<input name="motivo" required minLength={3} maxLength={300} className={campo} /></label>
            <button className={botaoSec}>Desabilitar papel</button>
          </form>
        )}
      </Secao>

      {a.homologacao && (
        <Secao titulo={`Homologação · rodada ${a.homologacao.rodada.slice(0, 8)}`} id="homolog">
          <p className="text-sm">{dataHora(a.homologacao.executado_em)} por {a.homologacao.executado_por} · v{a.homologacao.versao} · <strong>{a.homologacao.casos.filter(c => c.passou).length}/{a.homologacao.casos.length} casos</strong></p>
          <ul className="mt-2 space-y-1 text-sm">{a.homologacao.casos.map(c => <li key={c.caso}>{c.passou ? '✓' : '✕'} {c.caso}</li>)}</ul>
          <Link href="/agentes#homologacao" className="mt-2 inline-block text-sm underline">Ver evidências de todos os casos</Link>
        </Secao>
      )}

      <Secao titulo="Instrução" total={a.instrucoes.length} id="instr">
        {atual ? (
          <>
            <p className="text-sm"><strong>v{atual.versao}</strong> · {ESTADO_INSTRUCAO[atual.estado]} · {dataHora(atual.criado_em)}</p>
            <pre className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-vx-fundo p-3 text-xs leading-relaxed">{atual.conteudo}</pre>
            {a.instrucoes.length > 1 && (
              <ul className="mt-3 space-y-1 text-sm">{a.instrucoes.map(i => <li key={i.id}>v{i.versao} · {ESTADO_INSTRUCAO[i.estado]} · {dataHora(i.criado_em)}</li>)}</ul>
            )}
          </>
        ) : <Vazio>Nenhuma instrução cadastrada.</Vazio>}
        {u.perfil === 'admin' && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">Registrar nova versão (mudança operacional)</summary>
            <form action={acaoSalvarInstrucao} className="mt-2 space-y-2">
              <input type="hidden" name="papel" value={a.id} />
              <label className="flex flex-col gap-1 sm:w-40">Versão<input name="versao" defaultValue={`${maior}.${(menor || 0) + 1}`} pattern="\d+(\.\d+){0,2}" required className={campo} /></label>
              <label className="flex flex-col gap-1">Texto completo (instrução comum + bloco do papel)<textarea name="conteudo" required minLength={20} rows={8} defaultValue={atual?.conteudo} className={campo} /></label>
              <button className={botao}>Salvar como rascunho</button>
              <p className="text-xs text-vx-texto-2">A nova versão entra como rascunho e não muda a versão ativa. Para ativá-la, é preciso homologar de novo.</p>
            </form>
          </details>
        )}
      </Secao>

      <Secao titulo="Registro de configuração" total={a.registro.length} id="reg">
        {a.registro.length ? (
          <ol className="space-y-1 text-sm">{a.registro.map(r => <li key={r.id} className="flex gap-3"><time className="w-24 shrink-0 tabular-nums text-vx-texto-2">{dataHora(r.criado_em)}</time><span><strong>{r.ator}</strong> · {r.acao.replaceAll('_', ' ')} · {r.detalhe}</span></li>)}</ol>
        ) : <Vazio>Sem registros.</Vazio>}
      </Secao>

      <Secao titulo="Histórico autorizado" total={a.historico.length} id="hist">
        {a.historico.length ? (
          <ul className="space-y-1 text-sm">
            {a.historico.map(h => <li key={h.id}><Link className="underline" href={`/tarefas/${h.tarefa_id}`}>{h.objetivo}</Link> · {h.etapa} · {h.estado} · {dataHora(h.atualizado_em)} <Demo ativo={h.demo} /></li>)}
          </ul>
        ) : <Vazio>Sem execuções que você possa ver.</Vazio>}
      </Secao>
    </div>
  );
}
