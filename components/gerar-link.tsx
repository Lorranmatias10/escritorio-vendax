'use client';
import { useActionState } from 'react';
import { gerarLinkAcesso } from '@/app/acoes-auth';

// Mostra o link uma única vez, só para quem gerou. Ele não fica gravado no Escritório.
export function GerarLink({ usuario, nome }: { usuario: string; nome: string }) {
  const [estado, acao, pendente] = useActionState(gerarLinkAcesso, {} as { link?: string; erro?: string });
  return (
    <form action={acao} className="space-y-1">
      <input type="hidden" name="usuario" value={usuario} />
      <button disabled={pendente} className="rounded-lg border border-vx-linha bg-white px-3 py-1.5 text-sm font-semibold hover:bg-vx-fundo disabled:opacity-60">
        {pendente ? 'Gerando…' : 'Gerar link de acesso'}
      </button>
      {estado.erro && <p role="alert" className="text-xs text-vx-erro">{estado.erro}</p>}
      {estado.link && (
        <div className="rounded-lg border border-vx-alerta/40 bg-vx-alerta-claro p-2 text-xs">
          <p className="font-semibold">Link para {nome} (uso único, expira em 24 horas). Envie só para essa pessoa:</p>
          <input readOnly value={estado.link} aria-label={`Link de acesso de ${nome}`} onFocus={e => e.currentTarget.select()}
            className="mt-1 w-full rounded border border-vx-linha bg-white px-2 py-1 font-mono" />
        </div>
      )}
    </form>
  );
}
