import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirBanco, type Banco } from '@/lib/db';
import { carregarUsuario, type Usuario } from '@/lib/escopo';
import { contasDoCliente, obterFichaCliente } from '@/lib/ficha-cliente';
import { auditoriaCliente, historicoRotina, hoje, listarRotinas } from '@/lib/dados';
import { horarioRotina, janelaRotina, semanaAnteriorAoPeriodo } from '@/lib/agenda-rotinas';
import { consultarFontes, planoFontes } from '@/lib/fontes-cliente';
import { adaptadorSimulado } from '@/lib/ia';
import {
  atualizarFichaCliente, decidirAprovacao, definirRotinaAtiva, dispararRotinasVencidas, gravarVinculoCliente,
  processarFila, receberEventoReuniao, receberPedido, retirarVinculoCliente, rodarRotinaAgora, salvarRotina, verificarVinculoCliente,
} from '@/lib/orquestracao';

let b: Banco;
let tiago: Usuario;
let ligia: Usuario;
let fabiana: Usuario;
const a = 'teste-cliente-a', c = 'teste-cliente-b';
const ads = (identificador = '123456789012345') => ({ integracao: 'meta-ads', tipo: 'conta_anuncio', identificador, rotulo: 'Conta usada em teste' });
const perfil = { status: 'ativo', responsavel_id: null, contato_nome: null, contato_whatsapp: null };
const data = new Date('2026-11-23T14:00:00Z');
const antes = new Date('2026-11-18T11:00:00Z');
const json = (v: unknown) => new Response(JSON.stringify(v),{ status: 200, headers: { 'Content-Type': 'application/json' } });

beforeAll(async () => {
  b = await abrirBanco({ isolado: true });
  tiago = (await carregarUsuario(b,'tiago'))!;
  ligia = (await carregarUsuario(b,'ligia'))!;
  await b.query(`insert into clientes(id,nome,status) values ($1,'Conta A','ativo'),($2,'Conta B','ativo')`,[a,c]);
  await b.query('insert into permissoes_cliente values ($1,$2)',['fabiana',a]);
  fabiana = (await carregarUsuario(b,'fabiana'))!;
});
afterAll(async () => { await b?.fechar(); });

