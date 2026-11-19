import type { Metadata } from 'next';
import Link from 'next/link';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { contextoOpcional } from '@/lib/sessao';
import { sair } from './acoes-auth';
import { loginLigado } from '@/lib/auth';
import { usuarios, listarAprovacoes, hoje } from '@/lib/dados';
import { trocarUsuario } from './acoes';
import { Nav } from '@/components/nav';
import { botaoSec, campo } from '@/components/ui';
import { ultimosTestes } from '@/lib/integracoes';

const fonte = IBM_Plex_Sans({ variable: '--font-vx', subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = { title: 'Escritório Vendax', description: 'Clientes, tarefas, especialistas de IA, incidentes e aprovações.' };
export const dynamic = 'force-dynamic';

const Marca = () => (
  <Link href="/hoje" className="flex items-baseline gap-2 rounded-md">
    <span className="text-[22px] font-bold leading-none tracking-tight text-vx-grafite">venda<span className="text-vx-verde">x</span></span>
    <span className="text-sm font-medium text-vx-texto-2">Escritório</span>
  </Link>
);

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const ctx = await contextoOpcional();
  let lateral: React.ReactNode = null;
  if (ctx) {
    const { b, u, modo } = ctx;
    const [lista, pend, h, testes] = await Promise.all([usuarios(b), listarAprovacoes(b, u, 'pendente'), hoje(b, u), ultimosTestes(b)]);
    lateral = (
      <>
        <Nav admin={u.perfil === 'admin'} contadores={{ hoje: h.pendencias.length + h.bloqueadas.length, aprovacoes: pend.length, integracoes: testes.filter(t => t.status === 'erro').length }} />
        <div className="border-t border-vx-linha pt-2 lg:mt-auto lg:pt-3">
          {modo === 'login' ? (
            <form action={sair} className="flex items-center gap-2 text-sm">
              <span className="mr-auto min-w-0 truncate"><span className="font-medium">{u.nome}</span>{u.perfil === 'admin' && <span className="text-vx-texto-2"> · direção</span>}</span>
              <button className={botaoSec}>Sair</button>
            </form>
          ) : (
            <form action={trocarUsuario} className="flex items-center gap-2 text-sm lg:flex-wrap lg:items-end">
              <label htmlFor="usuario" className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-vx-texto-2 lg:flex-col lg:items-stretch lg:gap-1">
                <span className="shrink-0">Ver como<span className="hidden lg:inline"> (sem login)</span></span>
                <select key={u.id} id="usuario" name="usuario" defaultValue={u.id} className={`${campo} w-full`}>
                  {lista.map(x => <option key={x.id} value={x.id}>{x.nome}{x.perfil === 'admin' ? ' · direção' : ''}</option>)}
                </select>
              </label>
              <button className={botaoSec}>Trocar</button>
            </form>
          )}
        </div>
      </>
    );
  }
  return (
    <html lang="pt-BR" className={`${fonte.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:p-2 focus:shadow-vx-alto">Pular para o conteúdo</a>
        <div className="lg:grid lg:min-h-screen lg:grid-cols-[232px_1fr]">
          <aside className="z-30 flex flex-col gap-2 border-b border-vx-linha bg-vx-superficie px-4 pb-2.5 pt-3 lg:sticky lg:top-0 lg:h-screen lg:gap-5 lg:border-b-0 lg:border-r lg:px-3 lg:py-5">
            <div className="px-1 lg:px-2"><Marca /></div>
            {lateral}
          </aside>
          <div className="flex min-w-0 flex-col">
            <main id="conteudo" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            <footer className="border-t border-vx-linha px-4 py-3 text-center text-xs text-vx-texto-2 sm:px-6 lg:px-8">
              {loginLigado() ? 'Escritório Vendax' : 'Escritório Vendax, ambiente local sem login'}. Fuso America/Sao_Paulo. Ações externas desabilitadas na V1.
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
