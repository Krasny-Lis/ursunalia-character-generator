// Real Angular/HTTP/SQLite multi-event regression; only disposable fictional data.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server/server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const directory=mkdtempSync(join(tmpdir(),'ursunalia-event-navigation-'));
const origin=`http://127.0.0.1:${Number(process.env.SMOKE_PORT ?? 31850)}`;
const fixtures=[
  {id:'lighthouse',name:'Noc latarni: opowieści starego portu',subtitle:'Tajemnice morza',date:'17 maja 2028',location:'Gdańsk',locationNote:'Wejście od ulicy Portowej',description:'Historia latarników przygotowana przez organizatora.',formTitle:'Karta latarnika'},
  {id:'masquerade',name:'Maskarada nad Wisłą',subtitle:'Wieczór masek',date:'8 czerwca 2029',location:'Toruń',locationNote:'Sala przy rynku',description:'Historia miejskiej maskarady przygotowana przez organizatora.',formTitle:'Karta gościa maskarady'},
];
let app,browser;
try {
  app=await createAppServer({dbPath:join(directory,'test.sqlite'),origin,adminEmail:'navigation-admin@example.test',adminPassword:'fictional-only-password-12345'});
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(new URL(origin).port,'127.0.0.1',resolve);});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.evaluate(async fixtures=>{
    const write=async(path,method,body)=>{const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Fixture HTTP failed: '+r.status);return r.json();};
    await write('/api/auth/login','POST',{email:'navigation-admin@example.test',password:'fictional-only-password-12345'});
    for(const {formTitle,...event} of fixtures) {
      await write('/api/events','POST',{...event,published:true,registrationsOpen:true});
      await write('/api/events/'+event.id+'/character-schema','PUT',{expectedRevision:0,definition:{id:'form-'+event.id,eventId:event.id,revision:1,status:'draft',title:formTitle,sections:[{id:'identity',title:'Tożsamość',fields:[{id:'name',label:'Imię postaci',type:'text',required:true}]}]}});
    }
  },fixtures);
  const open=async event=>{await page.goto(origin+'/#/wydarzenie/'+event.id);await page.reload();await page.locator('.event-hero h1').filter({hasText:event.name}).waitFor();};
  const surveys=()=>page.locator('#navigation').getByRole('link',{name:'Ankiety',exact:true});
  const checkGeneric=async(event,other)=>{
    assert.equal((await page.locator('.event-hero h1').innerText()).trim(),event.name);
    assert.equal((await page.locator('.page-eyebrow').innerText()).trim(),'WYDARZENIE');
    const text=await page.locator('main').innerText();
    for(const value of [event.subtitle,event.date,event.location,event.locationNote,event.description,event.formTitle]) assert.ok(text.includes(value),value);
    for(const old of ['Budzenie Niedźwiedzi','Krywulka','Ziemiach Braci','Kisleva','PRZED NAMI HISTORIA',other.description,other.formTitle]) assert.equal(text.includes(old),false,old);
    assert.equal(await page.locator('.survey-card').count(),1);
    assert.ok((await surveys().getAttribute('href')).includes('/wydarzenie/'+event.id+'#ankiety'));
    assert.equal((await page.locator('.event-selector [aria-current=page]').innerText()).trim(),event.name);
  };
  for(const [index,event] of fixtures.entries()) {
    await open(event);await checkGeneric(event,fixtures[1-index]);
    for(const width of [1440,980,390,320]) {
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'event overflow at '+width);
      const toggle=page.getByRole('button',{name:'Menu',exact:true});
      if(await toggle.isVisible()) await toggle.click();
      await surveys().click();await page.waitForURL(url=>url.hash==='#/wydarzenie/'+event.id+'#ankiety');
      assert.equal((await page.locator('.event-hero h1').innerText()).trim(),event.name);
      if(process.env.SMOKE_SCREENSHOTS) await page.screenshot({path:join(process.env.SMOKE_SCREENSHOTS,`pr8-event-${event.id}-${width}.png`),fullPage:true});
    }
    await page.setViewportSize({width:1440,height:1000});
  }
  // Switch within the same component; navigation and visible forms follow the new route immediately.
  await page.locator('.event-selector').getByRole('link',{name:fixtures[0].name,exact:true}).click();
  await page.locator('.event-hero h1').filter({hasText:fixtures[0].name}).waitFor();await checkGeneric(fixtures[0],fixtures[1]);
  await page.locator('#navigation').getByRole('link',{name:'Wydarzenie',exact:true}).click();
  await page.waitForURL(url=>url.hash==='#/');assert.equal((await page.locator('.event-hero h1').innerText()).trim(),fixtures[0].name);
  // Continue to the right actual form and back from it through the shared header.
  await page.getByRole('button',{name:'Dołącz i wypełnij',exact:false}).click();await page.locator('#input-name').waitFor();
  await page.locator('#input-name').fill('Latarnik testowy');
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/characters')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Zapisz szkic',exact:true}).first().click();assert.equal((await saved).status(),200);
  await surveys().click();await page.waitForURL(url=>url.hash==='#/wydarzenie/'+fixtures[0].id+'#ankiety');await checkGeneric(fixtures[0],fixtures[1]);
  await page.locator('.event-selector').getByRole('link',{name:'Ursunalia 2027',exact:true}).click();
  await page.getByRole('heading',{name:'Ursunalia 2027',exact:true}).waitFor();
  const ursunalia=await page.locator('main').innerText();
  for(const original of ['Budzenie Niedźwiedzi','Witaj na Ziemiach Braci','Krywulka','kultur Kisleva','LARP FANTASY · KISLEV · 2027']) assert.ok(ursunalia.includes(original),original);
  assert.ok((await surveys().getAttribute('href')).includes('/wydarzenie/ursunalia-2027#ankiety'));
  for(const width of [1440,980,390,320]) {
    await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Ursunalia overflow at '+width);
    if(process.env.SMOKE_SCREENSHOTS) await page.screenshot({path:join(process.env.SMOKE_SCREENSHOTS,`pr8-event-ursunalia-${width}.png`),fullPage:true});
  }
  await page.goto(origin+'/#/wydarzenie/unknown');await page.reload();await page.getByRole('heading',{name:'Wydarzenie niedostępne',exact:true}).waitFor();
  assert.equal(await page.locator('.event-bottom').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: direct links/reloads, two distinct organizer events without Ursunalia lore, original Ursunalia text, route switching, contextual surveys/form navigation, unavailable event, widths 1440/980/390/320.');
} finally {if(browser)await browser.close();if(app)await app.close();rmSync(directory,{recursive:true,force:true});}
