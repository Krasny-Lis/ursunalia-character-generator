import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiFixture, seed, newCharacter } from './test-fixtures/api.mjs';
import { preflightDatabase } from './migrations.mjs';
const eventId = seed.event.id;
const portrait = 'data:image/png;base64,UE9SVFJBSVQtU0VDUkVU';
const plot = 'DELETE-ME-PLOT '.repeat(40);
async function player(f, name, status = 'draft', answers = seed.example) {
  await f.register(name); await f.join(name);
  const saved = await f.save(name, newCharacter(undefined, answers)); assert.equal(saved.status,200); let c=saved.data;
  if (status !== 'draft') { const r=await f.submit(name,c); assert.equal(r.status,200); c=r.data; }
  if (!['draft','submitted'].includes(status)) { const r=await f.decide('admin',c,status); assert.equal(r.status,200); c=r.data; }
  return c;
}
const lock = (f, c, locked = true, as = 'admin') => f.request(as, `/api/events/${eventId}/character-locks`, 'POST',
  { characters: (Array.isArray(c) ? c : [c]).map(c => ({ id: c.id, expectedRevision: c.revision })), locked });
const archive = (f, name, c) => f.request(name, `/api/characters/${c.id}/archive`, 'POST', { expectedRevision: c.revision, confirmArchive: true });
const remove = (f, name, c) => f.request(name, `/api/characters/${c.id}`, 'DELETE', { expectedRevision: c.revision, confirmDelete: true });
function sourceCopies(f, c) {
  const row = f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id);
  f.db.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?,?)').run(row.id,row.user_id,row.form_id,row.form_revision,row.answers,'accepted',row.updated_at,row.submitted_at,'Old '+plot);
  f.db.prepare('UPDATE characters SET legacy_application_id=? WHERE id=?').run(row.id,row.id);
  f.db.prepare('INSERT INTO character_schema_origins VALUES(?,?)').run(row.id, JSON.stringify(f.db.prepare('SELECT * FROM characters WHERE id=?').get(c.id)));
}
const tables = ['users','sessions','event_memberships','characters','character_controls','applications','character_schema_origins','character_archives','character_decisions','notifications'];
const snapshot = f => Object.fromEntries(tables.map(t => [t,f.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]));

test('independent locks preserve status, reject player saves/submits via API, and do not lock future characters or notify', async t => {
  const f = await apiFixture(t), c = await player(f,'owner','submitted');
  const gm = await f.register('gm'); await f.grant('admin',eventId,gm.id,'gm');
  assert.equal((await lock(f,c,true,'gm')).status,403);
  const before = f.db.prepare('SELECT COUNT(*) n FROM notifications').get().n;
  assert.equal((await lock(f,c)).status,200);
  let current = (await f.request('owner',`/api/characters/${c.id}`)).data;
  assert.equal(current.locked,true); assert.equal(current.status,c.status);
  assert.equal((await f.save('owner',current,{...current.answers,name:'Blocked'})).status,409);
  assert.equal((await f.submit('owner',current)).status,409);
  assert.equal((await lock(f,c,false)).status,409); // stale revision
  assert.equal((await lock(f,current)).data[0].revision,current.revision); // no-op
  const other = await player(f,'later'); assert.equal(other.locked,false);
  const edited = await f.request('gm',`/api/organizer/characters/${current.id}`,'PATCH',{expectedRevision:current.revision,expectedSchemaRevision:current.form.revision,answers:{...current.answers,name:'GM allowed'}});
  assert.equal(edited.status,200); current = edited.data;
  assert.equal(current.status,'submitted'); assert.equal(current.locked,true);
  assert.equal((await lock(f,current,false)).status,200);
  current = (await f.request('owner',`/api/characters/${c.id}`)).data;
  assert.equal(current.locked,false);
  assert.equal((await f.save('owner',current,{...current.answers,name:'Owner allowed'})).status,200);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM notifications').get().n,before);
  await f.restart(); assert.equal((await f.request('owner',`/api/characters/${c.id}`)).data.locked,false);
});

