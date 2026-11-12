import type { AddressCandidate, Coordinates, MapProvider } from './types';
import { MapServiceError } from './types';
import { getProxyStatus, proxyFetch } from './proxyClient';

/*
 * VWorld (국토교통부) static map for reports that are distributed as PDF (2026-11-11 review: public map, redistributable
 * with source attribution; NAVER static map redistribution terms not confirmed). Static map only — geocoding stays on
 * NAVER/Kakao. The centre marker and the attribution are drawn onto the image so they travel with it into 1P/7P/PDF.
 */
export const VWORLD_ATTRIBUTION = '© 국토교통부 브이월드(VWorld)';

const configured = () => getProxyStatus().vworldConfigured;

function loadImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new MapServiceError('request-failed', 'VWorld 지도 이미지를 읽지 못했습니다.')); };
    image.src = url;
  });
}

export const VWORLD_AERIAL_LABEL = '항공사진 · 현장사진 아님';

export async function stampVworldMap(blob: Blob, label = ''): Promise<string> {
  const image = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new MapServiceError('request-failed', '지도 이미지를 처리할 수 없습니다.');
  ctx.drawImage(image, 0, 0);
  // Centre marker: the map is requested centred on the property coordinates.
  const x = canvas.width / 2; const y = canvas.height / 2;
  ctx.fillStyle = '#d23b2f'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y - 22, 11, Math.PI * 0.82, Math.PI * 0.18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y - 22, 4.5, 0, Math.PI * 2); ctx.fill();
  // Source attribution (bottom right).
  ctx.font = '600 13px "Noto Sans KR", "Malgun Gothic", sans-serif';
  const width = ctx.measureText(VWORLD_ATTRIBUTION).width + 14;
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(canvas.width - width - 6, canvas.height - 26, width, 20);
  ctx.fillStyle = '#26384d'; ctx.textBaseline = 'middle'; ctx.fillText(VWORLD_ATTRIBUTION, canvas.width - width + 1, canvas.height - 16);
  // Aerial images carry their kind on the image itself so a report can never present them as a field photograph.
  if (label) {
    ctx.font = '700 15px "Noto Sans KR", "Malgun Gothic", sans-serif';
    const labelWidth = ctx.measureText(label).width + 18;
    ctx.fillStyle = 'rgba(3,47,86,0.9)'; ctx.fillRect(8, 8, labelWidth, 26);
    ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(label, 17, 21);
  }
  return canvas.toDataURL(label ? 'image/jpeg' : 'image/png', 0.9);
}

export const vworldMapProvider: MapProvider = {
  id: 'vworld', label: 'VWorld(국토교통부)', isConfigured: configured,
  async geocode(): Promise<AddressCandidate[]> {
    throw new MapServiceError('request-failed', 'VWorld는 지도 이미지 전용입니다.');
  },
  async createStaticMap({ latitude, longitude }: Coordinates): Promise<string> {
    if (!configured()) throw new MapServiceError('missing-key', 'VWorld API 설정이 없습니다.');
    const response = await proxyFetch('/api/maps/static', { provider: 'vworld', latitude: String(latitude), longitude: String(longitude) });
    return stampVworldMap(await response.blob());
  },
};

/** VWorld aerial image (basemap PHOTO) centred on the property, stamped with the kind label, marker and attribution. */
export async function createVworldAerialImage({ latitude, longitude }: Coordinates): Promise<string> {
  if (!configured()) throw new MapServiceError('missing-key', 'VWorld API 설정이 없습니다.');
  const response = await proxyFetch('/api/maps/static', { provider: 'vworld', layer: 'aerial', latitude: String(latitude), longitude: String(longitude) });
  return stampVworldMap(await response.blob(), VWORLD_AERIAL_LABEL);
}
