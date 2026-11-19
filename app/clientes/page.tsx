import Link from 'next/link';
import { contexto } from '@/lib/sessao';
import { clientesVisiveis, listarTarefas, listarEntregas, listarIncidentes, usuarios } from '@/lib/dados';
import { ESTADOS_TAREFA, ROTULO_ESTADO_TAREFA, type EstadoTarefa } from '@/lib/catalogo';
import { LinhaTarefa, Secao, Vazio, Demo, Prazo, campo, botao, Cabecalho, BarraFiltros, CampoFiltro, link, chip, Aviso } from '@/components/ui';
import { acaoCriarCliente } from '@/app/acoes';

const ERRO_CLIENTE: Record<string, string> = { nome: 'Informe o nome do cliente (pelo menos 2 letras).', duplicado: 'Já existe um cliente com esse nome.' };

const data = /^\d{4}-\d{2}-\d{2}$/;
const ENTREGA: Record<string, [string, string]> = {
  planejada: ['Planejada', 'border-vx-linha-forte bg-white'], em_andamento: ['Em andamento', 'border-vx-info/25 bg-vx-info-claro text-vx-info'],
  entregue: ['Entregue', 'border-vx-verde/25 bg-vx-verde-claro text-vx-verde-escuro'], atrasada: ['Atrasada', 'border-vx-erro/25 bg-vx-erro-claro text-vx-erro'],
};
const INCIDENTE: Record<string, string> = { aberto: 'Aberto', em_tratamento: 'Em tratamento', resolvido: 'Resolvido' };

