const CACHE='novablu-erp-0.07-prerelease-r2';
const ASSETS=['./','./index.html','./pro-modules.js','./invoice-v03.js','./invoice-v03.css','./hyper-v04.js','./hyper-v04.css','./advanced-v05.js','./advanced-v05.css','./ux-v06.js','./ux-v06.css','./release-v07.js','./release-v07.css','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});