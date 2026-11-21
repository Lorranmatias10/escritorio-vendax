import { beforeEach, describe, expect, it } from 'vitest';
import { banco, type Banco } from '@/lib/db';
import { carregarUsuario, type Usuario } from '@/lib/escopo';
import { resetarDemonstracao, limparDemonstracao } from '@/lib/seed';
import { dispararFluxoPiloto, simularFalha, simularFonteAusente } from '@/lib/demo';
import { decidirAprovacao, retomarExecucao, desabilitarPapel, criarCliente, definirAcessoClientes } from '@/lib/orquestracao';
import { homologarPiloto, homologarFase2, homologarFase3, PAPEIS_FASE_2, PAPEIS_FASE_3 } from '@/lib/homologacao';
import { lerCatalogoInstrucoes } from '@/lib/instrucoes';
import { catalogo, hoje, listarAprovacoes, listarTarefas, obterTarefa, salas, listarIncidentes, obterPapel, conversasRecentes } from '@/lib/dados';
import { PAPEIS, PAPEIS_PILOTO } from '@/lib/catalogo';

let b: Banco;
const u = async (id: string) => (await carregarUsuario(b, id)) as Usuario;

beforeEach(async () => {
  b = await banco();
  await resetarDemonstracao(b);
});

describe('catálogo', () => {
  it('carrega 5 andares, 9 departamentos e 25 papéis; só o piloto aguarda configuração', async () => {
    const c = await catalogo(b);
    expect(c.andares).toHaveLength(5);
    expect(c.deptos).toHaveLength(9);
    expect(c.papeis).toHaveLength(PAPEIS.length);
    const piloto = c.papeis.filter(p => p.fase === 'piloto').map(p => p.id).sort();
    expect(piloto).toEqual([...PAPEIS_PILOTO].sort());
    expect(c.papeis.filter(p => p.fase === 'piloto').every(p => p.estado_config === 'em_homologacao' && !p.execucao_habilitada)).toBe(true);
    expect(c.papeis.filter(p => p.fase !== 'piloto').every(p => p.estado_config === 'desabilitado' && !p.execucao_habilitada)).toBe(true);
    expect(c.papeis.find(p => p.id === 'gerente_contas')?.vinculo_reservado).toMatch(/AM - Vendax/);
  });
});

describe('fluxo do briefing da carteira piloto', () => {
  it('evento → Gerente de Contas → Auditor → Diretor → Hoje com aprovação e evidências', async () => {
    const tiago = await u('tiago');
    const { tarefaId, repetido } = await dispararFluxoPiloto(b, tiago);
    expect(repetido).toBe(false);
    const t = (await obterTarefa(b, tiago, tarefaId))!;
    expect(t.estado).toBe('aguardando_aprovacao');
    expect(t.em_hoje).toBe(true);
    expect(t.dono_nome).toBe('Fabiana');
    expect(t.proximo_passo).toMatch(/Fabiana decide/);
    expect(t.subtarefas.map(s => [s.papel_atual_id, s.estado])).toEqual([['auditor_qualidade', 'concluida'], ['diretor_operacoes', 'concluida']]);
    expect(t.execucoes.map(e => [e.papel_id, e.estado])).toEqual([['gerente_contas', 'concluida']]);
    // Auditor achou o prazo sem confirmação; o prazo confirmado não vira achado
    expect(t.evidencias.some(e => /sem confirmação.*até sexta/.test(e.descricao))).toBe(true);
    expect(t.evidencias.some(e => /amanhã/.test(e.descricao) && /sem confirmação/.test(e.descricao))).toBe(false);
    expect(t.aprovacoes).toHaveLength(1);
    expect(t.aprovacoes[0].aprovador_id).toBe('fabiana');
    const h = await hoje(b, tiago);
    expect(h.pendencias[0].id).toBe(tarefaId);
    // A sala de Gestão de Contas mostra a tarefa (mesma fonte do prédio e da lista)
    const sala = (await salas(b, tiago)).find(s => s.id === 'contas')!;
    expect(sala.contagem.aguardando_aprovacao).toBe(1);
  });

  it('evento repetido mantém um único registro e atualiza a execução de origem', async () => {
    const tiago = await u('tiago');
    const a = await dispararFluxoPiloto(b, tiago);
    const r = await dispararFluxoPiloto(b, tiago);
    expect(r).toEqual({ tarefaId: a.tarefaId, repetido: true });
    const [{ n }] = await b.query<{ n: number }>(`select count(*)::int n from tarefas where origem_evento_id = 'demo-reuniao-aurora-001'`);
    expect(n).toBe(1);
    const [{ ap }] = await b.query<{ ap: number }>('select count(*)::int ap from aprovacoes');
    expect(ap).toBe(1);
    const [ex] = await b.query<{ entrada: { contexto: { recebimentos: number } } }>(`select entrada from execucoes where etapa = 'organizar'`);
    expect(ex.entrada.contexto.recebimentos).toBe(2);
  });
});

