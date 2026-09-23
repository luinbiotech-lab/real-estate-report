import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { CloudUploadOutlined, OpenInNewRounded, RefreshRounded } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { DigitalTwinAsset, DigitalTwinAssetType, PropertyDocument } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { digitalTwinAssetIntakeService } from '../services/digitalTwinAssetIntakeService';
import type { Property } from '../types';

const ASSET_LABELS: Record<DigitalTwinAssetType, string> = {
  floor_plan: '평면도', dwg: 'DWG', dxf: 'DXF', scanned_plan: '스캔 도면', '360_photo': '360 사진', lidar: 'LiDAR', point_cloud: 'Point Cloud', mesh: 'Mesh', glb: 'GLB', gltf: 'glTF', room_model: 'Room Model', measurement_data: '측정 데이터',
};

const STATUS_LABELS: Record<DigitalTwinAsset['processingStatus'], string> = {
  uploaded: '업로드됨', pending: '대기', processing: '처리 중', ready: '준비 완료', failed: '실패', unsupported: '미지원',
};

export default function DigitalTwinIntakePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPropertyId = searchParams.get('propertyId') || '';
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [assets, setAssets] = useState<DigitalTwinAsset[]>([]);
  const [sourceDocuments, setSourceDocuments] = useState<PropertyDocument[]>([]);
  const [floorOptions, setFloorOptions] = useState<string[]>([]);
  const [linkingDocumentId, setLinkingDocumentId] = useState('');
  const [assetType, setAssetType] = useState<DigitalTwinAssetType>('dxf');
  const [floor, setFloor] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedProperty = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);

  const loadAssets = async (id: string) => {
    if (!id) { setAssets([]); setSourceDocuments([]); setFloorOptions([]); return; }
    const [rows, documents, spaces] = await Promise.all([
      propertyDataRoomRepository.getDigitalTwinAssets(id),
      propertyDataRoomRepository.getDocuments(id),
      propertyDataRoomRepository.getSpaces(id),
    ]);
    setAssets([...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setSourceDocuments(documents.filter((document) => document.documentType === 'floor_plan'));
    const floors = [...new Set(spaces.map((space) => space.floor?.trim().toUpperCase()).filter((value): value is string => Boolean(value)))];
    floors.sort((left, right) => {
      const rank = (value: string) => {
        const basement = value.match(/^B(\d+)$/);
        if (basement) return -Number(basement[1]);
        const ground = value.match(/^(\d+)(?:F|층)?$/);
        return ground ? Number(ground[1]) : Number.POSITIVE_INFINITY;
      };
      return rank(left) - rank(right) || left.localeCompare(right);
    });
    setFloorOptions(floors);
    if (floor && !floors.includes(floor)) setFloor('');
  };

  const load = async () => {
    setLoading(true); setError('');
    try {
      const list = await propertyRepository.getAll();
      setProperties(list);
      const requestedExists = requestedPropertyId && list.some((item) => item.id === requestedPropertyId);
      const nextId = propertyId || (requestedExists ? requestedPropertyId : '') || list[0]?.id || '';
      setPropertyId(nextId);
      await loadAssets(nextId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Digital Twin 입력 화면을 불러오지 못했습니다.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const selectProperty = async (id: string) => {
    setPropertyId(id); setNotice(''); setError('');
    await loadAssets(id);
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !propertyId) return;
    const detected = digitalTwinAssetIntakeService.detectAssetType(file.name);
    if (detected) setAssetType(detected);
    setUploading(true); setError(''); setNotice('');
    try {
      const result = await digitalTwinAssetIntakeService.upload(propertyId, file, { assetType: detected || assetType, floor, queueAgent: true });
      setNotice(`${file.name} 등록 완료 · ${ASSET_LABELS[result.asset.assetType]} v${result.asset.version}${result.jobId ? ' · Agent 검토 큐 연결' : ''}`);
      await loadAssets(propertyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Digital Twin 자산을 등록하지 못했습니다.');
    } finally {
      setUploading(false); event.target.value = '';
    }
  };

  const reuseSourceDocument = async (document: PropertyDocument) => {
    if (!propertyId) return;
    setLinkingDocumentId(document.id); setError(''); setNotice('');
    try {
      const result = await digitalTwinAssetIntakeService.uploadFromDocument(propertyId, document, { floor, queueAgent: true });
      setNotice(`${document.originalFileName} Data Room 원본 재사용 완료 · ${ASSET_LABELS[result.asset.assetType]} v${result.asset.version}${result.jobId ? ' · Agent 검토 큐 연결' : ''}`);
      await loadAssets(propertyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Data Room 도면을 Digital Twin 자산으로 연결하지 못했습니다.');
    } finally {
      setLinkingDocumentId('');
    }
  };

  if (loading) return <div className="center"><CircularProgress /><p>Digital Twin Intake를 준비하는 중입니다.</p></div>;

  return <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">DIGITAL TWIN ASSET INTAKE</Typography>
        <Typography variant="h4" component="h1">도면 · 3D · 측정자료 등록</Typography>
        <Typography color="text.secondary">원본 파일을 Data Room에 보존하고, 처리 후보를 Human Review 기반 Agent 흐름으로 연결합니다.</Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Button startIcon={<RefreshRounded />} onClick={() => void loadAssets(propertyId)}>새로고침</Button>
        <Button variant="outlined" startIcon={<OpenInNewRounded />} onClick={() => navigate('/digital-twin')}>Digital Twin Workspace</Button>
      </Stack>
    </Stack>

    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>새 자산 등록</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 320 }}>
            <InputLabel id="dt-intake-property">대상 물건</InputLabel>
            <Select labelId="dt-intake-property" label="대상 물건" value={propertyId} onChange={(event) => void selectProperty(event.target.value)}>
              {properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField select size="small" label="자산 유형" value={assetType} onChange={(event) => setAssetType(event.target.value as DigitalTwinAssetType)} sx={{ minWidth: 180 }}>
            {Object.entries(ASSET_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="층(선택)" value={floor} onChange={(event) => setFloor(event.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="">층 미지정</MenuItem>
            {floorOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <Button component="label" variant="contained" startIcon={<CloudUploadOutlined />} disabled={!propertyId || uploading}>
            {uploading ? '등록 중…' : '파일 선택 및 등록'}
            <input hidden type="file" accept=".dxf,.dwg,.glb,.gltf,.obj,.stl,.las,.laz,.ply,.pcd,.jpg,.jpeg,.png,.webp,.pdf,.json,.csv" onChange={upload} />
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          최대 50MiB · Production private Storage와 동일 기준 · DXF는 브라우저 geometry 후보 추출 가능 · DWG는 별도 변환기 연결 필요 · 자동 결과는 승인 전 원본/공식값을 변경하지 않습니다.
        </Typography>
      </CardContent>
    </Card>

    {sourceDocuments.length > 0 && <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5 }}>Data Room 평면도 재사용</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>이미 등록한 평면도 원본을 다시 선택하지 않고 provenance를 유지한 채 Digital Twin 자산으로 연결합니다.</Typography>
        <Stack spacing={1}>
          {sourceDocuments.map((document) => {
            const linked = assets.some((asset) => asset.sourceDocumentId === document.id);
            const binaryReady = document.fileData instanceof Blob;
            return <Box key={document.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto auto' }, gap: 1.5, alignItems: 'center', p: 1.25, border: '1px solid #e3e8ef', borderRadius: 2 }}>
              <Box>
                <Typography fontWeight={700}>{document.title}</Typography>
                <Typography variant="body2" color="text.secondary">{document.originalFileName} · {(document.fileSize / 1024 / 1024).toFixed(1)} MiB</Typography>
              </Box>
              <Chip size="small" label={linked ? 'Digital Twin 연결됨' : binaryReady ? 'Local binary 준비' : 'Local binary 필요'} color={linked ? 'success' : binaryReady ? 'info' : 'warning'} />
              <Button size="small" variant="outlined" disabled={linked || !binaryReady || Boolean(linkingDocumentId) || uploading} onClick={() => void reuseSourceDocument(document)}>
                {linkingDocumentId === document.id ? '연결 중…' : linked ? '연결 완료' : 'Digital Twin 연결'}
              </Button>
            </Box>;
          })}
        </Stack>
      </CardContent>
    </Card>}

    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 1.5 }}>
      <Box>
        <Typography variant="h6">{selectedProperty?.name || '대상 물건'} 자산</Typography>
        <Typography variant="body2" color="text.secondary">{assets.length}개 등록됨</Typography>
      </Box>
    </Stack>

    {!assets.length ? <Alert severity="info">등록된 Digital Twin 자산이 없습니다. 도면이나 3D 원본을 등록하면 여기에서 버전과 처리 상태를 확인할 수 있습니다.</Alert> : <Stack spacing={1.25}>
      {assets.map((asset) => <Card key={asset.id} variant="outlined">
        <CardContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '110px 1fr auto' }, gap: 2, alignItems: 'center', '&:last-child': { pb: 2 } }}>
          <Box><Typography variant="subtitle1" fontWeight={700}>{ASSET_LABELS[asset.assetType]}</Typography><Typography variant="caption" color="text.secondary">v{asset.version}</Typography></Box>
          <Box>
            <Typography variant="body1" fontWeight={600}>{asset.fileName || asset.storagePath}</Typography>
            <Typography variant="body2" color="text.secondary">{asset.fileFormat.toUpperCase()} · {asset.floor || '층 미지정'} · {new Date(asset.createdAt).toLocaleString('ko-KR')}</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
            <Chip size="small" label={STATUS_LABELS[asset.processingStatus]} color={asset.processingStatus === 'ready' ? 'success' : asset.processingStatus === 'failed' ? 'error' : 'default'} />
            <Button size="small" onClick={() => navigate('/digital-twin')}>검토/처리</Button>
          </Stack>
        </CardContent>
      </Card>)}
    </Stack>}
  </Box>;
}
