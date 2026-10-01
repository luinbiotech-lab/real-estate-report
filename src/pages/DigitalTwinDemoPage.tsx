import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import { ArrowBackRounded, OpenInNewRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import FloorPlanGeometryPreview from '../components/FloorPlanGeometryPreview';
import ExtrusionPreview from '../components/ExtrusionPreview';
import ReviewedMeshViewer from '../components/ReviewedMeshViewer';
import { floorPlanGeometryService } from '../services/floorPlanGeometryService';
import { roomTopologyService } from '../services/roomTopologyService';

const SOURCE_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/74/Little_White_House_floor_plan.svg';
const REAL_LENGTH_M = 54 * 0.3048;
const DRAWING_LENGTH = 258.138;
const SCALE = REAL_LENGTH_M / DRAWING_LENGTH;
const TEST_HEIGHT_M = 2.7;

export default function DigitalTwinDemoPage() {
  const navigate = useNavigate();
  const [asset, setAsset] = useState<DigitalTwinAsset>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true); setError('');
      try {
        const response = await fetch(SOURCE_URL);
        if (!response.ok) throw new Error(`공개 도면을 불러오지 못했습니다. HTTP ${response.status}`);
        const blob = await response.blob();
        const file = new File([blob], 'Little_White_House_floor_plan.svg', { type: 'image/svg+xml' });
        const now = new Date().toISOString();
        const base: DigitalTwinAsset = {
          id: 'demo-little-white-house',
          propertyId: 'demo-only',
          assetType: 'floor_plan',
          fileFormat: 'svg',
          storagePath: 'demo/remote-public-domain',
          fileName: file.name,
          mimeType: file.type,
          fileData: file,
          floor: '1F',
          version: 1,
          processingStatus: 'processing',
          metadata: {},
          createdAt: now,
          updatedAt: now,
        };
        const geometry = await floorPlanGeometryService.extract(base);
        const calibrated: DigitalTwinAsset = {
          ...base,
          metadata: {
            geometry,
            scaleCalibration: {
              status: 'verified',
              method: 'known_distance',
              drawingLength: DRAWING_LENGTH,
              realLengthM: REAL_LENGTH_M,
              metersPerDrawingUnit: SCALE,
              referenceLabel: 'Sun Deck 54 ft · NPS 도면 대조',
              note: 'TEST ONLY · 실제 고객 물건 데이터가 아님',
              verifiedAt: now,
            },
          },
        };
        const candidates = roomTopologyService.buildCandidates(calibrated);
        const priority = candidates.filter((candidate) => {
          const area = candidate.areaSqmCandidate || 0;
          return area >= 2 && area <= 80;
        });
        const roomTopologyReviews = priority.map((candidate, index) => ({
          candidateId: candidate.id,
          decision: 'approved' as const,
          name: `TEST ROOM ${index + 1}`,
          note: 'TEST ONLY · 자동 후보 검토용',
          reviewedAt: now,
        }));
        setAsset({
          ...calibrated,
          metadata: {
            ...calibrated.metadata,
            roomTopologyReviews,
            verticalDimensions: {
              status: 'verified',
              ceilingHeightM: TEST_HEIGHT_M,
              sourceLabel: 'TEST ONLY 2.7m',
              note: '실제 건물 높이 아님',
              verifiedAt: now,
            },
          },
        });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '3D 테스트 데모를 준비하지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const approvedCount = useMemo(() => {
    const reviews = asset?.metadata.roomTopologyReviews;
    return Array.isArray(reviews) ? reviews.filter((item) => item && typeof item === 'object' && (item as { decision?: string }).decision === 'approved').length : 0;
  }, [asset]);

  if (loading) return <div className="center"><CircularProgress /><p>공개 도면으로 3D 테스트 데모를 준비하는 중입니다.</p></div>;

  return <main style={{ padding: 28, maxWidth: 1360, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' }}>
      <div>
        <p className="eyebrow">TEST ONLY · PUBLIC DOMAIN FLOOR PLAN</p>
        <h1 style={{ margin: '5px 0 7px' }}>Digital Twin 3D 테스트 데모</h1>
        <p style={{ margin: 0, color: '#667085' }}>Little White House 공개도메인 SVG를 사용한 비파괴 검토용 데모입니다. Production 물건 데이터에는 저장되지 않습니다.</p>
      </div>
      <Stack direction="row" spacing={1}>
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/digital-twin')}>Workspace</Button>
        <Button variant="outlined" startIcon={<OpenInNewRounded />} href="https://commons.wikimedia.org/wiki/File:Little_White_House_floor_plan.svg" target="_blank" rel="noreferrer">원본 출처</Button>
      </Stack>
    </header>

    <Alert severity="warning" sx={{ mb: 2 }}>
      축척은 NPS 도면의 Sun Deck 54 ft와 SVG 기준 span 258.138 units를 대조한 테스트값입니다. 높이 2.7m와 TEST ROOM 명칭은 시각화 검증용 가정이며 실제 건축정보가 아닙니다.
    </Alert>

    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {asset && <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 18 }}>
        {[
          ['SVG geometry', '추출 완료'],
          ['축척', `1 unit = ${SCALE.toFixed(5)}m`],
          ['공간 후보 승인', `${approvedCount}개 TEST`],
          ['높이', `${TEST_HEIGHT_M.toFixed(1)}m TEST`],
        ].map(([label, value]) => <div key={label} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 14 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', marginTop: 4 }}>{value}</strong></div>)}
      </section>

      <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>1. 원본 geometry</h2>
        <FloorPlanGeometryPreview asset={asset} />
      </section>

      <section style={{ marginBottom: 18 }}>
        <ExtrusionPreview asset={asset} />
      </section>

      <section>
        <ReviewedMeshViewer asset={asset} />
      </section>
    </>}
  </main>;
}
