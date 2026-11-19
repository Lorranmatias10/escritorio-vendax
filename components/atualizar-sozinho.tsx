'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Recarrega os dados do servidor de tempos em tempos (sem recarregar a página), só com a aba visível.
export function AtualizarSozinho({ segundos = 15 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
