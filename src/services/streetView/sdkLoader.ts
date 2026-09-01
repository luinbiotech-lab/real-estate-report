const scripts = new Map<string, Promise<void>>();

export const getKakaoJavascriptKey = () => import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim() || '';

export function loadScript(id: string, src: string): Promise<void> {
  const existing = scripts.get(id);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const loaded = document.getElementById(id) as HTMLScriptElement | null;
    if (loaded?.dataset.loaded === 'true') { resolve(); return; }
    const script = loaded || document.createElement('script');
    script.id = id; script.async = true; script.src = src;
    script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
    script.onerror = () => reject(new Error('Kakao 로드뷰 SDK 인증에 실패했습니다. Kakao Developers Web 플랫폼에 http://localhost:5174 도메인이 등록되어 있는지 확인해 주세요.'));
    if (!loaded) document.head.appendChild(script);
  });
  scripts.set(id, promise);
  return promise;
}
