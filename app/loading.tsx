// Carregamento: esqueleto com a mesma estrutura das telas (cabeçalho + blocos), sem texto piscando.
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-vx-linha motion-reduce:animate-none" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-vx-linha/70 motion-reduce:animate-none" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-40 animate-pulse rounded-lg border border-vx-linha bg-vx-superficie motion-reduce:animate-none" />)}
      </div>
    </div>
  );
}
