import Image from 'next/image';

// Personagens realistas (render 3D, fundo transparente) em public/agentes/p01..p12.png.
// p01–p04 andando (perfil, virados para a direita) · p05–p08 conversando · p09–p12 trabalhando em pé.
// Tamanhos em px (todos na mesma escala, recortados de agentes gerados no estilo do prédio).
const DIM: [number, number][] = [[95, 176], [104, 178], [96, 174], [105, 177], [83, 177], [81, 180], [78, 177], [87, 178], [65, 178], [76, 177], [61, 178], [77, 179]];
const POSE = { anda: 0, conversa: 4, trabalha: 8 } as const;
export type Pose = keyof typeof POSE;
export type Base = 'habilitado' | 'piloto' | 'nenhum';

// Escolhe a pessoa pela semente (o mesmo agente mantém o mesmo rosto na mesma pose).
export const spriteDe = (pose: Pose, semente: number) => POSE[pose] + (semente % 4);

// Ciclo de caminhada: public/agentes/andar-1..4.png, 8 quadros lado a lado (DIM_ANDAR = tamanho de UM quadro) (mesmas pessoas de p01–p04),
// alinhados pelos pés e pelo eixo do tronco. Um ciclo = 2 passos ≈ 1,05 × a altura da pessoa.
const DIM_ANDAR: [number, number][] = [[128, 182], [168, 182], [128, 182], [168, 182]];
export const CICLO_S = .48;            // duração de um ciclo (2 passos), em segundos
export const PASSADA_POR_ALTURA = 1.05; // distância percorrida por ciclo / altura da pessoa

function BaseEstado({ base }: { base: Base }) {
  return (
    <>
      {base !== 'nenhum' && (
        <span aria-hidden className={`absolute -bottom-[2%] left-1/2 h-[5%] w-[70%] -translate-x-1/2 rounded-[50%] ${base === 'habilitado' ? 'bg-vx-verde/55 shadow-[0_0_6px_rgba(23,120,76,.6)]' : 'border border-vx-verde bg-white/70'}`} />
      )}
      <span aria-hidden className="absolute -bottom-[1%] left-1/2 h-[3%] w-[55%] -translate-x-1/2 rounded-[50%] bg-black/25 blur-[1px]" />
    </>
  );
}

// Pessoa andando: a tira de 8 quadros desliza dentro de uma janela do tamanho de um quadro.
// Parada, mostra o quadro 3 (passagem), que é a pose em pé de perfil.
export function PersonagemAndando({ pessoa, base, andando = true, ciclo = CICLO_S }: { pessoa: number; base: Base; andando?: boolean; ciclo?: number }) {
  const [w, h] = DIM_ANDAR[pessoa];
  return (
    <span className="relative block h-full" style={{ aspectRatio: `${w} / ${h}` }}>
      <BaseEstado base={base} />
      <span className="absolute inset-0 overflow-hidden">
        <Image src={`/agentes/andar-${pessoa + 1}.png`} alt="" width={w * 8} height={h} sizes="480px" draggable={false} unoptimized
          className={`block h-full w-[800%] max-w-none select-none ${andando ? 'vx-ciclo' : ''}`}
          style={andando ? { animationDuration: `${ciclo}s` } : { translate: '-25% 0' }} />
      </span>
    </span>
  );
}

const LARGURA_SENTADO = [53, 49, 55, 48];

export function PersonagemSentado({ pessoa, base, apagado }: { pessoa: number; base: Base; apagado: boolean }) {
  const largura = LARGURA_SENTADO[pessoa];
  return <span className="relative block h-full" style={{ aspectRatio: `${largura} / 96` }}>
    <BaseEstado base={base} />
    <Image src={`/agentes/sentado-${pessoa + 1}.webp`} alt="" width={largura} height={96} draggable={false} unoptimized
      className={`relative block h-full w-auto select-none ${apagado ? 'opacity-60 grayscale' : ''}`} />
  </span>;
}

export function Personagem({ sprite, virado = false, base, apagado = false }: { sprite: number; virado?: boolean; base: Base; apagado?: boolean }) {
  const [w, h] = DIM[sprite];
  return (
    <span className="relative block h-full" style={{ aspectRatio: `${w} / ${h}` }}>
      <BaseEstado base={base} />
      <Image src={`/agentes/p${String(sprite + 1).padStart(2, '0')}.png`} alt="" width={w} height={h} draggable={false} unoptimized
        className={`relative block h-full w-auto select-none ${virado ? '-scale-x-100' : ''} ${apagado ? 'opacity-60 grayscale' : ''}`} />
    </span>
  );
}