describe('fonte ausente, falha e retomada', () => {
  it('fonte indisponível bloqueia a tarefa com "Integração pendente"', async () => {
    const id = await simularFonteAusente(b, await u('tiago'));
    const t = (await obterTarefa(b, await u('tiago'), id))!;
    expect(t.estado).toBe('bloqueada');
    expect(t.motivo_bloqueio).toMatch(/Integração pendente/);
  });

  it('falha registrada e retomada sem duplicar efeitos', async () => {
    const tiago = await u('tiago');
    const id = await simularFalha(b, tiago);
    let t = (await obterTarefa(b, tiago, id))!;
    expect(t.estado).toBe('falhou');
    await retomarExecucao(b, tiago, t.execucoes[0].id);
    await retomarExecucao(b, tiago, t.execucoes[0].id); // repetir a retomada não faz nada
    t = (await obterTarefa(b, tiago, id))!;
    expect(t.estado).toBe('concluida');
    expect(t.execucoes).toHaveLength(1);
    expect(t.execucoes[0].tentativas).toBe(2);
    expect(t.evidencias.filter(e => e.tipo === 'rascunho')).toHaveLength(1);
    expect(t.eventos.map(e => e.tipo)).toEqual(expect.arrayContaining(['execucao_falhou', 'retomada', 'execucao_concluida']));
  });
});

describe('escopo por cliente e financeiro', () => {
  it('Lígia (só Clínica Aurora) não vê outro cliente nem financeiro, nem em contadores e resumos', async () => {
    await dispararFluxoPiloto(b, await u('tiago'));
    const fonte = await simularFonteAusente(b, await u('tiago')); // Instituto Sorriso
    const ligia = await u('ligia');
    const tarefas = await listarTarefas(b, ligia);
    expect(tarefas.every(t => t.cliente_id === 'aurora' || (t.area_interna && t.area_interna !== 'financeiro'))).toBe(true);
    expect(await obterTarefa(b, ligia, fonte)).toBeNull();
    const s = await salas(b, ligia);
    expect(s.find(x => x.id === 'financeiro')!.abertas).toBe(0);
    expect(s.find(x => x.id === 'whatsapp')!.abertas).toBe(0); // tarefa do Sorriso não conta
    const h = await hoje(b, ligia);
    expect(h.incidentes.every(i => i.cliente_nome === 'Clínica Aurora')).toBe(true);
    expect((await listarIncidentes(b, ligia)).some(i => i.area_interna === 'financeiro')).toBe(false);
    // Histórico autorizado do agente também é filtrado
    const papel = (await obterPapel(b, ligia, 'gerente_contas'))!;
    expect(papel.historico.every(e => !/Sorriso/.test(e.objetivo))).toBe(true);
    // Fabiana vê o financeiro; Lorran não
    expect((await listarTarefas(b, await u('fabiana'))).some(t => t.area_interna === 'financeiro')).toBe(true);
    expect((await listarTarefas(b, await u('lorran'))).some(t => t.area_interna === 'financeiro')).toBe(false);
  });

  it('impede disparar cenário e decidir aprovação sem acesso', async () => {
    await expect(simularFonteAusente(b, await u('ligia'))).rejects.toThrow(/Sem acesso/);
    await dispararFluxoPiloto(b, await u('tiago'));
    const [ap] = await listarAprovacoes(b, await u('tiago'), 'pendente');
    await expect(decidirAprovacao(b, await u('lorran'), ap.id, 'aprovada', '')).rejects.toThrow(/Sem acesso/);
    await expect(decidirAprovacao(b, await u('ligia'), ap.id, 'aprovada', '')).rejects.toThrow(/aprovador designado/);
  });
});

