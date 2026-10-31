import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { REPORT_BLANK_HIDE_NOTICE, REPORT_REQUIRED_NOTICE, blankFieldsSummary, requiredBlankFields, type ReportBlankField } from '../../domain/professionalReport/reportBlankFields';

/*
 * Pre-publish check for blank report fields (owner decision 2026-10-30): ask whether the values will be entered first;
 * only an explicit "숨김 처리하고 계속" publishes with the blank fields hidden. Rendered outside the printable area.
 */
export function ReportBlankFieldsDialog({ open, fields, actionLabel, onEnterValues, onContinue, onClose }: {
  open: boolean;
  fields: ReportBlankField[];
  actionLabel: string;
  onEnterValues: () => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const required = requiredBlankFields(fields);
  const optional = fields.filter((field) => !field.required);
  return <Dialog open={open} onClose={onClose} aria-labelledby="report-blank-fields-title" fullWidth maxWidth="sm">
    <DialogTitle id="report-blank-fields-title">입력되지 않은 항목이 {fields.length}개 있습니다</DialogTitle>
    <DialogContent>
      {required.length > 0 && <>
        <Alert severity="error" sx={{ mb: 1.5 }} data-testid="report-required-fields">{REPORT_REQUIRED_NOTICE}</Alert>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mb: 1.5 }}>
          {required.map((field) => <Chip key={field.key} size="small" color="error" label={`필수 · ${field.label}`} />)}
        </Stack>
      </>}
      {optional.length > 0 && <>
        <Typography variant="body2" sx={{ mb: 1.5 }}>아래 항목의 값을 지금 입력하시겠습니까? 입력하지 않고 계속하면 이 항목들은 리포트에 표시되지 않고, 남은 항목이 앞으로 당겨져 빈 칸 없이 배치됩니다.</Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} data-testid="report-blank-fields-list">
          {optional.map((field) => <Chip key={field.key} size="small" variant="outlined" label={`${field.group} · ${field.label}`} />)}
        </Stack>
        <Alert severity="info" sx={{ mt: 2 }}>{REPORT_BLANK_HIDE_NOTICE}</Alert>
      </>}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>취소</Button>
      <Button variant={required.length ? 'contained' : 'outlined'} onClick={onEnterValues}>값 입력하러 가기</Button>
      <Button variant="contained" disabled={required.length > 0} onClick={onContinue} data-testid="report-blank-fields-continue">숨김 처리하고 {actionLabel}</Button>
    </DialogActions>
  </Dialog>;
}

/** Persistent notice next to the report (never inside the printable sheet). */
export function ReportBlankFieldsNotice({ fields, acknowledged, className }: { fields: ReportBlankField[]; acknowledged: boolean; className?: string }) {
  if (!fields.length) return null;
  const required = requiredBlankFields(fields);
  if (required.length) return <Alert severity="error" className={className} data-testid="report-blank-fields-notice">
    발행 불가 — 필수 항목 미입력: {blankFieldsSummary(required)}. {REPORT_REQUIRED_NOTICE}
  </Alert>;
  return <Alert severity={acknowledged ? 'info' : 'warning'} className={className} data-testid="report-blank-fields-notice">
    {acknowledged ? '확인됨 — ' : `입력되지 않은 항목 ${fields.length}개: `}{blankFieldsSummary(fields)}. {REPORT_BLANK_HIDE_NOTICE}
  </Alert>;
}
