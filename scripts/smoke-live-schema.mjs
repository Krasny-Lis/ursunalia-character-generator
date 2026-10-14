import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server/server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const seed = JSON.parse(readFileSync(new URL('../public/data/platform.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'ursunalia-live-schema-browser-'));
const origin = `http://127.0.0.1:${Number(process.env.SMOKE_PORT ?? 31848)}`;
const schemaPath = `/api/events/${seed.event.id}/character-schema`;
let app, browser;
try {
  app = await createAppServer({ dbPath: join(directory, 'test.sqlite'), origin,
    adminEmail: 'schema-admin@example.test', adminPassword: 'fixture-only-password-12345' });
  await new Promise((resolve,reject) => { app.server.once('error',reject); app.server.listen(new URL(origin).port,'127.0.0.1',resolve); });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless:true,args:['--no-sandbox'] });
  const editor = await browser.newPage({viewport:{width:1440,height:1000}}), other = await browser.newPage({viewport:{width:1440,height:1000}});
  const player = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[]; for(const page of [editor,other,player]) page.on('pageerror',e=>errors.push(e.message));
  const builder = async page => { await page.goto(origin+'/#/organizator/ankiety/edytor?id=character-2027'); await page.reload(); await page.getByLabel('Tytuł formularza',{exact:true}).waitFor(); };
  const schema = page => page.evaluate(async path=>(await fetch(path)).json(),schemaPath);
  const api = async(page,click,suffix) => { const pending=page.waitForResponse(r=>r.url().endsWith(suffix)&&r.request().method()==='PUT'); await click(); const r=await pending; assert.equal(r.status(),200); return r.json(); };
  const save = page => api(page,()=>page.getByRole('button',{name:'Zapisz formularz',exact:true}).first().click(),schemaPath);
  for(const page of [editor,other]) {
    await page.goto(origin+'/#/konto'); await page.locator('input[name=email]').fill('schema-admin@example.test');
    await page.locator('input[name=password]').fill('fixture-only-password-12345');
    await page.getByRole('button',{name:'Zaloguj się',exact:true}).click(); await page.getByRole('heading',{name:'Ursunalia 2027',exact:true}).waitFor();
  }
  await player.goto(origin+'/#/konto'); await player.getByRole('button',{name:'Nowe konto',exact:true}).click();
  await player.locator('input[name=name]').fill('Schema player'); await player.locator('input[name=email]').fill('schema-player@example.test');
  await player.locator('input[name=password]').fill('fixture-only-password-12345');
  await player.getByRole('button',{name:'Utwórz konto',exact:true}).click(); await player.getByRole('heading',{name:'Ursunalia 2027',exact:true}).waitFor();
  const character=await player.evaluate(async({form,answers})=>{
    const post=async(path,body)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Fixture setup failed');return r.json();};
    await post('/api/events/ursunalia-2027/join',{});
    const c=await post('/api/characters',{id:'application-'+crypto.randomUUID(),form,answers,expectedRevision:0});
    return post('/api/characters/'+c.id+'/submit',{expectedRevision:c.revision});
  },{form:seed.forms[0],answers:seed.example});
  await builder(editor); await builder(other);
  await editor.getByLabel('Tytuł formularza',{exact:true}).fill('Manual live schema');
  assert.equal((await schema(editor)).title,seed.forms[0].title);
  assert.deepEqual(await editor.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ursunalia:builder:'))),[]);
  editor.once('dialog',d=>d.dismiss());
  await editor.getByRole('link',{name:'Ankiety organizatora',exact:true}).click();
  assert.equal(await editor.getByLabel('Tytuł formularza',{exact:true}).inputValue(),'Manual live schema');
  let saved=await save(editor); assert.equal(saved.title,'Manual live schema'); assert.equal(saved.revision,2);
  await other.getByLabel('Tytuł formularza',{exact:true}).fill('Other unsaved work');
  await other.getByRole('button',{name:'Zapisz formularz',exact:true}).first().click();
  await other.locator('.error-banner').waitFor(); assert.equal(await other.getByLabel('Tytuł formularza',{exact:true}).inputValue(),'Other unsaved work');
  assert.equal((await schema(other)).title,'Manual live schema');
  // Work remains in the losing editor; the winning editor continues with its new revision.
  await editor.locator('.palette-item').filter({hasText:'Krótka odpowiedź'}).click();
  await editor.locator('.editable-field.editing').getByLabel('Wymagane',{exact:true}).check();
  saved=await save(editor); assert.equal(saved.revision,3);
  const added=saved.sections.flatMap(s=>s.fields).find(f=>!seed.forms[0].sections.flatMap(s=>s.fields).some(old=>old.id===f.id));
  assert.ok(added?.required);
  const live=await player.evaluate(async id=>(await fetch('/api/characters/'+id)).json(),character.id);
  assert.equal(live.form.revision,3); assert.equal(live.status,'submitted'); assert.equal(live.answers[added.id],undefined);
  const rejected=await editor.evaluate(async c=>{ const r=await fetch('/api/organizer/characters/'+c.id+'/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:c.revision,status:'accepted'})});return r.status;},live);
  assert.equal(rejected,422);
  // Remove a field with data through existing controls and the mandatory loss-confirmation dialog.
  editor.once('dialog',d=>d.accept());
  await editor.locator('.editable-field').filter({has:editor.locator('.field-select h3').filter({hasText:'Imię postaci'})}).getByLabel('Usuń pytanie',{exact:true}).click();
  await editor.getByRole('button',{name:'Zapisz formularz',exact:true}).first().click();
  const dialog=editor.getByRole('dialog'); await dialog.waitFor();
  assert.ok((await dialog.innerText()).includes('1 aktywnych'));
  assert.equal(await dialog.getByRole('button',{name:'Potwierdź i zapisz',exact:true}).isDisabled(),true);
  const download=editor.waitForEvent('download'); await dialog.getByRole('button',{name:'Pobierz pełną kopię JSON',exact:true}).click();
  const artifact=await download; const exported=JSON.parse(readFileSync(await artifact.path(),'utf8'));
  assert.equal(exported.characters[0].answers.name,seed.example.name); assert.equal(exported.gmNotesAvailable,false);
  await dialog.getByRole('checkbox').check();
  saved=await api(editor,()=>dialog.getByRole('button',{name:'Potwierdź i zapisz',exact:true}).click(),schemaPath);
  const after=await player.evaluate(async id=>(await fetch('/api/characters/'+id)).json(),character.id);
  assert.equal(after.answers.name,undefined); assert.equal(after.status,'submitted'); assert.equal(after.form.revision,saved.revision);
  // Restore the field through an explicit schema save, fill new requirements and complete the review flow.
  const repaired=structuredClone(saved); repaired.sections[0].fields.unshift(seed.forms[0].sections[0].fields[0]);
  await editor.evaluate(async({path,definition})=>{const r=await fetch(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({definition,expectedRevision:definition.revision})});if(!r.ok)throw Error('Repair setup failed');}, {path:schemaPath,definition:repaired});
  await player.reload(); await player.goto(origin+'/#/zgloszenie-postaci?id='+character.id); await player.locator('#input-name').fill('Restored player');
  await player.locator('#input-'+added.id).fill('New required answer');
  const write=player.waitForResponse(r=>r.url().endsWith('/api/characters')&&r.request().method()==='POST');
  await player.getByRole('button',{name:'Zapisz szkic',exact:true}).first().click(); assert.equal((await write).status(),200);
  await player.getByRole('link',{name:'Podgląd',exact:true}).click(); await player.getByRole('button',{name:'Wyślij zgłoszenie',exact:true}).click();
  const sent=player.waitForResponse(r=>r.url().endsWith('/submit')); await player.getByRole('dialog').getByRole('button',{name:'Wyślij zgłoszenie',exact:true}).click(); assert.equal((await sent).status(),200);
  const ready=await player.evaluate(async id=>(await fetch('/api/characters/'+id)).json(),character.id);
  await editor.evaluate(async c=>{const r=await fetch('/api/organizer/characters/'+c.id+'/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:c.revision,status:'accepted'})});if(!r.ok)throw Error('Acceptance failed');},ready);
  await builder(editor);
  for(const width of [1440,980,390,320]) {
    await editor.setViewportSize({width,height:900});
    assert.ok(await editor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Builder overflow at '+width);
    if(process.env.SMOKE_SCREENSHOTS) await editor.screenshot({path:join(process.env.SMOKE_SCREENSHOTS,'stage3-builder-'+width+'.png')});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: live-schema Angular/API/SQLite; manual save, no persistent draft, navigation warning, 409, required validation, full backup, confirmed destruction, unchanged status, resubmit/accept; widths 1440/980/390/320.');
} finally { if(browser)await browser.close(); if(app)await app.close(); rmSync(directory,{recursive:true,force:true}); }
