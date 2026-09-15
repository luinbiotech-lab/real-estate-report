import { useEffect, useMemo, useState } from 'react';
import { AddRounded, DeleteOutlineRounded, SaveRounded } from '@mui/icons-material';
import { Alert, Button, Card, CardContent, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { propertyRepository } from '../repositories/propertyRepository';
import { calculateRentalIncomeMetrics, rentalIncomeScenarioService, type RentalIncomeScenario } from '../services/rentalIncomeScenarioService';
import type { Property } from '../types';
import { formatWon } from '../utils/format';

const emptyDraft = (property?: Property): Omit<RentalIncomeScenario, 'id' | 'createdAt' | 'updatedAt'> => ({
  propertyId: property?.id || '',
  name: '기준 시나리오',
  purchasePrice: property?.salePrice || 0,
  deposit: property?.deposit || 0,
  monthlyRent: property?.monthlyRent || 0,
  otherMonthlyIncome: 0,
  vacancyRatePct: 5,
  operatingExpenseRatePct: 15,
  annualDebtService: 0,
  equityInvestment: property?.salePrice || 0,
});

function pct(value: number) {
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`;
}

export default function RentalIncomeWorkspacePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [scenarios, setScenarios] = useState<RentalIncomeScenario[]>([]);
  const [draft, setDraft] = useState<Omit<RentalIncomeScenario, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }>(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const metrics = useMemo(() => calculateRentalIncomeMetrics(draft), [draft]);

  const loadScenarios = (id: string, property?: Property) => {
    const rows = rentalIncomeScenarioService.list(id);
    setScenarios(rows);
    setDraft(rows[0] || emptyDraft(property));
  };

  useEffect(() => {
    (async () => {
      const rows = await propertyRepository.getAll();
      setProperties(rows);
      const first = rows.find((item) => item.id === 'daon-bangbae-815-11') || rows[0];
      if (first) {
        setPropertyId(first.id);
        loadScenarios(first.id, first);
      }
      setLoading(false);
    })();
  }, []);

  const changeProperty = (id: string) => {
    const property = properties.find((item) => item.id === id);
    setPropertyId(id);
    loadScenarios(id, property);
    setNotice('');
  };

  const numberField = (key: keyof typeof draft) => ({
    value: Number(draft[key]) || 0,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, [key]: Number(event.target.value) || 0 })),
  });

  const save = () => {
    const saved = rentalIncomeScenarioService.save({ ...draft, propertyId });
    setScenarios(rentalIncomeScenarioService.list(propertyId));
    setDraft(saved);
    setNotice('임대·수익 시나리오를 저장했습니다.');
  };

  const createNew = () => {
    setDraft({ ...emptyDraft(selected), propertyId, name: `시나리오 ${scenarios.length + 1}` });
    setNotice('');
  };

  const remove = (scenario: RentalIncomeScenario) => {
    if (!confirm(`“${scenario.name}” 시나리오를 삭제할까요?`)) return;
    rentalIncomeScenarioService.remove(scenario.id);
    const rows = rentalIncomeScenarioService.list(propertyId);
    setScenarios(rows);
    setDraft(rows[0] || emptyDraft(selected));
  };

  if (loading) return <div className="center"><CircularProgress /><p>임대·수익 분석을 준비하는 중입니다.</p></div>;

  return <main style={{ padding: 28, maxWidth: 1320, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 22 }}>
      <div><p className="eyebrow">RENTAL · INCOME · NOI · CAP RATE</p><h1 style={{ margin: '5px 0' }}>임대 · 수익 분석</h1><p style={{ margin: 0, color: '#667085' }}>물건별 임대수입, 공실, 운영비, NOI와 Cap Rate를 시나리오 단위로 비교합니다.</p></div>
      <Stack direction="row" spacing={1}><Button startIcon={<AddRounded />} onClick={createNew}>새 시나리오</Button><Button variant="contained" startIcon={<SaveRounded />} onClick={save}>시나리오 저장</Button></Stack>
    </header>

    {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 18, marginBottom: 18 }}>
      <TextField select fullWidth size="small" label="대상 물건" value={propertyId} onChange={(event) => changeProperty(event.target.value)}>
        {properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}
      </TextField>
      {selected && <div style={{ marginTop: 10, color: '#667085', fontSize: 13 }}>{selected.propertyNumber || '물건번호 미입력'} · 매매가 {formatWon(selected.salePrice)} · {selected.tradeType}</div>}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(360px,.9fr)', gap: 18, alignItems: 'start' }}>
      <Card variant="outlined"><CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>시나리오 입력</Typography>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
          <TextField label="시나리오명" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} sx={{ gridColumn: '1 / -1' }} />
          <TextField type="number" label="매입가(원)" {...numberField('purchasePrice')} />
          <TextField type="number" label="보증금(원)" {...numberField('deposit')} />
          <TextField type="number" label="월 임대료(원)" {...numberField('monthlyRent')} />
          <TextField type="number" label="기타 월수입(원)" {...numberField('otherMonthlyIncome')} />
          <TextField type="number" label="공실률(%)" {...numberField('vacancyRatePct')} inputProps={{ min: 0, max: 100, step: .5 }} />
          <TextField type="number" label="운영비율(%)" {...numberField('operatingExpenseRatePct')} inputProps={{ min: 0, max: 100, step: .5 }} />
          <TextField type="number" label="연간 원리금상환(원)" {...numberField('annualDebtService')} />
          <TextField type="number" label="투입 자기자본(원)" {...numberField('equityInvestment')} />
        </div>
        <Alert severity="info" sx={{ mt: 2 }}>세금·취득부대비용·법인세·대출조건은 포함하지 않은 1차 투자 시뮬레이션입니다. 계약·투자 판단 전 별도 검증이 필요합니다.</Alert>
      </CardContent></Card>

      <Card variant="outlined"><CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>수익성 결과</Typography>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
          {[
            ['연 총수입', formatWon(metrics.annualGrossIncome)],
            ['공실 손실', formatWon(metrics.vacancyLoss)],
            ['유효총수익 EGI', formatWon(metrics.effectiveGrossIncome)],
            ['운영비', formatWon(metrics.operatingExpenses)],
            ['NOI', formatWon(metrics.noi)],
            ['Cap Rate', pct(metrics.capRatePct)],
            ['연 현금흐름', formatWon(metrics.annualCashFlow)],
            ['Cash-on-Cash', pct(metrics.cashOnCashReturnPct)],
          ].map(([label, value]) => <div key={label} style={{ border: '1px solid #e4e9ef', borderRadius: 10, padding: 13 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 18, marginTop: 5 }}>{value}</strong></div>)}
        </div>
      </CardContent></Card>
    </section>

    <section style={{ marginTop: 18 }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>저장된 시나리오</Typography>
      {!scenarios.length ? <Alert severity="info">저장된 임대·수익 시나리오가 없습니다.</Alert> : <div style={{ display: 'grid', gap: 10 }}>
        {scenarios.map((scenario) => {
          const result = calculateRentalIncomeMetrics(scenario);
          return <Card key={scenario.id} variant="outlined"><CardContent sx={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(3,.8fr) auto', gap: 12, alignItems: 'center' }}>
            <div><strong>{scenario.name}</strong><small style={{ display: 'block', color: '#667085', marginTop: 3 }}>월 임대료 {formatWon(scenario.monthlyRent)} · 공실 {pct(scenario.vacancyRatePct)} · 운영비 {pct(scenario.operatingExpenseRatePct)}</small></div>
            <div><small>NOI</small><strong style={{ display: 'block' }}>{formatWon(result.noi)}</strong></div>
            <div><small>Cap Rate</small><strong style={{ display: 'block' }}>{pct(result.capRatePct)}</strong></div>
            <div><small>현금수익률</small><strong style={{ display: 'block' }}>{pct(result.cashOnCashReturnPct)}</strong></div>
            <Stack direction="row" spacing={.5}><Button size="small" onClick={() => setDraft(scenario)}>불러오기</Button><Button size="small" color="error" startIcon={<DeleteOutlineRounded />} onClick={() => remove(scenario)}>삭제</Button></Stack>
          </CardContent></Card>;
        })}
      </div>}
    </section>
  </main>;
}
