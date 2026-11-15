import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chip, CircularProgress, FormControlLabel, MenuItem, Select, Switch } from '@mui/material';
import { ChevronRightRounded, InfoOutlined } from '@mui/icons-material';
import { propertyRepository } from '../repositories/propertyRepository';
import { loadListingTrustMany, type ListingTrust } from '../services/platformListingService';
import { gradeAtLeast, TRUST_GRADE_LABEL, TRUST_GRADES, type TrustGrade } from '../domain/platform/trustGrade';
import { DEFAULT_ADDRESS_LEVEL, inPriceBand, maskAddress, PRICE_BAND_LABEL, type PriceBand } from '../domain/platform/publicListing';
import { classifyPropertyRecord, RECORD_CLASS_LABEL } from '../domain/sampleProperty';
import { compareByUpdatedAtDesc } from '../domain/propertyRecordGuard';
import { effectiveRegion, mapPins, regionCounts, regionOf } from '../domain/propertyDetail/portfolioMap';
import { internalPhotoAllowed } from '../domain/professionalReport/reportAccessPolicy';
import PortfolioMapPanel, { portfolioMapAvailable } from '../components/PortfolioMapPanel';
import TrustGradeBadge from '../components/platform/TrustGradeBadge';
import type { Property } from '../types';
import { formatWon } from '../utils/format';
import '../platform.css';

/*
 * 탐색 (2026-11-15 platform upgrade, 루치오: "다온을 부동산플랫폼으로 격상").
 * The buyer-side list + map, benchmarked on Zillow / Redfin (map + list + filters) and 디스코 / 밸류업맵 (commercial
 * building facts first). DA:ON's own column is the trust grade: every card says how much of it is backed by official
 * documents, and the grade filter lets a buyer see only listings that a person has verified.
 * Phase 1 is an internal preview: nothing here is published to the internet, addresses are masked to 동·도로명 and
 * map pins are blurred to about 100 m, the way the public page will show them.
 */

type GradeFilter = 'all' | 'A' | 'B' | 'C';
type SortKey = 'grade' | 'recent' | 'priceAsc' | 'priceDesc';
const SORT_LABEL: Record<SortKey, string> = { grade: '신뢰 등급 높은 순', recent: '최근 갱신 순', priceAsc: '가격 낮은 순', priceDesc: '가격 높은 순' };
const GRADE_FILTER_LABEL: Record<GradeFilter, string> = { all: '등급 전체', A: 'A 등급만', B: 'B 이상', C: 'C 이상' };

/** Public title: masked address + main use. Internal property names can carry lot numbers, so they are not shown. */
export function publicTitle(property: Property) {
  const place = maskAddress(property.address, DEFAULT_ADDRESS_LEVEL) || '위치 확인 중';
  return `${place} ${property.mainUse || '건물'}`;
}

/** ~100 m blur for public map pins (3 decimals ≈ 110 m latitude). */
const blur = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value);

const gradeRank = (trust?: ListingTrust) => (trust ? TRUST_GRADES.indexOf(trust.grade.grade) : TRUST_GRADES.length);

