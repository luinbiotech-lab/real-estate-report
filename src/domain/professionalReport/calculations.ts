export const SQM_PER_PYEONG = 3.305785;

export function sqmToPyeong(squareMeters: number | null | undefined): number | null {
  return squareMeters && squareMeters > 0 ? squareMeters / SQM_PER_PYEONG : null;
}

export function pyeongToSqm(pyeong: number | null | undefined): number | null {
  return pyeong && pyeong > 0 ? pyeong * SQM_PER_PYEONG : null;
}

export function calculateUnitPrice(price: number | null | undefined, areaPyeong: number | null | undefined): number | null {
  return price && price > 0 && areaPyeong && areaPyeong > 0 ? price / areaPyeong : null;
}

export function roundArea(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}