test('locking an accepted character and GM acceptance unlocking are independent controls', async t => {
  const f = await apiFixture(t); let c = await player(f,'owner','accepted');
  await lock(f,c); c = (await f.request('owner',`/api/characters/${c.id}`)).data;
  c = (await f.request('admin',`/api/organizer/characters/${c.id}/unlock`,'POST',{expectedRevision:c.revision})).data;
  assert.equal(c.status,'changes'); assert.equal(c.locked,true);
  assert.equal((await f.save('owner',c)).status,409);
  await lock(f,c,false); c = (await f.request('owner',`/api/characters/${c.id}`)).data;
  assert.equal((await f.save('owner',c,{...c.answers,name:'Unlocked'})).status,200);
});

test('bulk locking checks all revisions, IDs and event grants before writing; errors and competing requests roll back the entire batch', async t => {
  const f = await apiFixture(t), a = await player(f,'a'), b = await player(f,'b');
  const before = snapshot(f);
  assert.equal((await lock(f,[a,{...b,revision:b.revision+1}])).status,409); assert.deepEqual(snapshot(f),before);
  assert.equal((await lock(f,[a,a])).status,400); assert.deepEqual(snapshot(f),before);
  assert.equal((await f.request('admin','/api/events','POST',{id:'other',name:'Other'})).status,201);
  assert.equal((await f.request('admin','/api/events/other/character-locks','POST',{characters:[{id:a.id,expectedRevision:a.revision}],locked:true})).status,404);
  f.db.exec(`CREATE TRIGGER fail_bulk BEFORE UPDATE ON characters WHEN OLD.id='${b.id}' BEGIN SELECT RAISE(ABORT,'fixture'); END;`);
  assert.equal((await lock(f,[a,b])).status,500); assert.deepEqual(snapshot(f),before);
  f.db.exec('DROP TRIGGER fail_bulk');
  const results = await Promise.all([lock(f,[a,b]),lock(f,[a,b])]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(preflightDatabase(f.db).ok,true);
});

test('owner deletion, including accepted and locked characters, removes all internal plot/photo copies and leaves membership and technical references', async t => {
  const f = await apiFixture(t); let c = await player(f,'owner','submitted',{...seed.example,history:plot,portrait});
  c = (await f.decide('admin',c,'accepted','Decision '+plot)).data;
  sourceCopies(f,c);
  const membership = f.db.prepare('SELECT * FROM event_memberships').all(), users=f.db.prepare('SELECT * FROM users').all(), sessions=f.db.prepare('SELECT * FROM sessions').all();
  const stranger = await f.register('stranger'); assert.ok(stranger);
  assert.equal((await remove(f,'stranger',c)).status,404);
  assert.equal((await f.request('owner',`/api/characters/${c.id}`,'DELETE',{expectedRevision:c.revision})).status,400);
  await lock(f,c); let locked = (await f.request('owner',`/api/characters/${c.id}`)).data;
  assert.equal((await remove(f,'owner',c)).status,409);
  assert.equal((await remove(f,'owner',locked)).status,200);
  assert.equal(f.db.prepare('SELECT answers,feedback FROM characters WHERE id=?').get(c.id).answers,'{}');
  assert.equal(f.db.prepare('SELECT answers,feedback FROM applications WHERE id=?').get(c.id).answers,'{}');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM character_schema_origins WHERE character_id=?').get(c.id).n,0);
  assert.ok(f.db.prepare('SELECT comment FROM character_decisions WHERE character_id=?').all(c.id).every(d=>d.comment===''));
  assert.deepEqual(f.db.prepare('SELECT * FROM event_memberships').all(),membership);
  for(const user of users) assert.deepEqual(f.db.prepare('SELECT * FROM users WHERE id=?').get(user.id),user);
  for(const session of sessions) assert.deepEqual(f.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(session.token_hash),session);
  for(const [as,path] of [['owner','/api/bootstrap'],['owner','/api/notifications'],['admin',`/api/events/${eventId}/character-schema/export`]]) {
    const json=JSON.stringify((await f.request(as,path)).data); assert.equal(json.includes('DELETE-ME-PLOT'),false); assert.equal(json.includes(portrait),false);
  }
  assert.equal((await f.request('owner',`/api/characters/${c.id}`)).status,404);
  assert.equal((await f.request('admin',`/api/organizer/characters/${c.id}`)).status,404);
  assert.equal((await f.request('admin',`/api/organizer/characters/${c.id}/restore`,'POST',{expectedRevision:locked.revision+1})).status,404);
  assert.equal((await f.save('owner',newCharacter())).status,200);
  await f.restart(); assert.equal((await f.request('owner','/api/bootstrap')).data.user.name,'owner'); assert.equal(preflightDatabase(f.db).ok,true);
});

test('archive freezes full historical text and event/schema context, removes all image copies and remains owner-only across later schema changes and restart', async t => {
  const f=await apiFixture(t); let c=await player(f,'owner','accepted',{...seed.example,history:plot,portrait});
  f.db.prepare('UPDATE characters SET answers=? WHERE id=?').run(JSON.stringify({...c.answers,legacyText:'Unknown historical text',legacyImage:portrait}),c.id);
  sourceCopies(f,c);
  const a=(await archive(f,'owner',c)); assert.equal(a.status,200);
  const saved=a.data; assert.equal(saved.status,'accepted'); assert.equal(saved.answers.history,plot); assert.equal(saved.answers.legacyText,'Unknown historical text');
  assert.equal(saved.answers.portrait,undefined); assert.equal(JSON.stringify(saved).includes(portrait),false);
  assert.equal(f.db.prepare('SELECT answers FROM characters WHERE id=?').get(c.id).answers,'{}');
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM applications').all()).includes(portrait),false);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM character_schema_origins').all()).includes(portrait),false);
  assert.equal((await f.save('owner',c)).status,409); assert.equal((await f.submit('owner',c)).status,404);
  await f.register('stranger'); assert.deepEqual((await f.request('stranger','/api/archives')).data,[]);
  assert.equal((await archive(f,'stranger',c)).status,404); assert.equal((await f.request('admin','/api/archives')).data.length,0);
  const target=structuredClone(saved.form); target.title='Later'; target.sections[0].fields=target.sections[0].fields.filter(x=>x.id!=='name');
  const schemaPath=`/api/events/${eventId}/character-schema`;
  const preview=(await f.request('admin',schemaPath+'/preview','POST',{definition:target,expectedRevision:target.revision})).data;
  assert.equal(preview.affectedCharacters,0);
  assert.equal((await f.request('admin',schemaPath,'PUT',{definition:target,expectedRevision:target.revision,confirmLoss:true,confirmationToken:preview.confirmationToken})).status,200);
  await f.request('admin',`/api/events/${eventId}`,'PATCH',{expectedRevision:1,name:'Renamed'});
  await f.restart(); assert.deepEqual((await f.request('owner','/api/archives')).data,[saved]);
  assert.equal(preflightDatabase(f.db).ok,true);
  assert.equal((await remove(f,'owner',saved)).status,200); assert.deepEqual((await f.request('owner','/api/archives')).data,[]);
  const exported=JSON.stringify((await f.request('admin',schemaPath+'/export')).data);
  assert.equal(exported.includes('DELETE-ME-PLOT'),false); assert.equal(exported.includes('Unknown historical text'),false); assert.equal(exported.includes(portrait),false);
});

