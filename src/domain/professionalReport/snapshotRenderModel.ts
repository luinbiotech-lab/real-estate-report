import { reportMediaCategoryAllowed, reportSnapshotInternalPhotoAllowed, reportSpatialMediaAllowed } from './reportAccessPolicy';
import type { ProfessionalReportViewModel } from './types';
import type { ReportSnapshot } from '../propertyDataRoom/types';

/*
 * Snapshot -> printable detail-report model. Shared by the in-app Snapshot page and the fixed-engine PDF render page
 * (2026-11-16, owner: the report must print the same on every device), so both apply the same media policy and checks.
 */
export function isViewModel(value: unknown): value is ProfessionalReportViewModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProfessionalReportViewModel>;
  return Boolean(candidate.identity?.name && candidate.pricing?.salePrice && candidate.generated?.generatedAt && candidate.dataQuality);
}

export function applySnapshotMediaPolicy(model: ProfessionalReportViewModel, propertyId: string): ProfessionalReportViewModel {
  const allowInternal = reportSnapshotInternalPhotoAllowed({
    id: propertyId,
    name: model.identity.name.value ?? '',
    address: model.identity.address.value ?? '',
    detailAddress: model.identity.detailAddress.value ?? '',
  }, model.media.internalPhotoAllowed);
  if (allowInternal) return model;
  return {
    ...model,
    spatial: model.spatial ? {
      ...model.spatial,
      media: model.spatial.media.filter((item) => reportSpatialMediaAllowed(item.mediaType, item.sourceOrigin, false)),
    } : undefined,
    media: {
      ...model.media,
      internalPhotoAllowed: false,
      mainImage: { ...model.media.mainImage, value: null, display: '미연결', state: 'missing', sourceIds: [] },
      additionalImages: { ...model.media.additionalImages, value: [], display: '미연결', state: 'missing', sourceIds: [] },
      items: model.media.items.filter((item) => item.id !== 'property-main' && item.category !== 'additional' && reportMediaCategoryAllowed(item.category, false)),
    },
  };
}

// Never display or print a Snapshot whose embedded Property differs from its owner.
// markReady() already rejects this mismatch, but historical drafts are printable.
export function snapshotMatchesProperty(snapshot: ReportSnapshot): boolean {
  const identity = (snapshot.snapshotData as Partial<ProfessionalReportViewModel>).identity;
  return typeof snapshot.propertyId === 'string' && snapshot.propertyId.length > 0 && identity?.id === snapshot.propertyId;
}


/** Normalise optional arrays and apply the snapshot media policy (Bangbae hard deny, internal photo rules). */
export function buildDetailRenderModel(snapshot: ReportSnapshot & { snapshotData: ProfessionalReportViewModel }): ProfessionalReportViewModel {
  return applySnapshotMediaPolicy({
    ...snapshot.snapshotData,
    building: {
      ...snapshot.snapshotData.building,
      floors: snapshot.snapshotData.building.floors ?? [],
    },
    investment: {
      ...snapshot.snapshotData.investment,
      comparables: snapshot.snapshotData.investment.comparables ?? [],
    },
  }, snapshot.propertyId);
}
