// Optional real-browser check; installs nothing, opens only a disposable fixture database.
// See docs/CHARACTERS-AND-REVIEW.md for browser prerequisites and invocation.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server/server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const seed = JSON.parse(readFileSync(new URL('../public/data/platform.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'ursunalia-browser-fixture-'));
const origin = `http://127.0.0.1:${Number(process.env.SMOKE_PORT ?? 31847)}`;
let app, browser;
try {
  app = await createAppServer({ dbPath: join(directory, 'test.sqlite'), origin,
    adminEmail: 'browser-admin@example.test', adminPassword: 'browser-only-password-12345' });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(new URL(origin).port, '127.0.0.1', resolve);
  });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const player = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const gm = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const page of [player, gm]) page.on('pageerror', error => errors.push(error.message));
  const apiResult = async (page, click, suffix) => {
    const response = page.waitForResponse(r => r.url().endsWith(suffix) && r.request().method() !== 'GET');
    await click(); const r = await response;
    const body = await r.json(); assert.equal(r.status(), 200, JSON.stringify(body)); return body;
  };
  const summary = async () => player.getByRole('link', { name: 'Podgląd', exact: true }).click();
  const send = async () => {
    await player.getByRole('button', { name: 'Wyślij zgłoszenie', exact: true }).click();
    return apiResult(player, () => player.getByRole('dialog').getByRole('button', { name: 'Wyślij zgłoszenie', exact: true }).click(), '/submit');
  };
  const save = () => apiResult(player, () => player.getByRole('button', { name: 'Zapisz szkic', exact: true }).first().click(), '/api/characters');
  await player.goto(origin + '/#/konto');
  await player.getByRole('button', { name: 'Nowe konto', exact: true }).click();
  await player.locator('input[name=name]').fill('Browser player');
  await player.locator('input[name=email]').fill('browser-player@example.test');
  await player.locator('input[name=password]').fill('browser-only-password-12345');
  await player.getByRole('button', { name: 'Utwórz konto', exact: true }).click();
  await player.locator('.survey-card').filter({ has: player.getByRole('heading', { name: seed.forms[0].title, exact: true }) }).getByRole('button').click();
  await player.locator('#input-name').fill('Browser draft');
  let c = await save(); assert.equal(c.status, 'draft'); assert.equal(c.revision, 1);
  await player.reload(); await player.locator('#input-name').waitFor();
  assert.equal(await player.locator('#input-name').inputValue(), 'Browser draft');
  // Supply the long example as fixture data through the same authorized HTTP API.
  // Submission, all subsequent edits and decisions use the actual Angular screens.
  c = await player.evaluate(async ({ c, answers }) => {
    const response = await fetch('/api/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, answers, expectedRevision: c.revision }) });
    if (!response.ok) throw new Error('Fixture answer preparation failed');
    return response.json();
  }, { c, answers: seed.example });
  await player.reload(); await player.locator('#input-name').waitFor();
  await summary(); c = await send(); assert.equal(c.status, 'submitted');
  await player.getByRole('link', { name: 'Edytuj zgłoszenie', exact: true }).click();
  const unchanged = await save(); assert.equal(unchanged.status, 'submitted'); assert.equal(unchanged.revision, c.revision);
  await player.locator('#input-name').fill('Alena z przeglądarki');
  c = await save(); assert.equal(c.status, 'draft');
  await summary(); c = await send(); assert.equal(c.status, 'submitted');
  await gm.goto(origin + '/#/konto');
  await gm.locator('input[name=email]').fill('browser-admin@example.test');
  await gm.locator('input[name=password]').fill('browser-only-password-12345');
  await gm.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await gm.getByRole('link', { name: 'Panel organizatora', exact: true }).click();
  await gm.getByPlaceholder('Gracz lub postać…').fill('Alena');
  await gm.locator('.review-item').click();
  await player.getByRole('link', { name: 'Edytuj zgłoszenie', exact: true }).click();
  await player.locator('#input-name').fill('Alena wycofana z kolejki');
  c = await save(); assert.equal(c.status, 'draft');
  await gm.getByRole('button', { name: 'Odśwież', exact: true }).click();
  await gm.getByRole('heading', { name: 'Brak zgłoszeń w tym widoku', exact: true }).waitFor();
  assert.equal(await gm.locator('.review-item').count(), 0);
  assert.equal(await gm.locator('.review-detail').count(), 0);
  await summary(); c = await send(); assert.equal(c.status, 'submitted');
  await gm.getByRole('button', { name: 'Odśwież', exact: true }).click();
  await gm.locator('.review-item').click();
  c = await apiResult(gm, () => gm.getByRole('button', { name: 'Odrzuć', exact: true }).click(), '/decision');
  assert.equal(c.status, 'rejected'); assert.equal(c.history[0].comment, '');
  await player.reload(); await player.getByRole('link', { name: 'Edytuj zgłoszenie', exact: true }).click();
  await player.locator('#input-surname').fill('Poprawiona'); c = await save(); assert.equal(c.status, 'rejected');
  await summary(); c = await send(); assert.equal(c.status, 'submitted');
  await gm.getByRole('button', { name: 'Odśwież', exact: true }).click();
  await gm.getByRole('button', { name: 'Edytuj postać jako MG', exact: true }).click();
  await gm.locator('#input-occupation').fill('Zmienione przez MG');
  c = await apiResult(gm, () => gm.getByRole('button', { name: 'Zapisz odpowiedzi bez zmiany statusu', exact: true }).click(), `/characters/${c.id}`);
  assert.equal(c.status, 'submitted'); assert.equal(c.history.length, 1);
  assert.equal(c.editHistory.length, 1);
  assert.equal(c.editHistory[0].characterId, c.id);
  assert.equal(c.editHistory[0].characterRevision, c.revision);
  assert.ok(Number.isFinite(Date.parse(c.editHistory[0].editedAt)));
  c = await apiResult(gm, () => gm.getByRole('button', { name: 'Zaakceptuj', exact: true }).click(), '/decision');
  assert.equal(c.status, 'accepted'); assert.equal(c.history.length, 2);
  await player.reload(); await player.getByRole('link', { name: 'Edytuj zgłoszenie', exact: true }).click();
  assert.equal(await player.locator('#input-name').isDisabled(), true);
  await gm.locator('.review-detail textarea').fill('Możesz poprawić postać.');
  c = await apiResult(gm, () => gm.getByRole('button', { name: 'Odblokuj dla gracza', exact: true }).click(), '/unlock');
  assert.equal(c.status, 'changes'); assert.equal(c.history.at(-1).action, 'unlock');
  await player.reload(); await player.locator('#input-name').waitFor();
  assert.equal(await player.locator('#input-name').isDisabled(), false);
  await player.locator('#input-name').fill('Alena po odblokowaniu'); c = await save();
  await summary(); c = await send();
  await gm.getByRole('button', { name: 'Odśwież', exact: true }).click();
  c = await apiResult(gm, () => gm.getByRole('button', { name: 'Zaakceptuj', exact: true }).click(), '/decision');
  assert.equal(c.status, 'accepted'); assert.equal(c.history.length, 4);
  await player.reload(); await player.locator('u-character-history').waitFor();
  assert.ok((await player.locator('u-character-history').innerText()).includes('Organizator'));
  assert.ok((await player.locator('u-character-history').innerText()).includes('Historia edycji MG'));
  await player.getByRole('link', { name: 'Edytuj zgłoszenie', exact: true }).click();
  for (const width of [1440, 980, 390, 320]) {
    for (const [name, page] of [['player', player], ['gm', gm]]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name} horizontal overflow at ${width}px`);
      if (process.env.SMOKE_SCREENSHOTS) {
        await page.screenshot({ path: join(process.env.SMOKE_SCREENSHOTS, `stage2-${name}-${width}.png`), fullPage: true });
        await page.screenshot({ path: join(process.env.SMOKE_SCREENSHOTS, `stage2-${name}-${width}-viewport.png`) });
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: real Angular/API/SQLite workflow; draft, no-op, retract, reject, correct, GM edit, accept, unlock, history; widths 1440/980/390/320.');
} finally {
  if (browser) await browser.close();
  if (app) await app.close();
  rmSync(directory, { recursive: true, force: true });
}
