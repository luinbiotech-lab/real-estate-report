/*
 * Owner lockout guard for the access management screen (2026-10-30).
 * The owner could demote or deactivate their own profile, or the last active owner, from the UI — leaving nobody able
 * to manage roles without direct database intervention. This is a client-side safety check only; server/RLS rules are
 * unchanged and remain the authority.
 */
export interface OwnerProfileLike { userId: string; role: string; active: boolean }

export function ownerChangeBlockReason(
  profiles: OwnerProfileLike[],
  actorUserId: string | undefined,
  target: OwnerProfileLike,
  change: { role?: string; active?: boolean },
): string | undefined {
  const demotes = change.role !== undefined && target.role === 'owner' && change.role !== 'owner';
  const deactivates = change.active === false && target.active;
  if (!demotes && !deactivates) return undefined;
  if (actorUserId && target.userId === actorUserId) return '현재 로그인한 OWNER 본인의 권한을 낮추거나 비활성화할 수 없습니다. 다른 OWNER가 처리해야 합니다.';
  if (target.role === 'owner') {
    const otherActiveOwners = profiles.filter((profile) => profile.userId !== target.userId && profile.role === 'owner' && profile.active).length;
    if (otherActiveOwners === 0) return '활성 OWNER가 한 명만 남아 있어 권한을 낮추거나 비활성화할 수 없습니다.';
  }
  return undefined;
}
