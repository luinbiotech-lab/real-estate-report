import { useState } from 'react';
import { VERIFICATION_LABELS } from '../../domain/propertyDataRoom/labels';
import type { PropertyDataSource, VerificationStatus } from '../../domain/propertyDataRoom/types';
import { marketPosition, type MarketPoint } from '../../domain/propertyDetail/marketPosition';
import { formatUnitPricePerPyeong } from '../../domain/propertyDetail/propertyDetailModel';
import type { Property } from '../../types';

const signedPct = (ratio: number) => { const v = Math.round(ratio * 1000) / 10; return `${v > 0 ? '+' : ''}${v}%`; };

const W = 640;
const H = 220;
const PAD = { l: 92, r: 16, t: 14, b: 30 };

function chartScales(points: MarketPoint[], subject: number | null) {
  const times = points.map((p) => Date.parse(p.tradeDate));
  const values = points.map((p) => p.landUnitPrice).concat(subject ? [subject] : []);
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const span = t1 - t0 || 86_400_000 * 30;
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const vPad = (vMax - vMin) * 0.12 || vMax * 0.1;
  const lo = Math.max(0, vMin - vPad);
  const hi = vMax + vPad;
  // Dots stay clear of the right-hand gutter where the reference-line labels sit.
  const x0 = PAD.l + 12;
  const x1 = W - PAD.r - 150;
  const x = (date: string) => x0 + ((Date.parse(date) - (t1 === t0 ? t0 - span / 2 : t0)) / span) * (x1 - x0);
  const y = (value: number) => PAD.t + (1 - (value - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.5, 1].map((f) => lo + (hi - lo) * f);
  return { x, y, ticks };
}

export default function MarketPositionPanel({ property, sources, compact = false, onOpenMarket }: {
  property: Property;
  sources: PropertyDataSource[];
  compact?: boolean;
  onOpenMarket?: () => void;
}) {
  const position = marketPosition(property, sources);
  const [active, setActive] = useState<MarketPoint | null>(null);
  const status = position.verificationStatus as VerificationStatus | undefined;

  return <section className={`market-position ${compact ? 'is-compact' : ''}`} aria-label="시세 위치">
    <header className="market-position-head">
      <div><p className="eyebrow">MARKET POSITION</p><h2>시세 위치</h2></div>
      <span className="market-position-tags">
        <span className="tag">비교거래 {position.count}건</span>
        {status && <span className="tag">{VERIFICATION_LABELS[status] ?? status}</span>}
      </span>
    </header>
    <p className={`market-position-headline band-${position.band}`}>{position.headline}</p>

    {position.count > 0 && <>
      <dl className="market-position-stats">
        <div><dt>대상 평당가 <small>계산값</small></dt><dd>{position.subjectUnitPrice ? formatUnitPricePerPyeong(position.subjectUnitPrice) : '계산 불가'}</dd></div>
        <div><dt>비교 중앙값</dt><dd>{formatUnitPricePerPyeong(position.median)}</dd></div>
        <div><dt>비교 범위</dt><dd>{formatUnitPricePerPyeong(position.min).replace('만/평', '')}~{formatUnitPricePerPyeong(position.max)}</dd></div>
        <div><dt>최근 거래일</dt><dd>{position.latestTradeDate}</dd></div>
      </dl>

      {!compact && <MarketChart points={position.points} subject={position.subjectUnitPrice} median={position.median} active={active} onActive={setActive} />}

      {!compact && <table className="market-position-table" aria-label="비교거래 목록">
        <thead><tr><th>사례</th><th>거래일</th><th>토지 평당가</th><th>대상 평당가 차이</th></tr></thead>
        <tbody>{position.points.map((point) => <tr key={`${point.label}-${point.tradeDate}`} className={active === point ? 'is-active' : ''}>
          <td>{point.label}</td><td>{point.tradeDate}</td><td>{formatUnitPricePerPyeong(point.landUnitPrice)}</td>
          <td>{position.subjectUnitPrice ? signedPct((position.subjectUnitPrice - point.landUnitPrice) / point.landUnitPrice) : '-'}</td>
        </tr>)}</tbody>
      </table>}
    </>}

    <ul className="market-position-basis">{position.basis.map((line) => <li key={line}>{line}</li>)}</ul>
    {onOpenMarket && <button type="button" className="market-position-link" onClick={onOpenMarket}>{position.count ? '비교거래 자세히 보기' : '비교거래 연결하기'}</button>}
  </section>;
}

function MarketChart({ points, subject, median, active, onActive }: {
  points: MarketPoint[]; subject: number | null; median: number; active: MarketPoint | null; onActive: (point: MarketPoint | null) => void;
}) {
  const { x, y, ticks } = chartScales(points, subject);
  return <figure className="market-position-chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="비교거래 토지 평당가와 대상 평당가" onMouseLeave={() => onActive(null)}>
      {ticks.map((tick) => <g key={tick}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(tick)} y2={y(tick)} className="grid" />
        <text x={PAD.l - 8} y={y(tick) + 4} textAnchor="end" className="axis">{formatUnitPricePerPyeong(tick).replace('/평', '')}</text>
      </g>)}
      <line x1={PAD.l} x2={W - PAD.r} y1={y(median)} y2={y(median)} className="median" />
      <text x={W - PAD.r} y={y(median) + (subject && subject < median ? -6 : 18)} textAnchor="end" className="ref-label">비교 중앙값</text>
      {subject && <>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(subject)} y2={y(subject)} className="subject" />
        <text x={W - PAD.r} y={y(subject) + (subject >= median ? -6 : 18)} textAnchor="end" className="ref-label subject-label">대상(호가 계산)</text>
      </>}
      {points.map((point) => <g key={`${point.label}-${point.tradeDate}`} onMouseEnter={() => onActive(point)} onClick={() => onActive(point)} onFocus={() => onActive(point)} tabIndex={0}>
        <circle cx={x(point.tradeDate)} cy={y(point.landUnitPrice)} r={14} className="hit" />
        <circle cx={x(point.tradeDate)} cy={y(point.landUnitPrice)} r={active === point ? 7 : 5} className="dot" />
        <title>{`${point.label} · ${point.tradeDate} · ${formatUnitPricePerPyeong(point.landUnitPrice)}`}</title>
      </g>)}
      <text x={x(points[0].tradeDate)} y={H - 8} className="axis">{points[0].tradeDate}</text>
      <text x={x(points[points.length - 1].tradeDate)} y={H - 8} textAnchor="end" className="axis">{points[points.length - 1].tradeDate}</text>
    </svg>
    <figcaption>{active ? `${active.label} · ${active.tradeDate} · ${formatUnitPricePerPyeong(active.landUnitPrice)}` : '점을 누르거나 마우스를 올리면 사례가 표시됩니다. 점 = 비교거래(제공 자료), 금색 선 = 대상 호가 계산값, 점선 = 비교 중앙값.'}</figcaption>
  </figure>;
}
