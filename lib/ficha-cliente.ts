import { z } from 'zod';
import type { Q } from './db';
import { filtroSql, podeVer, SemAcesso, type Usuario } from './escopo';

export const STATUS_CLIENTE = { ativo: 'Ativo', sazonal: 'Sazonal', proposta: 'Proposta', inativo: 'Inativo' } as const;
export const statusCliente = z.enum(['ativo','sazonal','proposta','inativo']);
export type StatusCliente = z.infer<typeof statusCliente>;
export const operacoesVendax = ['vendax', 'vendax-produtos', 'operacao-interna-vendax'];
export const TIPOS_CONTA = {
  conta_anuncio: 'Conta de anúncio', customer_id: 'Customer ID', funil: 'Funil',
  waba: 'WABA', numero_whatsapp: 'Número de WhatsApp', projeto_reportei: 'Projeto do Reportei',
  calendario: 'Calendário', espaco_crm: 'Espaço exclusivo do CRM', conta_nexttags: 'Conta NextTags',
} as const;
export const FONTES_CLIENTE = {
  'meta-ads': { nome: 'Meta Ads', tipos: ['conta_anuncio'] },
  'google-ads': { nome: 'Google Ads', tipos: ['customer_id'] },
  reportei: { nome: 'Reportei', tipos: ['projeto_reportei'] },
  crm: { nome: 'CRM Vendax', tipos: ['espaco_crm', 'customer_id'] },
  nexttags: { nome: 'NextTags', tipos: ['conta_nexttags', 'waba', 'numero_whatsapp'] },
  'vendax-app': { nome: 'Vendax App', tipos: ['funil','waba','numero_whatsapp'] },
  'google-workspace': { nome: 'Google Workspace', tipos: ['calendario'] },
} as const;
export const idsFontes = ['meta-ads','google-ads','reportei','crm','nexttags','vendax-app','google-workspace'] as const;
export const fonteCliente = z.enum(idsFontes);
export type FonteCliente = z.infer<typeof fonteCliente>;
export type TipoConta = keyof typeof TIPOS_CONTA;
export type ContaCliente = {
  id: string; cliente_id: string; integracao: FonteCliente; tipo: TipoConta; identificador: string;
  rotulo: string; verificado_em: string | null; verificado_por: string | null; verificador?: string | null; versao: number;
};
export const dadosFichaCliente = z.object({
  status: statusCliente.nullable(),
  responsavel_id: z.string().min(1).max(150).nullable(),
  contato_nome: z.string().trim().min(2).max(120).nullable(),
  contato_whatsapp: z.string().regex(/^\+[1-9][0-9]{7,14}$/).nullable(),
});
export const dadosContaCliente = z.object({
  integracao: fonteCliente,
  tipo: z.enum(Object.keys(TIPOS_CONTA) as [TipoConta, ...TipoConta[]]),
  rotulo: z.string().trim().min(2).max(120),
  identificador: z.string().trim().max(200),
}).transform(c => ({
  ...c,
  identificador: c.tipo === 'conta_anuncio' ? c.identificador.replace(/^act_/i,'')
    : c.integracao === 'google-ads' ? c.identificador.replaceAll('-','')
    : c.tipo === 'numero_whatsapp' ? c.identificador.replace(/[+() .-]/g,'') : c.identificador,
})).refine(c => {
  if (!(FONTES_CLIENTE[c.integracao].tipos as readonly TipoConta[]).includes(c.tipo)) return false;
  if (c.integracao === 'google-ads') return /^\d{10}$/.test(c.identificador);
  if (['meta-ads','crm','nexttags'].includes(c.integracao)) return /^\d{1,24}$/.test(c.identificador);
  if (c.integracao === 'google-workspace') return /^[^\s/@]+@[^\s/@]+$/.test(c.identificador);
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,180}$/.test(c.identificador);
}, 'Confira o tipo de conta e o identificador informado.');

export function lacunaConta(fonte: FonteCliente) {
  return `Conta de ${FONTES_CLIENTE[fonte].nome} não vinculada ao cliente - quem resolve: direção`;
}

export async function obterFichaCliente(q: Q, u: Usuario, id: string) {
  const params: unknown[] = [id];
  const escopo = filtroSql(u, params, 'c.id', null);
  const [ficha] = await q.query<z.infer<typeof dadosFichaCliente> & { id: string; nome: string; responsavel: string | null }>(
    `select c.id,c.nome,c.status,c.responsavel_id,p.nome as responsavel,c.contato_nome,c.contato_whatsapp
     from clientes c left join usuarios p on p.id=c.responsavel_id where c.id=$1 and not c.demo and ${escopo}`, params);
  return ficha ?? null;
}

export async function contasDoCliente(q: Q, u: Usuario, cliente: string) {
  if (!podeVer(u, cliente, null)) throw new SemAcesso();
  return q.query<ContaCliente>(`select a.*,p.nome as verificador from contas_cliente a
    left join usuarios p on p.id=a.verificado_por join clientes c on c.id=a.cliente_id
    where a.cliente_id=$1 and not c.demo order by a.integracao,a.rotulo,a.id`,[cliente]);
}
