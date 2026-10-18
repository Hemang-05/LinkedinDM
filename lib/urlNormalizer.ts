/**
 * Canonical LinkedIn URL Normalizer
 *
 * Ensures equivalent URLs resolve to the exact same canonical string so the
 * unique(user_id, linkedin_url) database constraint prevents duplicate connections.
 *
 * Examples:
 * - https://www.linkedin.com/in/john-doe/
 * - https://linkedin.com/in/john-doe
 * - www.linkedin.com/in/john-doe/
 * - in.linkedin.com/in/John-Doe?trk=public_profile
 * All resolve to: https://www.linkedin.com/in/john-doe
 */

export function normalizeLinkedInUrl(
  rawUrl?: string | null,
  fallbackName?: string | null,
  fallbackCompany?: string | null
): string {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    if (fallbackName && fallbackName.trim()) {
      const query = `${fallbackName.trim()} ${fallbackCompany?.trim() || ''}`.trim();
      return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}`;
    }
    return '';
  }

  let cleaned = rawUrl.trim();

  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//i, '');

  // Remove www. or country subdomain (e.g. in.linkedin.com, uk.linkedin.com)
  cleaned = cleaned.replace(/^(?:[a-z]{2,3}\.)?linkedin\.com/i, 'linkedin.com');
  cleaned = cleaned.replace(/^www\./i, '');

  // If it's a profile URL (/in/...)
  const profileMatch = cleaned.match(/(?:linkedin\.com)?\/in\/([^/?#]+)/i);
  if (profileMatch && profileMatch[1]) {
    let slug = profileMatch[1].trim();
    try {
      slug = decodeURIComponent(slug);
    } catch {
      // keep original slug if decoding fails
    }
    // Remove any trailing slashes, spaces, or query leftovers
    slug = slug.replace(/\/+$/, '').trim().toLowerCase();
    return `https://www.linkedin.com/in/${slug}`;
  }

  // If it's a company URL (/company/...)
  const companyMatch = cleaned.match(/(?:linkedin\.com)?\/company\/([^/?#]+)/i);
  if (companyMatch && companyMatch[1]) {
    let slug = companyMatch[1].trim().replace(/\/+$/, '').toLowerCase();
    return `https://www.linkedin.com/company/${slug}`;
  }

  // General URL: strip query parameters and trailing slashes
  cleaned = cleaned.split('?')[0].split('#')[0].replace(/\/+$/, '');

  // Ensure canonical https://www.linkedin.com prefix
  if (cleaned.startsWith('linkedin.com')) {
    cleaned = cleaned.replace(/^linkedin\.com/, 'https://www.linkedin.com');
  } else if (!cleaned.startsWith('https://')) {
    cleaned = `https://www.linkedin.com/${cleaned.replace(/^\/+/, '')}`;
  }

  return cleaned.toLowerCase();
}

/**
 * Checks if two LinkedIn URLs reference the same profile identity
 */
export function isSameLinkedInProfile(url1?: string | null, url2?: string | null): boolean {
  if (!url1 || !url2) return false;
  const norm1 = normalizeLinkedInUrl(url1);
  const norm2 = normalizeLinkedInUrl(url2);
  return Boolean(norm1 && norm2 && norm1 === norm2);
}
