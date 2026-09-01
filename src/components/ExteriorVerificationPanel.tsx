import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { CheckCircleOutlineRounded, ExploreRounded } from '@mui/icons-material';
import type { Property, StreetViewVerification } from '../types';
import { mapService } from '../services/maps/mapService';
import { streetViewService } from '../services/streetView/streetViewService';
import type { StreetViewMetadata, StreetViewSession } from '../services/streetView/types';

type ProviderId = 'kakao';
type Props = { property: Property; onVerified: (value: StreetViewVerification) => void };
const providerLabel = (provider?: string) => provider === 'naver' ? 'NAVER 거리뷰' : provider === 'kakao' ? 'Kakao 로드뷰' : '-';

export default function ExteriorVerificationPanel({ property, onVerified }: Props) {
  const [providerRevision, setProviderRevision] = useState(0);
  const [viewerRevision, setViewerRevision] = useState(0);
  const [active, setActive] = useState<ProviderId | null>(null);
  const [metadata, setMetadata] = useState<StreetViewMetadata | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<StreetViewSession | null>(null);
  const attachViewer = useCallback((node: HTMLDivElement | null) => { viewerRef.current = node; if (node) setViewerRevision((value) => value + 1); }, []);
  const coordinatesReady = Number.isFinite(property.latitude) && Number.isFinite(property.longitude);
  const roadviewAvailable = streetViewService.getProvider('kakao').isAvailable();

  useEffect(() => { void mapService.refreshProviderStatus().then(() => setProviderRevision((value) => value + 1)); }, []);
  useEffect(() => {
    if (!active || !viewerRef.current || !coordinatesReady) return;
    let cancelled = false; setLoading(true); setStatus('거리뷰를 찾고 있습니다.'); setMetadata(null);
    sessionRef.current?.destroy(); sessionRef.current = null;
    streetViewService.getProvider(active).openViewer(viewerRef.current, { latitude: property.latitude!, longitude: property.longitude! }).then((session) => {
      if (cancelled) { session.destroy(); return; }
      sessionRef.current = session; setMetadata(session.metadata); setStatus('거리뷰를 직접 돌려 대상 건물을 확인해 주세요.'); setLoading(false);
    }).catch((error: unknown) => { if (!cancelled) { setStatus(error instanceof Error ? error.message : '거리뷰를 표시하지 못했습니다.'); setLoading(false); } });
    return () => { cancelled = true; sessionRef.current?.destroy(); sessionRef.current = null; };
  }, [active, coordinatesReady, property.latitude, property.longitude, providerRevision, viewerRevision]);

  const close = () => { sessionRef.current?.destroy(); sessionRef.current = null; setActive(null); setMetadata(null); setStatus(''); };
  const verify = () => {
    if (!metadata) return;
    onVerified({ provider: metadata.provider, panoId: metadata.panoId, photoDate: metadata.photoDate, checkedAt: new Date().toISOString() });
    close();
  };

  return <section className="exterior-verification">
    <div><span className="panel-kicker">BUILDING CHECK</span><h3>건물 외관 확인</h3><p>좌표 주변 거리뷰를 직접 돌려 실제 건물과 진입 방향을 확인합니다.</p></div>
    {!coordinatesReady && <Alert severity="info">위치정보에서 주소 좌표를 먼저 적용해 주세요.</Alert>}
    <div className="streetview-actions">
      <Button variant="contained" startIcon={<ExploreRounded />} disabled={!coordinatesReady || !roadviewAvailable} onClick={() => setActive('kakao')}>건물 외관 보기</Button>
      <small className="streetview-unsupported">NAVER Panorama · 현재 SDK 미지원</small>
    </div>
    {coordinatesReady && !roadviewAvailable && <small className="streetview-config-note">Kakao 로드뷰용 JavaScript 키 설정이 필요합니다.</small>}
    {property.streetViewVerification?.checkedAt && <div className="verification-record"><CheckCircleOutlineRounded /><span><b>외관 확인 기록</b>{providerLabel(property.streetViewVerification.provider)} · {new Date(property.streetViewVerification.checkedAt).toLocaleString('ko-KR')}</span></div>}
    <p className="streetview-policy">거리뷰는 건물 확인용입니다. 보고서에 사용할 대표사진은 직접 업로드한 이미지 중에서 선택하세요.</p>
    <Dialog open={Boolean(active)} onClose={close} fullWidth maxWidth="lg">
      <DialogTitle>건물 외관 확인</DialogTitle>
      <DialogContent><div className="streetview-viewer-wrap"><div className="streetview-frame" ref={attachViewer} />{loading && <div className="streetview-loading">거리뷰를 불러오는 중입니다.</div>}</div>{status && <Alert severity={metadata ? 'success' : status.includes('없습니다') ? 'warning' : 'info'}>{status}</Alert>}{metadata && <div className="streetview-meta"><Chip label={`panoId ${metadata.panoId}`} /><span>파노라마 위치 차이 {metadata.distanceMeters != null ? `약 ${metadata.distanceMeters}m` : '공급자 미제공'}</span><span>검색 반경 {metadata.searchRadiusMeters ?? '-'}m</span></div>}</DialogContent>
      <DialogActions><Button onClick={close}>닫기</Button><Button variant="contained" disabled={!metadata} onClick={verify}>이 외관 확인을 기록</Button></DialogActions>
    </Dialog>
  </section>;
}
