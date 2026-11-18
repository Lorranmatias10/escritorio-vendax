// Teste automático das integrações a cada 30 minutos, dentro do próprio servidor (sem serviço extra).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.VX_DB === 'memoria') return;
  const g = globalThis as unknown as { __vxAgendaIntegracoes?: NodeJS.Timeout };
  if (g.__vxAgendaIntegracoes) return;
  const rodar = async () => {
    try {
      const [{ banco }, { testarTodas }] = await Promise.all([import('./lib/db'), import('./lib/integracoes')]);
      await testarTodas(await banco(), 'agendado', null);
    } catch (e) { console.error('[integrações] teste agendado falhou:', e instanceof Error ? e.message : e); }
  };
  g.__vxAgendaIntegracoes = setInterval(rodar, 30 * 60_000);
}
