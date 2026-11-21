import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { catalogo, ultimaHomologacao } from '@/lib/dados';
import { ROTULO_FASE, PAPEIS_PILOTO } from '@/lib/catalogo';
import { dataHora } from '@/lib/formato';
import { acaoHomologarPiloto, acaoHomologarFase2, acaoHomologarFase3 } from '@/app/acoes';
import { PAPEIS_FASE_2, PAPEIS_FASE_3 } from '@/lib/homologacao';
import { PAPEIS_CLAUDE } from '@/lib/skills-claude';
import { EstadoConfigBadge, botao, link, Cabecalho } from '@/components/ui';

export default async function Agentes() {
  const { b, u } = await contexto();
  const [c, h, h2, h3] = await Promise.all([catalogo(b), ultimaHomologacao(b, PAPEIS_PILOTO[0]), porFluxo(b, PAPEIS_FASE_2), porFluxo(b, PAPEIS_FASE_3)]);
  const piloto = c.papeis.filter(p => (PAPEIS_PILOTO as readonly string[]).includes(p.id));
  const claude = c.papeis.filter(p => PAPEIS_CLAUDE.some(id => id === p.id));
  const habilitado = piloto.every(p => p.estado_config === 'habilitado');
  return (
    <div className="space-y-5">
      <Cabecalho titulo="Agentes" descricao={<>{c.andares.length} andares, {c.deptos.length} departamentos e {c.papeis.length} papéis. Cada papel recebe a instrução comum e o seu bloco (catálogo em <code>agentes/instrucoes/</code>). Só executa quem passou na homologação.</>} />

      <section id="homologacao" aria-labelledby="h-piloto" className="scroll-mt-4 rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto">
            <h2 id="h-piloto" className="text-lg font-bold">Piloto · fase 1 em A1 (consulta e rascunho)</h2>
            <p className="text-sm text-vx-texto-2">Diretor de Operações, Gerente de Contas (AM - Vendax) e Auditor de Qualidade. Os 7 casos rodam num banco isolado com contas fictícias.</p>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {piloto.map(p => <li key={p.id} className="flex items-center gap-1.5"><Link href={`/agentes/${p.id}`} className={link}>{p.nome}</Link><EstadoConfigBadge estado={p.estado_config} /></li>)}
            </ul>
          </div>
          {u.perfil === 'admin'
            ? <form action={acaoHomologarPiloto}><button className={botao}>{habilitado ? 'Rodar a homologação de novo' : 'Homologar e habilitar o piloto (A1)'}</button></form>
            : <p className="text-sm text-vx-texto-2">Somente a direção homologa.</p>}
        </div>
        <Resultado h={h} />
      </section>

      <SecaoFase id="fase2" titulo="Fase 2 · seis fluxos em A1 (consulta e rascunho)" papeis={c.papeis.filter(p => PAPEIS_FASE_2.includes(p.id))} h={h2} admin={u.perfil === 'admin'} acao={acaoHomologarFase2} rotulo="fase 2" />
      <SecaoFase id="fase3" titulo="Fase 3 · catorze fluxos em A1 (consulta e rascunho)" papeis={c.papeis.filter(p => PAPEIS_FASE_3.includes(p.id))} h={h3} admin={u.perfil === 'admin'} acao={acaoHomologarFase3} rotulo="fase 3" />

      <section className="rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-4">
        <h2 className="text-lg font-bold">Especialistas com Skills do Claude</h2>
        <ul className="mt-2 flex flex-wrap gap-3 text-sm">
          {claude.map(p => <li key={p.id}><Link href={`/agentes/${p.id}#claude`} className={link}>{p.nome}</Link></li>)}
        </ul>
      </section>

      <div className="overflow-x-auto rounded-lg border border-vx-linha bg-vx-superficie shadow-vx">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Papéis do escritório</caption>
          <thead className="bg-vx-fundo text-xs font-semibold text-vx-texto-2">
            <tr><th className="px-3 py-2">Papel</th><th className="px-3 py-2">Sala</th><th className="px-3 py-2">Fase</th><th className="px-3 py-2">Dono proposto</th><th className="px-3 py-2">Instrução</th><th className="px-3 py-2">Autonomia</th><th className="px-3 py-2">Estado</th></tr>
          </thead>
          <tbody>
            {c.papeis.map(p => (
              <tr key={p.id} className="border-t border-vx-linha">
                <td className="px-3 py-2"><Link href={`/agentes/${p.id}`} className="font-medium text-vx-verde-escuro underline">{p.nome}</Link><div className="text-xs text-vx-texto-2">{p.id}</div></td>
                <td className="px-3 py-2">{p.departamento_nome}</td>
                <td className="px-3 py-2">{ROTULO_FASE[p.fase]}</td>
                <td className="px-3 py-2">{p.responsavel_proposto}</td>
                <td className="px-3 py-2">{p.versao_instrucao ? `v${p.versao_instrucao} (ativa)` : 'v1.0 importada'}</td>
                <td className="px-3 py-2">{p.execucao_habilitada ? p.modo : '—'}</td>
                <td className="px-3 py-2"><EstadoConfigBadge estado={p.estado_config} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-4 text-sm">O status de cada fonte vem de testes reais em <Link href="/integracoes" className="font-medium text-vx-verde-escuro underline">Integrações</Link>.</p>
    </div>
  );
}

type Rodada = NonNullable<Awaited<ReturnType<typeof ultimaHomologacao>>>;
type PapelCat = Awaited<ReturnType<typeof catalogo>>['papeis'][number];

// Cada fluxo pode vir de uma rodada diferente; mostra a última de cada um, na rodada mais recente.
async function porFluxo(b: Parameters<typeof ultimaHomologacao>[0], papeis: string[]): Promise<Rodada | null> {
  const r = (await Promise.all(papeis.map(p => ultimaHomologacao(b, p)))).filter(x => x !== null);
  return r.length ? { ...r.reduce((a, x) => (x.executado_em > a.executado_em ? x : a)), casos: r.flatMap(x => x.casos), aprovado: r.length === papeis.length && r.every(x => x.aprovado) } : null;
}

function SecaoFase({ id, titulo, papeis, h, admin, acao, rotulo }: { id: string; titulo: string; papeis: PapelCat[]; h: Rodada | null; admin: boolean; acao: () => Promise<void>; rotulo: string }) {
  return (
    <section id={id} aria-labelledby={`h-${id}`} className="scroll-mt-4 rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          <h2 id={`h-${id}`} className="text-lg font-bold">{titulo}</h2>
          <p className="text-sm text-vx-texto-2">Para cada fluxo: caso normal, dado ausente, duplicidade e fora de permissão, num banco isolado com contas fictícias. Cada papel só é habilitado se passar nos seus 4 casos.</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {papeis.map(p => <li key={p.id} className="flex items-center gap-1.5"><Link href={`/agentes/${p.id}`} className={link}>{p.nome}</Link><EstadoConfigBadge estado={p.estado_config} /></li>)}
          </ul>
        </div>
        {admin
          ? <form action={acao}><button className={botao}>{h ? `Rodar a homologação da ${rotulo} de novo` : `Homologar a ${rotulo} (A1)`}</button></form>
          : <p className="text-sm text-vx-texto-2">Somente a direção homologa.</p>}
      </div>
      <Resultado h={h} />
    </section>
  );
}
function Resultado({ h }: { h: Rodada | null }) {
  if (!h) return <p className="mt-3 text-sm text-vx-texto-2">Ainda não houve homologação.</p>;
  return (
          <div className="mt-4">
            <p className="text-sm">
              <strong>Última rodada:</strong> {dataHora(h.executado_em)} por {h.executado_por} · instrução v{h.versao} · provedor <strong>{String(h.casos[0]?.evidencia.provedor ?? 'simulado-local')}</strong> ·{' '}
              <strong className={h.aprovado ? 'text-vx-verde-escuro' : 'text-vx-erro'}>{h.casos.filter(x => x.passou).length}/{h.casos.length} casos {h.aprovado ? '✓ aprovado' : '✕ reprovado'}</strong>
              <span className="text-vx-texto-2"> · rodada {h.rodada.slice(0, 8)}</span>
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Casos de homologação</caption>
                <thead className="text-xs font-semibold text-vx-texto-2"><tr><th className="py-1 pr-3">Cenário</th><th className="py-1 pr-3">Esperado</th><th className="py-1 pr-3">Resultado</th><th className="py-1">Verificações</th></tr></thead>
                <tbody>
                  {h.casos.map(x => (
                    <tr key={x.caso} className="border-t border-vx-linha align-top">
                      <td className="py-2 pr-3 font-medium">{x.caso}</td>
                      <td className="py-2 pr-3 text-vx-texto-2">{x.esperado}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{x.passou ? <span className="text-vx-verde-escuro">✓ Passou</span> : <span className="text-vx-erro">✕ Falhou</span>}</td>
                      <td className="py-2 text-xs">
                        <ul>{Object.entries(x.evidencia).filter(([, v]) => typeof v === 'boolean').map(([k, v]) => <li key={k}>{v ? '✓' : '✕'} {k.replaceAll('_', ' ')}</li>)}</ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          );
}
