# DAON Visual MASTER — 2026-09-22

## Status
This document is the visual ground truth for DAON professional reports.

The approved report flow is:

1. OPENING
2. PROPERTY SUMMARY
3. INVESTMENT ANALYSIS
4. DEVELOPMENT DEEP DIVE
5. OPTIONAL DETAIL PAGES when verified source data exists
6. DAON COMPANY / CLOSING

The current detailed report renderer uses OPENING + existing verified detail pages + CLOSING while the individual inner page modules continue to evolve toward the approved visual references.

## Non-negotiable visual rules
- A4 portrait.
- Off-white / white body.
- Deep navy primary color.
- Warm gold accents only.
- Strong Korean headline hierarchy.
- Body text remains regular weight; emphasis remains visibly bold.
- Section title uses gold vertical rule and generous section-to-content spacing.
- Do not reduce whitespace simply to fit more text.
- If content is too long, edit the copy or add another page.
- Never redesign the MASTER because a property has different content.
- Property-specific data, photos, maps, analysis, and verified development facts are replaceable. Layout is not.

## Page roles

### OPENING
Brand-led greeting / proposal introduction. No property-detail density.

### PROPERTY SUMMARY
Large hero exterior image, price/lease data, property facts, key features, map, investment-highlight strip.

### INVESTMENT ANALYSIS
Numbered investment points, supporting imagery, development drivers, future-value interpretation, risks, summary opinion.

### DEVELOPMENT DEEP DIVE
Development drivers, official-plan facts, urban-function change, property-value transmission path.

### OPTIONAL DETAIL
Only render when real verified data exists. Never create filler pages with '확인 필요', N/A, or placeholder modules.

### CLOSING
DAON introduction, services, contact, brand close.

## Output pipeline
1. Verify source data.
2. Bind data to MASTER.
3. Render page images / browser preview.
4. Compare against approved MASTER visual references.
5. Correct typography, spacing, padding, alignment, imagery, and overflow.
6. Export/print PDF only after visual QA.

PDF is an output format, not the design source.

## Regression guard
The system validator must ensure:
- OPENING exists.
- DETAIL body exists.
- CLOSING exists.
- snapshot renderer uses DaonProfessionalReportMaster.
- A4 dimensions remain locked.
- old immutable snapshot versions remain readable.
