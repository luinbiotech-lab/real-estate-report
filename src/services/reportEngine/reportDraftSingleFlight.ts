// De-duplicate only overlapping draft creations within the caller's scope.
// The caller owns the map (per page instance), so an auth/session switch cannot
// accidentally reuse another user's in-flight report creation.
export function createReportDraftOnce<T>(
  pending: Map<string, Promise<T>>,
  propertyId: string,
  createDraft: (propertyId: string) => Promise<T>,
): Promise<T> {
  const existing = pending.get(propertyId);
  if (existing) return existing;

  // Schedule the mutation in a microtask after the promise is registered.
  // React StrictMode can rerun the effect before the first request settles.
  const request = Promise.resolve().then(() => createDraft(propertyId));
  pending.set(propertyId, request);
  const clear = () => {
    if (pending.get(propertyId) === request) pending.delete(propertyId);
  };
  void request.then(clear, clear);
  return request;
}
