'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { acaoEnviarAoEspecialista } from '@/app/acoes';
import type { TurnoEspecialista } from '@/lib/chat-especialistas';
import { FLUXOS_CLAUDE, type FluxoClaude } from '@/lib/skills-claude';
import { Icone } from './nav';

type Props = {
  visivel: boolean; conectado: boolean; turnos: TurnoEspecialista[];
  especialistas: FluxoClaude[]; especialista: FluxoClaude | ''; mudarEspecialista: (id: FluxoClaude | '') => void;
  clientes: { id: string; nome: string }[]; cliente: string; mudarCliente: (id: string) => void;
};

const horario = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dataSaoPaulo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' });
function periodoPadrao() {
  const hoje = Date.parse(dataSaoPaulo.format(new Date()));
  return { inicio: new Date(hoje - 30 * 86_400_000).toISOString().slice(0, 10), fim: new Date(hoje - 86_400_000).toISOString().slice(0, 10) };
}
const aguardando = { na_fila: 'Na fila', em_execucao: 'Preparando o rascunho', bloqueada: 'Pedido bloqueado', falhou: 'Falha na análise', cancelada: 'Pedido cancelado', aguardando_aprovacao: 'Aguardando revisão', concluida: 'Concluída' };

export function ChatEspecialistas({ visivel, conectado, turnos, especialistas, especialista, mudarEspecialista, clientes, cliente, mudarCliente }: Props) {
  const [mensagem, setMensagem] = useState('');
  const [dados, setDados] = useState('');
  const [buscarAds, setBuscarAds] = useState(true);
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviados, setEnviados] = useState<{ chave: string; turno: TurnoEspecialista }[]>([]);
  const log = useRef<HTMLDivElement>(null);
  const acompanhar = useRef(true);
  const enviou = useRef(false);
  const nonce = useRef<{ assinatura: string; id: string } | null>(null);
  const chave = JSON.stringify([especialista, cliente]);
  const eAds = especialista === 'google_ads' || especialista === 'meta_ads';
  const atual = especialista && FLUXOS_CLAUDE[especialista];
  const pronto = especialista !== '' && especialistas.includes(especialista) && clientes.some(c => c.id === cliente);
  const historico = [...new Map([...enviados.filter(x => x.chave === chave).map(x => x.turno), ...turnos].map(t => [t.id, t])).values()]
    .sort((a, b) => new Date(a.pedido_em).getTime() - new Date(b.pedido_em).getTime()).slice(-30);
  const ultimo = historico.at(-1);

  useLayoutEffect(() => {
    if (visivel && acompanhar.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [ultimo?.id, ultimo?.resposta, visivel]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const texto = mensagem.trim();
    if (!pronto || texto.length < 3 || enviou.current) return;
    const consulta_ads = eAds && buscarAds ? periodo : undefined;
    const dias = (Date.parse(periodo.fim) - Date.parse(periodo.inicio)) / 86_400_000;
    if (consulta_ads && !(dias >= 0 && dias <= 89)) {
      setErro('Confira as datas e selecione um período de até 90 dias.');
      return;
    }
    const assinatura = JSON.stringify([chave, texto, dados.trim(), consulta_ads]);
    const id = nonce.current?.assinatura === assinatura ? nonce.current.id : crypto.randomUUID();
    nonce.current = { assinatura, id };
    enviou.current = true;
    setEnviando(true);
    setErro('');
    try {
      const tarefa = await acaoEnviarAoEspecialista({ id, fluxo: especialista, cliente, mensagem: texto, dados, consulta_ads });
      acompanhar.current = true;
      setEnviados(v => [...v.filter(x => x.turno.id !== tarefa).slice(-29), {
        chave, turno: { id: tarefa, mensagem: texto, pedido_em: new Date().toISOString(), resposta_em: null, resposta: null, estado: 'na_fila' },
      }]);
      nonce.current = null;
      setMensagem('');
      setDados('');
    } catch {
      setErro('O pedido não pôde ser enviado. Tente novamente.');
    } finally { setEnviando(false); enviou.current = false; }
  }

  return (
    <section className="vx-painel-secao vx-chat" id="chat-especialistas" hidden={!visivel} aria-labelledby="titulo-chat-especialistas">
      <div className="vx-painel-cabecalho">
        <h2 id="titulo-chat-especialistas">Chat com especialistas</h2>
        <div className="vx-chat-especialista-filtros">
          <label className="vx-chat-canal">Especialidade
            <select value={especialista} disabled={enviando || !especialistas.length} onChange={e => { setErro(''); mudarEspecialista(e.target.value as FluxoClaude | ''); }}>
              {!especialistas.length && <option value="">Sem especialistas disponíveis</option>}
              {especialistas.map(id => <option key={id} value={id}>{FLUXOS_CLAUDE[id].nome}</option>)}
            </select>
          </label>
          <label className="vx-chat-canal">Cliente
            <select value={cliente} disabled={enviando || !clientes.length} onChange={e => { setErro(''); mudarCliente(e.target.value); }}>
              <option value="">Selecione um cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
        </div>
        {cliente && <Link className="text-xs text-vx-verde-escuro underline" href={`/clientes/memoria?cliente=${encodeURIComponent(cliente)}`}>Ver ficha do cliente</Link>}
      </div>
      <div className="vx-chat-log" ref={log} role="log" aria-label="Conversa com o especialista" onScroll={e => {
        const n = e.currentTarget;
        acompanhar.current = n.scrollHeight - n.scrollTop - n.clientHeight < 72;
      }}>
        {historico.length === 0 && <div className="vx-painel-vazio"><Icone nome="agentes" />
          <strong>{!especialistas.length ? 'Nenhum especialista disponível' : !clientes.length ? 'Nenhum cliente disponível para seu acesso' : !pronto ? 'Selecione um cliente para conversar' : !conectado ? 'Conectando ao chat' : 'Envie o primeiro pedido'}</strong>
          {pronto && conectado && <p>As respostas chegam aqui como rascunhos para sua revisão.</p>}
        </div>}
        {historico.map(t => <div key={t.id} className="vx-turno-especialista">
          <article className="vx-mensagem" data-minha="true"><div><header><strong>Você</strong><time>{horario.format(new Date(t.pedido_em))}</time></header><p>{t.mensagem}</p></div></article>
          {t.resposta && <article className="vx-mensagem"><span className="vx-chat-avatar" aria-hidden><Icone nome="agentes" /></span>
            <div><header><strong>{atual ? atual.nome : 'Especialista'}</strong>{t.resposta_em && <time>{horario.format(new Date(t.resposta_em))}</time>}</header><p>{t.resposta}</p></div>
          </article>}
          <p className="vx-chat-pedido-status"><span>{aguardando[t.estado]}</span><Link href={`/tarefas/${t.id}`}>Ver tarefa</Link></p>
        </div>)}
      </div>
      {pronto && <form className="vx-chat-editor vx-chat-especialista-editor" onSubmit={enviar}>
        {eAds && <details>
          <summary>{buscarAds ? 'Consultar dados da conta principal' : 'Consulta da conta desativada'}</summary>
          <label className="flex items-center gap-2"><input type="checkbox" checked={buscarAds} onChange={e => setBuscarAds(e.target.checked)} />Consultar campanhas e métricas</label>
          {buscarAds && <div className="grid grid-cols-2 gap-2">
            <label className="grid">De<input type="date" required value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} /></label>
            <label className="grid">Até<input type="date" required value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} /></label>
          </div>}
        </details>}
        <details><summary>Adicionar dados ao pedido</summary><textarea aria-label="Dados para o especialista" rows={2} maxLength={20000} value={dados} onChange={e => setDados(e.target.value)} /></details>
        {erro && <p className="vx-chat-erro" role="alert">{erro}</p>}
        <div>
          <textarea aria-label="Pedido ao especialista" rows={2} placeholder="Digite seu pedido" maxLength={2000} value={mensagem} onChange={e => setMensagem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
          <button type="submit" aria-label="Enviar pedido" title="Enviar pedido" disabled={mensagem.trim().length < 3 || enviando}><Icone nome="enviar" /></button>
        </div>
      </form>}
    </section>
  );
}