test('archive reuse creates a new draft on a different event, copying only compatible valid answers and never acceptance, photos or MG history', async t => {
  const f=await apiFixture(t), c=await player(f,'owner','accepted',{...seed.example,portrait});
  const saved=(await archive(f,'owner',c)).data;
  const other=await f.register('stranger'); await f.grant('admin',eventId,other.id,'gm');
  await f.request('admin','/api/events','POST',{id:'next',name:'Next',published:true,registrationsOpen:true});
  const form={...structuredClone(seed.forms[0]),id:'next-character',eventId:'next'};
  form.sections[0].fields.find(x=>x.id==='surname').type='textarea';
  const traits=form.sections.flatMap(s=>s.fields).find(x=>x.id==='traits'); traits.options=traits.options.filter(o=>o.id!==c.answers.traits[0]);
  form.sections[0].fields.find(x=>x.id==='name').maxLength=3;
  await f.request('admin','/api/events/next/character-schema','PUT',{definition:form,expectedRevision:0});
  const reuse=(as,eventId='next',revision=1)=>f.request(as,`/api/characters/${c.id}/reuse`,'POST',{eventId,expectedSchemaRevision:revision});
  assert.equal((await reuse('owner',seed.event.id)).status,400); assert.equal((await reuse('stranger')).status,404);
  assert.equal((await reuse('owner')).status,403); await f.join('owner','next');
  assert.equal((await reuse('owner','next',2)).status,409);
  const result=await reuse('owner'); assert.equal(result.status,200); const draft=result.data;
  assert.notEqual(draft.id,c.id); assert.equal(draft.status,'draft'); assert.deepEqual(draft.history,[]); assert.deepEqual(draft.editHistory,[]); assert.equal(draft.locked,false);
  assert.equal(draft.answers.portrait,undefined); assert.equal(draft.answers.name,undefined); assert.equal(draft.answers.surname,undefined);
  assert.deepEqual(draft.answers.traits,c.answers.traits.slice(1)); assert.equal(draft.answers.history,c.answers.history);
  assert.deepEqual((await f.request('owner','/api/archives')).data,[saved]);
  assert.equal((await reuse('owner')).status,409);
});

