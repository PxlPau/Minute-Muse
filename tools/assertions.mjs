/* =============================================================================
   tools/assertions.mjs — shared, data-independent assertions for the test suites

   Why this file exists
   --------------------
   An early version of the smoke test checked that the rendered passage was
   longer than 40 characters. That looked reasonable but was wrong: the
   collection legitimately contains very short entries — Mark Haddon's *The
   Curious Incident of the Dog in the Night-Time* is written as diary lines like
   "7.40 a.m. Have breakfast." — so the assertion rejected real content and made
   the suite fail at certain minutes of the day (guaranteed at 01:22, 07:32,
   07:40, 13:22, 15:55 and 16:18; about a 1-in-83 chance at any other minute).

   The right question is not "is the quote long enough" but "did a real passage
   from the collection reach the reader". These helpers answer that, and they
   stay true no matter which passage the clock happens to be showing.
   ========================================================================== */

/**
 * Assert that the reader is showing a genuine passage from the collection.
 *
 * Checks structure, never length:
 *  · the text is non-empty and wrapped in the reader's quotation marks
 *  · the byline is populated with an author
 *  · the markup carries a highlighted time, i.e. the minute was actually
 *    spotted inside the prose rather than the card sitting on a placeholder
 *
 * @param {(selector: string) => Element | null} $ query helper bound to the page
 * @param {{allowNoHighlight?: boolean}} [options]
 */
export function assertPassageRendered($, { allowNoHighlight = false } = {}) {
  const node = $('#quote');
  if (!node) throw new Error('the reader has no quote element');

  const text = (node.textContent || '').trim();
  if (!text) throw new Error('the reader is empty');

  // The reader wraps passages in curly quotes; a real passage needs both.
  if (!text.startsWith('“') || !text.endsWith('”')) {
    throw new Error(`passage is not presented as a quote: ${JSON.stringify(text.slice(0, 80))}`);
  }

  // Anything between the quotes counts, however brief: a three-word diary line
  // is a legitimate literary clock entry.
  const inner = text.slice(1, -1).trim();
  if (inner.length < 2) throw new Error(`passage body is empty: ${JSON.stringify(text)}`);

  const author = ($('#author')?.textContent || '').trim();
  if (author.length < 2) throw new Error('the byline has no author');

  if (!allowNoHighlight) {
    const highlights = node.innerHTML.match(/class="time-highlight"/g) || [];
    if (highlights.length === 0) {
      throw new Error(`no time phrase highlighted in: ${JSON.stringify(text.slice(0, 90))}`);
    }
    if (highlights.length > 1) {
      throw new Error(`${highlights.length} time phrases highlighted; expected at most one`);
    }
  }

  if (node.textContent.includes('<span')) {
    throw new Error('markup leaked into the visible text');
  }

  return { text, author };
}

/**
 * Assert the reader is not showing a failure placeholder. Used by the
 * resilience scenarios, where the point is that the room still opened.
 */
export function assertReaderNotBroken($) {
  const text = ($('#quote')?.textContent || '').trim();
  if (!text) throw new Error('the reader is empty');
  if (/could not be reached|could not load|failed/i.test(text)) {
    throw new Error(`the reader showed a failure message: ${JSON.stringify(text.slice(0, 90))}`);
  }
  return text;
}
