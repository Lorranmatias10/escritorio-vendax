import { redirect } from 'next/navigation';
import { contexto } from '@/lib/sessao';
import { loginLigado } from '@/lib/auth';
import { dataHora } from '@/lib/formato';
import { salvarEmail } from '@/app/acoes-auth';
import { acaoAcessoClientes } from '@/app/acoes';
import { GerarLink } from '@/components/gerar-link';
import { botaoSec, campo, Cabecalho, Aviso, chip } from '@/components/ui';

type Pessoa = { id: string; nome: string; perfil: string; pode_financeiro: boolean; email: string | null; senha_definida_em: string | null; clientes: string[] };

export default async function Usuarios() {
  const { b, u } = await contexto();
  if (u.perfil !== 'admin') redirect('/hoje');
  const todos = await b.query<{ id: string; nome: string }>('select id, nome from clientes order by nome');
  const pessoas = await b.query<Pessoa>(
    `select u.id, u.nome, u.perfil, u.pode_financeiro, u.email, u.senha_definida_em,
            coalesce(array_agg(c.nome order by c.nome) filter (where c.id is not null), '{}') as clientes
     from usuarios u left join permissoes_cliente p on p.usuario_id = u.id left join clientes c on c.id = p.cliente_id
     group by u.id order by u.perfil, u.nome`);
  return (
    <div className="space-y-5">
      <Cabecalho titulo="Usuários" descricao="Cadastre o e-mail, gere o link de acesso e envie à pessoa: ela define a própria senha. O mesmo link serve para redefinir a senha." />
      {!loginLigado() && <Aviso tom="alerta" titulo="Login desligado neste ambiente.">Os e-mails já podem ser cadastrados; o login liga com VX_LOGIN=ligado no servidor.</Aviso>}
      <div className="grid gap-3 md:grid-cols-2">
        {pessoas.map(p => (
          <article key={p.id} className="rounded-lg border border-vx-linha bg-vx-superficie shadow-vx p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-base font-semibold">{p.nome}</h2>
              <span className={`${chip} border-vx-linha-forte bg-white`}>{p.perfil === 'admin' ? 'Direção' : 'Equipe'}</span>
              {p.pode_financeiro && <span className={`${chip} border-vx-linha-forte bg-white`}>Financeiro</span>}
              <span className={`${chip} ${p.senha_definida_em ? 'border-vx-verde/25 bg-vx-verde-claro text-vx-verde-escuro' : 'border-vx-linha bg-vx-fundo text-vx-texto-2'}`}>{p.senha_definida_em ? `✓ Senha definida em ${dataHora(p.senha_definida_em)}` : '○ Sem senha'}</span>
            </div>
            {p.perfil === 'admin' ? <p className="mt-1 text-vx-texto-2">Clientes: todos (direção)</p> : (
              <form action={acaoAcessoClientes} className="mt-3">
                <input type="hidden" name="usuario" value={p.id} />
                <fieldset>
                  <legend className="text-xs font-medium text-vx-texto-2">Clientes que {p.nome} pode acessar</legend>
                  {todos.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {todos.map(c => (
                        <label key={c.id} className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-vx-linha px-2 text-sm has-[:checked]:border-vx-verde/40 has-[:checked]:bg-vx-verde-claro">
                          <input type="checkbox" name="clientes" value={c.id} defaultChecked={p.clientes.includes(c.nome)} className="accent-vx-verde" />{c.nome}
                        </label>
                      ))}
                    </div>
                  ) : <p className="mt-1 text-vx-texto-2">Nenhum cliente cadastrado ainda. Cadastre em Clientes.</p>}
                </fieldset>
                {todos.length > 0 && <button className={`${botaoSec} mt-2`}>Salvar acessos</button>}
              </form>
            )}
            <form action={salvarEmail} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="usuario" value={p.id} />
              <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs font-medium text-vx-texto-2">E-mail de login<input name="email" type="email" defaultValue={p.email ?? ''} required className={campo} /></label>
              <button className={botaoSec}>Salvar</button>
            </form>
            {p.email && <div className="mt-3"><GerarLink usuario={p.id} nome={p.nome} /></div>}
          </article>
        ))}
      </div>
    </div>
  );
}
