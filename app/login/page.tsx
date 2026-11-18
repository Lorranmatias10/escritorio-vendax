import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginLigado, LIMITE_FALHAS, JANELA_MIN } from '@/lib/auth';
import { contextoOpcional } from '@/lib/sessao';
import { entrar } from '@/app/acoes-auth';
import { botao, campo } from '@/components/ui';

const ERROS: Record<string, string> = {
  credenciais: 'E-mail ou senha incorretos.', dados: 'Preencha e-mail e senha.',
  sem_cadastro: 'Esta conta não está cadastrada no Escritório. Fale com a direção.',
  link: 'O link de acesso expirou ou já foi usado. Peça um novo à direção.',
  bloqueado: `Muitas tentativas erradas (${LIMITE_FALHAS}). Espere ${JANELA_MIN} minutos ou peça um link de acesso à direção.`,
};

export default async function Login({ searchParams }: PageProps<'/login'>) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  if (loginLigado() && (await contextoOpcional())) redirect('/hoje');
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-xl border border-vx-linha bg-white p-6">
      <h1 className="text-xl font-bold">Entrar no Escritório</h1>
      {!loginLigado() ? (
        <p className="mt-2 text-sm text-vx-texto-2">O login não está ligado neste ambiente (modo demonstração). <Link href="/hoje" className="underline">Continuar</Link></p>
      ) : (
        <form action={entrar} className="mt-4 space-y-3 text-sm">
          {sp.erro && <p role="alert" className="rounded-lg bg-vx-erro-claro p-2 text-vx-erro">{ERROS[sp.erro] ?? 'Não foi possível entrar.'}</p>}
          <label className="flex flex-col gap-1">E-mail<input name="email" type="email" autoComplete="email" required className={campo} /></label>
          <label className="flex flex-col gap-1">Senha<input name="senha" type="password" autoComplete="current-password" required className={campo} /></label>
          <button className={`${botao} w-full`}>Entrar</button>
          <p className="text-xs text-vx-texto-2">Primeiro acesso ou esqueceu a senha? Peça à direção um link de acesso.</p>
        </form>
      )}
    </div>
  );
}