export default async function Clientes({ searchParams }: PageProps<'/clientes'>) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { b, u } = await contexto();
  const [clientes, pessoas] = await Promise.all([clientesVisiveis(b, u), usuarios(b)]);
  // Filtros validados: cliente só entre os permitidos (o escopo também é aplicado na consulta).
  const f = {
    cliente: clientes.some(c => c.id === sp.cliente) ? sp.cliente : undefined,
    estado: ESTADOS_TAREFA.includes(sp.estado as EstadoTarefa) ? sp.estado : undefined,
    dono: pessoas.some(p => p.id === sp.dono) ? sp.dono : undefined,
    de: data.test(sp.de ?? '') ? sp.de : undefined,
    ate: data.test(sp.ate ?? '') ? sp.ate : undefined,
  };
  const filtrado = Object.values(f).some(Boolean);
  const [tarefas, entregas, incidentes] = await Promise.all([
    listarTarefas(b, u, { ...f, raiz: false }).then(ts => ts.filter(t => t.cliente_id)),
    listarEntregas(b, u, { cliente: f.cliente, de: f.de, ate: f.ate }),
    listarIncidentes(b, u, { cliente: f.cliente }),
  ]);
  return (
    <div className="space-y-5">
      {sp.ok === 'cliente' && <p role="status" className="rounded-lg border border-vx-verde/30 bg-vx-verde-claro px-3 py-2.5 text-sm"><span aria-hidden className="mr-1.5 font-bold">✓</span>Cliente cadastrado. Libere o acesso da equipe em <Link href="/usuarios" className={link}>Usuários</Link>.</p>}
      {sp.erro && ERRO_CLIENTE[sp.erro] && <Aviso tom="erro">{ERRO_CLIENTE[sp.erro]}</Aviso>}
      <Cabecalho titulo="Clientes"
        acoes={u.perfil === 'admin' && (
          <form action={acaoCriarCliente} className="flex flex-wrap items-center gap-2">
            <label htmlFor="novo-cliente" className="sr-only">Nome do novo cliente</label>
            <input id="novo-cliente" name="nome" required minLength={2} maxLength={120} placeholder="Nome do novo cliente" className={`${campo} w-56`} />
            <button className={botao}>Cadastrar cliente</button>
          </form>
        )}
        descricao={<>Tarefas, entregas e incidentes dos {clientes.length} cliente(s) que <strong className="font-semibold text-vx-grafite">{u.nome}</strong> pode acessar.</>}
        filtros={
          <BarraFiltros action="/clientes">
            <CampoFiltro rotulo="Cliente">
              <select name="cliente" defaultValue={f.cliente ?? ''} className={campo}>
                <option value="">Todos os permitidos</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </CampoFiltro>
            <CampoFiltro rotulo="Estado">
              <select name="estado" defaultValue={f.estado ?? ''} className={campo}>
                <option value="">Todos</option>
                {ESTADOS_TAREFA.map(e => <option key={e} value={e}>{ROTULO_ESTADO_TAREFA[e]}</option>)}
              </select>
            </CampoFiltro>
            <CampoFiltro rotulo="Responsável">
              <select name="dono" defaultValue={f.dono ?? ''} className={campo}>
                <option value="">Todos</option>
                {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </CampoFiltro>
            <CampoFiltro rotulo="De"><input type="date" name="de" defaultValue={f.de} className={campo} /></CampoFiltro>
            <CampoFiltro rotulo="Até"><input type="date" name="ate" defaultValue={f.ate} className={campo} /></CampoFiltro>
            <button className={botao}>Aplicar filtros</button>
            {filtrado && <Link href="/clientes" className={`${link} self-center px-1 text-sm`}>Limpar</Link>}
          </BarraFiltros>
        } />
      {clientes.length === 0 && <div className="rounded-lg border border-vx-linha bg-vx-superficie"><Vazio>{u.perfil === 'admin' ? 'Nenhum cliente cadastrado. Use “Cadastrar cliente” acima para começar.' : 'Seu usuário ainda não tem clientes liberados. Peça acesso à direção.'}</Vazio></div>}
      <Secao titulo="Tarefas" total={tarefas.length} id="tarefas">
        {tarefas.length ? <ul>{tarefas.map(t => <LinhaTarefa key={t.id} t={t} />)}</ul>
          : <Vazio acao={filtrado && <Link href="/clientes" className={link}>Limpar filtros</Link>}>Nenhuma tarefa{filtrado ? ' com estes filtros' : ''}.</Vazio>}
      </Secao>
      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Entregas" total={entregas.length} id="entregas">
          {entregas.length ? (
            <ul className="divide-y divide-vx-linha">
              {entregas.map(e => (
                <li key={e.id} className="px-2 py-2.5">
                  <div className="flex items-start gap-2"><span className="flex-1 font-medium leading-snug">{e.titulo}</span><span className={`${chip} ${ENTREGA[e.estado]?.[1]}`}>{ENTREGA[e.estado]?.[0]}</span></div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-vx-texto-2">
                    <span>{e.cliente_nome}</span><span>Prazo <Prazo v={e.prazo} /></span>
                    {e.tarefa_id && <Link className={link} href={`/tarefas/${e.tarefa_id}`}>Abrir tarefa</Link>}<Demo ativo={e.demo} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <Vazio>Nenhuma entrega registrada{filtrado ? ' com estes filtros' : ''}.</Vazio>}
        </Secao>
        <Secao titulo="Incidentes" total={incidentes.length} id="incidentes">
          {incidentes.length ? (
            <ul className="divide-y divide-vx-linha">
              {incidentes.map(i => (
                <li key={i.id} className="px-2 py-2.5">
                  <div className="flex items-start gap-2"><span className="flex-1 font-medium leading-snug">{i.titulo}</span>
                    <span className={`${chip} ${i.severidade === 'alta' ? 'border-vx-erro/25 bg-vx-erro-claro text-vx-erro' : 'border-vx-alerta/25 bg-vx-alerta-claro text-vx-alerta'}`}>Severidade {i.severidade === 'media' ? 'média' : i.severidade}</span></div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-vx-texto-2"><span>{i.cliente_nome ?? 'Interno'}</span><span>{INCIDENTE[i.estado]}</span><Demo ativo={i.demo} /></div>
                </li>
              ))}
            </ul>
          ) : <Vazio>Nenhum incidente registrado{f.cliente ? ' para este cliente' : ''}.</Vazio>}
        </Secao>
      </div>
    </div>
  );
}
