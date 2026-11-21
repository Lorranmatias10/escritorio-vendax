'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { acaoEnviarAoDiretor } from '@/app/acoes';
import type { AutonomiaDiretor, TurnoDiretor } from '@/lib/diretor';
import { STATUS_CLIENTE, type StatusCliente } from '@/lib/ficha-cliente';
import { ROTULO_ESTADO_TAREFA } from '@/lib/catalogo';
import { Icone } from './nav';

const autonomia = {
  responder: { nome: 'Só responder', ajuda: 'Usa a conversa e a memória já disponível.' },
  delegar: { nome: 'Delegar e consultar', ajuda: 'Aciona especialistas e consulta fontes autorizadas.' },
  executar: { nome: 'Executar no Escritório', ajuda: 'Também registra e atribui tarefas internas quando o pedido exigir.' },
} satisfies Record<AutonomiaDiretor, { nome: string; ajuda: string }>;

const horario = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
type Props = {
  visivel: boolean; conectado: boolean; turnos: TurnoDiretor[];
  clientes: { id: string; nome: string; status: StatusCliente | null }[]; cliente: string; mudarCliente: (id: string) => void;
};

export function ChatDiretor({ visivel, conectado, turnos, clientes, cliente, mudarCliente }: Props) {
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<AutonomiaDiretor>('delegar');
  const [erro, setErro] = useState('');
  const [envio, setEnvio] = useState<{ id: string; texto: string } | null>(null);
  const [enviados, setEnviados] = useState<{ cliente: string; turno: TurnoDiretor }[]>([]);
  const pendente = useRef<{ assinatura: string; id: string } | null>(null);
  const bloqueado = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const acompanhar = useRef(true);
  const historico = [...new Map([...enviados.filter(t => t.cliente === cliente).map(t => t.turno), ...turnos].map(t => [t.id, t])).values()]
    .sort((a, b) => new Date(a.pedido_em).getTime() - new Date(b.pedido_em).getTime()).slice(-30);
  const ultimo = historico.at(-1);
  const ultimoEstado = ultimo?.especialistas.map(e => e.estado).join(',');

  useLayoutEffect(() => {
    if (visivel && acompanhar.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [ultimo?.id, ultimo?.resposta, ultimo?.estado, ultimoEstado, envio?.id, visivel, cliente]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const mensagem = texto.trim();
    if (mensagem.length < 3 || bloqueado.current) return;
    const assinatura = JSON.stringify([cliente, mensagem, modo]);
    const id = pendente.current?.assinatura === assinatura ? pendente.current.id : crypto.randomUUID();
    pendente.current = { assinatura, id };
    bloqueado.current = true;
    acompanhar.current = true;
    setEnvio({ id, texto: mensagem });
    setErro('');
    try {
      const tarefa = await acaoEnviarAoDiretor({ id, cliente: cliente || null, mensagem, autonomia: modo });
      acompanhar.current = true;
      setEnviados(a => [...a.filter(t => t.turno.id !== tarefa).slice(-29),
        { cliente, turno: { id: tarefa, mensagem, resposta: null, estado: 'na_fila', pedido_em: new Date().toISOString(),
          resposta_em: null, bloqueio: null, especialistas: [] } }]);
      setTexto(atual => atual.trim() === mensagem ? '' : atual);
      pendente.current = null;
    } catch {
      setErro('O pedido não pôde ser enviado. Confira seu acesso ao cliente e tente novamente.');
    } finally { setEnvio(null); bloqueado.current = false; }
  }

  return <section className="vx-painel-secao vx-chat" id="chat-diretor" hidden={!visivel} aria-labelledby="titulo-chat-diretor">
    <div className="vx-painel-cabecalho">
      <h2 id="titulo-chat-diretor">Diretor Geral IA</h2>
      <label className="vx-chat-canal">Cliente ou operação
        <select value={cliente} disabled={!!envio} onChange={e => { setErro(''); acompanhar.current = true; mudarCliente(e.target.value); }}>
          <option value="">Operação interna da Vendax</option>
          {([[null,'Produtos próprios'], ...Object.entries(STATUS_CLIENTE)] as [StatusCliente | null,string][]).map(([status,label]) => {
            const grupo = clientes.filter(c => c.status === status && (status !== 'inativo' || mostrarInativos || c.id === cliente));
            return grupo.length > 0 && <optgroup key={status ?? 'vendax'} label={label}>{grupo.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</optgroup>;
          })}
        </select>
      </label>
      {clientes.some(c => c.status === 'inativo') && <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} /> Mostrar inativos
      </label>}
    </div>
    <div className="vx-chat-log" ref={log} role="log" aria-label="Conversa com o Diretor Geral" onScroll={e => {
      const n = e.currentTarget;
      acompanhar.current = n.scrollHeight - n.scrollTop - n.clientHeight < 72;
    }}>
      {historico.length === 0 && !envio && <div className="vx-painel-vazio"><Icone nome="agentes" />
        <strong>{conectado ? 'O que o time precisa resolver?' : 'Conectando ao Diretor'}</strong>
        {conectado && <p>{cliente ? 'Exemplo: compare Google Ads e Meta Ads nos últimos 30 dias.' : 'Selecione um cliente para pedir uma análise das contas dele.'}</p>}
      </div>}
      {historico.map(t => <div key={t.id} className="vx-turno-especialista">
        <article className="vx-mensagem" data-minha="true"><div>
          <header><strong>Você</strong><time dateTime={t.pedido_em}>{horario.format(new Date(t.pedido_em))}</time></header><p>{t.mensagem}</p>
        </div></article>
        {!cliente && t.cliente_nome && <p className="vx-diretor-andamento">{t.cliente_nome}</p>}
        {!t.resposta && (t.estado === 'na_fila' || t.estado === 'em_execucao') && (
          <p className="vx-diretor-andamento">
            {t.especialistas.some(s => s.estado === 'na_fila' || s.estado === 'em_execucao') ? 'Especialistas trabalhando'
              : t.especialistas.length ? 'Diretor consolidando as análises' : 'Diretor preparando a resposta'}
          </p>
        )}
        {t.especialistas.length > 0 && <details className="vx-diretor-entregas" open={!t.resposta}>
          <summary>Trabalho da equipe</summary>
          <ul className="vx-diretor-repasses" aria-label="Delegações">
            {t.especialistas.map(s => <li key={s.id}><div><Link href={`/tarefas/${s.id}`}>{s.nome}</Link>
              {!t.resposta && s.estado === 'concluida' && s.resumo && <p>{s.resumo}</p>}
            </div><span>{ROTULO_ESTADO_TAREFA[s.estado]}</span></li>)}
          </ul>
        </details>}
        {t.resposta && <article className="vx-mensagem"><span className="vx-chat-avatar" aria-hidden><Icone nome="agentes" /></span><div>
          <header><strong>Diretor Geral</strong>{t.resposta_em && <time dateTime={t.resposta_em}>{horario.format(new Date(t.resposta_em))}</time>}</header><p>{t.resposta}</p>
        </div></article>}
        {t.bloqueio && !t.resposta && <p className="vx-chat-erro">{t.estado === 'falhou' ? 'A execução falhou. Abra os detalhes para retomar.' : t.bloqueio}</p>}
        <p className="vx-chat-pedido-status">
          {t.estado !== 'na_fila' && t.estado !== 'em_execucao' && <span>{ROTULO_ESTADO_TAREFA[t.estado]}</span>}<Link href={`/tarefas/${t.id}`}>Ver pedido e evidências</Link></p>
      </div>)}
      {envio && <div className="vx-turno-especialista">
        <article className="vx-mensagem" data-minha="true"><div><header><strong>Você</strong></header><p>{envio.texto}</p></div></article>
        <p className="vx-diretor-andamento">Enviando</p>
      </div>}
    </div>
    <form className="vx-chat-editor vx-chat-especialista-editor" onSubmit={enviar}>
      {erro && <p className="vx-chat-erro" role="alert">{erro}</p>}
      <label className="vx-diretor-opcao">Autonomia
        <select value={modo} disabled={!!envio} aria-describedby="vx-autonomia-diretor" onChange={e => setModo(e.target.value as AutonomiaDiretor)}>
          {Object.entries(autonomia).map(([id, m]) => <option key={id} value={id}>{m.nome}</option>)}
        </select>
      </label>
      <p id="vx-autonomia-diretor" className="vx-diretor-ajuda">{autonomia[modo].ajuda}</p>
      <div><textarea aria-label="Pedido ao Diretor Geral" rows={2} maxLength={4000} placeholder="Digite seu pedido" value={texto} onChange={e => setTexto(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
        <button type="submit" aria-label="Enviar ao Diretor Geral" title="Enviar ao Diretor Geral" disabled={!!envio || texto.trim().length < 3}><Icone nome="enviar" /></button>
      </div>
    </form>
  </section>;
}