describe('aprovação A3', () => {
  it('decisão registrada fecha a tarefa e nenhuma ação externa roda na V1', async () => {
    const { tarefaId } = await dispararFluxoPiloto(b, await u('tiago'));
    const fabiana = await u('fabiana');
    const [ap] = await listarAprovacoes(b, fabiana, 'pendente');
    const r = await decidirAprovacao(b, fabiana, ap.id, 'aprovada', 'Pode confirmar.');
    expect(r).toEqual({ estado: 'aprovada', externa: 'desabilitada_v1' });
    const t = (await obterTarefa(b, fabiana, tarefaId))!;
    expect(t.estado).toBe('concluida');
    expect(t.aprovacoes[0].execucao_externa).toBe('desabilitada_v1');
    expect(t.eventos.some(e => e.tipo === 'acao_externa_bloqueada')).toBe(true);
    expect(t.evidencias.some(e => e.tipo === 'acao_solicitada')).toBe(true);
    expect(t.evidencias.some(e => e.tipo === 'resultado_confirmado')).toBe(false);
    // decidir de novo não muda nada
    expect((await decidirAprovacao(b, fabiana, ap.id, 'rejeitada', '')).estado).toBe('aprovada');
  });
});

describe('instruções versionadas dos agentes', () => {
  it('as versões preservam os 7 casos e cobrem todos os papéis com fase e dono', () => {
    const [v,especialistas] = lerCatalogoInstrucoes();
    expect(v.versao).toBe('1.0');
    expect(v.comum).toMatch(/Você é um agente do Escritório Vendax/);
    expect(v.papeis).toHaveLength(23);
    expect(v.casos).toHaveLength(7);
    const fase = { 1: 'piloto', 2: 'fase_2', 3: 'fase_3' } as const;
    expect(especialistas.versao).toBe('1.1');
    for (const p of [...v.papeis,...especialistas.papeis]) {
      const c = PAPEIS.find(x => x.id === p.id);
      expect(c, p.id).toBeDefined();
      expect([c!.fase,c!.responsavel]).toEqual([fase[p.fase],p.dono]);
      const renomeados: Record<string,string> = { diretor_operacoes: 'Diretor Geral IA', midia_paga: 'Líder de Mídia Paga' };
      expect(c!.nome).toBe(renomeados[p.id] ?? p.nome);
      expect(p.bloco).toMatch(/\*\*Entregue\*\*/);
    }
  });

  it('cada papel tem a instrução composta (comum + bloco) importada e versionada', async () => {
    const r = await b.query<{ papel_id: string; versao: string; conteudo: string }>('select papel_id, versao, conteudo from instrucoes');
    expect(r).toHaveLength(PAPEIS.length);
    expect(r.every(i => ['1.0','1.1'].includes(i.versao) && i.conteudo.includes('Instrução comum') && i.conteudo.includes(i.papel_id))).toBe(true);
  });
});

describe('homologação e habilitação do piloto', () => {
  it('só a direção homologa', async () => {
    await expect(homologarPiloto(b, await u('fabiana'))).rejects.toThrow(/direção/);
  });

  it('os 7 casos passam e só os 3 papéis do piloto ficam habilitados em A1, com evidência registrada', async () => {
    const r = await homologarPiloto(b, await u('tiago'));
    expect(r.resultados.filter(x => !x.passou)).toEqual([]);
    expect(r.aprovado).toBe(true);
    expect(r.resultados).toHaveLength(7);
    const c = await catalogo(b);
    for (const p of c.papeis) {
      if ((PAPEIS_PILOTO as readonly string[]).includes(p.id))
        expect([p.estado_config, p.execucao_habilitada, p.modo, p.versao_instrucao]).toEqual(['habilitado', true, 'A1', '1.0']);
      else expect([p.estado_config, p.execucao_habilitada]).toEqual(['desabilitado', false]);
    }
    const [{ n }] = await b.query<{ n: number }>('select count(*)::int n from homologacoes where rodada = $1 and passou', [r.rodada]);
    expect(n).toBe(7);
    // A homologação rodou isolada: nada dela aparece nos dados principais
    const [{ h }] = await b.query<{ h: number }>(`select count(*)::int h from tarefas where origem_evento_id like 'homolog-%'`);
    expect(h).toBe(0);
    // Execução habilitada registra a versão da instrução; em A1 nenhuma entrega é gravada pelo agente
    const { tarefaId } = await dispararFluxoPiloto(b, await u('tiago'));
    const [ex] = await b.query<{ versao_instrucao: string }>(`select versao_instrucao from execucoes where tarefa_id = $1`, [tarefaId]);
    expect(ex.versao_instrucao).toBe('1.0');
    const [{ e }] = await b.query<{ e: number }>('select count(*)::int e from entregas where tarefa_id = $1', [tarefaId]);
    expect(e).toBe(0);
  });

  it('desabilitar um papel bloqueia novas execuções e registra quem e por quê', async () => {
    await homologarPiloto(b, await u('tiago'));
    await desabilitarPapel(b, await u('tiago'), 'gerente_contas', 'Teste de desligamento');
    const { tarefaId } = await dispararFluxoPiloto(b, await u('tiago'));
    const t = (await obterTarefa(b, await u('tiago'), tarefaId))!;
    expect(t.estado).toBe('bloqueada');
    expect(t.motivo_bloqueio).toMatch(/desabilitado pela direção/);
    const [reg] = await b.query<{ acao: string; ator: string; detalhe: string }>(`select acao, ator, detalhe from registro_configuracao where papel_id = 'gerente_contas' order by id desc limit 1`);
    expect(reg).toEqual({ acao: 'desabilitado', ator: 'Tiago', detalhe: 'Teste de desligamento' });
  });
});

