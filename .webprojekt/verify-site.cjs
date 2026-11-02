/* Offline verification, using the locally installed Chrome and Node only. */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=['index.html','kezelesek.html','rolunk.html','kapcsolat.html','adatkezelesi-tajekoztato.html','koszonjuk.html','kisokos-koszonjuk.html','404.html'];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];const report=[];const posts=[];
function assert(ok,msg){if(!ok)errors.push(msg);}
const documents=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
const headers=[],footers=[],forms=[],appointments=[];
for(const [file,html] of Object.entries(documents)) {
 assert((html.match(/<h1\b/g)||[]).length===1,`${file}: H1 count`);
 assert(!html.includes('cdn.tailwindcss.com'),`${file}: Tailwind`);
 assert(!html.includes('—'),`${file}: em dash`);
 assert(html.includes('<html lang="hu">'),`${file}: lang`);
 const desc=html.match(/name="description" content="([^"]*)"/)[1];assert(desc.length>=140&&desc.length<=160,`${file}: description ${desc.length}`);
 headers.push(html.match(/<header\b[\s\S]*?<\/header>/)[0].replaceAll(' aria-current="page"',''));
 footers.push(html.match(/<footer\b[\s\S]*?<\/footer>/)[0]);
 appointments.push(html.match(/<section class="section appointment"[\s\S]*?<\/section>/)?.[0]);
 for(const form of html.matchAll(/<form\b[\s\S]*?<\/form>/g)) {
  const name=form[0].match(/\bname="([^"]+)"/)[1];
  assert(form[0].includes('data-netlify="true"')&&form[0].includes(`name="form-name" value="${name}"`),`${file}: Netlify ${name}`);
  assert(form[0].includes('netlify-honeypot="bot-field"')&&form[0].includes('name="bot-field"'),`${file}: honeypot`);
  if(name==='idopontkeres')forms.push(form[0]);
 }
 for(const tag of html.matchAll(/<(?:a|link|script|img)\b[^>]*>/g)) {
  for(const attr of tag[0].matchAll(/\b(?:src|href)="([^"]*)"/g)) {
   const href=attr[1];if(/^(https?:|tel:|mailto:)/.test(href))continue;
   const [dest,anchor]=href.split('#');const target=dest?dest.replace(/^\//,''):file;
   assert(fs.existsSync(path.join(root,target)),`${file}: missing ${target}`);
   if(anchor)assert(fs.readFileSync(path.join(root,target),'utf8').includes(`id="${anchor}"`),`${file}: missing anchor ${href}`);
  }
 }
 for(const m of html.matchAll(/<img\b[^>]*>/g)) {
  const tag=m[0];assert(/\balt="/.test(tag)&&/\bwidth="/.test(tag)&&/\bheight="/.test(tag),`${file}: image accessibility / dimensions`);
  if(tag.includes('.webp')) {
   assert(tag.includes('800w')&&tag.includes('1600w')&&tag.includes('sizes='),`${file}: responsive photo`);
   for(const url of tag.matchAll(/images\/[^\s",]+\.webp/g))assert(fs.existsSync(path.join(root,url[0])),`${file}: missing photo ${url[0]}`);
   assert(tag.includes('fetchpriority="high"')?!tag.includes('loading="lazy"'):tag.includes('loading="lazy"')&&tag.includes('decoding="async"'),`${file}: image loading`);
  }
 }
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert(new Set(ids).size===ids.length,`${file}: duplicate IDs`);
}
assert(new Set(headers).size===1,'Shared headers differ');assert(new Set(footers).size===1,'Shared footers differ');assert(new Set(forms).size===1,'Shared forms differ');assert(new Set(appointments.filter(Boolean)).size===1,'Shared appointment sections differ');
assert(!documents['index.html'].includes('data-package='),'Home contains packages');
assert((documents['kapcsolat.html'].match(/name="idopontkeres"/g)||[]).length===1,'Contact form repeats');
for(const file of ['koszonjuk.html','kisokos-koszonjuk.html','404.html','koncepciok.html',...fs.readdirSync(root).filter(f=>/^koncepcio-.*\.html$/.test(f))])assert(fs.readFileSync(path.join(root,file),'utf8').includes('<meta name="robots" content="noindex">'),file+': noindex');
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST') {let body='';for await(const b of req)body+=b;posts.push({url:url.pathname,fields:Object.fromEntries(new URLSearchParams(body))});res.writeHead(303,{Location:url.pathname});res.end();return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('404');return;}
 const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
let browser,ws;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${path.join(__dirname,'qa-browser')}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 console.log('Offline browser starting.');
 const devtools=await new Promise((resolve,reject)=>{let stderr='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);browser.stderr.on('data',b=>{stderr+=b;const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});browser.on('error',reject);});
 ws=new WebSocket(devtools);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let seq=0;const pending=new Map();const runtimeErrors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')runtimeErrors.push(m.params.exceptionDetails.text);};
 function call(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},10000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 const {targetId}=await call('Target.createTarget',{url:'about:blank'});const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
 const c=(method,params)=>call(method,params,sessionId);
 await c('Page.enable');await c('Runtime.enable');await c('Network.enable');await c('Network.setBlockedURLs',{urls:['https://*','http://fonts.*']});
 const evaluate=async expression=>{const result=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value;};
 async function navigate(file){await c('Page.navigate',{url:origin+'/'+file});for(let i=0;i<80;i++){await pause(30);if(await evaluate(`location.pathname === '/${file}' && document.readyState === 'complete'`))break;}await pause(80);}
 for(const width of [375,768,1440]) {
  await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===375});
  await c('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const file of files){
   await navigate(file);
   const result=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(e).position!=='absolute'}).map(e=>e.tagName+'.'+e.className).slice(0,6),brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),active:[...document.querySelectorAll('header [aria-current="page"]')].map(a=>a.getAttribute('href'))})`);
   assert(result.scrollWidth<=width,`${file}@${width}: horizontal overflow ${JSON.stringify(result)}`);assert(!result.brokenImages.length,`${file}@${width}: broken images`);
   if(files.indexOf(file)<4)assert(result.active.length===2&&result.active.every(f=>f===file),`${file}: active nav`);
   report.push({file,width,scrollWidth:result.scrollWidth});
   if((width===375&&['index.html','kezelesek.html','kapcsolat.html'].includes(file))||(width===1440&&['index.html','rolunk.html'].includes(file))){const shot=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(__dirname,`qa-${file.replace('.html','')}-${width}.png`),Buffer.from(shot.data,'base64'));}
  }
 }
 await c('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});await navigate('index.html');
 await evaluate(`document.querySelector('.menu-toggle').click()`);
 const open=await evaluate(`({expanded:document.querySelector('.menu-toggle').getAttribute('aria-expanded'),hidden:document.querySelector('#mobil-menu').hidden,focus:document.activeElement.textContent,inert:document.querySelector('main').inert})`);
 assert(open.expanded==='true'&&!open.hidden&&open.inert&&open.focus==='Főoldal','Mobile menu open / focus');
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 assert(await evaluate(`document.querySelector('.menu-toggle').getAttribute('aria-expanded')==='false'&&document.activeElement===document.querySelector('.menu-toggle')&&!document.querySelector('main').inert`),'Menu Escape / focus restore');
 await navigate('kezelesek.html');await evaluate(`document.querySelector('[data-package]').click()`);
 assert(await evaluate(`document.querySelector('[name=uzenet]').value==='Az Anti-Age csomag érdekel.'`),'Package prefill');
 await evaluate(`document.querySelector('[name=uzenet]').value='Saját kérdésem';document.querySelectorAll('[data-package]')[1].click()`);
 assert(await evaluate(`document.querySelector('[name=uzenet]').value==='Saját kérdésem'`),'Package overwrites user text');
 assert(await evaluate(`!document.querySelector('form').checkValidity()`),'Required fields validation');
 await c('Emulation.setScriptExecutionDisabled',{value:true});await navigate('index.html');
 const nojs=await evaluate(`({nav:getComputedStyle(document.querySelector('.nav')).display,reveal:[...document.querySelectorAll('[data-reveal]')].every(e=>getComputedStyle(e).opacity==='1'),width:document.documentElement.scrollWidth,js:document.documentElement.classList.contains('js')})`);
 assert(nojs.nav!=='none'&&nojs.reveal&&!nojs.js&&nojs.width===375,'No-JS navigation / content');
 // DOM automation fills the form; the browser performs its unmodified native POST.
 await evaluate(`document.querySelector('#idopont-nev').value='Teszt Vendég';document.querySelector('#idopont-email').value='teszt@example.com';document.querySelector('#idopont-uzenet').value='Helyi ellenőrzés';document.querySelector('form[name=idopontkeres] button').click()`);
 await pause(250);
 assert(posts.some(p=>p.url==='/koszonjuk.html'&&p.fields['form-name']==='idopontkeres'&&p.fields.nev==='Teszt Vendég'),'Native appointment POST without JS');
 await navigate('index.html');await evaluate(`document.querySelector('#hirlevel-nev').value='Teszt Vendég';document.querySelector('#hirlevel-email').value='teszt@example.com';document.querySelector('#hirlevel-hozzajarulas').checked=true;document.querySelector('form[name=hirlevel] button').click()`);await pause(250);
 assert(posts.some(p=>p.url==='/kisokos-koszonjuk.html'&&p.fields['form-name']==='hirlevel'&&p.fields.adatvedelem==='elfogadva'),'Native newsletter POST without JS');
 await c('Emulation.setScriptExecutionDisabled',{value:false});await c('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await navigate('index.html');
 assert(await evaluate(`document.documentElement.classList.contains('reveal-ready')`),'Reveal progressive enhancement');
 await evaluate(`document.querySelector('#idopont').scrollIntoView({behavior:'instant',block:'start'})`);await pause(1400);
 const revealed=await evaluate(`({opacity:getComputedStyle(document.querySelector('#idopont [data-reveal]')).opacity,classes:document.querySelector('#idopont [data-reveal]').className,y:document.querySelector('#idopont').getBoundingClientRect().y,scroll:scrollY,ready:document.documentElement.className})`);
 assert(revealed.opacity==='1','Scrolled reveal: '+JSON.stringify(revealed));
 assert(!runtimeErrors.length,'JS runtime errors: '+runtimeErrors.join(', '));
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({offline:true,checks:report,formPosts:posts.map(p=>({url:p.url,fieldNames:Object.keys(p.fields)})),errors},null,2));
 console.log(JSON.stringify({pages:files.length,viewportChecks:report.length,formPosts:posts.length,errors},null,2));
 await call('Browser.close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{ws?.close();browser?.kill();server.close();if(errors.length)process.exitCode=1;});
