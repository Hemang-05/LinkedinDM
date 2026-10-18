/**
 * Temporal Candidate Filter for LinkedIn CSV Exports
 *
 * Implements Layer 1 of the incremental import pipeline.
 * Uses the previous import's archive_requested_at boundary date (inclusive, YYYY-MM-DD)
 * to filter candidate rows.
 *
 * NOTE: The temporal filter is an optimization only. It must NOT be treated as
 * the ultimate source of truth. If a date is unparseable or absent, the row is
 * conservatively retained so Layer 2 (Identity Filter) can verify it against Supabase.
 */

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

/**
 * Parses raw LinkedIn Connected On date into standardized 'YYYY-MM-DD'
 * Handles 'DD MMM YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'MMM DD, YYYY', etc.
 */
export function parseConnectedOnDate(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Pattern 1: ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Pattern 2: DD MMM YYYY (standard LinkedIn format, e.g. "17 Oct 2026" or "5 May 2025")
  const ddMmmYyyyMatch = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]{3,9})\s+(\d{4})/);
  if (ddMmmYyyyMatch) {
    const day = ddMmmYyyyMatch[1].padStart(2, '0');
    const monthKey = ddMmmYyyyMatch[2].slice(0, 3).toLowerCase();
    const month = MONTHS[monthKey];
    const year = ddMmmYyyyMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Pattern 3: MMM DD, YYYY (e.g. "Oct 17, 2026")
  const mmmDdMatch = trimmed.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (mmmDdMatch) {
    const monthKey = mmmDdMatch[1].slice(0, 3).toLowerCase();
    const month = MONTHS[monthKey];
    const day = mmmDdMatch[2].padStart(2, '0');
    const year = mmmDdMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Pattern 4: MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback: Date.parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Extracts YYYY-MM-DD boundary string from ISO timestamp or Date object
 */
export function extractBoundaryDate(boundary: string | Date | null | undefined): string | null {
  if (!boundary) return null;
  if (boundary instanceof Date) {
    return boundary.toISOString().split('T')[0];
  }
  if (typeof boundary === 'string' && boundary.trim()) {
    const match = boundary.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Checks if a connection's Connected On date is eligible under the temporal filter.
 * Uses inclusive boundary (Connected On >= boundary_date) because LinkedIn provides
 * date-only precision, while export requests occur at specific times of day.
 *
 * If boundary is null (first import), returns true.
 * If connectedOn is unparseable, returns true (conservative fallback).
 */
export function isEligibleByTemporalFilter(
  rawConnectedOn: string | null | undefined,
  boundaryDate: string | Date | null | undefined
): boolean {
  const boundaryIso = extractBoundaryDate(boundaryDate);
  if (!boundaryIso) {
    // No previous boundary -> all rows are candidates
    return true;
  }

  const parsedConnectedOn = parseConnectedOnDate(rawConnectedOn);
  if (!parsedConnectedOn) {
    // Unparseable date -> conservatively include for Layer 2 identity check
    return true;
  }

  // Inclusive check: Connected On >= boundary date
  return parsedConnectedOn >= boundaryIso;
}
