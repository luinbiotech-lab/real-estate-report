import { useEffect, useState } from 'react';
import { ArchiveOutlined, DescriptionOutlined, VisibilityOutlined } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { ReportSnapshot } from '../domain/propertyDataRoom/types';
import { propertyRepository } from '../repositories/propertyRepository';
import { reportSnapshotHistoryService, type ReportSnapshotHistoryItem } from '../services/reportSnapshotHistoryService';
import type { Property } from '../types';

type PropertyHistory = {
  property: Property;
  history: ReportSnapshotHistoryItem[];
};

const STATUS_LABELS: Record<ReportSnapshot['status'], string> = {
  draft: '초안',
  ready: '확정',
  archived: '보관',
  failed: '실패',
};

const STATUS_COLORS: Record<ReportSnapshot['status'], 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  draft: 'primary',
  ready: 'success',
  archived: 'default',
  failed: 'error',
};

export default function ReportHistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PropertyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [archivingId, setArchivingId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const properties = await propertyRepository.getAll();
      const rows = await Promise.all(properties.map(async (property) => ({
        property,
        history: await reportSnapshotHistoryService.list(property.id),
      })));
      setItems(rows.filter((row) => row.history.length > 0));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '보고서 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const archive = async (snapshotId: string) => {
    setArchivingId(snapshotId);
    setError('');
    try {
      await reportSnapshotHistoryService.archive(snapshotId);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Snapshot을 보관 처리하지 못했습니다.');
    } finally {
      setArchivingId('');
    }
  };

  if (loading) return <div className="center"><CircularProgress /><p>보고서 이력을 불러오는 중입니다.</p></div>;

  return <Box sx={{ p: 3 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">REPORT SNAPSHOT HISTORY</Typography>
        <Typography variant="h4" component="h1">보고서 버전 이력</Typography>
        <Typography color="text.secondary">생성 시점 데이터를 고정한 Professional Report Snapshot을 물건별로 관리합니다.</Typography>
      </Box>
      <Button variant="outlined" onClick={() => void load()}>새로고침</Button>
    </Stack>

    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    {!items.length ? <Alert severity="info">생성된 Professional Report Snapshot이 없습니다.</Alert> : <Stack spacing={3}>
      {items.map(({ property, history }) => <Card key={property.id} variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">{property.name}</Typography>
              <Typography variant="body2" color="text.secondary">{property.address} · {property.propertyNumber || '물건번호 미입력'}</Typography>
            </Box>
            <Button size="small" onClick={() => navigate(`/property/${property.id}`)}>Data Room</Button>
          </Stack>

          <Stack spacing={1.25}>
            {history.map(({ snapshot, isLatest, isLatestReady }) => <Box key={snapshot.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '88px 1fr auto' }, gap: 1.5, alignItems: 'center', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>v{snapshot.reportVersion}</Typography>
              <Box>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: .5 }}>
                  <Chip size="small" label={STATUS_LABELS[snapshot.status]} color={STATUS_COLORS[snapshot.status]} />
                  {isLatest && <Chip size="small" label="최신" variant="outlined" />}
                  {isLatestReady && <Chip size="small" label="최신 확정본" color="success" variant="outlined" />}
                </Stack>
                <Typography variant="body2">{new Date(snapshot.generatedAt).toLocaleString('ko-KR')}</Typography>
                <Typography variant="caption" color="text.secondary">{snapshot.templateVersion} · {snapshot.engineVersion || 'engine 미기록'}{snapshot.generatedBy ? ` · ${snapshot.generatedBy}` : ''}</Typography>
              </Box>
              <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                <Button size="small" startIcon={<VisibilityOutlined />} onClick={() => navigate(`/professional-report/snapshot/${snapshot.id}`)}>미리보기</Button>
                {snapshot.status === 'draft' && !isLatest && <Button size="small" color="inherit" startIcon={<ArchiveOutlined />} disabled={archivingId === snapshot.id} onClick={() => void archive(snapshot.id)}>{archivingId === snapshot.id ? '보관 중…' : '보관'}</Button>}
              </Stack>
            </Box>)}
          </Stack>
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Button startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${property.id}`)}>현재 데이터 보고서</Button>
        </CardActions>
      </Card>)}
    </Stack>}
  </Box>;
}
