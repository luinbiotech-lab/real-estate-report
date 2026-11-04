import { useId } from 'react';

/*
 * DA:ON monogram (owner request 2026-11-04: "use the existing DA:ON logo, or make it again if there is none").
 * No logo file existed in the repository, so this vector mark redraws the monogram of the owner's reference report:
 * a gold "D" whose stem is formed by rising building towers. Vector so it stays sharp in print and needs no image file.
 */
export function DaonMark({ className = '', title = 'DA:ON' }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  const gold = `daon-mark-gold-${id}`;
  return <svg className={className} viewBox="0 0 64 72" role="img" aria-label={title} focusable="false">
    <defs>
      <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f3d896" />
        <stop offset="0.55" stopColor="#d2a14c" />
        <stop offset="1" stopColor="#a8711f" />
      </linearGradient>
    </defs>
    {/* D bowl */}
    <path d="M22 8h10c17 0 28 12 28 28S49 64 32 64H22" fill="none" stroke={`url(#${gold})`} strokeWidth="6" strokeLinejoin="round" />
    {/* stem: three towers rising left to right */}
    <rect x="4" y="30" width="6" height="34" fill={`url(#${gold})`} />
    <rect x="12" y="18" width="6" height="46" fill={`url(#${gold})`} />
    <rect x="20" y="4" width="6" height="60" fill={`url(#${gold})`} />
    <path d="M20 4l6-2v2z" fill={`url(#${gold})`} />
    {/* window slits on the tallest tower */}
    <g fill="#ffffff" opacity="0.35"><rect x="22" y="14" width="2" height="6" /><rect x="22" y="26" width="2" height="6" /><rect x="22" y="38" width="2" height="6" /><rect x="14" y="28" width="2" height="6" /><rect x="14" y="40" width="2" height="6" /></g>
    <rect x="2" y="64" width="34" height="3" fill={`url(#${gold})`} />
  </svg>;
}