test('bulk archival requires closed registrations, completion confirmation, event and character revisions; trigger failure rolls back all photos and snapshots', async t => {
  const f=await apiFixture(t), a=await player(f,'a','accepted',{...seed.example,portrait}), b=await player(f,'b','submitted',{...seed.example,portrait});
  const url=`/api/events/${eventId}/character-archives`, body={characters:[a,b].map(c=>({id:c.id,expectedRevision:c.revision})),confirmArchive:true,confirmCompleted:true,expectedEventRevision:1};
  assert.equal((await f.request('admin',url,'POST',body)).status,409);
  await f.request('admin',`/api/events/${eventId}`,'PATCH',{expectedRevision:1,registrationsOpen:false});
  assert.equal((await f.request('admin',url,'POST',body)).status,409); body.expectedEventRevision=2;
  assert.equal((await f.request('admin',url,'POST',{...body,confirmCompleted:false})).status,400);
  const before=snapshot(f);
  f.db.exec(`CREATE TRIGGER fail_archive BEFORE INSERT ON character_archives WHEN NEW.character_id='${b.id}' BEGIN SELECT RAISE(ABORT,'fixture'); END;`);
  assert.equal((await f.request('admin',url,'POST',body)).status,500); assert.deepEqual(snapshot(f),before);
  f.db.exec('DROP TRIGGER fail_archive');
  assert.equal((await f.request('admin',url,'POST',{...body,characters:[body.characters[0],{...body.characters[1],expectedRevision:1}]})).status,409); assert.deepEqual(snapshot(f),before);
  assert.equal((await f.request('admin',url,'POST',body)).status,200);
  assert.equal((await f.request('a','/api/archives')).data.length,1); assert.equal((await f.request('b','/api/archives')).data.length,1);
  const later=(await f.save('a',newCharacter())).data; assert.equal(later.status,'draft'); assert.equal(later.locked,false);
  assert.equal(preflightDatabase(f.db).ok,true);
});

