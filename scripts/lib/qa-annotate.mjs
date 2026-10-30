// Rendered-QA failure reporting for CI.
// Job logs are only downloadable from blob storage; check-run annotations are readable through the checks API, so
// failures are re-emitted as `::error::` workflow commands. Messages are length-capped and never include secrets
// (QA scripts only run against local preview servers with CI sentinel values).
export function annotateFailure(title, error) {
  if (!process.env.GITHUB_ACTIONS) return;
  const message = String(error?.stack || error?.message || error).slice(0, 3000);
  const escape = (value) => value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::error title=${escape(title).replace(/[:,]/g, ' ')}::${escape(message)}`);
}

/** waitForFunction-based text wait that names the missing text, the page and a visible-text excerpt on timeout. */
export async function waitForVisibleText(page, text, timeout = 30_000) {
  try {
    await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
  } catch (error) {
    const visible = ((await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 400);
    const url = new URL(page.url());
    throw new Error(`Text not found: "${text}" at ${url.pathname}${url.search} — visible: ${visible}`, { cause: error });
  }
}
