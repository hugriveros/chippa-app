import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve('dist');
const qa = path.resolve('.qa');
await mkdir(qa, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!path.extname(file)) file = path.join(root, 'index.html');
    const data = await readFile(file);
    res.setHeader('Content-Type', ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg' })[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-default-apps', '--remote-debugging-port=0', `--user-data-dir=${path.join(qa, 'browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore','ignore','pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start')), 20000);
    chrome.on('error', reject);
    chrome.stderr.on('data', (data) => { output += data.toString(); const match = output.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once:true }));
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', (event) => {
    const value = JSON.parse(event.data);
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text);
    if (value.id) { const waiter = pending.get(value.id); if (waiter) { pending.delete(value.id); value.error ? waiter.reject(new Error(JSON.stringify(value.error))) : waiter.resolve(value.result); } }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve,reject) => { const id = ++sequence; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({ id,method,params,...(sessionId ? {sessionId} : {}) })); });
  const target = await send('Target.createTarget', { url: origin });
  const { sessionId } = await send('Target.attachToTarget', { targetId:target.targetId, flatten:true });
  const call = (method,params) => send(method,params,sessionId);
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const evaluate = async (expression) => { const result = await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || expression); return result.result.value; };
  const wait = async (expression) => { for(let i=0;i<80;i++) { if(await evaluate(expression)) return; await new Promise(resolve=>setTimeout(resolve,100)); } throw new Error(`Timed out: ${expression}`); };
  const click = async (selector) => { await wait(`!!document.querySelector(${JSON.stringify(selector)})`); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await new Promise(resolve=>setTimeout(resolve,100)); };
  const fill = (selector,value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Missing field'); const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const home = async () => { await click('.sidebar-brand'); await wait(`document.querySelectorAll('.play-card').length===17`); };
  const open = async (name) => { await home(); await evaluate(`(()=>{const el=[...document.querySelectorAll('.play-card')].find(el=>el.querySelector('.play-card-title').textContent===${JSON.stringify(name)});if(!el)throw new Error('Card missing');el.click();})()`); await wait(`!!document.querySelector('.module-page') || !!document.querySelector('dialog[open]')`); };
  const screenshot = async (name) => { const {data}=await call('Page.captureScreenshot',{format:'png'}); await writeFile(path.join(qa,name),Buffer.from(data,'base64')); };
  if (process.argv.includes('--friends')) {
    await wait(`!!document.querySelector('.nav-cta')`);await evaluate('localStorage.clear()');await click('.nav-cta');
    await fill('input[autocomplete=name]','Katy');await fill('input[type=email]','katy@example.test');await fill('.password-field input','test12345');await fill('input[autocomplete=new-password]:not(.password-field input)','test12345');await click('.auth-card form .primary-button');
    await wait(`!!document.querySelector('.friends-page')`);assert.equal(await evaluate(`!!document.querySelector('.setup-page')`),false);assert.equal(await evaluate(`JSON.parse(localStorage.getItem('chippa-demo-v1')).experience`),null);
    const friendsHome=async()=>{await evaluate(`[...document.querySelectorAll('.side-link')].find(el=>el.textContent.includes('Amigos')).click()`);await wait(`!!document.querySelector('.friends-hero')`);};
    const invite=async(name)=>{await click('.friends-hero .primary-button');await fill('.friend-invite form input',name);await click('.friend-invite form .primary-button');await wait(`!!document.querySelector('.friend-created-link input')`);await wait(`[...document.querySelectorAll('.invitation-list article')].some(el=>el.textContent.includes(${JSON.stringify(name)}))`);};
    const connect=async(name)=>{await invite(name);await evaluate(`[...document.querySelectorAll('.invitation-list article')].find(el=>el.textContent.includes(${JSON.stringify(name)})).querySelector('.secondary-button').click()`);await wait(`!!document.querySelector('.friend-card')`);};
    const detail=async(name)=>{await friendsHome();await wait(`[...document.querySelectorAll('.friend-card')].some(el=>el.textContent.includes(${JSON.stringify(name)}))`);await evaluate(`[...document.querySelectorAll('.friend-card')].find(el=>el.textContent.includes(${JSON.stringify(name)})).click()`);await wait(`!!document.querySelector('.friend-detail-hero')`);};
    const createMeeting=async(name)=>{await click('.friend-detail-hero .primary-button');await fill('.modal-card form > label:first-child input',name);await click('.modal-card form .primary-button');await wait(`!!document.querySelector('.dashboard-content')`);};
    await connect('Rafa');await detail('Rafa');assert.equal(await evaluate(`document.querySelectorAll('.friend-meeting').length`),0);await createMeeting('Un cafecito con Rafa');
    await click('.membership-button');await click('dialog input[type=checkbox]');await click('dialog form .primary-button');await wait(`!document.querySelector('dialog[open]')`);
    await open('Cápsula compartida');await fill('.capsule-composer textarea','Un recuerdo compartido con Rafa');await click('.capsule-composer .primary-button');await fill('.capsule-composer textarea','BORRADOR PRIVADO NO MOSTRAR');await click('.capsule-composer input[type=checkbox]');await click('.capsule-composer .primary-button');
    await detail('Rafa');assert.equal(await evaluate(`document.querySelectorAll('.friend-meeting').length`),1);await click('.friends-tabs button:nth-child(2)');assert.ok(await evaluate(`document.querySelector('.friend-timeline').textContent.includes('Un recuerdo compartido con Rafa')`));assert.equal(await evaluate(`document.querySelector('.friend-timeline').textContent.includes('BORRADOR PRIVADO NO MOSTRAR')`),false);
    await friendsHome();await connect('Sofía');await detail('Sofía');assert.equal(await evaluate(`document.querySelectorAll('.friend-meeting').length`),0);await createMeeting('Un paseo con Sofía');
    await detail('Rafa');assert.equal(await evaluate(`document.querySelectorAll('.friend-meeting').length`),1);await createMeeting('Otra cita con Rafa');await detail('Rafa');assert.equal(await evaluate(`document.querySelectorAll('.friend-meeting').length`),2);await click('.friend-meeting:last-child');await wait(`!!document.querySelector('.dashboard-content')`);assert.equal(await evaluate(`JSON.parse(localStorage.getItem('chippa-demo-v1')).experience.title`),'Un cafecito con Rafa');
    await detail('Rafa');await click('.friends-tabs button:nth-child(2)');assert.ok(await evaluate(`document.querySelector('.friend-timeline').textContent.includes('Un recuerdo compartido con Rafa')`));await screenshot('friend-detail.png');
    await friendsHome();await screenshot('friends-desktop.png');await invite('Por cancelar');await evaluate(`[...document.querySelectorAll('.invitation-list article')].find(el=>el.textContent.includes('Por cancelar')).querySelector('.text-button').click()`);await wait(`[...document.querySelectorAll('.invitation-list article')].some(el=>el.textContent.includes('Por cancelar')&&el.textContent.includes('Cancelada'))`);
    await friendsHome();await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await screenshot('friends-mobile.png');assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`),true);
    await call('Page.reload');await wait(`!!document.querySelector('.demo-link')`);await click('.demo-link');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await friendsHome();await wait(`document.querySelectorAll('.friend-card').length===2`);await detail('Rafa');assert.equal(await evaluate(`document.querySelectorAll('.friend-meeting').length`),2);
    assert.deepEqual(errors,[]);console.log('OK: registro directo, invitaci?n/conexi?n, dos amigos, tres encuentros separados, historial e interacciones, borradores privados excluidos, cancelaci?n, persistencia y m?vil.');
  } else {
  await wait(`!!document.querySelector('.demo-link')`);
  await evaluate('localStorage.clear()');
  await click('.demo-link'); await home();
  assert.equal(await evaluate(`document.querySelectorAll('.side-premium-lock').length`),2);
  await click('.membership-button'); await click('dialog input[type=checkbox]'); await click('dialog form .primary-button');
  await wait(`!document.querySelector('dialog[open]') && document.querySelector('.membership-button').textContent.includes('activo')`);
  assert.equal(await evaluate(`document.querySelectorAll('.side-premium-lock').length`),0);
  for(const name of ['Nuestro momento','Tienes una carta','Nuestra próxima aventura','¿Pensamos lo mismo?','Completa nuestra historia','Match de recuerdos','Misión desbloqueada','Trivia post-cita','Bingo de recuerdos','¿Quién conoce más?','Adivina el lugar','Banco de preguntas','Pasaporte digital','Cápsula compartida','Carta del futuro','Playlist de la cita','Generador de planes']) {
    await open(name); assert.equal(await evaluate(`!!document.querySelector('.module-page h1')`),true,name); assert.equal(await evaluate(`!!document.querySelector('.module-page .module-panel')`),true,name);
  }
  await open('Bingo de recuerdos'); for(const index of [0,1,2]) await click(`.bingo-board button:nth-child(${index+1})`);
  await wait(`!!document.querySelector('.activity-finish-banner')`);
  await home(); assert.equal(await evaluate(`!![...document.querySelectorAll('.play-card')].find(el=>el.querySelector('.play-card-title').textContent==='Bingo de recuerdos').querySelector('.chippa-stamp')`),true);
  await open('¿Quién conoce más?'); for(let index=0;index<4;index++) { await click('.option-list button'); await click('.extra-game > .primary-button'); }
  await wait(`!!document.querySelector('.activity-finish-banner')`);
  await open('Adivina el lugar'); for(const name of ['Barrio Lastarria','Parque Araucano','Jardín Japonés']) { await evaluate(`[...document.querySelectorAll('.option-list button')].find(el=>el.textContent===${JSON.stringify(name)}).click()`); await new Promise(resolve=>setTimeout(resolve,150)); }
  await wait(`!!document.querySelector('.activity-finish-banner')`);
  await open('Cápsula compartida'); await fill('.capsule-composer textarea','Recuerdo de prueba'); await click('.capsule-composer .primary-button'); await wait(`!!document.querySelector('.activity-finish-banner')`);
  await open('Generador de planes'); await click('.plan-form .primary-button'); await click('.generated-plan .vote-row button'); await click('.generated-plan .primary-button'); await wait(`!!document.querySelector('.activity-finish-banner')`);
  await open('Playlist de la cita'); const fields=['input','input','input']; await fill('.song-form label:nth-of-type(1) input','Una canción'); await fill('.song-form label:nth-of-type(2) input','Artista'); await click('.song-form .primary-button'); await wait(`!!document.querySelector('.song-row')`); await click('[aria-label="Siguiente canción"]');
  await open('Carta del futuro'); await fill('.future-form input','Para después'); await fill('.future-form textarea','Un mensaje de prueba'); await fill('.future-form input[type=date]', await evaluate(`(()=>{let d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);})()`)); await click('.future-form .primary-button'); await wait(`!!document.querySelector('.future-envelope')`);
  await open('Match de recuerdos'); await click('.memory-card');
  const pairs=await evaluate(`(()=>{const game=JSON.parse(localStorage.getItem('chippa-demo-v1')).shared.game.memorySession;const pairs={};game.cards.forEach((card,index)=>(pairs[card.pair] ||= []).push(index+1));return Object.values(pairs);})()`);
  for(const pair of pairs) for(const index of pair) await click(`.memory-card:nth-child(${index})`);
  await wait(`!!document.querySelector('.memory-win') && !!document.querySelector('.activity-finish-banner')`);
  await open('Nuestro momento'); await fill('.lined-textarea','Un momento para guardar'); await click('.share-toggle input'); await click('.privacy-panel .primary-button');
  await click('.switch-profile'); await fill('.lined-textarea','Otra mirada de la cita'); await click('.share-toggle input'); await click('.privacy-panel .primary-button'); await click('.switch-profile');
  await open('Tienes una carta'); for(let i=0;i<3;i++){await click('.letter-table > .primary-button');await fill('.answer-panel textarea',`Respuesta ${i+1}`);await click('.answer-panel .primary-button');}
  await open('Banco de preguntas'); await click('.question-bank-panel .secondary-button'); await fill('.bank-answer textarea','Una respuesta para conocernos'); await click('.bank-answer .primary-button'); await wait(`!!document.querySelector('.activity-finish-banner')`);
  await open('Pasaporte digital'); await click('.passport-details .full-button'); await wait(`!!document.querySelector('.activity-finish-banner')`);
  await open('Nuestra próxima aventura'); for(let i=1;i<=4;i++)await click(`.choice-group:nth-of-type(${i}) button`);await click('.preference-panel .primary-button');await click('.proposal-panel .primary-button');await wait(`!!document.querySelector('.activity-finish-banner')`);
  await open('¿Pensamos lo mismo?'); for(let i=0;i<14;i++){await click('.option-list button');await click('.share-toggle input');if(await evaluate(`!document.querySelector('.game-footer button').disabled`))await click('.game-footer button');else await click('.game-aside .secondary-button');}await wait(`!!document.querySelector('.round-complete')`);
  await home();if(await evaluate(`JSON.parse(localStorage.getItem('chippa-demo-v1')).activeUserId!=='demo-luna'`))await click('.switch-profile');
  await open('Completa nuestra historia');for(let i=0;i<14;i++){await fill('.story-page textarea',`Una versión de la historia ${i+1}`);await click('.story-page input[type=checkbox]');if(await evaluate(`!document.querySelector('.story-page .primary-button').disabled`))await click('.story-page .primary-button');else await click('.story-aside .secondary-button');}await wait(`!!document.querySelector('.round-complete')`);
  await home();if(await evaluate(`JSON.parse(localStorage.getItem('chippa-demo-v1')).activeUserId!=='demo-luna'`))await click('.switch-profile');
  await open('Trivia post-cita'); for(let i=0;i<10;i++) { await click('.option-list button'); await click('.share-toggle input'); const ready=await evaluate(`!document.querySelector('.game-footer button').disabled`); if(ready) await click('.game-footer button'); else await click('.game-aside .secondary-button'); }
  await wait(`!!document.querySelector('.round-complete')`);
  await home(); if(await evaluate(`JSON.parse(localStorage.getItem('chippa-demo-v1')).activeUserId!=='demo-luna'`)) await click('.switch-profile');
  await open('Misión desbloqueada');for(let i=1;i<=4;i++)await click(`.mission-card:nth-child(${i}) .secondary-button`);await wait(`!!document.querySelector('.activity-finish-banner')`);
  await home();assert.equal(await evaluate(`document.querySelectorAll('.chippa-stamp.compact').length`),17);await evaluate(`window.scrollTo({top:document.querySelector('.activity-section').getBoundingClientRect().top+window.scrollY-80,behavior:'instant'})`); await screenshot('dashboard-completed.png');
  await call('Page.reload'); await wait(`!!document.querySelector('.demo-link')`); await click('.demo-link'); await wait(`document.querySelector('.membership-button').textContent.includes('activo')`);
  assert.equal(await evaluate(`document.querySelectorAll('.chippa-stamp.compact').length`),17);
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true}); await evaluate(`window.scrollTo({top:document.querySelector('.activity-section').getBoundingClientRect().top+window.scrollY-80,behavior:'instant'})`); await screenshot('mobile-completed.png');
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`),true,'Mobile overflow');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await click('.membership-button');await click('dialog .text-button');await wait(`document.querySelectorAll('.side-premium-lock').length===2`);
  await call('Page.navigate',{url:origin});await wait(`!!document.querySelector('.nav-cta')`);await click('.nav-cta');await wait(`document.querySelectorAll('.avatar-picker button').length===8`);await click('.avatar-picker button:nth-child(8)');assert.equal(await evaluate(`document.querySelector('.avatar-picker button:nth-child(8)').getAttribute('aria-pressed')`),'true');await screenshot('avatar-picker.png');
  assert.deepEqual(errors,[]);
  console.log('OK: 17 actividades terminadas y timbradas; rondas de dos perfiles completas; 4 misiones reclamadas; Premium activa, persiste y cancela; 17 timbres sobreviven a recarga; selector de 8 avatares; móvil sin desborde; ningún error de JavaScript.');
  }
} finally { try { socket?.close(); } catch {} chrome.kill(); await new Promise(resolve=>server.close(resolve)); }