test('notifications are atomic with decisions, persistent, private and idempotently readable; no-op, lock and answer edits produce none', async t => {
  const f=await apiFixture(t); let c=await player(f,'owner','submitted'); await f.register('stranger');
  assert.deepEqual((await f.request('owner','/api/notifications')).data,[]);
  f.db.exec("CREATE TRIGGER fail_notification BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'fixture'); END;");
  const before=snapshot(f); assert.equal((await f.decide('admin',c,'changes','Fix')).status,500); assert.deepEqual(snapshot(f),before);
  f.db.exec('DROP TRIGGER fail_notification');
  c=(await f.decide('admin',c,'changes','Fix')).data;
  const n=(await f.request('owner','/api/notifications')).data[0]; assert.equal(n.kind,'changes'); assert.equal(n.comment,'Fix'); assert.equal(n.characterId,c.id); assert.equal(n.eventId,eventId); assert.equal(n.readAt,null);
  assert.equal((await f.request('stranger',`/api/notifications/${n.id}/read`,'POST',{})).status,404); assert.deepEqual((await f.request('stranger','/api/notifications')).data,[]);
  await f.decide('admin',c,'changes','Fix'); await f.save('owner',c,c.answers); await lock(f,c);
  assert.equal((await f.request('owner','/api/notifications')).data.length,1);
  let read=(await f.request('owner',`/api/notifications/${n.id}/read`,'POST',{})).data; assert.ok(read.readAt);
  assert.deepEqual((await f.request('owner',`/api/notifications/${n.id}/read`,'POST',{})).data,read);
  await f.request('owner','/api/auth/logout','POST',{});
  assert.equal((await f.request('owner','/api/notifications')).status,401);
  await f.request('owner','/api/auth/login','POST',{email:'owner@example.test',password:'test-password-long-enough'});
  await f.restart(); assert.deepEqual((await f.request('owner','/api/notifications')).data,[read]);
  c=(await f.request('owner',`/api/characters/${c.id}`)).data; await lock(f,c,false); c=(await f.request('owner',`/api/characters/${c.id}`)).data;
  c=(await f.decide('admin',c,'changes','New comment')).data;
  assert.equal((await f.request('owner','/api/notifications')).data.length,2);
  const gmEdit=await f.request('admin',`/api/organizer/characters/${c.id}`,'PATCH',{expectedRevision:c.revision,expectedSchemaRevision:c.form.revision,answers:{...c.answers,name:'Changed by GM'}}); assert.equal(gmEdit.status,200);
  assert.equal((await f.request('owner','/api/notifications')).data.length,2);
});

test('direct draft references, administration, search, archives and bulk operations enforce owner and event-scoped rights including revoked GM grants', async t => {
  const f=await apiFixture(t); let c=await player(f,'owner');
  const gm=await f.register('gm'); await f.grant('admin',eventId,gm.id,'gm');
  for(const as of ['gm','admin']) {
    assert.equal((await f.request(as,`/api/organizer/characters/${c.id}`)).status,404);
    assert.equal((await f.request(as,`/api/organizer/characters/${c.id}`,'PATCH',{expectedRevision:c.revision,expectedSchemaRevision:1,answers:c.answers})).status,404);
  }
  const meta=(await f.request('admin',`/api/events/${eventId}/characters`)).data[0]; assert.equal(meta.id,c.id); assert.equal(meta.answers,undefined);
  for(const as of ['owner','gm']) for(const endpoint of ['administration','accounts?q=owner','characters']) assert.equal((await f.request(as,`/api/events/${eventId}/${endpoint}`)).status,403);
  assert.equal((await f.request('admin',`/api/events/${eventId}/accounts?q=`)).status,400);
  const found=(await f.request('admin',`/api/events/${eventId}/accounts?q=owner`)).data; assert.equal(found.length,1); assert.deepEqual(Object.keys(found[0]).sort(),['email','id','name']);
  c=(await f.submit('owner',c)).data; assert.equal((await f.request('gm',`/api/organizer/characters/${c.id}`)).status,200);
  c=(await f.save('owner',c,{...c.answers,name:'Retracted'})).data;
  assert.equal((await f.request('gm',`/api/organizer/characters/${c.id}`)).status,404);
  c=(await f.submit('owner',c)).data;
  await f.grant('admin',eventId,gm.id);
  assert.equal((await f.request('gm',`/api/organizer/characters/${c.id}`)).status,403);
  await f.restart(); assert.equal((await f.decide('gm',c,'accepted')).status,403);
  assert.equal((await f.request('owner',`/api/characters/${c.id}/archive`,'POST',{expectedRevision:c.revision,confirmArchive:true},'https://evil.test')).status,403);
});

