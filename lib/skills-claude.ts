export const FLUXOS_CLAUDE = {
  nextags: { papel: 'fluxos_campanhas_whatsapp', nome: 'NextTags', skills: ['especialista-nextags'] },
  perfil_google: { papel: 'web_presenca_local', nome: 'Perfil da Empresa no Google', skills: ['google-meu-negocio-expert'] },
  google_ads: { papel: 'especialista_google_ads', nome: 'Google Ads', skills: ['google-ads-medico', 'adspirer-google-ads'] },
  meta_ads: { papel: 'especialista_meta_ads', nome: 'Meta Ads', skills: ['meta-ads-medico', 'adspirer-meta-ads'] },
} as const;

export type FluxoClaude = keyof typeof FLUXOS_CLAUDE;

export const FLUXOS_CLAUDE_IDS = Object.keys(FLUXOS_CLAUDE) as FluxoClaude[];
export const PAPEIS_CLAUDE = [...new Set(FLUXOS_CLAUDE_IDS.map(id => FLUXOS_CLAUDE[id].papel))];
export const fluxosDoPapel = (papel: string) => FLUXOS_CLAUDE_IDS.filter(id => FLUXOS_CLAUDE[id].papel === papel);

export function fluxoClaude(id: unknown) {
  return typeof id === 'string' && Object.hasOwn(FLUXOS_CLAUDE, id) ? FLUXOS_CLAUDE[id as FluxoClaude] : undefined;
}

// Execuções de mídia já gravadas podem ser retomadas pelo papel original.
export const fluxoDoPapel = (fluxo: FluxoClaude, papel: string) =>
  FLUXOS_CLAUDE[fluxo].papel === papel || (papel === 'midia_paga' && (fluxo === 'google_ads' || fluxo === 'meta_ads'));
