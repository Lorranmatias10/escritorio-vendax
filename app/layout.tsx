import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { contextoOpcional } from '@/lib/sessao';
import { sair } from './acoes-auth';
import { loginLigado } from '@/lib/auth';
import { usuarios, listarAprovacoes, hoje } from '@/lib/dados';
import { trocarUsuario } from './acoes';
import { Nav } from '@/components/nav';
import { ultimosTestes } from '@/lib/integracoes';

const fonte = Inter({ variable: '--font-vx', subsets: ['latin'] });

export const metadata: Metadata = { title: 'Escritório Vendax', description: 'Clientes, tarefas, especialistas de IA, incidentes e aprovações.' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const ctx = await contextoOpcional();
  const marca = <div className="text-xl font-bold tracking-tight">venda<span className="text-vx-verde">x</span> <span className="text-sm font-medium text-vx-texto-2">Escritório</span></div>;
  let topo = marca;
  if (ctx) {
    const { b, u, modo } = ctx;
    const [lista, pend, h, testes] = await Promise.all([usuarios(b), listarAprovacoes(b, u, 'pendente'), hoje(b, u), ultimosTestes(b)]);
    topo = (
      <>
        {marca}
        <Nav admin={u.perfil === 'admin'} contadores={{ hoje: h.pendencias.length + h.bloqueadas.length, aprovacoes: pend.length, integracoes: testes.filter(t => t.status === 'erro').length }} />
        {modo === 'login' ? (
          <form action={sair} className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-vx-texto-2">{u.nome}{u.perfil === 'admin' ? ' · direção' : ''}</span>
            <button className="rounded-lg border border-vx-linha px-2.5 py-1.5 font-medium hover:bg-vx-fundo">Sair</button>
          </form>
        ) : (
          <form action={trocarUsuario} className="ml-auto flex items-center gap-2 text-sm">
            <label htmlFor="usuario" className="text-vx-texto-2">Ver como <span className="text-xs">(Demonstração)</span></label>
            <select key={u.id} id="usuario" name="usuario" defaultValue={u.id} className="rounded-lg border border-vx-linha bg-white px-2 py-1.5">
              {lista.map(x => <option key={x.id} value={x.id}>{x.nome}{x.perfil === 'admin' ? ' · direção' : ''}</option>)}
            </select>
            <button className="rounded-lg border border-vx-linha px-2.5 py-1.5 font-medium hover:bg-vx-fundo">Trocar</button>
          </form>
        )}
      </>
    );
  }
  return (
    <html lang="pt-BR" className={`${fonte.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">Pular para o conteúdo</a>
        <header className="border-b border-vx-linha bg-vx-superficie">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">{topo}</div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-vx-linha py-3 text-center text-xs text-vx-texto-2">
          {loginLigado() ? 'Escritório Vendax' : 'V1 local · modo demonstração'} · fuso America/Sao_Paulo · ações externas desabilitadas · dados marcados como Demonstração são sintéticos
        </footer>
      </body>
    </html>
  );
}
