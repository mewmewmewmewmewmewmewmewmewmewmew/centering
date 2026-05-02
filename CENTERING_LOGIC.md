# Centering Logic — LLM Reference

**File to edit:** `src/lib/centeringLogic.ts`  
Do not edit any other file to change grading or ratio behaviour.

---

## How the app calls this file

Every time the user moves a guide line, `App.tsx` calls:

```ts
const result = computeCentering(lines);
// result.lrRatio   — left/right ratio, 0–100 (50 = perfect)
// result.tbRatio   — top/bottom ratio, 0–100 (50 = perfect)
// result.grades    — { PSA, BGS, CGC } each { grade: string, color: string }
```

`lines` is an object with four fractions (all in the range 0–1):
```ts
{ left: 0.0488, right: 0.9512, top: 0.0430, bottom: 0.9570 }
```

---

## Coordinate system

Everything is a fraction of the container width/height:
- `0` = left or top edge of the image
- `1` = right or bottom edge of the image

**Card border constants** (margins baked into the flattened 1260×1760 px image):
```
MARGIN = 0.02          // 2% from each horizontal edge
MY     = 0.02 × (63/88) ≈ 0.01432   // matching vertical margin (equal px all sides)
```

The printed card border runs from `MARGIN` to `1 - MARGIN` horizontally,
and from `MY` to `1 - MY` vertically.

---

## Ratio calculation (`computeRatio`)

The gap between each guide line and its nearest card border edge:

```
innerLeft   = lines.left  - MARGIN
innerRight  = (1 - MARGIN) - lines.right
innerTop    = lines.top   - MY
innerBottom = (1 - MY)    - lines.bottom
```

Ratios (as percentages):
```
lrRatio = innerLeft  / (innerLeft  + innerRight)  × 100
tbRatio = innerTop   / (innerTop   + innerBottom) × 100
```

`50.0` on both axes = perfectly centred card.

---

## Grading thresholds (`GRADE_THRESHOLDS`)

For each axis: `max = 50 + |ratio - 50|` (the worse side as a percentage, always ≥ 50).

The **displayed grade** uses whichever axis (LR or TB) is further from 50.

| max (worse side) | PSA | CGC | BGS |
|-----------------|-----|-----|-----|
| ≤ 50.5          | —   | —   | BL  |
| ≤ 55            | 10  | 10  | 9.5 |
| ≤ 60            | 9   | 9   | 8   |
| ≤ 65            | 8   | 8   | 7   |
| ≤ 70            | 7   | 7   | —   |
| > 70            | 6   | 6   | 6   |

---

## How to make changes

### Adjust a grading threshold
Edit `GRADE_THRESHOLDS` in `centeringLogic.ts`. Each row is:
```ts
[maxWorstSide, gradeString, tailwindColorClass]
```
Rows are checked top-to-bottom; first match wins.

### Change the ratio formula
Edit `computeRatio()`. Input is `GuideLines`, output must be `{ lrRatio, tbRatio }` (both 0–100).

### Add a new grading company
1. Add its key to the `GradingCompany` type.
2. Add a threshold array to `GRADE_THRESHOLDS`.
3. The app automatically picks it up via the `grades` object on `CenteringResult`.

### Return shape — never change this
```ts
interface CenteringResult {
  lrRatio: number;
  tbRatio: number;
  grades: Record<GradingCompany, { grade: string; color: string }>;
}
```
The `color` field is a Tailwind text class (e.g. `"text-green-400"`).

---

## Exported functions summary

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `computeCentering(lines)` | `GuideLines` | `CenteringResult` | Main entry — call this |
| `computeRatio(lines)` | `GuideLines` | `{ lrRatio, tbRatio }` | Ratio only |
| `computeGrade(ratio, company)` | `number, GradingCompany` | `GradeResult` | Grade for one axis |