describe('dados reais: clientes e acesso', () => {
  it('a limpeza tira do banco principal tudo o que é demonstração e mantém equipe e catálogo', async () => {
    await limparDemonstracao(b);
    const [{ c }] = await b.query<{ c: number }>('select count(*)::int c from clientes');
    const [{ t }] = await b.query<{ t: number }>('select count(*)::int t from tarefas');
    const [{ p }] = await b.query<{ p: number }>('select count(*)::int p from papeis');
    expect([c, t, p]).toEqual([0, 0, PAPEIS.length]);
    expect((await b.query('select id from usuarios')).length).toBe(4);
  });

  it('só a direção cadastra cliente e define acesso; quem recebe acesso passa a ver o cliente', async () => {
    await limparDemonstracao(b);
    await expect(criarCliente(b, await u('fabiana'), 'Clínica Teste')).rejects.toThrow(/direção/);
    const id = await criarCliente(b, await u('tiago'), '  Clínica  São João ');
    expect(id).toBe('clinica-sao-joao');
    await expect(criarCliente(b, await u('tiago'), 'clínica são joão')).rejects.toThrow(/Já existe/);
    await expect(definirAcessoClientes(b, await u('lorran'), 'ligia', [id])).rejects.toThrow(/direção/);
    await definirAcessoClientes(b, await u('tiago'), 'ligia', [id, 'inexistente']);
    expect((await u('ligia')).clientes).toEqual([id]);
    expect((await u('lorran')).clientes).toEqual([]);
  });
});

describe('comunicação entre agentes no prédio', () => {
  it('cada passagem de tarefa vira uma conversa de quem concluiu para o destino, com o mesmo escopo', async () => {
    await homologarPiloto(b, await u('tiago')); // estado conhecido: outro teste desabilita o Gerente de Contas
    await dispararFluxoPiloto(b, await u('tiago'));
    const c = await conversasRecentes(b, await u('tiago'));
    expect(c.map(x => `${x.de}>${x.para}`).sort()).toEqual(['auditor_qualidade>diretor_operacoes', 'gerente_contas>auditor_qualidade']);
    expect(await conversasRecentes(b, await u('lorran'))).toEqual([]); // Lorran não vê a Clínica Aurora
  });
});

describe('homologação da fase 2', () => {
  it('só a direção homologa', async () => {
    await expect(homologarFase2(b, await u('fabiana'))).rejects.toThrow(/direção/);
  });

  it('4 casos por fluxo passam, os 6 papéis ficam habilitados em A1 e nada vaza para os dados principais', async () => {
    const r = await homologarFase2(b, await u('tiago'));
    expect(r.resultados.filter(x => !x.passou)).toEqual([]);
    expect(r.resultados).toHaveLength(24);
    expect(r.aprovados.sort()).toEqual([...PAPEIS_FASE_2].sort());
    const c = await catalogo(b);
    for (const p of c.papeis.filter(p => PAPEIS_FASE_2.includes(p.id)))
      expect([p.estado_config, p.execucao_habilitada, p.modo, p.versao_instrucao]).toEqual(['habilitado', true, 'A1', '1.0']);
    expect(c.papeis.filter(p => p.fase === 'fase_3').every(p => !p.execucao_habilitada)).toBe(true);
    const [{ h }] = await b.query<{ h: number }>(`select count(*)::int h from tarefas where origem_evento_id like 'homolog-%'`);
    expect(h).toBe(0);
    // A página do papel mostra só os 4 casos dele
    const papel = (await obterPapel(b, await u('tiago'), 'monitor_whatsapp'))!;
    expect(papel.homologacao?.casos).toHaveLength(4);
  });

});

