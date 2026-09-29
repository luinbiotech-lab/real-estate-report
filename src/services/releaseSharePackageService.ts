import type { BuildingReleaseShare } from './buildingReleaseCollaborationService';
import type { BuildingReleaseSnapshot } from './buildingReleaseSnapshotService';
import { productionRemoteViewerService } from './productionRemoteViewerService';

export const RELEASE_SHARE_PACKAGE_VERSION = 'daon-release-share-package-v1';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function buildReleaseSharePackageHtml(snapshot: BuildingReleaseSnapshot, share: BuildingReleaseShare) {
  if (share.snapshotId !== snapshot.id || share.propertyId !== snapshot.propertyId) throw new Error('공유정책과 Release Snapshot이 일치하지 않습니다.');
  const viewer = productionRemoteViewerService.toHtml(snapshot);
  const expiresLabel = share.expiresAt ? new Date(share.expiresAt).toLocaleString('ko-KR') : '만료 없음';
  const note = share.note ? escapeHtml(share.note) : '외부 검토 공유';
  const banner = `<section id="daon-share-policy" style="position:sticky;top:0;z-index:9999;background:#10243f;color:#fff;border-bottom:4px solid #b89b63;padding:12px 18px;font-family:Arial,sans-serif"><div style="max-width:1240px;margin:auto;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><small style="color:#d7c8a7;letter-spacing:.12em">DA:ON ASSET · READ ONLY SHARE</small><strong style="display:block;margin-top:3px">${note}</strong></div><div style="display:flex;gap:7px;flex-wrap:wrap"><span style="border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:5px 9px;font-size:12px">${escapeHtml(RELEASE_SHARE_PACKAGE_VERSION)}</span><span style="border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:5px 9px;font-size:12px">READ ONLY</span><span style="border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:5px 9px;font-size:12px">EXPIRES ${escapeHtml(expiresLabel)}</span><span style="border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:5px 9px;font-size:12px">DOWNLOAD ${share.allowDownload ? 'ALLOWED' : 'BLOCKED'}</span></div></div></section>`;
  const payload = safeJson({
    schemaVersion: RELEASE_SHARE_PACKAGE_VERSION,
    shareId: share.id,
    snapshotId: snapshot.id,
    propertyId: snapshot.propertyId,
    checksumHex: snapshot.checksumHex,
    token: share.token,
    access: share.access,
    status: share.status,
    expiresAt: share.expiresAt,
    allowDownload: share.allowDownload,
    note: share.note,
  });
  const guard = `<script id="daon-share-guard">(()=>{const SHARE=${payload};const expired=Boolean(SHARE.expiresAt&&Date.now()>=new Date(SHARE.expiresAt).getTime());const blocked=SHARE.status!=='active'||expired;if(!blocked)return;const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#10243f;color:white;display:flex;align-items:center;justify-content:center;padding:28px;font-family:Arial,sans-serif';const box=document.createElement('div');box.style.cssText='max-width:620px;border:1px solid rgba(255,255,255,.25);border-radius:16px;padding:28px;background:rgba(255,255,255,.06)';const h=document.createElement('h1');h.textContent='공유 열람이 종료되었습니다.';const p=document.createElement('p');p.textContent=expired?'이 공유 패키지는 만료되었습니다. 최신 공유본을 요청하세요.':'이 공유는 회수되었거나 비활성 상태입니다.';const meta=document.createElement('small');meta.textContent='Snapshot '+SHARE.snapshotId+' · checksum '+SHARE.checksumHex;box.append(h,p,meta);overlay.appendChild(box);document.body.appendChild(overlay)})();</script>`;
  const disclaimer = `<div style="max-width:1240px;margin:14px auto 24px;padding:0 24px;font-family:Arial,sans-serif"><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px;color:#7c2d12;font-size:12px;line-height:1.55">이 파일은 외부 검토용 읽기 전용 패키지입니다. constructionReady=false / legalBimReady=false이며 구조·피난·인허가·실시설계 승인본이 아닙니다. DOWNLOAD 정책은 향후 공유 서버의 원본 다운로드 권한을 의미하며, 이미 전달된 로컬 HTML 파일 자체의 저장을 기술적으로 차단하지 않습니다.</div></div>`;
  return viewer
    .replace('<body>', `<body>${banner}`)
    .replace('</body>', `${disclaimer}${guard}</body>`);
}

export const releaseSharePackageService = { toHtml: buildReleaseSharePackageHtml };
