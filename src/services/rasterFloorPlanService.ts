import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';

export interface RasterPlanSummary {
  parser: 'raster_plan_metadata_v1';
  sourceAssetId: string;
  widthPx: number;
  heightPx: number;
  aspectRatio: number;
  scaleStatus: 'unverified';
  mappingStatus: 'manual_mapping_required';
  warnings: string[];
}

function isRaster(asset: DigitalTwinAsset) {
  const format = asset.fileFormat.toLowerCase();
  return asset.assetType === 'scanned_plan' || ['jpg', 'jpeg', 'png', 'webp'].includes(format);
}

export const rasterFloorPlanService = {
  canExtract(asset: DigitalTwinAsset) {
    return isRaster(asset);
  },

  async extract(asset: DigitalTwinAsset): Promise<RasterPlanSummary> {
    if (!isRaster(asset)) throw new Error('JPG, PNG, WEBP 스캔 도면만 raster metadata 추출이 가능합니다.');
    if (!(asset.fileData instanceof Blob)) throw new Error('스캔 도면 원본 Blob이 없어 metadata를 추출할 수 없습니다.');

    const bitmap = await createImageBitmap(asset.fileData);
    try {
      const widthPx = bitmap.width;
      const heightPx = bitmap.height;
      if (!widthPx || !heightPx) throw new Error('이미지 크기를 확인할 수 없습니다.');
      return {
        parser: 'raster_plan_metadata_v1',
        sourceAssetId: asset.id,
        widthPx,
        heightPx,
        aspectRatio: Number((widthPx / heightPx).toFixed(6)),
        scaleStatus: 'unverified',
        mappingStatus: 'manual_mapping_required',
        warnings: [
          'Raster 도면의 픽셀 크기는 확인했지만 실제 축척은 자동 확정하지 않습니다.',
          '벽·문·창·공간 경계는 Human Review 또는 별도 vision adapter가 승인하기 전까지 확정 데이터가 아닙니다.',
        ],
      };
    } finally {
      bitmap.close();
    }
  },
};
