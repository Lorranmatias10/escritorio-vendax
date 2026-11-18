// Catálogo versionado de instruções: agentes/instrucoes/v<versão>.md
// Cada arquivo traz a instrução comum e os 23 blocos individuais (formato de Escritorio_Vendax_Instrucoes_dos_23_Agentes.md).
// Mudança operacional = novo arquivo de versão; as versões anteriores ficam preservadas no banco e no git.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type InstrucaoPapel = { numero: number; id: string; nome: string; fase: 1 | 2 | 3; dono: string; bloco: string };
export type VersaoInstrucoes = { versao: string; arquivo: string; comum: string; papeis: InstrucaoPapel[]; casos: { cenario: string; esperado: string }[] };

const semCitacao = (s: string) => s.split('\n').map(l => l.replace(/^>\s?/, '')).join('\n').trim();

export function lerVersao(texto: string, arquivo = ''): VersaoInstrucoes {
  const versao = texto.match(/\*\*Versão ([\d.]+)/)?.[1];
  if (!versao) throw new Error(`Versão não encontrada em ${arquivo}`);
  const comumBruto = texto.split(/^## Instrução comum.*$/m)[1]?.split(/^## /m)[0];
  if (!comumBruto) throw new Error(`Instrução comum não encontrada em ${arquivo}`);
  const papeis: InstrucaoPapel[] = [];
  for (const parte of texto.split(/^### /m).slice(1)) {
    const [titulo, ...resto] = parte.split('\n');
    const cab = titulo.match(/^(\d{2}) · (.+)$/);
    const corpo = resto.join('\n').split(/^## /m)[0];
    const meta = corpo.match(/\*\*ID\*\*\s+(\S+)\s+·\s+\*\*Fase\*\*\s+(\d)\s+·\s+\*\*(?:Donos? propostos?|Donas? propostas?)\*\*\s+(.+)/);
    if (!cab || !meta) throw new Error(`Bloco inválido em ${arquivo}: "${titulo}"`);
    papeis.push({
      numero: Number(cab[1]), nome: cab[2].trim(), id: meta[1], fase: Number(meta[2]) as 1 | 2 | 3, dono: meta[3].trim(),
      bloco: corpo.replace(meta[0], '').trim(),
    });
  }
  const tabela = texto.split(/^## Casos para homologar.*$/m)[1] ?? '';
  const casos = tabela.split('\n').filter(l => /^\|/.test(l) && !/^\|\s*-/.test(l)).slice(1)
    .map(l => l.split('|').map(c => c.trim())).map(c => ({ cenario: c[1], esperado: c[2] }));
  return { versao, arquivo, comum: semCitacao(comumBruto), papeis, casos };
}

// Texto que o agente recebe: instrução comum + bloco do papel.
export const compor = (v: VersaoInstrucoes, p: InstrucaoPapel) =>
  `# Instrução comum (v${v.versao})\n\n${v.comum}\n\n# ${String(p.numero).padStart(2, '0')} · ${p.nome} (${p.id})\n\n${p.bloco}`;

export function lerCatalogoInstrucoes(dir = path.join(process.cwd(), 'agentes', 'instrucoes')): VersaoInstrucoes[] {
  return readdirSync(dir).filter(f => /^v[\d.]+\.md$/.test(f)).sort()
    .map(f => lerVersao(readFileSync(path.join(dir, f), 'utf8'), f));
}
