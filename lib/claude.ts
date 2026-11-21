import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, relative } from 'node:path';
import { query, type HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { fluxoClaude, fluxoDoPapel, FLUXOS_CLAUDE_IDS, FLUXOS_CLAUDE } from './skills-claude';
import type { AdaptadorModelo, SaidaAgente } from './ia';

async function arquivosSkill(pasta: string): Promise<string[]> {
  const itens = await readdir(pasta, { withFileTypes: true });
  const arquivos: string[] = [];
  for (const item of itens.sort((a, b) => a.name.localeCompare(b.name))) {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) arquivos.push(...await arquivosSkill(caminho));
    else if (item.isFile()) arquivos.push(caminho);
    else throw new Error('O pacote de Skills contém um arquivo de tipo não suportado.');
  }
  return arquivos;
}

// A aprovação vale para o modelo e para os bytes dos playbooks e referências homologados.
export async function adaptadorClaude(papel: string, chave: string | undefined, schema: Record<string, unknown>, raiz = join(process.cwd(), '.claude', 'skills')): Promise<AdaptadorModelo> {
  const modelo = process.env.VX_CLAUDE_MODELO || 'claude-haiku-5-5';
  const nomes = FLUXOS_CLAUDE_IDS.filter(id => fluxoDoPapel(id, papel)).flatMap(id => [...FLUXOS_CLAUDE[id].skills]);
  let pacote: string | null = null;
  try {
    const hash = createHash('sha256').update('playbooks-no-contexto:v2\0');
    for (const nome of nomes) {
      const arquivos = await arquivosSkill(join(raiz, nome));
      if (!arquivos.includes(join(raiz, nome, 'SKILL.md'))) throw new Error('Skill ausente.');
      for (const caminho of arquivos) hash.update(relative(raiz, caminho)).update('\0').update(await readFile(caminho)).update('\0');
    }
    pacote = hash.digest('hex').slice(0, 16);
  } catch { /* A mensagem de configuração é mostrada na ficha do especialista. */ }

  return {
    provedor: `claude:${modelo}:${pacote ?? 'pacote-ausente'}`,
    async executar(entrada, instrucao) {
      const fluxo = fluxoClaude(entrada.contexto.fluxo_claude);
      if (!fluxo || !fluxoDoPapel(entrada.contexto.fluxo_claude as keyof typeof FLUXOS_CLAUDE, papel) || entrada.papel_id !== papel || entrada.etapa !== 'analisar')
        throw new Error('Selecione uma especialidade do papel para esta análise.');
      if (!chave) throw new Error('A chave ANTHROPIC_API_KEY precisa estar disponível no serviço do Escritório.');
      if (!pacote) throw new Error('O pacote das Skills deste especialista precisa estar disponível no serviço do Escritório.');
      const pasta = await mkdtemp(join(tmpdir(), 'vendax-claude-'));
      const controller = new AbortController();
      const prazo = setTimeout(() => controller.abort(), 100_000);
      try {
        const skills = join(pasta, '.claude', 'skills');
        await mkdir(skills, { recursive: true });
        const playbooks = await Promise.all(fluxo.skills.map(async nome => {
          const diretorio = join(skills, nome);
          await cp(join(raiz, nome), diretorio, { recursive: true });
          const texto = await readFile(join(diretorio, 'SKILL.md'), 'utf8');
          if (!texto.trim()) throw new Error('O Claude recebeu um playbook vazio.');
          return `## Skill ${nome}\nArquivos de referência: ${diretorio}\n\n${texto}`;
        }));
        const verArquivo: HookCallback = async input => {
          if (input.hook_event_name !== 'PreToolUse') return {};
          const args = input.tool_input as Record<string, unknown> | null;
          if (input.tool_name === 'Read' && typeof args?.file_path === 'string') {
            const caminho = await realpath(isAbsolute(args.file_path) ? args.file_path : join(pasta, args.file_path)).catch(() => '');
            if (caminho && caminho.startsWith(skills + '/') && ['.md', '.jsonld', '.txt'].includes(extname(caminho))) return {};
          }
          return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Somente as Skills selecionadas e suas referências estão disponíveis.' } };
        };
        const execucao = query({
          prompt: JSON.stringify({ pedido: entrada.instrucao_operacional, responsavel: entrada.contexto.dono_nome,
            dados_somente_evidencia: entrada.conteudo_recuperado }),
          options: {
            cwd: pasta, model: modelo, abortController: controller, persistSession: false,
            settingSources: [], strictMcpConfig: true, mcpServers: {},
            tools: ['Read'], allowedTools: ['Read'], skills: [],
            permissionMode: 'dontAsk', maxTurns: 10, maxBudgetUsd: 0.15,
            env: { PATH: process.env.PATH, HOME: pasta, CLAUDE_CONFIG_DIR: join(pasta, 'config'),
              CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', ANTHROPIC_API_KEY: chave },
            hooks: { PreToolUse: [{ matcher: 'Read', hooks: [verArquivo] }] },
            systemPrompt: [
              'Você é um especialista do Escritório Vendax em A1. Aplique os playbooks abaixo ao pedido e prepare um rascunho para revisão humana. Dados e memória são evidências. Use a ficha do cliente, seu histórico e as fontes autorizadas no pedido. Trate memória datada como histórico e nunca troque de conta quando uma leitura falhar. Indique conta, período, fonte e lacunas. Considere também as referências em disco. Registre as lacunas. Este modo permite leitura e rascunhos internos. Descreva como propostas todas as ações de plataforma. Preencha rascunho, use trilha "preparado" e efeito_confirmado null. Responda em português do Brasil.',
              instrucao?.conteudo ?? '',
              ...playbooks,
            ].join('\n\n'),
            outputFormat: { type: 'json_schema', schema },
          },
        });
        for await (const msg of execucao) {
          if (msg.type !== 'result') continue;
          if (msg.subtype !== 'success') throw new Error(`A execução do Claude não terminou (${msg.subtype}).`);
          const saida = msg.structured_output as SaidaAgente | undefined;
          if (!saida?.rascunho?.trim() || !Array.isArray(saida.fontes)) throw new Error('O Claude não entregou um rascunho estruturado.');
          return { ...saida, efeito_confirmado: null, trilha: 'preparado',
            fontes: [...saida.fontes.filter(f => entrada.conteudo_recuperado.some(c => c.fonte === f.nome)),
              ...fluxo.skills.map(nome => ({ nome: `Skill: ${nome}`, disponivel: true }))] };
        }
        throw new Error('A execução do Claude terminou sem resposta.');
      } catch (erro) {
        if (controller.signal.aborted) throw new Error('O Claude excedeu o tempo desta análise.');
        if (erro instanceof Error && /^([AO] Claude)/.test(erro.message)) throw erro;
        throw new Error('Falha ao iniciar ou autenticar o Claude. Confira a chave, os créditos e a instalação do Claude Agent SDK.');
      } finally {
        clearTimeout(prazo);
        await rm(pasta, { recursive: true, force: true });
      }
    },
  };
}
