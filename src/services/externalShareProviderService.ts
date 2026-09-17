export type ExternalShareProviderId = 'local_offline' | 'remote_public';
export type ExternalShareProviderMode = 'local' | 'remote';
export type ExternalShareProviderAvailability = 'ready' | 'not_configured';

export interface ExternalShareCapabilities {
  publicUrl: boolean;
  remoteRevoke: boolean;
  serverExpiry: boolean;
  authenticatedAccess: boolean;
  syncedReview: boolean;
}

export interface ExternalShareProviderDescriptor {
  id: ExternalShareProviderId;
  label: string;
  mode: ExternalShareProviderMode;
  availability: ExternalShareProviderAvailability;
  capabilities: ExternalShareCapabilities;
  reason?: string;
}

export interface ExternalShareRemoteBinding {
  providerId: 'remote_public';
  remoteShareId?: string;
  publicUrl?: string;
  syncedAt?: string;
  remoteStatus?: 'active' | 'revoked' | 'expired';
}

const providers: ExternalShareProviderDescriptor[] = [
  {
    id: 'local_offline',
    label: 'LOCAL / OFFLINE',
    mode: 'local',
    availability: 'ready',
    capabilities: {
      publicUrl: false,
      remoteRevoke: false,
      serverExpiry: false,
      authenticatedAccess: false,
      syncedReview: false,
    },
  },
  {
    id: 'remote_public',
    label: 'REMOTE / PUBLIC',
    mode: 'remote',
    availability: 'ready',
    capabilities: {
      publicUrl: true,
      remoteRevoke: true,
      serverExpiry: true,
      authenticatedAccess: true,
      syncedReview: true,
    },
    reason: 'Supabase REMOTE / PUBLIC server와 self-hosted read-only viewer가 연결되어 있습니다.',
  },
];

export const externalShareProviderService = {
  list(): ExternalShareProviderDescriptor[] {
    return providers.map((provider) => ({ ...provider, capabilities: { ...provider.capabilities } }));
  },

  get(id: ExternalShareProviderId): ExternalShareProviderDescriptor {
    const provider = providers.find((item) => item.id === id);
    if (!provider) throw new Error(`지원하지 않는 외부공유 Provider입니다: ${id}`);
    return { ...provider, capabilities: { ...provider.capabilities } };
  },

  getLocal(): ExternalShareProviderDescriptor {
    return this.get('local_offline');
  },

  getRemote(): ExternalShareProviderDescriptor {
    return this.get('remote_public');
  },

  isRemoteReady(): boolean {
    return this.getRemote().availability === 'ready';
  },
};
