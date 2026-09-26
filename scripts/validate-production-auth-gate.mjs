import { existsSync, readFileSync } from 'node:fs';

const files = {
  gate: 'src/components/ProductionAuthGate.tsx',
  app: 'src/App.tsx',
  docker: 'Dockerfile',
  render: 'render.yaml',
  env: '.env.example',
};

for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`Production auth gate 필수 파일 누락: ${file}`);
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  "VITE_REQUIRE_REMOTE_AUTH === 'true'",
  'remoteAuthGateway.getSession()',
  'remoteAuthGateway.signIn(email, password)',
  'DA:ON PRODUCTION ACCESS',
  'Production 운영 화면은 Supabase Auth의 active profile을 가진 사용자만 접근할 수 있습니다.',
]) if (!text.gate.includes(marker)) throw new Error(`Production Auth Gate 계약 누락: ${marker}`);

for (const marker of [
  "import ProductionAuthGate from './components/ProductionAuthGate';",
  '<ProductionAuthGate><Routes>',
  '</Routes></ProductionAuthGate>',
]) if (!text.app.includes(marker)) throw new Error(`App Production Auth Gate 연결 누락: ${marker}`);

for (const marker of [
  'ARG VITE_REQUIRE_REMOTE_AUTH=true',
  'VITE_REQUIRE_REMOTE_AUTH=$VITE_REQUIRE_REMOTE_AUTH',
]) if (!text.docker.includes(marker)) throw new Error(`Docker Production Auth Gate 누락: ${marker}`);

if (!text.render.includes('key: VITE_REQUIRE_REMOTE_AUTH') || !text.render.includes('value: "true"')) {
  throw new Error('Render production service는 VITE_REQUIRE_REMOTE_AUTH=true여야 합니다.');
}
if (!text.env.includes('VITE_REQUIRE_REMOTE_AUTH=false')) {
  throw new Error('Local env example은 명시적으로 Production Auth Gate default false를 문서화해야 합니다.');
}

console.log('Production UI remote-auth gate: PASS');
