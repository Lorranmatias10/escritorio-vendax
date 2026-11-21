import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contexto } from '@/lib/sessao';
import { auditoriaCliente, clientesVisiveis, usuarios } from '@/lib/dados';
import { contasDoCliente, obterFichaCliente, STATUS_CLIENTE } from '@/lib/ficha-cliente';
import { dataHora } from '@/lib/formato';
import { lerFicha, lerContas } from '@/lib/memoria-vendax';
import { Aviso, BarraFiltros, botao, Cabecalho, campo, CampoFiltro, link, Secao, Vazio } from '@/components/ui';
import { acaoImportarCarteira, acaoSalvarFicha } from '../memoria-acoes';

import { acaoFichaCliente } from '../ficha-acoes';
import { ContasFicha } from './contas';

const situacoes = ['Ativo', 'Projeto', 'Prospect', 'Inativo', 'Encerrado'];
const ROTULOS = { principal: 'Principal para consulta', historica: 'Histórica / alternativa', verificar: 'A confirmar' };
const ACOES_CADASTRO: Record<string, string> = {
  ficha_atualizada: 'atualizou a ficha',
  conta_criada: 'cadastrou o vínculo',
  conta_verificada: 'verificou o vínculo',
  conta_editada: 'editou o vínculo',
  conta_removida: 'removeu o vínculo',
};
const FILTRO = '/clientes/memoria';

export default async function Memoria({ searchParams }: PageProps<'/clientes/memoria'>) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { b, u } = await contexto();
  const clientes = (await clientesVisiveis(b, u)).filter(c => !c.demo);
  const cliente = clientes.find(c => c.id === sp.cliente);
  if (sp.cliente && !cliente) notFound();
  const admin = u.perfil === 'admin';
  const id = cliente?.id;
  const [ficha, legadas, cadastro, contas, auditoria, pessoas] = await Promise.all([
    lerFicha(b,u,id ?? null), id ? lerContas(b,u,id) : [], id ? obterFichaCliente(b,u,id) : null,
    id ? contasDoCliente(b,u,id) : [], id ? auditoriaCliente(b,u,id) : [], admin ? usuarios(b) : [],
  ]);
  return <div className="space-y-5">
    <Cabecalho titulo={cliente ? `Ficha · ${cliente.nome}` : "Memória operacional"}
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
    {(sp.resultado === 'salvo' || sp.resultado === 'verificado') && <p role="status" className="rounded-lg bg-vx-verde-claro p-3 text-sm">{sp.resultado === 'verificado' ? 'Vínculo verificado pela integração.' : 'Registro salvo.'}</p>}
    {sp.resultado && !['salvo','verificado'].includes(sp.resultado) && <Aviso tom="erro">{sp.resultado === 'conflito' ? 'A ficha foi atualizada por outra pessoa. Revise a versão mais recente.' : sp.resultado === 'verificacao' ? 'A integração não confirmou o vínculo. Confira o identificador e a conexão de leitura.' : 'Não foi possível salvar. Confira os dados, o acesso do responsável e os vínculos existentes.'}</Aviso>}
    {cadastro && <Secao titulo="Cadastro do cliente">
      <dl className="grid gap-2 p-3 text-sm sm:grid-cols-3">
        <div><dt className="text-vx-texto-2">Status</dt><dd>{cadastro.status ? STATUS_CLIENTE[cadastro.status] : 'Operação Vendax'}</dd></div>
        <div><dt className="text-vx-texto-2">Responsável</dt><dd>{cadastro.responsavel ?? 'A definir'}</dd></div>
        <div><dt className="text-vx-texto-2">Contato da operação</dt><dd>{[cadastro.contato_nome,cadastro.contato_whatsapp].filter(Boolean).join(' · ') || 'A definir'}</dd></div>
      </dl>
      {admin && <details className="m-2 rounded-lg border border-vx-linha p-3">
        <summary className="cursor-pointer font-semibold">Editar cadastro</summary>
        <form action={acaoFichaCliente} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="cliente" value={cadastro.id} />
          {cadastro.status && <label className="grid gap-1">Status<select name="status" className={campo} defaultValue={cadastro.status}>
            {Object.entries(STATUS_CLIENTE).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>}
          <label className="grid gap-1">Responsável<select name="responsavel_id" className={campo} defaultValue={cadastro.responsavel_id ?? ''}>
            <option value="">A definir</option>{pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select></label>
          <label className="grid gap-1">Nome do contato<input name="contato_nome" className={campo} defaultValue={cadastro.contato_nome ?? ''} maxLength={120} /></label>
          <label className="grid gap-1">WhatsApp do contato<input name="contato_whatsapp" className={campo} type="tel" placeholder="+55…" defaultValue={cadastro.contato_whatsapp ?? ''} /></label>
          <div><button className={botao}>Salvar cadastro</button></div>
        </form>
      </details>}
    </Secao>}
    {id && <ContasFicha cliente={id} contas={contas} admin={admin} />}
    {auditoria.length > 0 && <Secao titulo="Histórico do cadastro">
      <ul className="divide-y divide-vx-linha">{auditoria.map(a => <li key={a.id} className="px-3 py-2 text-sm">
        <span className="font-medium">{a.ator} {ACOES_CADASTRO[a.acao] ?? 'registrou uma alteração'}</span>
        {' · '}{a.detalhe} · {dataHora(a.criado_em)}
      </li>)}</ul>
    </Secao>}
    <Secao titulo={cliente ? "Contexto operacional" : "Vendax"}>
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
    {cliente && legadas.length > 0 && <Secao titulo="Referências de anúncios na memória">
      <p className="px-3 py-2 text-sm text-vx-texto-2">Histórico para conferência. A leitura do agente exige um vínculo verificado na ficha.</p>
      <ul className="divide-y divide-vx-linha">
        {legadas.map(a => <li key={`${a.plataforma}:${a.conta_id}`} className="space-y-1 p-3">
          <p className="font-medium">{a.plataforma === 'google_ads' ? 'Google Ads' : 'Meta Ads'} · {a.nome}</p>
          <p className="text-sm">{a.conta_id} · {ROTULOS[a.situacao]}</p>
          <p className="text-sm text-vx-texto-2">{a.data_fonte} · {a.fonte}</p>
        </li>)}
      </ul>
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
