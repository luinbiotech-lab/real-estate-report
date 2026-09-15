import type { PropertyMedia } from '../domain/propertyDataRoom/types';

export type VisionProviderId = 'browser_pixel_v1' | 'external_proxy';

export interface VisionSignals {
  provider: VisionProviderId;
  width?: number;
  height?: number;
  brightness?: number;
  contrast?: number;
  edgeDensity?: number;
  qualityTags: string[];
  conditionHints: string[];
  warnings: string[];
}

async function mediaBlob(media: PropertyMedia): Promise<Blob | undefined> {
  if (media.fileData instanceof Blob) return media.fileData;
  if (!media.url) return undefined;
  const response = await fetch(media.url);
  if (!response.ok) return undefined;
  return response.blob();
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

async function analyzeBrowserPixels(media: PropertyMedia): Promise<VisionSignals> {
  const blob = await mediaBlob(media);
  if (!blob || !blob.type.startsWith('image/')) {
    return { provider: 'browser_pixel_v1', qualityTags: [], conditionHints: [], warnings: ['이미지 픽셀 원본을 읽을 수 없어 메타데이터 분석만 사용합니다.'] };
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const maxSide = 256;
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    let sum = 0; let sumSq = 0; let edgeSum = 0; let samples = 0;
    const luminance = new Float32Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const y = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      luminance[p] = y; sum += y; sumSq += y * y; samples += 1;
    }
    for (let y = 1; y < height; y += 1) {
      for (let x = 1; x < width; x += 1) {
        const i = y * width + x;
        edgeSum += Math.abs(luminance[i] - luminance[i - 1]) + Math.abs(luminance[i] - luminance[i - width]);
      }
    }

    const brightness = samples ? sum / samples : 0;
    const variance = samples ? Math.max(0, sumSq / samples - brightness * brightness) : 0;
    const contrast = Math.sqrt(variance);
    const edgeDensity = clamp01(edgeSum / Math.max(1, (width - 1) * (height - 1) * 2));
    const qualityTags: string[] = [];
    const conditionHints: string[] = [];
    if (brightness < 0.25) qualityTags.push('저조도');
    else if (brightness > 0.82) qualityTags.push('과노출 가능');
    else qualityTags.push('노출 양호');
    if (contrast < 0.09) qualityTags.push('저대비');
    if (edgeDensity < 0.035) conditionHints.push('디테일 식별 어려움');
    if (edgeDensity > 0.16) conditionHints.push('복잡한 마감/설비 요소 가능');
    if (bitmap.width < 900 || bitmap.height < 700) qualityTags.push('저해상도 가능');

    return {
      provider: 'browser_pixel_v1', width: bitmap.width, height: bitmap.height,
      brightness: Number(brightness.toFixed(3)), contrast: Number(contrast.toFixed(3)), edgeDensity: Number(edgeDensity.toFixed(3)),
      qualityTags, conditionHints, warnings: ['픽셀 신호는 공간·하자·설비를 확정 판정하지 않습니다. Human Review가 필요합니다.'],
    };
  } finally {
    bitmap.close();
  }
}

export const visionProviderService = {
  providerId: 'browser_pixel_v1' as const,
  async analyzeMedia(media: PropertyMedia): Promise<VisionSignals> {
    try { return await analyzeBrowserPixels(media); }
    catch (error) {
      return { provider: 'browser_pixel_v1', qualityTags: [], conditionHints: [], warnings: [`브라우저 Vision 분석 실패: ${error instanceof Error ? error.message : String(error)}`] };
    }
  },
};
