import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { Aviso, botao, botaoSec, Cabecalho, campo, chip, link, Secao, Vazio } from '@/components/ui';
import { FREQUENCIAS, MODELOS_ROTINA } from '@/lib/agenda-rotinas';
import { catalogo, clientesVisiveis, historicoRotina, listarRotinas, usuarios } from '@/lib/dados';
import { FONTES_CLIENTE, STATUS_CLIENTE } from '@/lib/ficha-cliente';
import { dataHora } from '@/lib/formato';
import { rotinasLigadas } from '@/lib/orquestracao';
import { contexto } from '@/lib/sessao';
import { acaoAtivarRotina, acaoRodarRotina, acaoSalvarRotina } from './acoes';

const ERROS: Record<string,string> = {
  salvar: 'Confira o horário, o dia, as fontes e se o dono e o aprovador têm acesso ao escopo.',
  alterar: 'Não foi possível mudar o estado da rotina.',
  rodar: 'Não foi possível disparar a rotina.',
};
const RESULTADOS: Record<string,string> = {
  salva: 'Rotina salva.', alterada: 'Estado da rotina alterado.', disparo: 'Tarefa registrada na fila A1.',
  ignorada: 'A rotina não criou tarefa. Veja o histórico do disparo.',
};
const diasSemana = ['segunda','terça','quarta','quinta','sexta','sábado','domingo'];

