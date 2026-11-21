// Teste automático das integrações a cada 30 minutos, dentro do próprio servidor (sem serviço extra).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.VX_DB === 'memoria') return;
  const g = globalThis as unknown as { __vxAgendaIntegracoes?: NodeJS.Timeout; __vxFilaDiretor?: NodeJS.Timeout; __vxRotinas?: NodeJS.Timeout };
  if (!g.__vxFilaDiretor && process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    let ocupada = false;
    g.__vxFilaDiretor = setInterval(async () => {
      if (ocupada) return;
      ocupada = true;
      try {
        const [{ banco }, { processarFila }] = await Promise.all([import('./lib/db'), import('./lib/orquestracao')]);
        await processarFila(await banco(), undefined, 8, undefined, true);
      } catch (e) { console.error('[diretor] erro na fila:', e instanceof Error ? e.message : e); }
      finally { ocupada = false; }
    }, 5_000);
    g.__vxFilaDiretor.unref();
  }
  if (!g.__vxRotinas && process.env.VX_ROTINAS === 'ligado') {
    let ocupada = false;
    const verificar = async () => {
      if (ocupada) return;
      ocupada = true;
      try {
        const [{ banco }, { dispararRotinasVencidas, processarFila }] = await Promise.all([import('./lib/db'), import('./lib/orquestracao')]);
        const b = await banco();
        await dispararRotinasVencidas(b);
        if (!g.__vxFilaDiretor) await processarFila(b, undefined, 8, undefined, true);
      } catch (e) { console.error('[rotinas] erro no agendador:', e instanceof Error ? e.message : e); }
      finally { ocupada = false; }
    };
    g.__vxRotinas = setInterval(verificar, 60_000);
    g.__vxRotinas.unref();
  }
  if (g.__vxAgendaIntegracoes) return;
  const rodar = async () => {
    try {
      const [{ banco }, { testarTodas }] = await Promise.all([import('./lib/db'), import('./lib/integracoes')]);
      await testarTodas(await banco(), 'agendado', null);
    } catch (e) { console.error('[integrações] teste agendado falhou:', e instanceof Error ? e.message : e); }
  };
  g.__vxAgendaIntegracoes = setInterval(rodar, 30 * 60_000);
}
