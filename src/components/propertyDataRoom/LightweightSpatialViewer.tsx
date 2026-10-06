import { Box, Chip, Stack, Typography } from '@mui/material';
import type { SpatialPropertySpace } from '../../domain/propertyDataRoom/spatialMediaModel';
import { SPATIAL_VERIFICATION_LABELS } from '../../domain/propertyDataRoom/spatialMediaModel';

function floorRank(value: string) {
  const normalized = value.trim().toUpperCase();
  const basement = normalized.match(/^B(\d+)$/);
  if (basement) return -Number(basement[1]);
  const ground = normalized.match(/^(\d+)(?:F|층)?$/);
  return ground ? Number(ground[1]) : 999;
}

export default function LightweightSpatialViewer({ spaces }: { spaces: SpatialPropertySpace[] }) {
  const active = spaces.filter((space) => !space.deletedAt);
  const groups = new Map<string, SpatialPropertySpace[]>();
  for (const space of active) {
    const floor = space.floorId || '층 미지정';
    groups.set(floor, [...(groups.get(floor) ?? []), space]);
  }
  const floors = [...groups.entries()].sort(([left], [right]) => floorRank(right) - floorRank(left) || right.localeCompare(left, 'ko'));

  if (!floors.length) {
    return <Box sx={{ p: 3, border: '1px dashed #c7ced8', borderRadius: 2, textAlign: 'center' }}>
      <Typography fontWeight={700}>표시할 공간 구조가 없습니다.</Typography>
      <Typography variant="body2" color="text.secondary">도면에서 층·공간을 연결하면 이 영역에 floor-stack viewer가 생성됩니다.</Typography>
    </Box>;
  }

  return <Box sx={{ p: { xs: 1.5, md: 2.5 }, border: '1px solid #dce2ea', borderRadius: 2, bgcolor: '#f8fafc', overflowX: 'auto' }}>
    <Stack spacing={1.25} sx={{ minWidth: 620 }}>
      {floors.map(([floor, rows], index) => {
        const verified = rows.filter((space) => ['document_verified', 'field_checked', 'owner_confirmed', 'agent_verified'].includes(space.verificationStatus)).length;
        return <Box key={floor} sx={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr auto',
          gap: 1.5,
          alignItems: 'stretch',
          ml: Math.min(index * 6, 30) + 'px',
          mr: Math.max(0, 30 - index * 6) + 'px',
          p: 1.25,
          bgcolor: 'background.paper',
          border: '1px solid #d7dee8',
          borderRadius: 1.5,
          boxShadow: '0 5px 14px rgba(15, 23, 42, 0.05)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>{floor}</Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
            {rows.map((space) => <Chip
              key={space.id}
              variant="outlined"
              label={space.spaceName + (typeof space.areaM2 === 'number' ? ' · ' + space.areaM2.toFixed(1) + '㎡' : '')}
              title={SPATIAL_VERIFICATION_LABELS[space.verificationStatus]}
            />)}
          </Box>
          <Chip size="small" color={verified === rows.length ? 'success' : 'default'} label={String(verified) + '/' + String(rows.length) + ' 검증'} />
        </Box>;
      })}
    </Stack>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
      현재 Viewer는 검증된 층·공간 구조를 빠르게 확인하는 lightweight 표현입니다. 실측 geometry 또는 GLB가 연결되면 정밀 3D Viewer로 확장합니다.
    </Typography>
  </Box>;
}
