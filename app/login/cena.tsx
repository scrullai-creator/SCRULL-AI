// Cena ilustrada do Scrull: céu de fim de tarde (roxo no alto, lilás e rosa no horizonte),
// estrelas, uma estrela cadente e colinas em camadas. Feita à mão em SVG, sem imagem externa.
const ESTRELAS = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1) * 1200, y: r(2) * 430, t: 0.6 + r(3) * 1.6, o: 0.35 + r(4) * 0.6, d: r(5) * 4 };
});

export function Cena({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-ceu`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140a33" />
          <stop offset=".38" stopColor="#3b1c86" />
          <stop offset=".66" stopColor="#8b45d6" />
          <stop offset=".86" stopColor="#e28ad6" />
          <stop offset="1" stopColor="#ffc2d9" />
        </linearGradient>
        <radialGradient id={`${id}-lua`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff3fb" />
          <stop offset=".55" stopColor="#ffd6ef" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffd6ef" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-c1`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a463e6" /><stop offset="1" stopColor="#6d32c4" /></linearGradient>
        <linearGradient id={`${id}-c2`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7c3bd4" /><stop offset="1" stopColor="#4a1d99" /></linearGradient>
        <linearGradient id={`${id}-c3`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4c1d95" /><stop offset="1" stopColor="#24104f" /></linearGradient>
      </defs>
      <rect width="1200" height="800" fill={`url(#${id}-ceu)`} />
      {ESTRELAS.map((e, i) => (
        <circle key={i} cx={e.x} cy={e.y} r={e.t} fill="#fff" opacity={e.o} className="estrela" style={{ animationDelay: `${e.d}s` }} />
      ))}
      <line className="cadente" x1="880" y1="70" x2="980" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      <circle cx="905" cy="300" r="120" fill={`url(#${id}-lua)`} opacity=".55" />
      <circle cx="905" cy="300" r="44" fill="#fff0fa" opacity=".95" />
      <path d="M0 520 C 140 450 260 470 380 520 S 620 600 760 520 S 1020 430 1200 500 L1200 800 L0 800 Z" fill={`url(#${id}-c1)`} />
      <path d="M0 600 C 180 540 300 560 460 610 S 760 680 920 600 S 1110 560 1200 590 L1200 800 L0 800 Z" fill={`url(#${id}-c2)`} />
      <path d="M0 690 C 200 640 360 650 520 700 S 860 760 1040 690 S 1160 670 1200 680 L1200 800 L0 800 Z" fill={`url(#${id}-c3)`} />
    </svg>
  );
}