export default async function Rotinas({ searchParams }: PageProps<'/rotinas'>) {
  const { b,u } = await contexto();
  if (u.perfil !== 'admin') notFound();
  const sp = (await searchParams) as Record<string,string | undefined>;
  const [rotinas,clientes,pessoas,{ papeis,deptos }] = await Promise.all([listarRotinas(b,u),clientesVisiveis(b,u),usuarios(b),catalogo(b)]);
  const selecionada = rotinas.find(r => r.id === sp.rotina);
  const atual = sp.editar === 'sim' ? selecionada : undefined;
  const modelo = MODELOS_ROTINA.find(m => m.id === sp.modelo);
  const exibirFormulario = Boolean(atual || modelo || sp.nova === 'sim');
  const configuracao = atual ?? modelo;
  const comercial = modelo?.id === 'follow-up' && sp.escopo !== 'cliente';
  const papelModelo = modelo?.id === 'follow-up' && !comercial ? 'crm_conversao' : modelo?.papel_id;
  const escopoAtual = atual?.cliente_id ? `cliente:${atual.cliente_id}` : atual?.area_interna ? `area:${atual.area_interna}` : comercial ? 'area:comercial' : '';
  const historico = selecionada ? await historicoRotina(b,u,selecionada.id) : [];
  const ligada = rotinasLigadas();
  return <div className="space-y-5">
    <Cabecalho titulo="Rotinas" descricao="Agendamentos em A1 · consulta e rascunho · horário de São Paulo."
      acoes={<Link href="/rotinas?nova=sim#configurar" className={botao}>Nova rotina</Link>} />
    {!ligada && <Aviso tom="alerta">Agendador geral desligado. Você pode configurar rotinas e horários.</Aviso>}
    {sp.erro && ERROS[sp.erro] && <Aviso tom="erro">{ERROS[sp.erro]}</Aviso>}
    {sp.ok && RESULTADOS[sp.ok] && <p role="status" className="rounded-lg bg-vx-verde-claro p-3 text-sm">{RESULTADOS[sp.ok]}</p>}
    <Secao titulo="Rotinas configuradas" total={rotinas.length}>
      {rotinas.length ? <ul className="divide-y divide-vx-linha">
        {rotinas.map(r => <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
          <div>
            <h3 className="font-semibold">{r.nome} <span className={chip}>{r.ativa ? 'Ligada' : 'Desligada'}</span></h3>
            <p className="text-sm">{r.papel} · {r.cliente ?? r.area}</p>
            <p className="text-sm text-vx-texto-2">
              {FREQUENCIAS[r.frequencia]}{r.dia ? ` · ${r.frequencia === 'semanal' ? diasSemana[r.dia - 1] : `dia ${r.dia}`}` : ''} · {r.hora.slice(0,5)}
              {' · '}Dono {r.dono} · Aprova {r.aprovador} · {r.fontes.map(f => FONTES_CLIENTE[f].nome).join(', ')}
            </p>
            <p className="text-sm text-vx-texto-2">Próxima {r.proxima_execucao ? dataHora(r.proxima_execucao) : '—'} · Última {r.ultima_execucao ? dataHora(r.ultima_execucao) : '—'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className={botaoSec} href={`/rotinas?rotina=${r.id}&editar=sim#configurar`}>Editar</Link>
            <Link className={botaoSec} href={`/rotinas?rotina=${r.id}#historico`}>Histórico</Link>
            <form action={acaoAtivarRotina}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="ativa" value={r.ativa ? 'nao' : 'sim'} />
              <button className={botaoSec}>{r.ativa ? 'Desligar' : 'Ligar'}</button>
            </form>
            <form action={acaoRodarRotina}><input type="hidden" name="id" value={r.id} />
              <button disabled={!ligada || !r.ativa} className={`${botaoSec} disabled:cursor-not-allowed disabled:opacity-50`}>Rodar agora</button>
            </form>
          </div>
        </li>)}
      </ul> : <Vazio>Nenhuma rotina configurada.</Vazio>}
    </Secao>
    <Secao titulo="Modelos de rotina">
      <div className="grid gap-3 p-3 md:grid-cols-3">
        {MODELOS_ROTINA.map(m => <article className="space-y-2 rounded-md border border-vx-linha p-3" key={m.id}>
          <h3 className="font-semibold">{m.nome}</h3>
          <p className="text-sm text-vx-texto-2">{m.frequencia === 'semanal' ? 'Segunda' : 'Diária'} · {m.hora} · Desligada</p>
          <p className="text-sm">{m.fontes.map(f => FONTES_CLIENTE[f].nome).join(', ')}</p>
          {m.id === 'follow-up' ? <div className="flex flex-wrap gap-3 text-sm">
            <Link className={link} href="/rotinas?modelo=follow-up#configurar">Comercial Vendax</Link>
            <Link className={link} href="/rotinas?modelo=follow-up&escopo=cliente#configurar">Por cliente</Link>
          </div> : <Link className={link} href={`/rotinas?modelo=${m.id}#configurar`}>Configurar</Link>}
        </article>)}
      </div>
    </Secao>
    {exibirFormulario && <Secao titulo={atual ? 'Editar rotina' : 'Configurar rotina'} id="configurar">
      <form action={acaoSalvarRotina} className="grid gap-3 p-3 sm:grid-cols-2">
        <input type="hidden" name="chave_dedup" value={atual?.chave_dedup ?? randomUUID()} />
        {atual && <input type="hidden" name="id" value={atual.id} />}
        <label className="grid gap-1">Nome<input name="nome" required minLength={3} maxLength={120} className={campo} defaultValue={configuracao?.nome} /></label>
        <label className="grid gap-1">Papel<select name="papel_id" required className={campo} defaultValue={atual?.papel_id ?? papelModelo ?? ''}>
          <option value="">Selecione o papel</option>{papeis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select></label>
        <label className="grid gap-1">Cliente ou área interna<select name="escopo" required className={campo} defaultValue={escopoAtual}>
          <option value="">Selecione o escopo</option>
          <optgroup label="Clientes">{clientes.filter(c => !c.demo && Boolean(c.status)).map(c =>
            <option key={c.id} value={`cliente:${c.id}`}>{c.nome} · {STATUS_CLIENTE[c.status!]}</option>)}</optgroup>
          <optgroup label="Áreas internas">{deptos.map(d => <option key={d.id} value={`area:${d.id}`}>{d.nome}</option>)}</optgroup>
        </select></label>
        <label className="flex items-center gap-2"><input type="checkbox" name="inclui_sazonal" defaultChecked={atual?.inclui_sazonal} /> Permitir disparos para cliente sazonal</label>
        {[['dono_id','Responsável',atual?.dono_id ?? u.id],['aprovador_id','Aprovador',atual?.aprovador_id ?? u.id]].map(([nome,rotulo,valor]) =>
          <label key={nome} className="grid gap-1">{rotulo}<select name={nome} required className={campo} defaultValue={valor}>
            {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select></label>)}
        <label className="grid gap-1 sm:col-span-2">Objetivo<textarea name="objetivo" required minLength={5} maxLength={4000} className={campo} rows={3} defaultValue={configuracao?.objetivo} /></label>
        <fieldset className="grid grid-cols-2 gap-2 sm:col-span-2">
          <legend className="mb-1 font-medium">Fontes a consultar</legend>
          {Object.entries(FONTES_CLIENTE).map(([k,v]) => <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="fontes" value={k} defaultChecked={configuracao?.fontes.some(f => f === k)} />{v.nome}
          </label>)}
        </fieldset>
        <label className="grid gap-1">Frequência<select name="frequencia" className={campo} defaultValue={configuracao?.frequencia ?? 'diaria'}>
          {Object.entries(FREQUENCIAS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
        <label className="grid gap-1">Hora<input name="hora" type="time" required className={campo} defaultValue={configuracao?.hora.slice(0,5) ?? '09:00'} /></label>
        <label className="grid gap-1">Dia<input name="dia" type="number" min={1} max={31} className={campo} defaultValue={configuracao?.dia ?? undefined} />
          <span className="text-xs text-vx-texto-2">Semanal: 1 para segunda, 7 para domingo. Mensal: dia do mês, limitado ao último dia. Diária: deixe em branco.</span>
        </label>
        <div className="flex items-end gap-2"><button className={botao}>Salvar rotina</button><Link className={botaoSec} href="/rotinas">Cancelar</Link></div>
      </form>
    </Secao>}
    {selecionada && <Secao titulo={`Histórico · ${selecionada.nome}`} id="historico">
      {historico.length ? <ul className="divide-y divide-vx-linha">
        {historico.map(h => <li key={h.id} className="px-3 py-2 text-sm">
          <p><strong>{h.estado === 'disparada' ? 'Disparada' : 'Ignorada'}</strong> · {dataHora(h.criado_em)} · {h.origem === 'agenda' ? 'Agenda' : 'Manual'} · Janela {h.janela}</p>
          <p>{h.motivo} {h.tarefa_id && <Link className={link} href={`/tarefas/${h.tarefa_id}`}>Abrir tarefa</Link>}</p>
        </li>)}
      </ul> : <Vazio>Sem disparos registrados.</Vazio>}
    </Secao>}
  </div>;
}
