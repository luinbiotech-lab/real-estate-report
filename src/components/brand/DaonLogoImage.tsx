import logoUrl from '../../assets/brand/daon-logo-sample.png';

/*
 * TEMPORARY DA:ON logo (owner instruction 2026-11-05): "로고는 나중에 원본 줄테니 일단 깨지더라도 샘플에 있는 로고를 사용".
 * The image is cropped from the owner's own reference report (DA:ON ASSET lockup: D mark + DA:ON + ASSET) with the
 * navy background keyed out to transparency, so it is meant for navy surfaces. Low resolution by design until the
 * owner supplies the original file; replace src/assets/brand/daon-logo-sample.png (or this import) at that time.
 */
export function DaonLogoImage({ className = '' }: { className?: string }) {
  return <img className={`daon-logo-img ${className}`.trim()} src={logoUrl} alt="DA:ON ASSET" draggable={false} />;
}