test('event administration grant writes detect concurrent editors and retain the last-organizer protection', async t => {
  const f=await apiFixture(t), user=await f.register('team');
  const url=`/api/events/${eventId}/grants/${user.id}`;
  const results=await Promise.all([f.request('admin',url,'PUT',{role:'gm',expectedRevision:1}),f.request('admin',url,'PUT',{role:'organizer',expectedRevision:1})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await f.request('admin',url,'PUT',{role:'gm'})).status,400);
  const data=(await f.request('admin',`/api/events/${eventId}/administration`)).data;
  assert.equal(data.event.revision,2); assert.equal(data.grants.length,2); assert.deepEqual(data.participants,[]);
  const admin=data.grants.find(u=>u.email==='admin@example.test');
  await f.request('admin',url,'DELETE',{expectedRevision:2});
  assert.equal((await f.request('admin',`/api/events/${eventId}/grants/${admin.id}`,'DELETE',{expectedRevision:3})).status,409);
});

test('failed owner deletion and archive leave character, copies, photos, membership and histories intact', async t => {
  const f=await apiFixture(t), c=await player(f,'owner','accepted',{...seed.example,history:plot,portrait}); sourceCopies(f,c);
  const before=snapshot(f);
  f.db.exec("CREATE TRIGGER fail_retire BEFORE UPDATE ON character_controls BEGIN SELECT RAISE(ABORT,'fixture'); END;");
  assert.equal((await remove(f,'owner',c)).status,500); assert.deepEqual(snapshot(f),before);
  assert.equal((await archive(f,'owner',c)).status,500); assert.deepEqual(snapshot(f),before);
  f.db.exec('DROP TRIGGER fail_retire'); assert.equal(preflightDatabase(f.db).ok,true);
});

test('bulk GM decisions and notifications are atomic, validate every acceptance and reject cross-event IDs, stale revisions and revoked grants', async t => {
  const f=await apiFixture(t), a=await player(f,'a','submitted'), b=await player(f,'b','submitted');
  const gm=await f.register('gm'); await f.grant('admin',eventId,gm.id,'gm');
  const url='/api/organizer/characters/decisions';
  const body={eventId,status:'accepted',feedback:'Team review',characters:[a,b].map(c=>({id:c.id,expectedRevision:c.revision}))};
  const before=snapshot(f);
  assert.equal((await f.request('gm',url,'POST',{...body,characters:[body.characters[0],{...body.characters[1],expectedRevision:1}]})).status,409); assert.deepEqual(snapshot(f),before);
  f.db.exec(`CREATE TRIGGER fail_second_notice BEFORE INSERT ON notifications WHEN NEW.character_id='${b.id}' BEGIN SELECT RAISE(ABORT,'fixture'); END;`);
  assert.equal((await f.request('gm',url,'POST',body)).status,500); assert.deepEqual(snapshot(f),before);
  f.db.exec('DROP TRIGGER fail_second_notice');
  const schema=(await f.request('admin',`/api/events/${eventId}/character-schema`)).data;
  schema.sections[0].fields.push({id:'new-required',type:'text',label:'New required',required:true});
  await f.request('admin',`/api/events/${eventId}/character-schema`,'PUT',{definition:schema,expectedRevision:1});
  const current=[a,b].map(c=>f.db.prepare('SELECT revision FROM characters WHERE id=?').get(c.id));
  body.characters=body.characters.map((c,i)=>({...c,expectedRevision:current[i].revision}));
  assert.equal((await f.request('gm',url,'POST',body)).status,422);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM notifications').get().n,0);
  body.status='changes'; assert.equal((await f.request('gm',url,'POST',body)).status,200);
  assert.equal((await f.request('a','/api/notifications')).data.length,1); assert.equal((await f.request('b','/api/notifications')).data.length,1);
  await f.request('admin','/api/events','POST',{id:'other-review',name:'Other'});
  assert.equal((await f.request('gm',url,'POST',{...body,eventId:'other-review'})).status,403);
  await f.grant('admin',eventId,gm.id); assert.equal((await f.request('gm',url,'POST',body)).status,403);
});

