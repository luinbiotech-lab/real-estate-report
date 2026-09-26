export const CUTOVER_MODE = import.meta.env.DEV || import.meta.env.VITE_CUTOVER_MODE === 'true';
export const REMOTE_OPERATIONAL_MODE = import.meta.env.VITE_REMOTE_OPERATIONAL_MODE === 'true';

if (CUTOVER_MODE && REMOTE_OPERATIONAL_MODE) {
  throw new Error('VITE_CUTOVER_MODE와 VITE_REMOTE_OPERATIONAL_MODE는 동시에 true일 수 없습니다.');
}
