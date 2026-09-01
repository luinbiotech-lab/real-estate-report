import { ImageOutlined } from '@mui/icons-material';
import { lines } from '../utils/format';

export function Photo({ src, label, className = '' }: { src: string; label: string; className?: string }) {
  return src ? <img className={`doc-photo ${className}`} src={src} alt={label} /> : <div className={`photo-placeholder ${className}`}><ImageOutlined /><span>{label}</span><small>등록된 이미지가 없습니다</small></div>;
}

export function InfoGrid({ items, className = '' }: { items: [string, string][]; className?: string }) {
  return <div className={`info-grid ${className}`}>{items.map(([key, value]) => <div key={key}><small>{key}</small><b>{value || '-'}</b></div>)}</div>;
}

export function TextBlock({ title, value, accent = false, limit = 6 }: { title: string; value: string; accent?: boolean; limit?: number }) {
  const entries = lines(value).slice(0, limit);
  return <section className={`text-block ${accent ? 'accent' : ''}`}><h3>{title}</h3>{entries.length > 1 ? <ul>{entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p>{entries[0] || '입력된 내용이 없습니다.'}</p>}</section>;
}

export function MetricStrip({ items }: { items: [string, string][] }) {
  return <div className="metric-strip">{items.map(([label, value], index) => <div key={label}><span>{String(index + 1).padStart(2, '0')}</span><small>{label}</small><b>{value || '검토 필요'}</b></div>)}</div>;
}
