/**
 * Reliable clipboard copying with modern navigator.clipboard and fallback execCommand
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Modern Async Clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // Legacy execCommand fallback (works in iframe / restricted contexts)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Open external profile URL synchronously to prevent popup blockers
 */
export function openLinkedInTab(linkedinUrl?: string, name?: string, company?: string): void {
  if (typeof window === 'undefined') return;

  const targetUrl =
    linkedinUrl && linkedinUrl.includes('linkedin.com')
      ? linkedinUrl
      : `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
          (name || '') + ' ' + (company || '')
        )}`;

  window.open(targetUrl, '_blank', 'noopener,noreferrer');
}