test('archive image scrubbing preserves surrounding narrative text while removing images even from unknown historical values', async t => {
  const f=await apiFixture(t), c=await player(f,'owner');
  f.db.prepare('UPDATE characters SET answers=? WHERE id=?').run(JSON.stringify({...c.answers,unknownNote:'Before '+portrait+' after',unknownArray:['text',portrait]}),c.id);
  const result=await archive(f,'owner',c);assert.equal(result.status,200);
  assert.equal(result.data.answers.unknownNote,'Before  after');assert.deepEqual(result.data.answers.unknownArray,['text','']);assert.equal(preflightDatabase(f.db).ok,true);
});

test('competing archival requests return a revision conflict without duplicating historical copies', async t => {
  const f=await apiFixture(t), c=await player(f,'owner');
  await f.request('admin',`/api/events/${eventId}`,'PATCH',{expectedRevision:1,registrationsOpen:false});
  const body={characters:[{id:c.id,expectedRevision:c.revision}],confirmArchive:true,confirmCompleted:true,expectedEventRevision:2};
  const results=await Promise.all([f.request('admin',`/api/events/${eventId}/character-archives`,'POST',body),f.request('admin',`/api/events/${eventId}/character-archives`,'POST',body)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await f.request('owner','/api/archives')).data.length,1);assert.equal(preflightDatabase(f.db).ok,true);
});

test('account lookup handles Polish case folding, escapes no SQL values and limits results without exposing hashes or public lists', async t => {
  const f=await apiFixture(t), owner=await f.register('owner');
  f.db.prepare('UPDATE users SET name=? WHERE id=?').run('Żaneta',owner.id);
  const found=await f.request('admin',`/api/events/${eventId}/accounts?q=${encodeURIComponent('żANETA')}`);assert.equal(found.status,200);assert.equal(found.data[0].id,owner.id);
  for(let i=0;i<25;i++) f.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('lookup-'+i,'Limited '+i,'lookup-'+i+'@example.test','fictional-hash','participant');
  const results=(await f.request('admin',`/api/events/${eventId}/accounts?q=limited`)).data;
  assert.equal(results.length,20);assert.ok(results.every(u=>Object.keys(u).sort().join(',')==='email,id,name'));
  assert.deepEqual((await f.request('admin',`/api/events/${eventId}/accounts?q=%25__`)).data,[]);
  assert.equal((await f.request('',`/api/events/${eventId}/accounts?q=limited`)).status,401);
});

test('retiring one character preserves unrelated characters, their legacy/origin photo copies and additional questionnaires exactly', async t => {
  const f=await apiFixture(t), c=await player(f,'owner','accepted',{...seed.example,portrait}), other=await player(f,'other','accepted',{...seed.example,portrait:'data:image/png;base64,T1RIRVI='});
  sourceCopies(f,c);sourceCopies(f,other);
  const ownerId=f.db.prepare('SELECT user_id FROM characters WHERE id=?').get(c.id).user_id;
  f.db.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?,?)').run('logistics-preserved',ownerId,seed.forms[1].id,1,'{"unknownLogistics":"Keep exactly"}','draft','2026-10-14',null,'Keep logistics feedback');
  const records=()=>({character:f.db.prepare('SELECT * FROM characters WHERE id=?').get(other.id),origin:f.db.prepare('SELECT * FROM character_schema_origins WHERE character_id=?').get(other.id),legacy:f.db.prepare('SELECT * FROM applications WHERE id=?').get(other.id),survey:f.db.prepare("SELECT * FROM applications WHERE id='logistics-preserved'").get()});
  const before=records();const saved=(await archive(f,'owner',c)).data;assert.deepEqual(records(),before);
  assert.equal((await remove(f,'owner',saved)).status,200);assert.deepEqual(records(),before);assert.equal(preflightDatabase(f.db).ok,true);
});
