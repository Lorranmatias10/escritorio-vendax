import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contexto } from '@/lib/sessao';
import { clientesVisiveis } from '@/lib/dados';
import { lerFicha, lerContas } from '@/lib/memoria-vendax';
import { Aviso, BarraFiltros, botao, Cabecalho, campo, CampoFiltro, link, Secao, Vazio } from '@/components/ui';
import { acaoImportarCarteira, acaoSalvarConta, acaoSalvarFicha } from '../memoria-acoes';

const situacoes = ['Ativo', 'Projeto', 'Prospect', 'Inativo', 'Encerrado'];
const ROTULOS = { principal: 'Principal para consulta', historica: 'Histórica / alternativa', verificar: 'A confirmar' };
const FILTRO = '/clientes/memoria';

export default async function Memoria({ searchParams }: PageProps<'/clientes/memoria'>) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { b, u } = await contexto();
  const clientes = (await clientesVisiveis(b, u)).filter(c => !c.demo);
  const cliente = clientes.find(c => c.id === sp.cliente);
  if (sp.cliente && !cliente) notFound();
  const admin = u.perfil === 'admin';
  const [ficha, contas] = await Promise.all([lerFicha(b, u, cliente?.id ?? null), cliente ? lerContas(b, u, cliente.id) : []]);
  return <div className="space-y-5">
    <Cabecalho titulo="Memória operacional"
      descricao="Contexto que os agentes recebem nas tarefas. Cada ficha acompanha as referências de origem e as contas vinculadas."
      acoes={<Link className={link} href="/clientes">Voltar para Clientes</Link>}
      filtros={<BarraFiltros action={FILTRO}>
        <CampoFiltro rotulo="Ficha">
          <select name="cliente" defaultValue={cliente?.id ?? ''} className={campo}>
            <option value="">Vendax · geral</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </CampoFiltro>
        <button className={botao}>Abrir ficha</button>
      </BarraFiltros>} />
    {sp.fichas !== undefined && admin && <p role="status" className="rounded-lg bg-vx-verde-claro p-3 text-sm">
      Importação concluída. {Number(sp.clientes)} novos cadastros, {Number(sp.fichas)} fichas e {Number(sp.contas)} contas de anúncios.
      {Number(sp.revisar) > 0 && ` Cadastros para revisar: ${Number(sp.revisar)}.`}
    </p>}
    {sp.erro === 'importar' && <Aviso tom="erro">Não foi possível importar. Confira o arquivo e o acesso de direção.</Aviso>}
    {sp.resultado === 'salvo' && <p role="status" className="rounded-lg bg-vx-verde-claro p-3 text-sm">Registro salvo.</p>}
    {sp.resultado && sp.resultado !== 'salvo' && <Aviso tom="erro">{sp.resultado === 'conflito' ? 'A ficha foi atualizada por outra pessoa. Revise a versão mais recente.' : 'Não foi possível salvar. Confira os dados e a associação da conta ao cliente.'}</Aviso>}
    <Secao titulo={cliente?.nome ?? 'Vendax'}>
      {ficha ? <div className="space-y-3 px-2 py-3">
        <p className="text-sm text-vx-texto-2">{ficha.situacao} · versão {ficha.versao} · {ficha.data_fonte}</p>
        <p className="whitespace-pre-wrap leading-relaxed">{ficha.texto}</p>
        <p className="text-sm text-vx-texto-2">{ficha.fonte}</p>
      </div> : <Vazio>Ficha ainda sem contexto registrado.</Vazio>}
      {admin && <details className="m-2 rounded-lg border border-vx-linha p-3">
        <summary className="cursor-pointer font-semibold">Editar ficha</summary>
        <form action={acaoSalvarFicha} className="mt-3 grid gap-3">
          <input name="cliente" value={cliente?.id ?? ''} type="hidden" />
          <input name="versao" value={ficha?.versao ?? 0} type="hidden" />
          {cliente ? <label>Situação <select name="situacao" className={campo} defaultValue={ficha?.situacao ?? 'Ativo'}>
            {situacoes.map(s => <option key={s}>{s}</option>)}
          </select></label> : <input type="hidden" name="situacao" value="Vendax" />}
          <label className="grid gap-1">Contexto operacional<textarea name="texto" required minLength={20} maxLength={6500} rows={12} className={campo} defaultValue={ficha?.texto} /></label>
          <label className="grid gap-1">Fonte<input name="fonte" required minLength={3} maxLength={300} className={campo} defaultValue={ficha?.fonte} /></label>
          <label>Data da fonte <input name="data_fonte" type="date" required className={campo} defaultValue={ficha?.data_fonte} /></label>
          <div><button className={botao}>Salvar ficha</button></div>
        </form>
      </details>}
    </Secao>
    {cliente && <Secao titulo="Contas de anúncios" total={contas.length}>
      {contas.length ? <ul className="divide-y divide-vx-linha">
        {contas.map(a => <li key={`${a.plataforma}:${a.conta_id}`} className="space-y-1 p-3">
          <p className="font-medium">{a.plataforma === 'google_ads' ? 'Google Ads' : 'Meta Ads'} · {a.nome}</p>
          <p className="text-sm">{a.conta_id} · {ROTULOS[a.situacao]}</p>
          <p className="text-sm text-vx-texto-2">{a.data_fonte} · {a.fonte}</p>
        </li>)}
      </ul> : <Vazio>Sem contas vinculadas nesta ficha.</Vazio>}
      {admin && <details className="m-2 rounded-lg border border-vx-linha p-3">
        <summary className="cursor-pointer font-semibold">Vincular ou atualizar conta</summary>
        <form action={acaoSalvarConta} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="cliente" type="hidden" value={cliente.id} />
          <label className="grid gap-1">Plataforma<select name="plataforma" className={campo}><option value="google_ads">Google Ads</option><option value="meta_ads">Meta Ads</option></select></label>
          <label className="grid gap-1">ID da conta<input name="conta_id" className={campo} required maxLength={32} /></label>
          <label className="grid gap-1">Identificação da conta<input name="nome" className={campo} required minLength={2} maxLength={120} /></label>
          <label className="grid gap-1">Uso da conta<select name="situacao" className={campo} defaultValue="verificar">
            {Object.entries(ROTULOS).map(([k, v]) => <option value={k} key={k}>{v}</option>)}
          </select></label>
          <label className="grid gap-1">Fonte<input name="fonte" className={campo} required minLength={3} maxLength={300} /></label>
          <label className="grid gap-1">Data da fonte<input name="data_fonte" type="date" className={campo} required /></label>
          <div><button className={botao}>Salvar conta</button></div>
        </form>
      </details>}
    </Secao>}
    {admin && !cliente && <Secao titulo="Importar carteira">
      <details className="m-2 rounded-lg border border-vx-linha p-3">
        <summary className="cursor-pointer font-semibold">Importar fichas em lote</summary>
        <form action={acaoImportarCarteira} className="mt-3 grid gap-3">
          <label className="grid gap-1">Conteúdo do arquivo de importação<textarea name="carteira" className={campo} rows={6} maxLength={179999} required /></label>
          <p className="text-sm text-vx-texto-2">Cria cadastros e vínculos ausentes e preserva fichas já registradas.</p>
          <div><button className={botao}>Importar memória</button></div>
        </form>
      </details>
    </Secao>}
  </div>;
}
