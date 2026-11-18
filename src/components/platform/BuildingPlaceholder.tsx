/*
 * Designed stand-in for a listing without a public photo (2026-11-18, 루치오: "물건의 외모도 중요해, 첫인상").
 * An illustration, clearly not a photograph: it never shows the real building and is labelled as such, so it cannot be
 * mistaken for field evidence (Bangbae 815-11 media policy, no synthetic visual as an actual photograph).
 */
export default function BuildingPlaceholder({ note, place, compact = false }: { note: string; place?: string; compact?: boolean }) {
  const windows: Array<[number, number, boolean]> = [];
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 5; col += 1) windows.push([452 + col * 62, 196 + row * 52, (row * 5 + col) % 7 === 2 || (row * 3 + col) % 9 === 4]);
  }
  return <span className={`building-placeholder ${compact ? 'compact' : ''}`} role="img" aria-label={`건물 일러스트 (실제 사진 아님). ${note}`}>
    <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b2545" /><stop offset="0.62" stopColor="#1d4a7e" /><stop offset="1" stopColor="#d9b876" /></linearGradient>
        <linearGradient id="bp-front" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#f4f1ea" /><stop offset="1" stopColor="#ddd5c4" /></linearGradient>
        <linearGradient id="bp-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b9ae98" /><stop offset="1" stopColor="#9c917c" /></linearGradient>
        <linearGradient id="bp-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c5b8f" /><stop offset="1" stopColor="#173a63" /></linearGradient>
      </defs>
      <rect width="1200" height="640" fill="url(#bp-sky)" />
      <g fill="#ffffff" opacity="0.08">
        <rect x="70" y="250" width="150" height="390" rx="4" /><rect x="236" y="310" width="120" height="330" rx="4" />
        <rect x="880" y="220" width="140" height="420" rx="4" /><rect x="1036" y="300" width="110" height="340" rx="4" />
      </g>
      <polygon points="760,170 820,140 820,560 760,600" fill="url(#bp-side)" />
      <rect x="430" y="170" width="330" height="430" fill="url(#bp-front)" />
      <rect x="420" y="158" width="350" height="16" rx="3" fill="#0b2545" opacity="0.85" />
      {windows.map(([x, y, lit]) => <rect key={`${x}-${y}`} x={x} y={y} width="44" height="34" rx="3" fill={lit ? '#f5d58c' : 'url(#bp-glass)'} opacity={lit ? 0.95 : 0.9} />)}
      <rect x="430" y="520" width="330" height="80" fill="#0b2545" opacity="0.9" />
      <rect x="560" y="540" width="70" height="60" rx="3" fill="#f5d58c" opacity="0.85" />
      <rect x="0" y="600" width="1200" height="40" fill="#0a1f3a" opacity="0.55" />
    </svg>
    <span className="building-placeholder-caption">
      {place && !compact && <b>{place}</b>}
      <span>{compact ? '일러스트' : note}</span>
    </span>
  </span>;
}
