'use client';
import Link from 'next/link';
import { botao, botaoSec } from '@/components/ui';

// Erro: diz o que houve e oferece o próximo passo. Detalhe técnico só pelo código de referência.
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const semAcesso = error.name === 'SemAcesso' || /acesso/i.test(error.message);
  return (
    <div role="alert" className="mx-auto mt-6 max-w-lg rounded-lg border border-vx-linha bg-vx-superficie p-6 shadow-vx">
      <h1 className="text-xl font-semibold">{semAcesso ? 'Sem acesso a este conteúdo' : 'Não foi possível carregar esta tela'}</h1>
      <p className="mt-1 text-sm text-vx-texto-2">
        {semAcesso ? 'O registro pertence a um cliente ou área que o seu usuário não pode ver.' : 'A consulta ao servidor falhou. Tente de novo; se continuar, avise o Lorran com o código abaixo.'}
      </p>
      {error.digest && <p className="tabular mt-2 text-xs text-vx-texto-2">Código: {error.digest}</p>}
      <div className="mt-4 flex gap-2">
        {!semAcesso && <button onClick={reset} className={botao}>Tentar de novo</button>}
        <Link href="/hoje" className={botaoSec}>Ir para Hoje</Link>
      </div>
    </div>
  );
}
