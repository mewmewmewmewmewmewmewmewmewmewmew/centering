/**
 * centeringLogic.ts
 * -----------------
 * ALL centering math and grading lives here.
 * The app calls computeCentering() whenever guide lines move and
 * uses the returned values for display — nothing else in the app
 * does centering math.
 *
 * ─── COORDINATE SYSTEM ───────────────────────────────────────────
 * Every position is a fraction of the container (0 = left/top edge,
 * 1 = right/bottom edge).
 *
 * Card constants baked into the flattened 1260×1740 px image:
 *   MARGIN = 0.02   (2% of width on each horizontal side = 25.2 px)
 *   MY     = MARGIN / FLATTENED_ASPECT ≈ 0.014483  (the same 25.2 px
 *            expressed as a fraction of height, so all four physical
 *            margins are equal)
 *
 * The canvas is 1260×1740, NOT 63:88 — the *card inside it* is 63:88
 * (1209.6 × 1689.6 px). See FLATTENED_ASPECT below.
 *
 * The card's inner area (inside the printed border) therefore runs:
 *   horizontally: [MARGIN, 1-MARGIN]  = [0.02, 0.98]
 *   vertically:   [MY,     1-MY]      = [≈0.01448, ≈0.98552]
 *
 * ─── GUIDE LINES ─────────────────────────────────────────────────
 * The user drags four lines (left, right, top, bottom).
 * Each is a fraction in [0,1].
 * Default 50/50 start (3% inward from each card edge):
 *   left   ≈ 0.0488   right  ≈ 0.9512
 *   top    ≈ 0.0440   bottom ≈ 0.9560
 *
 * ─── HOW RATIO IS CALCULATED ─────────────────────────────────────
 * The gap between a guide line and the card edge is measured inward
 * from the card's printed border, not from the container edge.
 *
 *   innerLeft   = lines.left  - MARGIN          (left  gap as fraction)
 *   innerRight  = (1-MARGIN)  - lines.right      (right gap as fraction)
 *   innerTop    = lines.top   - MY               (top   gap as fraction)
 *   innerBottom = (1-MY)      - lines.bottom      (bottom gap as fraction)
 *
 *   lrRatio (%) = innerLeft  / (innerLeft  + innerRight)  × 100
 *   tbRatio (%) = innerTop   / (innerTop   + innerBottom) × 100
 *
 * A perfectly centred card returns 50.0 / 50.0.
 *
 * ─── GRADING THRESHOLDS ──────────────────────────────────────────
 * For each axis the "worse" side is: max(lrRatio, 100-lrRatio).
 * Call this `max` (always ≥ 50).
 *
 * These are FRONT-of-card tolerances; backs are graded more loosely.
 * Centering is also only a ceiling — corners, edges and surface can
 * pull the real grade below what these tables report.
 *
 * PSA:
 *   max ≤ 55  → 10        CGC (half steps):     BGS (centering subgrade):
 *   max ≤ 60  → 9           ≤ 55  → 10            ≤ 50.5 → Black Label (BL)
 *   max ≤ 65  → 8           ≤ 60  → 9.5           ≤ 55   → 9.5
 *   max ≤ 70  → 7           ≤ 65  → 9             ≤ 60   → 9
 *   else      → 6           ≤ 70  → 8.5           ≤ 65   → 8.5
 *                           ≤ 75  → 8             ≤ 70   → 8
 *                           else  → 6             ≤ 75   → 7.5
 *                                                 ≤ 80   → 7
 *                                                 else   → 6
 *
 * KNOWN GAP: every ladder bottoms out at 6. Real scales keep going
 * (PSA 6 needs 80/20, 5 needs 85/15, 3–2 need 90/10), so badly centred
 * cards read higher here than they would grade.
 *
 * The displayed grade uses whichever axis (LR or TB) is worse.
 *
 * ─── HOW TO MODIFY ───────────────────────────────────────────────
 * • To adjust grading thresholds: edit the GRADE_THRESHOLDS tables.
 * • To change how ratio is calculated: edit computeRatio().
 * • To add a new grading company: add an entry to GRADE_THRESHOLDS
 *   and add its key to the GradingCompany type.
 * • Do NOT import from App.tsx or any component — this file must
 *   remain dependency-free (only imports from utils.ts).
 * • The app always calls computeCentering(lines) and reads the
 *   returned object — shape must stay { lrRatio, tbRatio, grades }.
 */

import { CARD_RATIO } from './utils';

// ─── Constants ───────────────────────────────────────────────────────────────

export const MARGIN = 0.02;

