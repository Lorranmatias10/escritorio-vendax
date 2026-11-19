import Link from 'next/link';
import { botaoSec } from '@/components/ui';

export default function NaoEncontrado() {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-lg border border-vx-linha bg-vx-superficie p-6 shadow-vx">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-1 text-sm text-vx-texto-2">O endereço não existe ou mudou. Use o menu para continuar.</p>
      <Link href="/hoje" className={`${botaoSec} mt-4`}>Ir para Hoje</Link>
    </div>
  );
}
