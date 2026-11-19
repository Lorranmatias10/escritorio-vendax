import { contexto } from '@/lib/sessao';
import { definirSenha } from '@/app/acoes-auth';
import { botao, campo } from '@/components/ui';

const ERROS: Record<string, string> = {
  curta: 'Use pelo menos 10 caracteres.', diferente: 'As duas senhas não são iguais.',
  falhou: 'Não foi possível salvar. Tente de novo ou peça um novo link.',
};

export default async function DefinirSenha({ searchParams }: PageProps<'/definir-senha'>) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { u } = await contexto();
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-6">
      <h1 className="text-xl font-bold">Definir senha</h1>
      <p className="mt-1 text-sm text-vx-texto-2">Olá, {u.nome}. Escolha a senha que você vai usar para entrar.</p>
      <form action={definirSenha} className="mt-4 space-y-3 text-sm">
        {sp.erro && <p role="alert" className="rounded-lg bg-vx-erro-claro p-2 text-vx-erro">{ERROS[sp.erro] ?? 'Erro.'}</p>}
        <label className="flex flex-col gap-1">Nova senha (mínimo 10 caracteres)<input name="senha" type="password" autoComplete="new-password" minLength={10} required className={campo} /></label>
        <label className="flex flex-col gap-1">Repita a senha<input name="confirmacao" type="password" autoComplete="new-password" minLength={10} required className={campo} /></label>
        <button className={`${botao} w-full`}>Salvar senha</button>
      </form>
    </div>
  );
}
