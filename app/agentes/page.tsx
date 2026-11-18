import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { catalogo, ultimaHomologacao } from '@/lib/dados';
import { ROTULO_FASE, PAPEIS_PILOTO } from '@/lib/catalogo';
import { dataHora } from '@/lib/formato';
import { acaoHomologarPiloto } from '@/app/acoes';
import { EstadoConfigBadge, botao } from '@/components/ui';

export default async function Agentes() {
  const { b, u } = await contexto();
  const [c, h] = await Promise.all([catalogo(b), ultimaHomologacao(b)]);
  const piloto = c.papeis.filter(p => (PAPEIS_PILOTO as readonly string[]).includes(p.id));
  const habilitado = piloto.every(p => p.estado_config === 'habilitado');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Agentes</h1>
        <p className="text-sm text-vx-texto-2">
          {c.andares.length} andares, {c.deptos.length} departamentos e {c.papeis.length} papéis. Cada papel recebe a instrução comum e o seu bloco
          (catálogo versionado em <code>agentes/instrucoes/</code>). O cadastro é separado da execução: só executa quem passou na homologação.
        </p>
      </div>

      <section id="homologacao" aria-labelledby="h-piloto" className="scroll-mt-4 rounded-xl border border-vx-linha bg-white p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto">
            <h2 id="h-piloto" className="text-lg font-bold">Piloto · fase 1 em A1 (consulta e rascunho)</h2>
            <p className="text-sm text-vx-texto-2">Diretor de Operações, Gerente de Contas (AM - Vendax) e Auditor de Qualidade. Os 7 casos rodam num banco isolado com contas fictícias.</p>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {piloto.map(p => <li key={p.id} className="flex items-center gap-1.5"><Link href={`/agentes/${p.id}`} className="underline">{p.nome}</Link><EstadoConfigBadge estado={p.estado_config} /></li>)}
            </ul>
          </div>
          {u.perfil === 'admin'
            ? <form action={acaoHomologarPiloto}><button className={botao}>{habilitado ? 'Rodar a homologação de novo' : 'Homologar e habilitar o piloto (A1)'}</button></form>
            : <p className="text-sm text-vx-texto-2">Somente a direção homologa.</p>}
        </div>
        {h ? (
          <div className="mt-4">
            <p className="text-sm">
              <strong>Última rodada:</strong> {dataHora(h.executado_em)} por {h.executado_por} · instrução v{h.versao} · provedor <strong>{String(h.casos[0]?.evidencia.provedor ?? 'simulado-local')}</strong> ·{' '}
              <strong className={h.aprovado ? 'text-vx-verde-escuro' : 'text-vx-erro'}>{h.casos.filter(x => x.passou).length}/{h.casos.length} casos {h.aprovado ? '✓ aprovado' : '✕ reprovado'}</strong>
              <span className="text-vx-texto-2"> · rodada {h.rodada.slice(0, 8)}</span>
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Casos de homologação</caption>
                <thead className="text-xs uppercase text-vx-texto-2"><tr><th className="py-1 pr-3">Cenário</th><th className="py-1 pr-3">Esperado</th><th className="py-1 pr-3">Resultado</th><th className="py-1">Verificações</th></tr></thead>
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
        ) : <p className="mt-3 text-sm text-vx-texto-2">Ainda não houve homologação.</p>}
      </section>

      <div className="overflow-x-auto rounded-xl border border-vx-linha bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Papéis do escritório</caption>
          <thead className="bg-vx-fundo text-xs uppercase text-vx-texto-2">
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

      <p className="rounded-xl border border-vx-linha bg-white p-4 text-sm">O status de cada fonte vem de testes reais em <Link href="/integracoes" className="font-medium text-vx-verde-escuro underline">Integrações</Link>.</p>
    </div>
  );
}
