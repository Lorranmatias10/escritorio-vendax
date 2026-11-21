import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { query, type HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { adaptadorClaude } from '../lib/claude';
import { SaidaAgente, type EntradaAgente } from '../lib/ia';
import { FLUXOS_CLAUDE } from '../lib/skills-claude';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: vi.fn() }));

const pedido: EntradaAgente = {
  papel_id: 'midia_paga', etapa: 'analisar', instrucao_operacional: 'Audite a campanha fictícia.',
  conteudo_recuperado: [{ fonte: 'Dados anexados à tarefa', texto: 'Oito contatos.' }],
  contexto: { fluxo_claude: 'google_ads', dono_nome: 'Responsável fictício' },
};
const rascunho = {
  resumo: 'Resumo', afirmacoes: [], fontes: [{ nome: 'Fonte externa inventada', disponivel: true }], lacunas: [],
  rascunho: 'Conferir a conversão.', efeito_confirmado: 'Efeito alegado pelo modelo', trilha: 'concluido',
  proxima_acao: 'Revisar o rascunho', papel_destino: null, responsavel_humano: 'Responsável fictício', condicao_conclusao: 'Revisão interna',
};

describe('Claude por especialidade', () => {
  let pasta: string;
  beforeEach(async () => {
    vi.resetAllMocks();
    pasta = await mkdtemp(join(tmpdir(), 'vendax-claude-teste-'));
    for (const fluxo of [FLUXOS_CLAUDE.google_ads, FLUXOS_CLAUDE.meta_ads]) {
      for (const nome of fluxo.skills) {
        await mkdir(join(pasta, nome));
        await writeFile(join(pasta, nome, 'SKILL.md'), `---\nname: ${nome}\ndescription: Skill fictícia.\n---\n`);
      }
    }
  });
  afterEach(() => rm(pasta, { recursive: true, force: true }));

  function sdkParaGoogle() {
    vi.mocked(query).mockImplementation(({ options }) => {
      async function* resposta() {
        const opt = options!;
        expect(opt.skills).toEqual([]);
        expect(opt.tools).toEqual(['Read']);
        expect(opt.mcpServers).toEqual({});
        for (const skill of FLUXOS_CLAUDE.google_ads.skills) {
          expect(opt.systemPrompt).toContain(`name: ${skill}\ndescription: Skill fictícia.`);
        }
        for (const skill of FLUXOS_CLAUDE.meta_ads.skills) expect(opt.systemPrompt).not.toContain(skill);
        const pre = opt.hooks!.PreToolUse![0].hooks[0];
        const contexto = { signal: new AbortController().signal };
        const preInvalido = { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: '/var/fora-do-pacote.txt' } } as Parameters<HookCallback>[0];
        expect(await pre(preInvalido, 'teste', contexto)).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
        yield { type: 'result', subtype: 'success', structured_output: rascunho };
      }
      return resposta() as ReturnType<typeof query>;
    });
  }

  it('carrega as duas Skills corretas e só registra fontes fornecidas em A1', async () => {
    sdkParaGoogle();
    const adaptador = await adaptadorClaude(pedido.papel_id, 'chave-ficticia', {}, pasta);
    const saida = SaidaAgente.parse(await adaptador.executar(pedido, null, 1));
    expect(saida.trilha).toBe('preparado');
    expect(saida.efeito_confirmado).toBeNull();
    expect(saida.fontes.map(f => f.nome)).toEqual(FLUXOS_CLAUDE.google_ads.skills.map(nome => `Skill: ${nome}`));
  });

  it('recusa a execução quando o outro especialista foi selecionado ou uma Skill não carregou', async () => {
    const adaptador = await adaptadorClaude(pedido.papel_id, 'chave-ficticia', {}, pasta);
    await expect(adaptador.executar({ ...pedido, contexto: { fluxo_claude: 'nextags' } }, null, 1)).rejects.toThrow('especialidade');
    expect(query).not.toHaveBeenCalled();
    await rm(join(pasta, 'adspirer-google-ads', 'SKILL.md'));
    const incompleto = await adaptadorClaude(pedido.papel_id, 'chave-ficticia', {}, pasta);
    await expect(incompleto.executar(pedido, null, 1)).rejects.toThrow('pacote das Skills');
    expect(query).not.toHaveBeenCalled();
  });

  it('muda a identidade homologada quando a referência muda', async () => {
    const antes = await adaptadorClaude(pedido.papel_id, 'chave-ficticia', {}, pasta);
    await writeFile(join(pasta, 'adspirer-google-ads', 'referencia.md'), 'Atualização da referência.');
    const depois = await adaptadorClaude(pedido.papel_id, 'chave-ficticia', {}, pasta);
    expect(antes.provedor).not.toBe(depois.provedor);
  });
});
