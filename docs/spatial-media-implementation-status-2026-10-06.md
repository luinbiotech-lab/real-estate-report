# Spatial Media / 3D / Walkthrough Implementation Status

Date: 2026-10-06  
Branch: `feat/daon-master-code-lock`

## Completed in this sprint

### 1. Database contract

Added:

- `supabase/migrations/20261006_spatial_media_walkthrough_contract.sql`
- `supabase/migrations/20261006_spatial_media_property_scope_fix.sql`

The first migration defines the typed spatial-media operating layer. The second migration adds property-level scope to navigation rows that need direct property filtering:

- `viewer_edges.property_id`
- `walkthrough_steps.property_id`

This prevents later UI/repository queries from needing inefficient scene/route prefetches before filtering by property.

### 2. Domain model

Added:

- `src/domain/propertyDataRoom/spatialMediaModel.ts`

This defines the common typed contract for:

- floor plans,
- spatial property spaces,
- media assets,
- media-space links,
- viewer scenes/nodes/edges,
- walkthrough routes/steps,
- verification events,
- Bangbae 815-11 media policy,
- report-safety helpers.

### 3. Local persistence

Updated:

- `src/repositories/database.ts`

Database version changed from `13` to `14`.

Added local IndexedDB stores:

- `propertyMediaPolicies`
- `floorPlans`
- `propertySpacesSpatial`
- `mediaAssets`
- `mediaSpaceLinks`
- `viewerScenes`
- `viewerNodes`
- `viewerEdges`
- `walkthroughRoutes`
- `walkthroughSteps`
- `verificationEvents`

### 4. Repository layer

Added:

- `src/repositories/spatialMediaRepository.ts`

The repository supports both:

- local IndexedDB mode, and
- remote Supabase REST mode when `REMOTE_OPERATIONAL_MODE` is enabled.

Main methods:

- `getMediaPolicy` / `saveMediaPolicy`
- `getFloorPlans` / `saveFloorPlan`
- `getSpaces` / `saveSpace`
- `getMediaAssets` / `saveMediaAsset`
- `getMediaSpaceLinks` / `saveMediaSpaceLink`
- `getViewerScenes` / `saveViewerScene`
- `getViewerNodes` / `saveViewerNode`
- `getViewerEdges` / `saveViewerEdge`
- `getWalkthroughRoutes` / `saveWalkthroughRoute`
- `getWalkthroughSteps` / `saveWalkthroughStep`
- `getVerificationEvents` / `appendVerificationEvent`
- `getBundle`

## Verification status

### Confirmed

- GitHub branch updated.
- New migrations committed.
- New domain model committed.
- Local DB store version updated.
- Repository layer committed.
- Locked DAON report masters were not modified.

### Not verified in this environment

- Local `npm run typecheck`
- Local `npm run build`
- Supabase migration dry-run
- Runtime UI test

Reason: repository work was performed through the GitHub connector. The container Git clone path was unavailable because of environment DNS/network restrictions.

### Remote status observation

Latest checked commit showed Vercel status failure with target URL indicating `build-rate-limit`. This is a deployment quota/rate-limit status, not yet evidence of TypeScript or app build failure.

## Next step

The next implementation step is UI integration:

1. Add a Data Room summary adapter that merges existing `DataRoomBundle` with `SpatialMediaDataRoomBundle`.
2. Add grouped Data Room tabs:
   - Photos/Videos
   - Floor Plans/Spaces
   - 3D/Walkthrough
   - Verification
3. Add Bangbae 815-11 sample seed:
   - interior photos disabled,
   - exterior/road/roadview/map enabled,
   - AI visualization allowed only as clearly labeled visualization.
4. Add report summary fields:
   - media policy summary,
   - unmatched media count,
   - verified media count,
   - floor-plan extraction state,
   - walkthrough readiness.