beforeEach(async () => {
  vi.stubEnv('VX_ROTINAS','ligado');
  vi.stubEnv('AI_PROVEDOR','simulado');
  vi.stubEnv('META_ACCESS_TOKEN','meta-somente-leitura-teste');
  await b.exec(`
    delete from rotinas_execucoes;
    delete from rotinas;
    delete from clientes_auditoria;
    delete from contas_cliente;
    update clientes set status='ativo',responsavel_id=null,contato_nome=null,contato_whatsapp=null where id like 'teste-cliente-%';
    update papeis set modo='A1',estado_config='habilitado',execucao_habilitada=true,homologado_com='simulado-local'
    where id in ('midia_paga','dados_atribuicao','gerente_contas','auditor_qualidade','diretor_operacoes');
  `);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubAds() {
  const fetch = vi.fn(async (url: URL) => {
    const id = url.pathname.match(/\/act_(\d+)/)?.[1];
    if (url.searchParams.get('fields') === 'account_id') return json({account_id:id});
    return json({ data: [{ account_id:id, id:'123', name:'Campanha de teste' }] });
  });
  vi.stubGlobal('fetch',fetch);
  return fetch;
}

async function vincular(cliente: string, identificador = ads().identificador, verificar = false) {
  await gravarVinculoCliente(b,tiago,cliente,ads(identificador));
  const [v] = await contasDoCliente(b,tiago,cliente);
  if (verificar) await verificarVinculoCliente(b,tiago,cliente,v.id,v.versao);
  return v;
}

async function pedido(cliente: string, objetivo = 'Ler campanhas de Meta Ads') {
  const r = await receberPedido(b,tiago,{
    id: randomUUID(), papel_id: 'midia_paga', cliente_id: cliente, area_interna: null, dono_id: 'tiago', objetivo,
    fontes_integracoes: ['meta-ads'], conteudo_recuperado: [], demo: false,
  });
  await processarFila(b,undefined,1,r.tarefaId);
  const [t] = await b.query<{estado:string; motivo_bloqueio:string|null}>('select estado,motivo_bloqueio from tarefas where id=$1',[r.tarefaId]);
  return { ...r,...t };
}

describe('ficha e escopo das fontes', () => {
  it('bloqueia um cliente sem vínculo e não lê a API', async () => {
    const fetch = stubAds();
    const t = await pedido(a);
    expect(t.estado).toBe('bloqueada');
    expect(t.motivo_bloqueio).toBe('Conta de Meta Ads não vinculada ao cliente - quem resolve: direção');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('não usa conta ainda não verificada, mesmo que tenha o ID no pedido', async () => {
    const fetch = stubAds();
    await vincular(a);
    expect((await pedido(a,`Leia Meta Ads ${ads().identificador}`)).estado).toBe('bloqueada');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('impede uso do ID de outro cliente, inclusive se possui outro vínculo verificado', async () => {
    const fetch = stubAds();
    const bId = '876543210987654';
    await vincular(c,bId,true);
    await vincular(a,ads().identificador,true);
    fetch.mockClear();
    expect((await pedido(a,`Ler campanhas de Meta Ads da conta act_${bId}`)).estado).toBe('bloqueada');
    expect(fetch).not.toHaveBeenCalled();
    await expect(contasDoCliente(b,fabiana,c)).rejects.toThrow('Sem acesso');
    await expect(gravarVinculoCliente(b,tiago,a,ads(bId))).rejects.toThrow('outro cliente');
  });

  it('só a direção altera ficha, status, verificação e remoção', async () => {
    const v = await vincular(a);
    const fetch = stubAds();
    await expect(atualizarFichaCliente(b,fabiana,a,{ ...perfil,status:'inativo' })).rejects.toThrow('Somente a direção');
    await expect(gravarVinculoCliente(b,fabiana,a,ads())).rejects.toThrow('Somente a direção');
    await expect(verificarVinculoCliente(b,fabiana,a,v.id,v.versao)).rejects.toThrow('Somente a direção');
    await expect(retirarVinculoCliente(b,fabiana,a,v.id,v.versao)).rejects.toThrow('Somente a direção');
    expect(fetch).not.toHaveBeenCalled();
    await atualizarFichaCliente(b,tiago,a,{ ...perfil,status:'sazonal',responsavel_id:fabiana.id });
    expect(await obterFichaCliente(b,fabiana,a)).toMatchObject({ status:'sazonal',responsavel:'Fabiana' });
    expect(await obterFichaCliente(b,ligia,a)).toBeNull();
    const [registro] = await b.query('select ator_id, detalhe from clientes_auditoria where cliente_id=$1 and acao=$2',[a,'ficha_atualizada']);
    expect(registro).toMatchObject({ ator_id:'tiago',detalhe:'Status: ativo → sazonal.' });
  });

  it('confirma o ID pela API, registra quem conferiu e invalida a verificação quando o ID muda', async () => {
    const v = await vincular(a);
    const fetch = stubAds();
    fetch.mockResolvedValueOnce(json({ account_id:'999' }));
    await expect(verificarVinculoCliente(b,tiago,a,v.id,v.versao)).rejects.toThrow('não confirmou');
    expect((await contasDoCliente(b,tiago,a))[0].verificado_em).toBeNull();
    await verificarVinculoCliente(b,tiago,a,v.id,v.versao);
    const [verificada] = await contasDoCliente(b,tiago,a);
    expect(verificada).toMatchObject({ verificado_por:'tiago' });
    expect(verificada.verificado_em).toBeTruthy();
    const t = await pedido(a);
    expect(t.estado).toBe('aguardando_aprovacao');
    expect(await b.query('select referencia from evidencias where tarefa_id=$1 and referencia=$2',[t.tarefaId,ads().identificador])).not.toHaveLength(0);
    await gravarVinculoCliente(b,tiago,a,ads('555555555555555'),{ id:v.id,versao:verificada.versao });
    expect((await contasDoCliente(b,tiago,a))[0]).toMatchObject({ verificado_em:null,verificado_por:null });
  });

  it('mantém ações distintas de cadastro, verificação, edição e remoção no histórico', async () => {
    stubAds();
    await vincular(a,ads().identificador,true);
    const [verificada] = await contasDoCliente(b,tiago,a);
    await gravarVinculoCliente(b,tiago,a,{ ...ads(), rotulo:'Rótulo revisado' },verificada);
    const [editada] = await contasDoCliente(b,tiago,a);
    await retirarVinculoCliente(b,tiago,a,editada.id,editada.versao);
    const historico = await auditoriaCliente(b,tiago,a);
    expect(historico.map(r => r.acao)).toEqual(['conta_removida','conta_editada','conta_verificada','conta_criada']);
    expect(historico[2].detalhe).toBe(historico[3].detalhe);
    expect(historico.every(r => r.ator === tiago.nome)).toBe(true);
  });

  it('usa o contato da ficha e o rascunho no fluxo real de reunião, dentro de A1', async () => {
    const fetch = stubAds();
    await atualizarFichaCliente(b,tiago,a,{ ...perfil,contato_nome:'Contato de teste',contato_whatsapp:'+5511999991234' });
    const t = await receberEventoReuniao(b,tiago,{ id:randomUUID(), cliente_id:a, dono_id:'tiago', titulo:'Revisão de entregas',
      transcricao:'Contato: A página de matrícula pode ficar pronta até sexta? Tiago vai confirmar o prazo.', prazo:data.toISOString(), demo:false });
    await processarFila(b,undefined,3,t.tarefaId);
    expect(fetch).not.toHaveBeenCalled();
    const [ap] = await b.query<{ modo:string; parametros:unknown; alvo:string; conta:string }>(
      'select modo,parametros,alvo,conta from aprovacoes where tarefa_id=$1',[t.tarefaId]);
    expect(ap).toMatchObject({ modo:'A1', alvo:'Revisão interna', parametros:{ contato:'Contato de teste', destinatario:'+5511999991234', mensagem:expect.any(String) } });
    expect(JSON.stringify(ap)).not.toMatch(/Aurora|implantes|Demonstração/);
  });
});

async function rotina(mudancas: Record<string,unknown> = {}) {
  const id = await salvarRotina(b,tiago,{
    chave_dedup:randomUUID(), nome:'Rotina de teste', papel_id:'dados_atribuicao', cliente_id:a, area_interna:null,
    dono_id:'tiago', aprovador_id:'fabiana', objetivo:'Prepare um relatório dos anúncios', fontes:['meta-ads'],
    frequencia:'diaria', dia:null, hora:'09:00', inclui_sazonal:false, ...mudancas,
  },undefined,antes);
  await definirRotinaAtiva(b,tiago,id,true,antes);
  return id;
}

const projeto = { integracao:'reportei', tipo:'projeto_reportei', identificador:'3001', rotulo:'Projeto de teste' };
const googleAds = { integracao:'google-ads', tipo:'customer_id', identificador:'1234567890', rotulo:'Google de teste' };
const periodoPrincipal = { inicio:'2026-11-16', fim:'2026-11-22' };
const periodoComparacao = { inicio:'2026-11-09', fim:'2026-11-15' };
const metrica = { id:'impressions', reference_key:'fb_ads:impressions', component:'number_v1', metrics:['impressions'], type:['impressions'] };

async function verificarConta(entrada: typeof projeto) {
  await gravarVinculoCliente(b,tiago,a,entrada);
  const v = (await contasDoCliente(b,tiago,a)).find(v => v.integracao === entrada.integracao)!;
  await verificarVinculoCliente(b,tiago,a,v.id,v.versao);
}

function stubMetricas(opcoes: { integracaoDeOutroProjeto?: boolean; comparacaoIndisponivel?: boolean } = {}) {
  vi.stubEnv('REPORTEI_TOKEN','reportei-teste');
  vi.stubEnv('REPORTEI_BASE_URL','https://app.reportei.com/api');
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID','google-teste');
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET','google-secret-teste');
  vi.stubEnv('google-ads:refresh_token','google-refresh-teste');
  const fetch = vi.fn(async (entrada: URL | string, req?: RequestInit) => {
    const url = new URL(entrada);
    const body = typeof req?.body === 'string' ? JSON.parse(req.body) : undefined;
    if (url.hostname === 'app.reportei.com') {
      if (url.pathname === '/api/v2/projects/3001') return json({project:{id:3001,name:'Projeto de teste'}});
      if (url.pathname === '/api/v2/integrations' && url.searchParams.get('project_id') === '3001') {
        return json({data:[
          {id:81,project_id:opcoes.integracaoDeOutroProjeto ? 3002 : 3001,slug:'facebook_ads',status:'active'},
          {id:82,project_id:3001,slug:'facebook_ads',status:'revoked'},
        ]});
      }
      if (url.pathname === '/api/v2/metrics' && url.searchParams.get('integration_slug') === 'facebook_ads') return json({data:[metrica]});
      if (url.pathname === '/api/v2/metrics/get-data') {
        expect(req?.method).toBe('POST');
        expect(body).toEqual({integration_id:81,start:periodoPrincipal.inicio,end:periodoPrincipal.fim,metrics:[metrica]});
        return json({data:{impressions:{values:0}}});
      }
    }
    if (url.hostname === 'oauth2.googleapis.com') return json({access_token:'google-access-teste'});
    if (url.hostname === 'googleads.googleapis.com') {
      expect(url.pathname).toMatch(/\/customers\/1234567890\/googleAds:searchStream$/);
      const query = String(body?.query);
      const customer = {id:googleAds.identificador,currencyCode:'BRL'};
      const ehComparacao = query.includes(periodoComparacao.inicio);
      const campaign = {id:ehComparacao ? 'gb' : 'ga',name:'Campanha Google'};
      if (query.includes('FROM customer')) return json([{results:[{customer}]}]);
      if (query.includes('segments.date')) {
        expect(query).toContain(ehComparacao ? periodoComparacao.fim : periodoPrincipal.fim);
        expect(query).toContain('metrics.conversions');
        return json([{results:[{customer,campaign,metrics:{impressions:'600',clicks:'60',costMicros:'5000000',conversions:1.5}}]}]);
      }
      return json([{results:[{customer,campaign}]}]);
    }
    if (url.hostname === 'graph.facebook.com') {
      const account_id = ads().identificador;
      expect(url.pathname).toContain(`/act_${account_id}`);
      if (url.searchParams.get('fields') === 'account_id') return json({account_id});
      if (url.pathname.endsWith('/campaigns')) return json({data:[{account_id,id:'ma'}]});
      if (url.pathname.endsWith('/insights')) {
        const {since,until} = JSON.parse(url.searchParams.get('time_range')!);
        const ehComparacao = since === periodoComparacao.inicio;
        const paginou = url.searchParams.get('after') === 'cursor-teste';
        expect({inicio:since,fim:until}).toEqual(ehComparacao ? periodoComparacao : periodoPrincipal);
        expect(url.searchParams.get('fields')).toContain(',conversions');
        if (ehComparacao && opcoes.comparacaoIndisponivel) return new Response(null,{status:503});
        const linha = {account_id,campaign_id:ehComparacao ? 'mb' : paginou ? 'mc' : 'ma',campaign_name:'Campanha Meta',
          account_currency:'BRL',impressions:'500',clicks:'50',spend:'12.34',date_start:since,date_stop:until,
          conversions:[{action_type:'lead',value:'3'}]};
        return json({data:[linha],...(!ehComparacao && !paginou ? {paging:{next:'https://graph.facebook.com/proxima',cursors:{after:'cursor-teste'}}} : {})});
      }
    }
    throw new Error(`Consulta inesperada: ${url.pathname}`);
  });
  vi.stubGlobal('fetch',fetch);
  return fetch;
}

describe('rotinas agendadas', () => {
  it('entrega métricas do projeto e campanhas dos dois períodos ao agente em A1', async () => {
    const fetch = stubMetricas();
    await vincular(a,ads().identificador,true);
    await verificarConta(googleAds);
    await verificarConta(projeto);
    expect(fetch.mock.calls.filter(([url]) => new URL(url).hostname === 'app.reportei.com').map(([url]) => new URL(url).pathname))
      .toEqual(['/api/v2/projects/3001']);
    await gravarVinculoCliente(b,tiago,c,{...projeto,identificador:'3002'});
    const id = await rotina({frequencia:'semanal',dia:1,fontes:['meta-ads','google-ads','reportei']});
    const disparo = await rodarRotinaAgora(b,tiago,id,data);
    expect(disparo.tarefaId).toBeTruthy();
    const executar = vi.fn(adaptadorSimulado.executar);
    await processarFila(b,{ ...adaptadorSimulado,executar },1,disparo.tarefaId!);
    const fontes = executar.mock.calls[0][0].conteudo_recuperado;
    const reportei = fontes.find(f => f.fonte === 'Reportei · 3001');
    expect(reportei?.identificador).toBe('3001');
    expect(JSON.parse(reportei!.texto)).toMatchObject({conta:'3001',periodo:periodoPrincipal,dados:{
      id:'3001',integracoes:[{integracao_id:81,metricas:[{indicador:'fb_ads:impressions',valor:0}]}],
    }});
    for (const { nome, conta, camp, campComparacao, custo, conversoes } of [
      {nome:'Meta Ads',conta:ads().identificador,camp:'ma',campComparacao:'mb',custo:12.34,conversoes:[{tipo:'lead',valor:3}]},
      {nome:'Google Ads',conta:googleAds.identificador,camp:'ga',campComparacao:'gb',custo:5,conversoes:1.5},
    ]) {
      const principal = fontes.find(f => f.fonte === `${nome} · ${conta} · Período principal`);
      const comparacao = fontes.find(f => f.fonte === `${nome} · ${conta} · Período de comparação`);
      for (const [fonte,periodo,idCampanha] of [[principal,periodoPrincipal,camp],[comparacao,periodoComparacao,campComparacao]] as const) {
        expect(fonte?.identificador).toBe(conta);
        const evid = JSON.parse(fonte!.texto);
        expect(evid.periodo).toEqual(periodo);
        expect(evid.dados.metricas[0]).toMatchObject({id:idCampanha,moeda:'BRL',impressoes:expect.any(Number),cliques:expect.any(Number),custo,conversoes});
        if (nome === 'Meta Ads' && fonte === principal) expect(evid.dados.metricas[1].id).toBe('mc');
      }
    }
    expect((await hoje(b,fabiana)).aprovacoes.find(t => t.tarefa_id === disparo.tarefaId)).toMatchObject({modo:'A1',alvo:'Revisão interna'});
    expect(fetch.mock.calls.some(([url]) => new URL(url).pathname.endsWith('/3002'))).toBe(false);
  });

  it('não busca métricas de integração com outro projeto e preserva o período principal se a comparação falhar', async () => {
    const fetch = stubMetricas({integracaoDeOutroProjeto:true,comparacaoIndisponivel:true});
    await vincular(a,ads().identificador,true);
    await verificarConta(projeto);
    const plano = await planoFontes(b,tiago,a,null,['reportei','meta-ads'],'dados_atribuicao');
    const fontes = await consultarFontes(b,plano,periodoPrincipal,periodoComparacao);
    expect(fontes.find(f => f.fonte === 'Reportei · 3001')).toMatchObject({disponivel:false,identificador:'3001'});
    expect(fetch.mock.calls.some(([url]) => new URL(url).pathname.endsWith('/metrics/get-data'))).toBe(false);
    expect(fontes.find(f => f.fonte.endsWith('Período principal'))?.disponivel).not.toBe(false);
    expect(fontes.find(f => f.fonte.endsWith('Período de comparação'))).toMatchObject({disponivel:false,texto:expect.stringContaining('HTTP 503')});
  });

  it('retoma somente a janela perdida mais recente e não duplica mesmo com disparos concorrentes', async () => {
    const fetch = stubAds();
    await vincular(a,ads().identificador,true);
    fetch.mockClear();
    const id = await rotina();
    const [, manual] = await Promise.all([dispararRotinasVencidas(b,data),rodarRotinaAgora(b,tiago,id,data)]);
    expect(manual.tarefaId).toBeTruthy();
    expect(await historicoRotina(b,tiago,id)).toMatchObject([{ estado:'disparada',janela:'2026-11-23',tarefa_id:manual.tarefaId }]);
    expect((await listarRotinas(b,tiago))[0].proxima_execucao).toEqual(new Date('2026-11-24T12:00:00Z'));
    expect(fetch).not.toHaveBeenCalled();
    await processarFila(b,undefined,1,manual.tarefaId!);
    const vista = await hoje(b,fabiana);
    expect(vista.pendencias.some(t => t.id === manual.tarefaId && t.em_hoje)).toBe(true);
    const ap = vista.aprovacoes.find(t => t.tarefa_id === manual.tarefaId);
    expect(ap).toMatchObject({ modo:'A1',aprovador_id:'fabiana',alvo:'Revisão interna' });
    await decidirAprovacao(b,fabiana,ap!.id,'aprovada','Revisado.');
    expect(await b.query('select 1 from evidencias where tarefa_id=$1 and tipo=$2',[manual.tarefaId,'acao_solicitada'])).toHaveLength(0);
  });

  it('não dispara cliente inativo e registra o motivo', async () => {
    await atualizarFichaCliente(b,tiago,a,{ ...perfil,status:'inativo' });
    const id = await rotina();
    expect((await dispararRotinasVencidas(b,data))[0]).toMatchObject({ tarefaId:null,motivo:expect.stringContaining('inativo') });
    expect(await historicoRotina(b,tiago,id)).toMatchObject([{ estado:'ignorada' }]);
  });

  it('não dispara para papel desabilitado ou homologado com outro provedor', async () => {
    const id = await rotina();
    await b.query("update papeis set execucao_habilitada=false where id='dados_atribuicao'");
    expect((await rodarRotinaAgora(b,tiago,id,data)).motivo).toMatch(/desabilitado/);
    await b.query("update papeis set execucao_habilitada=true,homologado_com='outro' where id='dados_atribuicao'");
    expect((await rodarRotinaAgora(b,tiago,id,data)).motivo).toMatch(/não homologado/);
    expect(await historicoRotina(b,tiago,id)).toMatchObject([{ estado:'ignorada' },{ estado:'ignorada' }]);
  });

  it('registra a falta de vínculo verificado sem criar tarefa nem consultar fonte', async () => {
    const fetch = stubAds();
    await vincular(a);
    const id = await rotina();
    const [r] = await dispararRotinasVencidas(b,data);
    expect(r).toEqual({ tarefaId:null,motivo:'Conta de Meta Ads não vinculada ao cliente - quem resolve: direção' });
    expect(await historicoRotina(b,tiago,id)).toMatchObject([{ tarefa_id:null,estado:'ignorada' }]);
    expect(await b.query("select id from tarefas where origem_evento_id like $1",[`rotina:${id}:%`])).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('limita disparos somando manual e automático na última hora', async () => {
    vi.stubEnv('VX_ROTINAS_LIMITE_HORA','1');
    stubAds();
    await vincular(a,ads().identificador,true);
    const id = await rotina();
    const outra = await rotina();
    expect((await rodarRotinaAgora(b,tiago,id,data)).tarefaId).toBeTruthy();
    await dispararRotinasVencidas(b,data);
    expect(await historicoRotina(b,tiago,outra)).toMatchObject([{ estado:'ignorada', motivo:expect.stringContaining('Limite geral') }]);
  });

  it('com a chave geral desligada não dispara pelo relógio nem manualmente', async () => {
    const fetch = stubAds();
    await vincular(a,ads().identificador,true);
    fetch.mockClear();
    const id = await rotina();
    vi.stubEnv('VX_ROTINAS','desligado');
    expect(await dispararRotinasVencidas(b,data)).toEqual([]);
    expect((await rodarRotinaAgora(b,tiago,id,data)).tarefaId).toBeNull();
    expect(await historicoRotina(b,tiago,id)).not.toContainEqual(expect.objectContaining({ estado:'disparada' }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('limita o dia mensal ao fim do mês e usa a semana local', () => {
    const r = { frequencia:'mensal',dia:31,hora:'08:00' } as const;
    expect(horarioRotina(r,new Date('2027-02-01T12:30:00Z'),'proxima').toISOString()).toBe('2027-02-28T11:00:00.000Z');
    expect(janelaRotina({frequencia:'semanal',dia:1,hora:'08:00'},new Date('2026-11-23T01:00:00Z'))).toBe('2026-11-16');
    expect(semanaAnteriorAoPeriodo({inicio:'2027-01-04'})).toEqual({inicio:'2026-12-28',fim:'2027-01-03'});
  });
});
