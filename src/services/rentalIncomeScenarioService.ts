export interface RentalIncomeScenario {
  id: string;
  propertyId: string;
  name: string;
  purchasePrice: number;
  deposit: number;
  monthlyRent: number;
  otherMonthlyIncome: number;
  vacancyRatePct: number;
  operatingExpenseRatePct: number;
  annualDebtService: number;
  equityInvestment: number;
  createdAt: string;
  updatedAt: string;
}

export interface RentalIncomeMetrics {
  annualGrossIncome: number;
  vacancyLoss: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noi: number;
  capRatePct: number;
  annualCashFlow: number;
  cashOnCashReturnPct: number;
}

const STORAGE_KEY = 'daon:rental-income-scenarios:v1';

function readAll(): RentalIncomeScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: RentalIncomeScenario[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function safeRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function calculateRentalIncomeMetrics(input: Pick<RentalIncomeScenario,
  'purchasePrice' | 'monthlyRent' | 'otherMonthlyIncome' | 'vacancyRatePct' | 'operatingExpenseRatePct' | 'annualDebtService' | 'equityInvestment'
>): RentalIncomeMetrics {
  const annualGrossIncome = Math.max(0, input.monthlyRent + input.otherMonthlyIncome) * 12;
  const vacancyLoss = annualGrossIncome * safeRate(input.vacancyRatePct) / 100;
  const effectiveGrossIncome = Math.max(0, annualGrossIncome - vacancyLoss);
  const operatingExpenses = effectiveGrossIncome * safeRate(input.operatingExpenseRatePct) / 100;
  const noi = Math.max(0, effectiveGrossIncome - operatingExpenses);
  const capRatePct = input.purchasePrice > 0 ? (noi / input.purchasePrice) * 100 : 0;
  const annualCashFlow = noi - Math.max(0, input.annualDebtService);
  const cashOnCashReturnPct = input.equityInvestment > 0 ? (annualCashFlow / input.equityInvestment) * 100 : 0;
  return { annualGrossIncome, vacancyLoss, effectiveGrossIncome, operatingExpenses, noi, capRatePct, annualCashFlow, cashOnCashReturnPct };
}

export const rentalIncomeScenarioService = {
  list(propertyId: string) {
    return readAll().filter((row) => row.propertyId === propertyId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  save(input: Omit<RentalIncomeScenario, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    const now = new Date().toISOString();
    const rows = readAll();
    const existing = input.id ? rows.find((row) => row.id === input.id) : undefined;
    const value: RentalIncomeScenario = {
      ...input,
      id: input.id || `income-${input.propertyId}-${Date.now()}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const next = existing ? rows.map((row) => row.id === value.id ? value : row) : [value, ...rows];
    writeAll(next);
    return value;
  },
  remove(id: string) {
    writeAll(readAll().filter((row) => row.id !== id));
  },
};
