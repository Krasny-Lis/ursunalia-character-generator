// End-to-end acceptance on real Angular/HTTP/SQLite. Only a disposable fictional database is opened.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server/server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const directory = mkdtempSync(join(tmpdir(), 'ursunalia-mvp-browser-'));
const origin = `http://127.0.0.1:${Number(process.env.SMOKE_PORT ?? 31849)}`;
const password = 'fictional-browser-password-12345';
const template = {id:'template',eventId:'template-event',revision:1,status:'draft',title:'Testowa karta postaci',sections:[{id:'identity',title:'Tożsamość',fields:[
  {id:'name',type:'text',label:'Imię postaci',required:true},
  {id:'history',type:'textarea',label:'Historia postaci',required:false},
  {id:'portrait',type:'file',label:'Portret postaci',required:false},
]}]};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz1kAAAAASUVORK5CYII=','base64');
let app,browser;
const debugPages=[];
try {
  app=await createAppServer({dbPath:join(directory,'test.sqlite'),origin,adminEmail:'mvp-admin@example.test',adminPassword:password});
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(new URL(origin).port,'127.0.0.1',resolve);});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const admin=await browser.newPage({viewport:{width:1440,height:1000}}),gm=await browser.newPage({viewport:{width:1440,height:1000}}),player=await browser.newPage({viewport:{width:1440,height:1000}});
  debugPages.push(admin,gm,player);
  const errors=[];for(const p of [admin,gm,player]) p.on('pageerror',e=>errors.push(e.message));
  const route=async(page,path)=>{await page.goto(origin+'/#/'+path);};
  const result=async(page,click,suffix,method,expected=200)=>{
    const wait=page.waitForResponse(r=>r.url().endsWith(suffix)&&r.request().method()===method);await click();const r=await wait;const body=await r.json();assert.equal(r.status(),expected,JSON.stringify(body));return body;
  };
  const request=(page,path,method='GET',body)=>page.evaluate(async({path,method,body})=>{
    const r=await fetch(path,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};
  },{path,method,body});
  const login=async(page,email,register=false,name='')=>{
    await route(page,'konto');await page.reload();await page.locator('input[name=email]').waitFor();
    if(register){await page.getByRole('button',{name:'Nowe konto',exact:true}).click();await page.locator('input[name=name]').fill(name);}
    await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(password);
    await page.getByRole('button',{name:register?'Utwórz konto':'Zaloguj się',exact:true}).click();await page.getByRole('heading',{name:'Ursunalia 2027',exact:true}).waitFor();
  };
  const administration=async(id)=>{
    await route(admin,'organizator/wydarzenia');await admin.reload();await admin.getByLabel(/Wybierz wydarzenie/).waitFor();
    await admin.getByLabel(/Wybierz wydarzenie/).selectOption(id);
    if(id) await admin.locator('input[name=name]').waitFor();
  };
  const eventCreate=async(id,name)=>{
    await administration('');await admin.locator('input[name=id]').fill(id);await admin.locator('input[name=name]').fill(name);
    await admin.locator('input[name=date]').fill('22–24.04.2027');await admin.locator('input[name=location]').fill('Testowa Krywulka');await admin.locator('textarea[name=description]').fill('Fikcyjne wydarzenie odbiorcze MVP.');
    const event=await result(admin,()=>admin.getByRole('button',{name:'Utwórz wydarzenie',exact:true}).click(),'/api/events','POST',201);assert.equal(event.published,false);
    await admin.getByRole('link',{name:'Formularz postaci',exact:true}).click();await admin.getByLabel('Tytuł formularza',{exact:true}).waitFor();
    admin.once('dialog',d=>d.accept());await admin.locator('.import-button input').setInputFiles({name:'fictional-form.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(template))});
    await admin.getByLabel('Tytuł formularza',{exact:true}).fill('Karta '+name);
    const form=await result(admin,()=>admin.getByRole('button',{name:'Zapisz formularz',exact:true}).first().click(),`/api/events/${id}/character-schema`,'PUT');
    await administration(id);await admin.getByLabel('Wydarzenie opublikowane',{exact:true}).check();await admin.getByLabel('Zapisy otwarte',{exact:true}).check();
    const published=await result(admin,()=>admin.getByRole('button',{name:'Zapisz wydarzenie',exact:true}).click(),`/api/events/${id}`,'PATCH');assert.equal(published.registrationsOpen,true);
    return form;
  };
  const save=()=>result(player,()=>player.getByRole('button',{name:'Zapisz szkic',exact:true}).first().click(),'/api/characters','POST');
  const send=async()=>{
    await player.getByRole('link',{name:'Podgląd',exact:true}).click();await player.getByRole('button',{name:'Wyślij zgłoszenie',exact:true}).click();
    return result(player,()=>player.getByRole('dialog').getByRole('button',{name:'Wyślij zgłoszenie',exact:true}).click(),'/submit','POST');
  };
  await login(admin,'mvp-admin@example.test');
  await eventCreate('mvp-first','Etap 4 – Pierwszy');
  await login(gm,'mvp-gm@example.test',true,'MVP MG');
  await admin.getByLabel('Nazwa lub e-mail',{exact:true}).fill('mvp-gm');await admin.getByRole('button',{name:'Szukaj kont',exact:true}).click();
  await result(admin,()=>admin.getByRole('button',{name:'Nadaj MG',exact:true}).click(),'/grants/'+(await request(gm,'/api/bootstrap')).data.user.id,'PUT');
  await login(player,'mvp-player@example.test',true,'MVP gracz');
  await player.getByRole('link',{name:'Etap 4 – Pierwszy',exact:true}).click();await player.getByRole('heading',{name:'Etap 4 – Pierwszy',exact:true}).waitFor();await player.getByRole('button',{name:'Dołącz i wypełnij',exact:false}).click();
  await player.locator('#input-name').fill('Archiwalna Alena');let c=await save();assert.equal(c.status,'draft');
  await player.reload();await player.locator('#input-name').waitFor();assert.equal(await player.locator('#input-name').inputValue(),'Archiwalna Alena');
  const draftCheck=await request(gm,'/api/organizer/characters/'+c.id);assert.equal(draftCheck.status,404);
  await player.locator('#input-history').fill('Tekst do zachowania w archiwum.');await player.locator('.upload-control input[type=file]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:png});
  await player.locator('.upload-control img').waitFor();c=await save();assert.ok(c.answers.portrait.startsWith('data:image/'));const image=c.answers.portrait;
  c=await send();assert.equal(c.status,'submitted');
  await route(gm,'organizator/ankiety');await gm.reload();await gm.locator('.review-item').click();
  await gm.locator('.review-detail textarea').fill('Dodaj szczegół historii.');
  c=await result(gm,()=>gm.getByRole('button',{name:'Poproś o poprawki',exact:true}).click(),'/decision','POST');assert.equal(c.status,'changes');
  await route(player,'powiadomienia');await player.getByRole('heading',{name:'Powiadomienia',exact:true}).waitFor();await player.getByText('Dodaj szczegół historii.',{exact:true}).waitFor();
  await result(player,()=>player.getByRole('button',{name:'Oznacz jako przeczytane',exact:true}).click(),'/read','POST');
  await player.getByRole('button',{name:'Otwórz postać',exact:true}).click();await player.getByRole('link',{name:'Edytuj zgłoszenie',exact:true}).click();
  await player.locator('#input-history').fill('Tekst do zachowania w archiwum. Dodany szczegół.');c=await save();c=await send();
  await gm.getByRole('button',{name:'Odśwież',exact:true}).click();c=await result(gm,()=>gm.getByRole('button',{name:'Zaakceptuj',exact:true}).click(),'/decision','POST');assert.equal(c.status,'accepted');
  await administration('mvp-first');
  await result(admin,()=>admin.getByRole('button',{name:'Zablokuj kartę',exact:true}).click(),'/character-locks','POST');
  await player.reload();await player.getByText('Karta zablokowana',{exact:true}).waitFor();
  const current=(await request(player,'/api/characters/'+c.id)).data;
  assert.equal((await request(player,'/api/characters','POST',{...current,expectedRevision:current.revision,answers:{...current.answers,name:'Forbidden'}})).status,409);
  await admin.getByLabel('Zapisy otwarte',{exact:true}).uncheck();await result(admin,()=>admin.getByRole('button',{name:'Zapisz wydarzenie',exact:true}).click(),'/api/events/mvp-first','PATCH');
  await admin.getByLabel('Zaznacz wszystkie istniejące karty',{exact:true}).check();await admin.getByLabel('Potwierdzam, że wydarzenie zostało zakończone',{exact:true}).check();
  admin.once('dialog',d=>d.accept());await result(admin,()=>admin.getByRole('button',{name:'Archiwizuj zaznaczone po wydarzeniu',exact:true}).click(),'/character-archives','POST');
  await route(player,'konto');await player.getByRole('button',{name:'Otwórz archiwalną postać',exact:true}).click();
  await player.getByRole('heading',{name:'Archiwalna postać · Etap 4 – Pierwszy',exact:true}).waitFor();assert.ok((await player.locator('.review-detail').innerText()).includes('Dodany szczegół.'));
  assert.equal((await request(player,'/api/archives')).data[0].answers.portrait,undefined);
  assert.equal(JSON.stringify((await request(admin,'/api/events/mvp-first/character-schema/export')).data).includes(image),false);
  const archivedBefore=app.db.prepare('SELECT * FROM character_archives').get();
  const nextForm=await eventCreate('mvp-next','Etap 4 – Kolejny');
  await player.reload();await player.getByRole('button',{name:'Otwórz archiwalną postać',exact:true}).click();await player.getByLabel(/Docelowe wydarzenie/).selectOption('mvp-next');
  c=await result(player,()=>player.getByRole('button',{name:'Utwórz nowy szkic z archiwum',exact:true}).click(),'/reuse','POST');assert.equal(c.status,'draft');assert.deepEqual(c.history,[]);assert.equal(c.answers.portrait,undefined);
  await player.locator('#input-name').waitFor();assert.equal(await player.locator('#input-name').inputValue(),'Archiwalna Alena');assert.deepEqual(app.db.prepare('SELECT * FROM character_archives').get(),archivedBefore);
  c=await send();
  assert.equal((await request(gm,'/api/organizer/characters/'+c.id)).status,403); // event isolation
  await route(admin,'organizator/ankiety');await admin.reload();await admin.locator('.review-item').waitFor();
  await admin.getByLabel('Zaznacz postać · MVP gracz',{exact:true}).check();admin.once('dialog',d=>d.accept());
  const accepted=await result(admin,()=>admin.getByRole('button',{name:'Zaakceptuj zaznaczone',exact:true}).click(),'/api/organizer/characters/decisions','POST');assert.equal(accepted[0].status,'accepted');
  c=accepted[0];
  // Owner deletion uses the visible confirmation flow, also for accepted cards.
  await player.reload();player.once('dialog',d=>d.dismiss());await player.getByRole('button',{name:'Usuń postać',exact:true}).click();
  assert.equal((await request(player,'/api/characters/'+c.id)).status,200);
  player.once('dialog',d=>d.accept());await result(player,()=>player.getByRole('button',{name:'Usuń postać',exact:true}).click(),'/api/characters/'+c.id,'DELETE');
  assert.equal((await request(player,'/api/characters/'+c.id)).status,404);
  assert.equal(JSON.stringify((await request(admin,'/api/events/mvp-next/character-schema/export')).data).includes('Dodany szczegół.'),false);
  assert.ok(app.db.prepare('SELECT * FROM event_memberships WHERE user_id=? AND event_id=?').get((await request(player,'/api/bootstrap')).data.user.id,'mvp-next'));
  // Revocation through the administration UI takes effect without ending the MG session.
  await administration('mvp-first');admin.once('dialog',d=>d.accept());await result(admin,()=>admin.locator('.survey-card').filter({has:admin.getByRole('heading',{name:'MVP MG · MG',exact:true})}).getByRole('button',{name:'Odbierz uprawnienia',exact:true}).click(),'/grants/'+(await request(gm,'/api/bootstrap')).data.user.id,'DELETE');
  assert.equal((await request(gm,'/api/organizer/characters?eventId=mvp-first')).status,403);
  // Concurrent event edits return 409 and retain the local Angular draft.
  await administration('mvp-next');await admin.locator('input[name=name]').fill('Local concurrent event');
  const event=(await request(admin,'/api/events/mvp-next')).data;
  assert.equal((await request(admin,'/api/events/mvp-next','PATCH',{expectedRevision:event.revision,description:'Concurrent update'})).status,200);
  await result(admin,()=>admin.getByRole('button',{name:'Zapisz wydarzenie',exact:true}).click(),'/api/events/mvp-next','PATCH',409);
  assert.equal(await admin.locator('input[name=name]').inputValue(),'Local concurrent event');
  admin.once('dialog',d=>d.accept());await admin.getByRole('button',{name:'Wczytaj aktualne dane',exact:true}).click();
  // Responsive checks cover all new screens plus the player and review screens.
  for(const [page,screen,path] of [[admin,'admin','organizator/wydarzenia'],[admin,'review','organizator/ankiety'],[player,'account','konto'],[player,'notifications','powiadomienia'],[player,'characters','moje-postacie']]) {
    await route(page,path);await page.getByRole('heading').first().waitFor();
    if(screen==='account') await page.getByRole('button',{name:'Otwórz archiwalną postać',exact:true}).click();
    for(const width of [1440,980,390,320]) {
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),screen+' overflow at '+width);
      if(process.env.SMOKE_SCREENSHOTS) await page.screenshot({path:join(process.env.SMOKE_SCREENSHOTS,`stage4-${screen}-${width}.png`),fullPage:true});
    }
    await page.setViewportSize({width:1440,height:1000});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: full MVP Angular/HTTP/SQLite; event creation, live form, registration, private draft, review/corrections, notifications, acceptance, independent lock, bulk archive without photos, archive reuse, bulk decision, irreversible deletion, event isolation, revocation, 409, widths 1440/980/390/320.');
} catch(error) {
  for(const page of debugPages) { console.error(page.url(), (await page.locator('body').innerText()).slice(0,4000)); }
  throw error;
} finally { if(browser) await browser.close();if(app) await app.close();rmSync(directory,{recursive:true,force:true}); }
