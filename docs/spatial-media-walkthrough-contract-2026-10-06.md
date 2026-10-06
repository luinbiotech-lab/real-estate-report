# DA:ON Spatial Media / 3D / Walkthrough Contract

Date: 2026-10-06  
Branch: `feat/daon-master-code-lock`  
Scope: Property Data Room platform body only. Report master design is locked and must not be redesigned by this contract.

## 1. Purpose

This contract closes the first operating design for:

1. floor-plan based 3D stabilization,
2. photo/video upload structure,
3. photo/video to property-space matching,
4. 3D Viewer / Walkthrough structure,
5. estimated / verified / field-checked state tracking.

The goal is not full automatic BIM generation. The goal is a stable data path:

```text
Property
→ Floor plan
→ Floor / space structure
→ Media assets
→ Media-to-space links
→ Viewer scene / nodes / edges
→ Walkthrough route / steps
→ Verification events
→ ReportViewModel / Data Room / Public Share
```

## 2. Non-negotiable operating principles

- Existing `DAON_1P_MASTER` and `DAON_DETAIL_7P_MASTER` remain locked.
- Confirmed report layout must not be redesigned by 3D work.
- Real media, public-source media, AI visualization, sample media, and inferred geometry must remain distinguishable.
- Interior photos must be property-policy controlled. For Bangbae 815-11, interior photos are not allowed.
- Estimated geometry must not be presented as measured BIM.
- Verification state must be stored as an auditable event, not only as a final field value.
- Existing `property_objects` JSON storage is preserved. The new migration adds a typed operational layer, not a destructive replacement.

## 3. Implemented artifacts

### 3.1 Database migration

`supabase/migrations/20261006_spatial_media_walkthrough_contract.sql`

Adds typed operational tables:

| Table | Role |
|---|---|
| `property_media_policies` | Property-level restrictions such as interior-photo ban and AI-visualization allowance |
| `floor_plans` | Uploaded floor-plan source, conversion status, extraction status, verification status |
| `property_spaces_spatial` | Floor/space-level structure for 2D/3D, media matching, and report mapping |
| `media_assets` | Photos, videos, floor-plan images, roadview captures, map captures, 360 media |
| `media_space_links` | Explicit link between media and space, including camera pose and confidence |
| `viewer_scenes` | 3D/floor-stack/photo-walkthrough scene container |
| `viewer_nodes` | Space/photo/video/roadview/annotation nodes inside scenes |
| `viewer_edges` | Node-to-node transitions for walkthrough and navigation |
| `walkthrough_routes` | Named route such as default/exterior/floor/investment/due-diligence |
| `walkthrough_steps` | Ordered walkthrough steps linked to spaces, media, or viewer nodes |
| `verification_events` | Append-oriented audit trail for status transitions |

### 3.2 Frontend/domain contract

`src/domain/propertyDataRoom/spatialMediaModel.ts`

Defines shared unions, interfaces, labels, and helper functions for:

- spatial verification status and level,
- floor-plan extraction status,
- spatial property spaces,
- media assets,
- media-space matching,
- viewer scenes/nodes/edges,
- walkthrough routes/steps,
- verification events,
- Bangbae 815-11 media restriction policy.

## 4. Verification state model

The common status set is:

```text
unknown
estimated
ai_estimated
source_provided
document_verified
field_checked
owner_confirmed
agent_verified
conflict
rejected
```

The common level mapping is:

| Level | Status examples | Meaning |
|---:|---|---|
| 0 | `unknown`, `conflict`, `rejected` | Not usable as confirmed evidence |
| 1 | `estimated`, `ai_estimated` | Inferred or generated |
| 2 | `source_provided` | Provided by owner/agent/source, not independently verified |
| 3 | `document_verified` | Official document or reliable document verified |
| 4 | `field_checked` | Field check / site capture verified |
| 5 | `owner_confirmed`, `agent_verified` | Confirmed by responsible party or final verifier |

## 5. Floor-plan to 3D stabilization

Initial target is not advanced BIM.

| Level | Product meaning | Current target |
|---:|---|---|
| 0 | No 3D | Not enough |
| 1 | Floor stack | Supported by schema |
| 2 | Space model | Supported by schema |
| 3 | Media pins on spaces | Supported by schema |
| 4 | Photo walkthrough | Supported by schema |
| 5 | Digital twin | Future expansion only |

Operational rule:

```text
Upload floor plan
→ convert/normalize
→ map floor and space candidates
→ manually review
→ connect media
→ prepare viewer scene
→ prepare walkthrough
→ generate report-safe view model
```

## 6. Media upload and source separation

Supported media types:

```text
photo
video
floorplan_image
roadview_capture
map_capture
drone_image
document_scan
360_image
360_video
```

Supported source origins:

```text
owner_provided
agent_uploaded
field_captured
public_source
roadview
map_provider
ai_generated
sample
unknown
```

Report safety rule:

- `ai_generated` media is not report-safe as real photo evidence.
- `conflict` and `rejected` media is not report-safe.
- `report` or `public_share` visibility is required for report/public use.

## 7. Photo/video to space matching

Matching status flow:

```text
unmatched
→ suggested
→ matched
→ needs_review
→ verified
```

Rejected links use:

```text
rejected
```

Supported match types:

```text
manual
filename_rule
gps_exif
timestamp_session
ai_visual_match
roadview_position
unknown
```

Early product priority:

1. manual matching,
2. filename/session-based suggestion,
3. EXIF/GPS assist,
4. AI visual match only as candidate, never as final truth without review.

## 8. Viewer / Walkthrough structure

### Viewer scene types

```text
floor_stack
space_model
photo_walkthrough
roadview_context
digital_twin
```

Initial implementation should prioritize:

1. `floor_stack`,
2. `space_model`,
3. `photo_walkthrough`.

### Walkthrough route types

```text
default
exterior
floor
investment
due_diligence
custom
```

Bangbae 815-11 default walkthrough should avoid interior photos and use:

```text
Exterior front
→ Road frontage
→ Entrance context
→ Floor/space schematic
→ Rooftop or upper exterior context if available
→ Nearby road / transit / living network
```

## 9. Bangbae 815-11 policy

The default policy is:

```text
allowInteriorPhotos = false
allowExteriorPhotos = true
allowRoadview = true
allowPublicMap = true
allowAiVisualization = true, but never as real photo evidence
restrictionNote = "매도인 요청으로 내부 사진은 사용하지 않으며, 외관·도로·주변환경·로드뷰·지도 중심으로 구성한다."
```

## 10. Next implementation sequence

1. Wire typed tables to repository/service layer.
2. Add Data Room tab grouping: Photos/Videos, Floor Plans/Spaces, 3D/Walkthrough, Verification.
3. Add media upload screen with source-origin, visibility, and verification fields.
4. Add media-to-space matching screen with left floor/space tree and right selected-media detail.
5. Add floor-plan upload and manual space mapping screen.
6. Add lightweight SVG/Canvas spatial viewer before heavy Three.js.
7. Feed spatial/media/walkthrough summaries into ReportViewModel.
8. Apply Bangbae 815-11 sample policy and route.
9. Run typecheck/build and then production dry-run only after remote data write safety review.

## 11. Completion definition

This phase is complete when the following are true:

- floor plans, spaces, media, viewer scenes, walkthroughs, and verification events have a shared data contract;
- interior-photo restrictions can be enforced per property;
- AI/sample/inferred media cannot be confused with real field evidence;
- report generation can read verification status and source origin;
- the Data Room can display unmatched / suggested / matched / verified media states;
- future 3D/Digital Twin work can extend this contract without replacing it.
