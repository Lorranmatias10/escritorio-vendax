import { redirect } from 'next/navigation';
import { contexto } from '@/lib/sessao';
import { loginLigado } from '@/lib/auth';
import { dataHora } from '@/lib/formato';
import { salvarEmail } from '@/app/acoes-auth';
import { GerarLink } from '@/components/gerar-link';
import { botaoSec, campo } from '@/components/ui';

type Pessoa = { id: string; nome: string; perfil: string; pode_financeiro: boolean; email: string | null; senha_definida_em: string | null; clientes: string[] };

export default async function Usuarios() {
  const { b, u } = await contexto();
  if (u.perfil !== 'admin') redirect('/hoje');
  const pessoas = await b.query<Pessoa>(
    `select u.id, u.nome, u.perfil, u.pode_financeiro, u.email, u.senha_definida_em,
            coalesce(array_agg(c.nome order by c.nome) filter (where c.id is not null), '{}') as clientes
     from usuarios u left join permissoes_cliente p on p.usuario_id = u.id left join clientes c on c.id = p.cliente_id
     group by u.id order by u.perfil, u.nome`);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-vx-texto-2">Login com e-mail e senha. Cadastre o e-mail, gere o link de acesso e envie à pessoa: ela define a própria senha. O mesmo botão serve para redefinir a senha.</p>
      </div>
      {!loginLigado() && <p role="note" className="rounded-xl border border-vx-alerta/40 bg-vx-alerta-claro p-3 text-sm">O login ainda não está ligado neste ambiente (modo demonstração). Os e-mails já podem ser cadastrados; o login liga com VX_LOGIN=ligado no servidor.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {pessoas.map(p => (
          <article key={p.id} className="rounded-xl border border-vx-linha bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold">{p.nome}</h2>
              <span className="rounded-full border border-vx-linha px-2 text-xs">{p.perfil === 'admin' ? 'Direção' : 'Equipe'}</span>
              {p.pode_financeiro && <span className="rounded-full border border-vx-linha px-2 text-xs">Financeiro</span>}
              <span className={`rounded-full px-2 text-xs ${p.senha_definida_em ? 'bg-vx-verde-claro text-vx-verde-escuro' : 'bg-vx-fundo text-vx-texto-2'}`}>{p.senha_definida_em ? `✓ Senha definida em ${dataHora(p.senha_definida_em)}` : '○ Sem senha'}</span>
            </div>
            <p className="mt-1 text-vx-texto-2">Clientes: {p.perfil === 'admin' ? 'todos' : p.clientes.length ? p.clientes.join(', ') : 'nenhum'}</p>
            <form action={salvarEmail} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="usuario" value={p.id} />
              <label className="flex flex-1 flex-col gap-1">E-mail de login<input name="email" type="email" defaultValue={p.email ?? ''} required className={campo} /></label>
              <button className={botaoSec}>Salvar</button>
            </form>
            {p.email && <div className="mt-3"><GerarLink usuario={p.id} nome={p.nome} /></div>}
          </article>
        ))}
      </div>
    </div>
  );
}
