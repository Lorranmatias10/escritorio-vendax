import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { INTEGRACOES } from '@/lib/catalogo';
import { catalogo } from '@/lib/dados';
import { DEFINICOES, PROVEDOR_IA, ROTULO_STATUS, historicoTestes, presencaCredenciais, testarDesatualizadas, ultimosTestes, type Status, type TesteGravado } from '@/lib/integracoes';
import { dataHora } from '@/lib/formato';
import { acaoTestarIntegracao, acaoTestarTodas } from '@/app/acoes';
import { loginLigado } from '@/lib/auth';
import { acaoConectarCrm } from './acoes-crm';
import { botao, botaoSec, link, Cabecalho, Aviso } from '@/components/ui';

const ESTILO: Record<Status, [string, string]> = {
  conectado: ['✓', 'bg-vx-verde-claro text-vx-verde-escuro border-vx-verde/30'],
  parcial: ['◐', 'bg-vx-alerta-claro text-vx-alerta border-vx-alerta/30'],
  erro: ['✕', 'bg-vx-erro-claro text-vx-erro border-vx-erro/30'],
  nao_configurado: ['○', 'bg-vx-fundo text-vx-texto-2 border-vx-linha'],
  nao_testado: ['?', 'bg-vx-info-claro text-vx-info border-vx-info/30'],
};
const ORIGEM: Record<string, string> = { abertura: 'ao abrir a tela', manual: 'manual', agendado: 'automático (30 min)', conexao: 'após conectar' };
const MSG: Record<string, string> = {
  crm_configurado_servidor: 'A credencial do CRM Vendax está gerenciada pelo servidor.',
  crm_token_invalido: 'Informe um token pessoal do CRM Vendax válido.',
  crm_indisponivel: 'O CRM Vendax não respondeu. Tente validar o token novamente.',
  crm_token_escopo: 'O CRM Vendax não confirmou um token somente leitura com acesso a espaços. Emita um token de leitura e tente de novo.',
  sem_permissao: 'Somente a direção conecta integrações.', alvo_invalido: 'Integração inválida.',
  oauth_nao_configurado: 'O app OAuth do Google ainda não está configurado no servidor. Veja o passo a passo do card.',
  cofre_sem_chave: 'O cofre do servidor está sem chave (VX_COFRE_CHAVE).', estado_invalido: 'A autorização expirou ou não veio deste app. Tente de novo.',
  autorizacao_negada: 'A autorização foi cancelada na tela do Google.', troca_falhou: 'O Google não devolveu o acesso offline. Tente "Reconectar".',
};
const REVALIDAR_MS = 60_000; // proteção contra limite de requisições ao reabrir a tela várias vezes