export default function ExplorePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Property[]>([]);
  const [trust, setTrust] = useState<Map<string, ListingTrust>>(new Map());
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [gradeState, setGradeState] = useState<'loading' | 'ready'>('loading');
  const [grade, setGrade] = useState<GradeFilter>('all');
  /** Grade strip: exactly this grade (tap again to clear). The select above is 'at least'. */
  const [exact, setExact] = useState<TrustGrade>();
  const [use, setUse] = useState('전체');
  const [band, setBand] = useState<PriceBand>('all');
  const [region, setRegion] = useState('전체');
  const [sort, setSort] = useState<SortKey>('grade');
  const [includeSamples, setIncludeSamples] = useState(true);
  const [hoverId, setHoverId] = useState<string>();

  useEffect(() => {
    let active = true;
    propertyRepository.getAll().then(async (values) => {
      if (!active) return;
      const sorted = [...values].sort(compareByUpdatedAtDesc);
      setItems(sorted); setLoadState('ready');
      const map = await loadListingTrustMany(sorted);
      if (active) { setTrust(map); setGradeState('ready'); }
    }).catch(() => { if (active) setLoadState('error'); });
    return () => { active = false; };
  }, []);

  const pool = useMemo(() => items.filter((property) => includeSamples || classifyPropertyRecord(property).recordClass === 'operational'), [items, includeSamples]);
  const regions = useMemo(() => regionCounts(pool), [pool]);
  const activeRegion = effectiveRegion(region, regions);
  const uses = useMemo(() => [...new Set(pool.map((property) => property.mainUse).filter(Boolean))].sort(), [pool]);
  const distribution = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, none: 0 };
    for (const property of pool) counts[trust.get(property.id)?.grade.grade ?? 'none'] += 1;
    return counts;
  }, [pool, trust]);

  const filtered = useMemo(() => pool
    .filter((property) => activeRegion === '전체' || regionOf(property) === activeRegion)
    .filter((property) => use === '전체' || property.mainUse === use)
    .filter((property) => inPriceBand(property.salePrice, band))
    .filter((property) => {
      const value = trust.get(property.id)?.grade.grade;
      if (exact) return value === exact;
      if (grade === 'all') return true;
      return Boolean(value && gradeAtLeast(value, grade));
    })
    .sort((a, b) => {
      if (sort === 'grade') return gradeRank(trust.get(a.id)) - gradeRank(trust.get(b.id)) || compareByUpdatedAtDesc(a, b);
      if (sort === 'priceAsc') return (a.salePrice || Infinity) - (b.salePrice || Infinity);
      if (sort === 'priceDesc') return (b.salePrice || 0) - (a.salePrice || 0);
      return compareByUpdatedAtDesc(a, b);
    }), [pool, activeRegion, use, band, grade, exact, sort, trust]);

  const showMap = portfolioMapAvailable();
  const pinData = useMemo(() => mapPins(filtered.map((property) => ({ ...property, name: publicTitle(property), latitude: blur(property.latitude), longitude: blur(property.longitude) })), (property) => `${trust.get(property.id)?.grade.grade ?? '–'} · ${formatWon(property.salePrice)}`), [filtered, trust]);
  const openListing = useCallback((id: string) => navigate(`/listing/${encodeURIComponent(id)}`), [navigate]);

  return <div className="explore-page">
    <header className="page-header explore-head"><div>
      <p className="eyebrow">탐색 · 검증된 상업용 건물</p>
      <h1>근거가 확인된 건물부터 봅니다</h1>
      <p>모든 매물에 신뢰 등급(A~D)이 붙습니다. 등급은 자료실에 실제로 있는 공적서류와 사람이 확인한 값만으로 계산합니다.</p>
    </div></header>
    <p className="platform-preview-note" role="note"><InfoOutlined /> 내부 미리보기입니다. 아직 인터넷에 공개되지 않았고, 공개 게시는 승인 후 2단계에서 시작합니다. 주소는 동·도로명까지, 지도 위치는 약 100m 단위로 흐리게 보여 줍니다.</p>

    <section className="panel explore-filters" aria-label="탐색 조건">
      <div className="explore-grade-strip" role="group" aria-label="신뢰 등급 분포">
        {TRUST_GRADES.map((value) => <button key={value} type="button" className={`grade-${value} ${exact === value ? 'active' : ''}`} aria-pressed={exact === value} onClick={() => setExact(exact === value ? undefined : value)}><b>{value}</b><span>{TRUST_GRADE_LABEL[value]}</span><em>{gradeState === 'ready' ? distribution[value] : '…'}</em></button>)}
        {distribution.none > 0 && gradeState === 'ready' && <span className="grade-none-count">등급 확인 불가 {distribution.none}</span>}
      </div>
      <div className="toolbar">
        <Select size="small" value={grade} onChange={(event) => { setGrade(event.target.value as GradeFilter); setExact(undefined); }} aria-label="신뢰 등급">{(Object.keys(GRADE_FILTER_LABEL) as GradeFilter[]).map((value) => <MenuItem key={value} value={value}>{GRADE_FILTER_LABEL[value]}</MenuItem>)}</Select>
        <Select size="small" value={use} onChange={(event) => setUse(event.target.value)} aria-label="주용도"><MenuItem value="전체">주용도 전체</MenuItem>{uses.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select>
        <Select size="small" value={band} onChange={(event) => setBand(event.target.value as PriceBand)} aria-label="가격대">{(Object.keys(PRICE_BAND_LABEL) as PriceBand[]).map((value) => <MenuItem key={value} value={value}>{PRICE_BAND_LABEL[value]}</MenuItem>)}</Select>
        <Select size="small" value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="정렬">{(Object.keys(SORT_LABEL) as SortKey[]).map((value) => <MenuItem key={value} value={value}>{SORT_LABEL[value]}</MenuItem>)}</Select>
        <FormControlLabel control={<Switch size="small" checked={includeSamples} onChange={(event) => setIncludeSamples(event.target.checked)} />} label="샘플·테스트 포함" />
      </div>
      {regions.length > 1 && <div className="region-filter" role="group" aria-label="지역"><Chip label={`전체 ${pool.length}`} color={activeRegion === '전체' ? 'primary' : 'default'} variant={activeRegion === '전체' ? 'filled' : 'outlined'} onClick={() => setRegion('전체')} />{regions.map((row) => <Chip key={row.region} label={`${row.region} ${row.count}`} color={activeRegion === row.region ? 'primary' : 'default'} variant={activeRegion === row.region ? 'filled' : 'outlined'} onClick={() => setRegion(row.region)} />)}</div>}
    </section>

    <section className={`explore-browse ${showMap ? 'has-map' : ''}`} aria-label="탐색 결과">
      <div className="explore-results">
        <p className="explore-count">{loadState === 'ready' ? `매물 ${filtered.length}건` : ''}{gradeState === 'loading' && loadState === 'ready' && <span><CircularProgress size={12} /> 등급 계산 중</span>}</p>
        {loadState === 'loading' && <p className="home-empty">불러오는 중입니다.</p>}
        {loadState === 'error' && <p className="home-empty">매물을 불러오지 못했습니다. 새로고침해 주세요.</p>}
        {loadState === 'ready' && !filtered.length && <p className="home-empty">{pool.length ? '조건에 맞는 매물이 없습니다. 등급·가격 조건을 넓혀 보세요.' : '아직 등록된 매물이 없습니다.'} <Link to="/property/new">중개사로 물건 등록</Link></p>}
        <ul className="explore-cards">{filtered.map((property) => {
          const record = classifyPropertyRecord(property).recordClass;
          const row = trust.get(property.id);
          const official = row?.grade.criteria.find((item) => item.key === 'official');
          const perPyeong = property.salePrice > 0 && property.landAreaPyeong > 0 ? Math.round(property.salePrice / property.landAreaPyeong / 10000) : 0;
          return <li key={property.id} onMouseEnter={() => setHoverId(property.id)} onMouseLeave={() => setHoverId(undefined)}>
            <Link to={`/listing/${encodeURIComponent(property.id)}`} className={`explore-card ${hoverId === property.id ? 'hover' : ''}`}>
              <span className="explore-card-visual">{property.mainImage && internalPhotoAllowed(property) ? <img src={property.mainImage} alt="" loading="lazy" /> : <small>사진 미공개</small>}</span>
              <span className="explore-card-body">
                <span className="explore-card-top">{gradeState === 'ready' ? <TrustGradeBadge grade={row?.grade} /> : <span className="trust-grade-badge grade-none size-small"><b>…</b><span>계산 중</span></span>}{record !== 'operational' && <em className="explore-sample">{RECORD_CLASS_LABEL[record]}</em>}</span>
                <strong>{publicTitle(property)}</strong>
                <span className="explore-card-price">{property.salePrice > 0 ? formatWon(property.salePrice) : '가격 확인 중'}</span>
                <span className="explore-card-facts">{property.landAreaPyeong > 0 ? `대지 ${property.landAreaPyeong.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}평` : '대지 확인 중'}{perPyeong > 0 && <> · 평당 {perPyeong.toLocaleString('ko-KR')}만 원 <i>계산값</i></>}</span>
                {official && <span className={`explore-card-proof ${official.met ? 'met' : ''}`}>필수 공적서류 공식확인 {official.value}</span>}
              </span>
              <ChevronRightRounded className="explore-card-arrow" />
            </Link>
          </li>;
        })}</ul>
      </div>
      {showMap && <PortfolioMapPanel pins={pinData.pins} missing={pinData.missing} activeId={hoverId} onOpen={openListing} />}
    </section>
    {!showMap && loadState === 'ready' && <p className="platform-footnote">지도는 카카오 지도 키를 연결하면 목록 옆에 표시됩니다.</p>}
  </div>;
}