/**
 * Height ÷ width of the flattened image.
 *
 * The flattened image surrounds the card with an EQUAL pixel margin on all four
 * sides, so the canvas is not itself 63:88 — the card inside it is:
 *   cardW   = W·(1 − 2·MARGIN)
 *   cardH   = cardW ÷ CARD_RATIO
 *   canvasH = cardH + 2·(MARGIN·W)
 * Dividing through by W gives the ratio below (≈ 1.38095, i.e. 1260×1740).
 *
 * Deriving it rather than hard-coding it is what keeps the card's own aspect a
 * true 63:88 — subtracting equal margins from a 63:88 *canvas* would leave an
 * inner card that is ~1.2% too tall.
 */
export const FLATTENED_ASPECT = (1 - 2 * MARGIN) / CARD_RATIO + 2 * MARGIN;

/** Vertical margin as a fraction of height — the same pixel margin as MARGIN. */
export const MY = MARGIN / FLATTENED_ASPECT; // ≈ 0.014483

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuideLines {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type GradingCompany = 'PSA' | 'BGS' | 'CGC';

export interface GradeResult {
  grade: string;
  color: string; // Tailwind text colour class
}

export interface CenteringResult {
  lrRatio: number;       // 0–100, 50 = perfect
  tbRatio: number;       // 0–100, 50 = perfect
  grades: Record<GradingCompany, GradeResult>;
}

// ─── Grading thresholds ───────────────────────────────────────────────────────
// Each entry: [maxWorstSide, grade, tailwindColor]
// Rows are checked top-to-bottom; first match wins.

type ThresholdRow = [number, string, string];

const GRADE_THRESHOLDS: Record<GradingCompany, ThresholdRow[]> = {
  PSA: [
    [55,   '10',  'text-green-400'],
    [60,   '9',   'text-lime-400'],
    [65,   '8',   'text-yellow-300'],
    [70,   '7',   'text-orange-300'],
    [Infinity, '6', 'text-orange-500'],
  ],
  // CGC grades in half steps, so it needs its own ladder rather than PSA's
  // integer one — 60/40 is a CGC 9.5, not a 9.
  CGC: [
    [55,   '10',  'text-green-400'],
    [60,   '9.5', 'text-lime-400'],
    [65,   '9',   'text-lime-400'],
    [70,   '8.5', 'text-yellow-300'],
    [75,   '8',   'text-yellow-300'],
    [Infinity, '6', 'text-orange-500'],
  ],
  // BGS centering subgrade (front). 'BL' = centering good enough for a Black
  // Label 10, which additionally needs the other three subgrades to be 10.
  BGS: [
    [50.5, 'BL',  'text-green-400 font-black'],
    [55,   '9.5', 'text-green-400'],
    [60,   '9',   'text-lime-400'],
    [65,   '8.5', 'text-lime-400'],
    [70,   '8',   'text-yellow-300'],
    [75,   '7.5', 'text-yellow-300'],
    [80,   '7',   'text-orange-300'],
    [Infinity, '6', 'text-orange-500'],
  ],
};

// ─── Core functions ───────────────────────────────────────────────────────────

/** Convert a ratio (0-100) to a grade for one company. */
export function computeGrade(ratio: number, company: GradingCompany): GradeResult {
  const max = 50 + Math.abs(50 - ratio); // worst-side percentage (≥ 50)
  for (const [threshold, grade, color] of GRADE_THRESHOLDS[company]) {
    if (max <= threshold) return { grade, color };
  }
  return { grade: '-', color: '' };
}

/** Compute LR and TB ratios from guide line positions. */
export function computeRatio(lines: GuideLines): { lrRatio: number; tbRatio: number } {
  const innerLeft   = lines.left  - MARGIN;
  const innerRight  = (1 - MARGIN) - lines.right;
  const innerTop    = lines.top   - MY;
  const innerBottom = (1 - MY)    - lines.bottom;

  const lrTotal = innerLeft + innerRight;
  const tbTotal = innerTop  + innerBottom;

  return {
    lrRatio: lrTotal > 0 ? (innerLeft / lrTotal) * 100 : 50,
    tbRatio: tbTotal > 0 ? (innerTop  / tbTotal) * 100 : 50,
  };
}

/**
 * Main entry point — call this whenever guide lines change.
 * Returns ratios and grades for all three companies.
 */
export function computeCentering(lines: GuideLines): CenteringResult {
  const { lrRatio, tbRatio } = computeRatio(lines);

  const companies: GradingCompany[] = ['PSA', 'BGS', 'CGC'];
  const grades = {} as Record<GradingCompany, GradeResult>;

  for (const company of companies) {
    const lrGrade = computeGrade(lrRatio, company);
    const tbGrade = computeGrade(tbRatio, company);
    // Use whichever axis is further from 50 (worse centering)
    const lrWorst = Math.abs(50 - lrRatio);
    const tbWorst = Math.abs(50 - tbRatio);
    grades[company] = lrWorst >= tbWorst ? lrGrade : tbGrade;
  }

  return { lrRatio, tbRatio, grades };
}