function StatusBadge({ s }: { s: Status }) {
  const [sim, c] = ESTILO[s];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${c}`}><span aria-hidden>{sim}</span>{ROTULO_STATUS[s]}</span>;
}

export default async function Integracoes({ searchParams }: PageProps<'/integracoes'>) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { b, u } = await contexto();

  // Health check real ao abrir a tela (o que não foi testado no último minuto).
  await testarDesatualizadas(b, REVALIDAR_MS, u.id);

  const [ultimos, historico, presenca, cat] = await Promise.all([ultimosTestes(b), historicoTestes(b, 60), presencaCredenciais(b), catalogo(b)]);
  const porId = new Map(ultimos.map(t => [t.integracao_id, t]));
  const papeis = new Map(cat.papeis.map(p => [p.id, p]));
  const ativos = new Set(cat.papeis.filter(p => p.execucao_habilitada).map(p => p.id));
  const conectadas = INTEGRACOES.filter(i => porId.get(i.id)?.status === 'conectado').length;
  const CARDS = [PROVEDOR_IA, ...INTEGRACOES];
  const criticas = CARDS.filter(i => ['erro', 'nao_configurado'].includes(porId.get(i.id)?.status ?? '') && (i.papeis as readonly string[]).some(p => ativos.has(p)));
  const ocultar = (id: string) => id === 'asaas' && !u.pode_financeiro; // financeiro restrito

  return (
    <div className="space-y-5">
      <Cabecalho titulo="Integrações" descricao="Status de testes reais, só de leitura: ao abrir a tela, em “Testar conexão” e a cada 30 minutos. Chaves e tokens ficam só no servidor."
        acoes={u.perfil === 'admin' && <form action={acaoTestarTodas}><button className={botao}>Testar todas</button></form>} />

      {sp.ok && <p role="status" className="rounded-lg border border-vx-verde/30 bg-vx-verde-claro px-3 py-2.5 text-sm"><span aria-hidden className="mr-1.5 font-bold">✓</span>Conta conectada e testada: {CARDS.find(i => i.id === sp.ok)?.nome}.</p>}
      {sp.erro && <Aviso tom="erro">{MSG[sp.erro] ?? 'Não foi possível concluir a conexão.'}</Aviso>}

      <div className="grid gap-3 md:grid-cols-[auto_1fr]">
        <div className="rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-4">
          <p className="text-3xl font-bold tabular-nums">{conectadas} <span className="text-lg font-medium text-vx-texto-2">de {INTEGRACOES.length}</span></p>
          <p className="text-sm text-vx-texto-2">integrações conectadas</p>
        </div>
        {criticas.length > 0 ? (
          <div role="alert" className="rounded-lg border border-vx-erro/40 bg-vx-erro-claro p-4 text-sm">
            <p className="font-semibold text-vx-erro">✕ Agentes ativos dependem de integrações sem conexão</p>
            <ul className="mt-1 space-y-0.5">
              {criticas.map(i => (
                <li key={i.id}><a href={`#${i.id}`} className={link}>{i.nome}</a> ({ROTULO_STATUS[porId.get(i.id)!.status]}) · usada por {(i.papeis as readonly string[]).filter(p => ativos.has(p)).map(p => papeis.get(p)?.nome).join(', ')}</li>
              ))}
            </ul>
            <p className="mt-1 text-vx-texto-2">Enquanto isso, esses agentes trabalham só com o conteúdo anexado à tarefa e registram a fonte como lacuna.</p>
          </div>
        ) : <div className="rounded-lg border border-vx-verde/30 bg-vx-verde-claro p-4 text-sm">Nenhum agente ativo depende de integração em erro ou sem configuração.</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {CARDS.map(i => {
          const d = DEFINICOES.find(x => x.id === i.id)!;
          const t = porId.get(i.id);
          const status: Status = t?.status ?? 'nao_testado';
          const pres = presenca[i.id];
          const hist = historico.filter(h => h.integracao_id === i.id).slice(0, 6);
          const conectarHref = d.conexao.tipo === 'oauth' ? `/api/integracoes/google/conectar?alvo=${d.conexao.alvo}` : null;
          return (
            <article key={i.id} id={i.id} aria-labelledby={`t-${i.id}`} className="scroll-mt-4 rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-4 text-sm">
              <div className="flex items-start gap-3">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-vx-grafite text-xs font-bold text-white">{i.icone}</span>
                <div className="mr-auto">
                  <h2 id={`t-${i.id}`} className="text-base font-bold">{i.nome}</h2>
                  <p className="text-xs text-vx-texto-2">{d.metodo}</p>
                </div>
                <StatusBadge s={status} />
              </div>

              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-vx-texto-2">Último teste</dt><dd>{t ? `${dataHora(t.testado_em)} · ${ORIGEM[t.origem]}` : 'Não testado'}</dd>
                <dt className="text-vx-texto-2">Conta</dt><dd>{ocultar(i.id) ? 'Restrito ao financeiro' : t?.conta ?? '—'}</dd>
                <dt className="text-vx-texto-2">Escopo</dt><dd>{t?.escopo ?? '—'} <span className="text-vx-texto-2">· agentes precisam de: {i.escopo}</span></dd>
                <dt className="text-vx-texto-2">Agentes</dt>
                <dd>{i.papeis.map(p => <span key={p} className={`mr-1 inline-block ${ativos.has(p) ? 'font-semibold' : 'text-vx-texto-2'}`}>{papeis.get(p)?.nome}{ativos.has(p) ? ' (ativo)' : ''}{p !== i.papeis.at(-1) ? ',' : ''}</span>)}</dd>
              </dl>

              {status !== 'conectado' && t && (
                <div className={`mt-3 rounded-lg border p-2.5 ${ESTILO[status][1]}`}>
                  <p className="font-medium">{t.mensagem}</p>
                  {t.acao && <p className="mt-0.5">O que fazer: {t.acao}</p>}
                </div>
              )}
              {status === 'conectado' && t && <p className="mt-3 text-vx-verde-escuro">{t.mensagem}</p>}

              <p className="mt-3 text-xs text-vx-texto-2">
                Credenciais no servidor: {d.credenciais.map(c => <span key={c.nome} className="mr-2 inline-block [overflow-wrap:anywhere]"><code>{c.nome}</code> {pres[c.nome] ? '✓' : c.obrigatoria ? '✕' : '—'}</span>)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {u.perfil === 'admin' && (
                  <form action={acaoTestarIntegracao}><input type="hidden" name="integracao" value={i.id} /><button className={botaoSec}>Testar conexão</button></form>
                )}
                {u.perfil === 'admin' && conectarHref && (pres.GOOGLE_OAUTH_CLIENT_ID
                  ? <Link href={conectarHref} prefetch={false} className={botao}>{status === 'nao_configurado' ? 'Conectar' : 'Reconectar'}</Link>
                  : <span className="text-xs text-vx-texto-2">“Conectar” fica disponível depois do app OAuth do Google (passos abaixo).</span>)}
              </div>
              {i.id === 'crm' && u.perfil === 'admin' && loginLigado() && (
                <form action={acaoConectarCrm} className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 text-xs font-medium">
                    Token de leitura do CRM
                    <input name="token" type="password" autoComplete="off" spellCheck={false} maxLength={136} required
                      className="rounded-md border border-vx-linha bg-vx-superficie px-3 py-2 text-sm" />
                  </label>
                  <button className={botao}>Conectar CRM</button>
                </form>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer font-medium text-vx-verde-escuro">{conectarHref ? 'Passo a passo para conectar' : status === 'nao_configurado' ? 'Conectar · passo a passo' : 'Reconectar · passo a passo'}</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5">{d.passos.map((p, k) => <li key={k}>{p}</li>)}</ol>
                {i.id === 'crm' ? <p className="mt-2 text-xs text-vx-texto-2">O token validado fica no cofre do servidor.</p>
                  : <p className="mt-2 text-xs text-vx-texto-2">Onde colar: arquivo <code>.env.local</code> na pasta do Escritório (no servidor publicado, nas variáveis secretas do serviço). Nunca no chat nem nesta tela.</p>}
              </details>
              {hist.length > 0 && !ocultar(i.id) && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-vx-texto-2">Histórico de testes ({hist.length})</summary>
                  <ul className="mt-1 space-y-0.5 text-xs">{hist.map(h => <li key={h.id}>{dataHora(h.testado_em)} · {ROTULO_STATUS[h.status]} · {h.mensagem}</li>)}</ul>
                </details>
              )}
            </article>
          );
        })}
      </div>

      <section aria-labelledby="hist" className="rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-4">
        <h2 id="hist" className="text-[15px] font-semibold">Histórico de testes (últimos {historico.length})</h2>
        <div className="mt-2 max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs font-semibold text-vx-texto-2"><tr><th className="py-1 pr-3">Quando</th><th className="py-1 pr-3">Integração</th><th className="py-1 pr-3">Resultado</th><th className="py-1 pr-3">Origem</th><th className="py-1">Mensagem</th></tr></thead>
            <tbody>
              {historico.map((h: TesteGravado) => (
                <tr key={h.id} className="border-t border-vx-linha">
                  <td className="py-1 pr-3 whitespace-nowrap tabular-nums">{dataHora(h.testado_em)}</td>
                  <td className="py-1 pr-3">{CARDS.find(x => x.id === h.integracao_id)?.nome}</td>
                  <td className="py-1 pr-3 whitespace-nowrap">{ESTILO[h.status][0]} {ROTULO_STATUS[h.status]}</td>
                  <td className="py-1 pr-3">{ORIGEM[h.origem]}</td>
                  <td className="py-1">{ocultar(h.integracao_id) ? 'Restrito ao financeiro' : h.mensagem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
