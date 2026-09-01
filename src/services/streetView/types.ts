import type { Coordinates } from '../maps/types';

export type StreetViewProviderId = 'naver' | 'kakao' | 'google';
export interface StreetViewMetadata {
  provider: 'naver' | 'kakao'; panoId: string; photoDate?: string; distanceMeters?: number; searchRadiusMeters?: number;
}
export interface StreetViewSession { metadata: StreetViewMetadata; destroy(): void }
export interface StreetViewProvider {
  readonly id: StreetViewProviderId; readonly label: string;
  isAvailable(): boolean;
  openViewer(container: HTMLElement, coordinates: Coordinates): Promise<StreetViewSession>;
}