describe('homologação da fase 3', () => {
  it('só a direção homologa', async () => {
    await expect(homologarFase3(b, await u('fabiana'))).rejects.toThrow(/direção/);
  });

  it('4 casos por fluxo passam e os 14 papéis restantes ficam habilitados em A1', async () => {
    const r = await homologarFase3(b, await u('tiago'));
    expect(r.resultados.filter(x => !x.passou)).toEqual([]);
    expect(r.resultados).toHaveLength(56);
    expect(r.aprovados.sort()).toEqual([...PAPEIS_FASE_3].sort());
    const c = await catalogo(b);
    const fase3 = c.papeis.filter(p => p.fase === 'fase_3');
    expect(fase3.filter(p => !PAPEIS_FASE_3.includes(p.id)).map(p => p.id).sort())
      .toEqual(['especialista_google_ads','especialista_meta_ads']);
    expect(fase3.filter(p => !PAPEIS_FASE_3.includes(p.id)).every(p => !p.execucao_habilitada)).toBe(true);
    for (const p of c.papeis.filter(p => PAPEIS_FASE_3.includes(p.id)))
      expect([p.estado_config, p.execucao_habilitada, p.modo, p.versao_instrucao]).toEqual(['habilitado', true, 'A1', '1.0']);
    const [{ h }] = await b.query<{ h: number }>(`select count(*)::int h from tarefas where origem_evento_id like 'homolog-%'`);
    expect(h).toBe(0);
  });
});

describe('login próprio', () => {
  it('senha: hash scrypt com sal, nunca o texto; confere certa e recusa errada', async () => {
    const { hashSenha, conferirSenha } = await import('@/lib/auth');
    const h1 = await hashSenha('senha-forte-123'), h2 = await hashSenha('senha-forte-123');
    expect(h1).not.toContain('senha-forte-123');
    expect(h1).not.toBe(h2); // sal diferente
    expect(await conferirSenha('senha-forte-123', h1)).toBe(true);
    expect(await conferirSenha('senha-errada-123', h1)).toBe(false);
    expect(await conferirSenha('qualquer', null)).toBe(false);
  });

  it('link de acesso é de uso único, cria sessão, permite definir senha e entrar; sessão sai no logout', async () => {
    const a = await import('@/lib/auth');
    await b.query(`update usuarios set email = 'ligia@exemplo.com', senha_hash = null where id = 'ligia'`);
    const link = await a.gerarLink(b, 'ligia', 'tiago');
    const sessao = (await a.consumirLink(b, link))!;
    expect(sessao).toBeTruthy();
    expect(await a.consumirLink(b, link)).toBeNull(); // uso único
    expect((await a.usuarioDaSessao(b, sessao))?.id).toBe('ligia');
    await a.definirSenhaUsuario(b, 'ligia', 'minha-senha-123', sessao);
    const [{ senha_hash }] = await b.query<{ senha_hash: string }>(`select senha_hash from usuarios where id = 'ligia'`);
    expect(senha_hash).toMatch(/^scrypt\$/);
    const r = await a.entrarComSenha(b, 'LIGIA@exemplo.com', 'minha-senha-123');
    expect(r.ok && r.usuario.id).toBe('ligia');
    if (r.ok) { await a.encerrarSessao(b, r.token); expect(await a.usuarioDaSessao(b, r.token)).toBeNull(); }
    const [{ n }] = await b.query<{ n: number }>(`select count(*)::int n from sessoes where token_hash = $1`, [sessao]);
    expect(n).toBe(0); // o token não fica no banco, só o hash
  });

  it('bloqueia após 5 senhas erradas seguidas e não revela se o e-mail existe', async () => {
    const a = await import('@/lib/auth');
    await b.query(`update usuarios set email = 'lorran@exemplo.com', senha_hash = $1 where id = 'lorran'`, [await a.hashSenha('correta-123456')]);
    for (let i = 0; i < 5; i++) expect(await a.entrarComSenha(b, 'lorran@exemplo.com', 'errada')).toEqual({ ok: false, motivo: 'credenciais' });
    expect(await a.entrarComSenha(b, 'lorran@exemplo.com', 'correta-123456')).toEqual({ ok: false, motivo: 'bloqueado' });
    expect(await a.entrarComSenha(b, 'ninguem@exemplo.com', 'x')).toEqual({ ok: false, motivo: 'credenciais' });
  });

  it('link vencido não entra', async () => {
    const a = await import('@/lib/auth');
    const link = await a.gerarLink(b, 'fabiana', 'tiago');
    await b.query(`update links_acesso set expira_em = now() - interval '1 minute' where usuario_id = 'fabiana' and usado_em is null`);
    expect(await a.consumirLink(b, link)).toBeNull();
  });
});
