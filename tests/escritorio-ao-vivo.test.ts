import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirBanco, type Banco } from '@/lib/db';
import { carregarUsuario } from '@/lib/escopo';
import { atividadeAgentes, enviarMensagemChat, listarMensagensChat } from '@/lib/escritorio-ao-vivo';
import { adaptadorSimulado } from '@/lib/ia';
import { processarFila, receberEventoReuniao } from '@/lib/orquestracao';

describe('Escritório ao vivo', () => {
  let b: Banco;
  beforeAll(async () => { b = await abrirBanco({ isolado: true }); });
  afterAll(async () => { await b.fechar(); });
  const u = async (id: string) => (await carregarUsuario(b, id))!;

  it('entrega mensagens gerais a toda a equipe e reserva as privadas aos participantes', async () => {
    const [tiago, fabiana, ligia, lorran] = await Promise.all(['tiago', 'fabiana', 'ligia', 'lorran'].map(u));
    const canal = await enviarMensagemChat(b, tiago, { destinatario: null, requisicao: randomUUID(), corpo: 'Alinhamento do dia' });
    const direta = await enviarMensagemChat(b, lorran, { destinatario: 'fabiana', requisicao: randomUUID(), corpo: 'Conversa privada' });
    expect(await listarMensagensChat(b, ligia, null)).toEqual([canal]);
    expect(await listarMensagensChat(b, fabiana, 'lorran')).toEqual([direta]);
    expect(await listarMensagensChat(b, lorran, 'fabiana')).toEqual([direta]);
    expect(await listarMensagensChat(b, tiago, 'fabiana')).toEqual([]);
    expect(await listarMensagensChat(b, ligia, 'lorran')).toEqual([]);
  });

  it('mantém um único registro em tentativas repetidas e pagina o histórico', async () => {
    const tiago = await u('tiago');
    const entrada = { destinatario: null, requisicao: randomUUID(), corpo: '  Um envio  ' };
    const [a, bmsg] = await Promise.all([enviarMensagemChat(b, tiago, entrada), enviarMensagemChat(b, tiago, entrada)]);
    expect(a.id).toBe(bmsg.id);
    expect(a.corpo).toBe('Um envio');
    expect((await listarMensagensChat(b, tiago, null)).filter(m => m.id === a.id)).toHaveLength(1);
    expect((await listarMensagensChat(b, tiago, null, a.id)).every(m => BigInt(m.id) < BigInt(a.id))).toBe(true);
    await expect(enviarMensagemChat(b, tiago, { ...entrada, destinatario: 'fabiana' })).rejects.toThrow();
    await expect(enviarMensagemChat(b, tiago, { ...entrada, destinatario: 'tiago' })).rejects.toThrow();
    await expect(enviarMensagemChat(b, tiago, { ...entrada, corpo: ' ' })).rejects.toThrow();
  });

  it('registra quem passou a tarefa e aplica o escopo de clientes às transições', async () => {
    const [tiago, lorran] = await Promise.all([u('tiago'), u('lorran')]);
    await receberEventoReuniao(b, tiago, { id: `teste-${randomUUID()}`, cliente_id: 'aurora', titulo: 'Planejamento fictício', dono_id: 'fabiana',
      transcricao: 'Fabiana: A landing page é a próxima entrega.\nCliente: Podemos revisar na sexta?', prazo: '2026-11-26', demo: true });
    await processarFila(b, adaptadorSimulado);
    const atividade = await atividadeAgentes(b, tiago);
    expect(atividade).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: 'execucao_iniciada', de: 'gerente_contas' }),
      expect.objectContaining({ tipo: 'delegada', de: 'gerente_contas', para: 'auditor_qualidade' }),
      expect.objectContaining({ tipo: 'delegada', de: 'auditor_qualidade', para: 'diretor_operacoes' }),
    ]));
    expect(await atividadeAgentes(b, lorran)).toEqual([]);
  });
});
