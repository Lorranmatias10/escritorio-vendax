import Link from 'next/link';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { contexto } from '@/lib/sessao';
import { clientesVisiveis, obterPapel } from '@/lib/dados';
import { PAPEIS, ROTULO_FASE, MODOS, FONTES_CONFIRMADAS, INTEGRACOES } from '@/lib/catalogo';
import { ultimosTestes, ROTULO_STATUS } from '@/lib/integracoes';
import { dataHora } from '@/lib/formato';
import { acaoSalvarInstrucao, acaoDesabilitarPapel, acaoHomologarEspecialista, acaoPedirAoEspecialista } from '@/app/acoes';
import { EstadoConfigBadge, Secao, Vazio, Demo, botao, botaoSec, campo, Cabecalho, link, chip } from '@/components/ui';
import { adaptadorDoPapel } from '@/lib/ia';
import { FLUXOS_CLAUDE, fluxosDoPapel } from '@/lib/skills-claude';

export const maxDuration = 120;

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
  const fluxos = fluxosDoPapel(id);
  const claude = fluxos.length ? await adaptadorDoPapel(id) : null;
  const temChave = Boolean(process.env.ANTHROPIC_API_KEY);
  const podePedir = claude && temChave && a.execucao_habilitada && claude.provedor === a.claude_homologado_com;
  const clientes = podePedir ? (await clientesVisiveis(b, u)).filter(c => !c.demo) : [];
  return (
    <div className="space-y-5">
      <Cabecalho titulo={a.nome} trilha={<><Link href="/agentes" className={link}>Agentes</Link> <span aria-hidden>/</span> {a.nome}</>}
        descricao={`${a.departamento_nome} · responsável ${a.responsavel_proposto}`}
        extra={<><EstadoConfigBadge estado={a.estado_config} /><span className={`${chip} border-vx-linha-forte bg-white`}>{ROTULO_FASE[a.fase]}</span></>}
        acoes={<Link href={`/escritorio?sala=${a.departamento_id}&agente=${a.id}`} className={botaoSec}>Ver no escritório</Link>} />

      <Secao titulo="Configuração" id="config">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-vx-texto-2">ID canônico</dt><dd><code>{a.id}</code></dd></div>
          <div><dt className="text-vx-texto-2">Sala</dt><dd><Link className={link} href={`/escritorio?sala=${a.departamento_id}&agente=${a.id}`}>{a.departamento_nome}</Link></dd></div>
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
              <ul className="mt-1 space-y-0.5">{integ.map(i => <li key={i.id}><Link href={`/integracoes#${i.id}`} className={link}>{i.nome}</Link> · {ROTULO_STATUS[testes.get(i.id) ?? 'nao_testado']}</li>)}</ul>
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
            <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-vx-texto-2">Motivo para desabilitar<input name="motivo" required minLength={3} maxLength={300} className={campo} /></label>
            <button className={botaoSec}>Desabilitar papel</button>
          </form>
        )}
      </Secao>

      {claude && (
        <Secao titulo="Claude e Skills" id="claude">
          <ul className="space-y-1 text-sm">
            {fluxos.map(id => <li key={id}><strong>{FLUXOS_CLAUDE[id].nome}</strong> · {FLUXOS_CLAUDE[id].skills.join(', ')}</li>)}
          </ul>
          <p className="mt-2 text-sm text-vx-texto-2">
            {!temChave ? 'A chave do Claude precisa estar disponível no serviço.' : claude.provedor.endsWith(':pacote-ausente') ? 'O pacote das Skills está indisponível.' : podePedir ? 'Habilitado em A1 para análise dos dados que você anexar.' : 'Aguardando homologação com dados fictícios.'}
          </p>
          {a.homologacaoClaude?.casos.filter(c => !c.passou && typeof c.evidencia.erro === 'string').map(c => (
            <p key={c.caso} className="mt-1 text-sm text-vx-erro">{c.caso} · {String(c.evidencia.erro)}</p>
          ))}
          {u.perfil === 'admin' && temChave && !claude.provedor.endsWith(':pacote-ausente') && (
            <form action={acaoHomologarEspecialista} className="mt-3">
              <input type="hidden" name="papel" value={id} />
              <button className={botaoSec}>{podePedir ? 'Homologar novamente' : 'Homologar e habilitar em A1'}</button>
            </form>
          )}
          {podePedir && clientes.length > 0 && (
            <form action={acaoPedirAoEspecialista} className="mt-4 grid gap-3 border-t border-vx-linha pt-4 text-sm sm:grid-cols-2">
              <input type="hidden" name="id" value={randomUUID()} />
              <label className="flex flex-col gap-1">Cliente<select className={campo} name="cliente" required>
                <option value="">Selecione</option>{clientes.map(c => <option value={c.id} key={c.id}>{c.nome}</option>)}
              </select></label>
              <label className="flex flex-col gap-1">Área<select className={campo} name="fluxo" required>
                {fluxos.map(id => <option value={id} key={id}>{FLUXOS_CLAUDE[id].nome}</option>)}
              </select></label>
              <label className="flex flex-col gap-1 sm:col-span-2">Objetivo<input name="objetivo" required minLength={3} maxLength={300} className={campo} /></label>
              <label className="flex flex-col gap-1 sm:col-span-2">Dados para analisar<textarea name="dados" rows={5} required maxLength={20_000} className={campo} /></label>
              <div><button className={botao}>Pedir análise</button></div>
            </form>
          )}
          {podePedir && !clientes.length && <p className="mt-2 text-sm">Vincule um cliente a seu acesso para enviar um pedido.</p>}
        </Secao>
      )}

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
            {a.historico.map(h => <li key={h.id}><Link className={link} href={`/tarefas/${h.tarefa_id}`}>{h.objetivo}</Link> · {h.etapa} · {h.estado} · {dataHora(h.atualizado_em)} <Demo ativo={h.demo} /></li>)}
          </ul>
        ) : <Vazio>Sem execuções que você possa ver.</Vazio>}
      </Secao>
    </div>
  );
}
