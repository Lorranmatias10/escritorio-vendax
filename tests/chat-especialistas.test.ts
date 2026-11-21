import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { abrirBanco, type Banco } from '@/lib/db';
import { carregarUsuario } from '@/lib/escopo';
import { fluxosDisponiveis, historicoEspecialista } from '@/lib/chat-especialistas';
import { registrarChatEspecialista } from '@/lib/especialistas';
import { adaptadorDoPapel, type EntradaAgente } from '@/lib/ia';
import { processarFila } from '@/lib/orquestracao';

vi.mock('@/lib/ia', async importar => ({
  ...await importar<typeof import('@/lib/ia')>(),
  adaptadorDoPapel: vi.fn(),
}));

let banco: Banco;
const provedor = 'claude:teste:manual';
const executar = vi.fn(async (pedido: EntradaAgente) => ({
  resumo: 'Análise preparada', afirmacoes: [], fontes: [], lacunas: [],
  rascunho: 'Confira a conversão antes de otimizar.', efeito_confirmado: null, trilha: 'preparado',
  proxima_acao: 'Revisar o rascunho', papel_destino: null,
  responsavel_humano: pedido.contexto.dono_nome, condicao_conclusao: 'Revisão interna',
}));

beforeAll(async () => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'chave-ficticia');
  vi.mocked(adaptadorDoPapel).mockResolvedValue({ provedor, executar });
  banco = await abrirBanco({ isolado: true });
  await banco.query("insert into clientes (id, nome, demo) values ('teste-chat', 'Cliente de teste', false), ('outro-chat', 'Outro cliente', false)");
  await banco.query("insert into permissoes_cliente (usuario_id, cliente_id) values ('fabiana', 'teste-chat')");
  await banco.query("update papeis set execucao_habilitada = true, modo = 'A1', claude_homologado_com = $1 where id = 'midia_paga'", [provedor]);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await banco?.fechar();
});

it('registra um pedido, entrega o rascunho e aplica escopo por autor, cliente e especialidade', async () => {
  const fabiana = (await carregarUsuario(banco, 'fabiana'))!;
  const tiago = (await carregarUsuario(banco, 'tiago'))!;
  const pedido = { id: randomUUID(), fluxo: 'google_ads' as const, cliente: 'teste-chat', mensagem: 'Como reviso a campanha?\nConfira cada conversão.', dados: 'Dados fictícios' };
  expect(await fluxosDisponiveis(banco)).toEqual(['google_ads', 'meta_ads']);
  await expect(registrarChatEspecialista(banco, fabiana, { ...pedido, cliente: 'outro-chat' })).rejects.toThrow('Sem acesso');
  const id = await registrarChatEspecialista(banco, fabiana, pedido);
  expect(await registrarChatEspecialista(banco, fabiana, pedido)).toBe(id);
  expect(await historicoEspecialista(banco, fabiana, pedido)).toEqual([expect.objectContaining({ id, estado: 'na_fila', mensagem: pedido.mensagem, resposta: null })]);
  await processarFila(banco, undefined, 1, id);
  expect(executar).toHaveBeenCalledTimes(1);
  expect(executar.mock.calls[0][0].instrucao_operacional).toContain(pedido.mensagem);
  expect(await historicoEspecialista(banco, fabiana, pedido)).toEqual([
    expect.objectContaining({ id, estado: 'aguardando_aprovacao', mensagem: pedido.mensagem, resposta: 'Confira a conversão antes de otimizar.' }),
  ]);
  expect(await historicoEspecialista(banco, tiago, pedido)).toEqual([]);
  expect(await historicoEspecialista(banco, fabiana, { ...pedido, fluxo: 'meta_ads' })).toEqual([]);
  expect(await historicoEspecialista(banco, { ...fabiana, clientes: [] }, pedido)).toEqual([]);

  const retorno = await registrarChatEspecialista(banco, fabiana, { ...pedido, id: randomUUID(), mensagem: 'Como priorizo as conversões?' });
  await processarFila(banco, undefined, 1, retorno);
  expect(executar.mock.calls[1][0].conteudo_recuperado).toEqual(expect.arrayContaining([
    expect.objectContaining({ fonte: 'Histórico recente deste chat', texto: expect.stringContaining(pedido.mensagem) }),
  ]));
  const outro = await registrarChatEspecialista(banco, tiago, { ...pedido, id: randomUUID() });
  await processarFila(banco, undefined, 1, outro);
  expect(executar.mock.calls[2][0].conteudo_recuperado.map(f => f.fonte)).toEqual(['Dados anexados à tarefa']);
});
