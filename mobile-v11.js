(function(){
'use strict';
let ctx=null,registration=null,installPrompt=null,reloadPending=false;
function standalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
function migrate(c){
 const d=c.db;d.meta=d.meta||{};d.meta.version=Math.max(Number(d.meta.version||1),11);
 d.mobile=Object.assign({installDismissedAt:0,installedAt:0,updateAvailable:false,lastUpdateCheck:0},d.mobile||{});
 d.settings.modules=d.settings.modules||{};if(d.settings.modules.device===undefined)d.settings.modules.device=true;
 const acts=['view','create','edit','delete','approve','export'];
 Object.keys(d.permissions||{}).forEach(role=>{
  if(!d.permissions[role].device){d.permissions[role].device={};acts.forEach(a=>d.permissions[role].device[a]=a==='view'||['Owner','Admin'].includes(role))}
 });
}
function networkState(){return navigator.onLine?'online':'offline'}
function ensureChrome(c){
 const top=document.querySelector('.topbar');if(!top)return;
 let pill=document.querySelector('#nbDevicePill');
 if(!pill){
  pill=document.createElement('button');pill.id='nbDevicePill';pill.className='device-pill';pill.onclick=()=>{c.setRoute('device');c.render()};
  const command=document.querySelector('#commandBtn');if(command)top.insertBefore(pill,command);else top.appendChild(pill);
 }
 const online=navigator.onLine,installed=standalone();
 pill.innerHTML='<span class="net-dot '+(online?'online':'offline')+'"></span><span class="device-pill-copy">'+(online?'Online':'Offline')+(installed?' • App':' • Web')+'</span>';
 pill.title=online?'الإنترنت متصل — البيانات المحلية تعمل حتى عند الانقطاع':'أنت Offline — NovaBlu يعمل من الكاش والبيانات المحلية';
 document.body.classList.toggle('is-offline',!online);
 let bar=document.querySelector('#nbOfflineBar');
 if(!online&&!bar){bar=document.createElement('div');bar.id='nbOfflineBar';bar.className='offline-bar';bar.innerHTML='<strong>Offline</strong><span>البيانات المحلية متاحة. المزامنة السحابية ليست مفعلة أصلاً في هذه المرحلة.</span>';document.body.appendChild(bar)}
 if(online&&bar)bar.remove();
 showInstall(c);
 showUpdate(c);
}
function showInstall(c){
 if(standalone()||!installPrompt||document.querySelector('#nbInstallBanner'))return;
 const dismissed=Number(c.db.mobile.installDismissedAt||0);if(Date.now()-dismissed<86400000)return;
 const el=document.createElement('div');el.id='nbInstallBanner';el.className='pwa-banner';el.innerHTML='<div><strong>ثبت NovaBlu كتطبيق</strong><span>وصول أسرع وتجربة شاشة كاملة على هذا الجهاز.</span></div><button class="btn primary" id="nbInstallNow">تثبيت</button><button class="pwa-x" id="nbInstallDismiss">×</button>';
 document.body.appendChild(el);
 el.querySelector('#nbInstallNow').onclick=()=>install(c);
 el.querySelector('#nbInstallDismiss').onclick=()=>{c.db.mobile.installDismissedAt=Date.now();c.save();el.remove()};
}
async function install(c){
 if(!installPrompt){c.toast('التثبيت غير متاح من هذا المتصفح حالياً');return}
 try{installPrompt.prompt();const r=await installPrompt.userChoice;if(r.outcome==='accepted'){c.db.mobile.installedAt=Date.now();c.audit('تثبيت PWA','Device',navigator.userAgent);c.save('تم طلب تثبيت NovaBlu')}installPrompt=null;document.querySelector('#nbInstallBanner')?.remove()}catch(e){c.toast('تعذر فتح نافذة التثبيت')}
}
function showUpdate(c){
 if(!c.db.mobile.updateAvailable||document.querySelector('#nbUpdateBanner'))return;
 const el=document.createElement('div');el.id='nbUpdateBanner';el.className='pwa-banner update';el.innerHTML='<div><strong>تحديث NovaBlu جاهز</strong><span>أعد تحميل التطبيق لتشغيل آخر نسخة.</span></div><button class="btn primary" id="nbReloadUpdate">تحديث الآن</button><button class="pwa-x" id="nbUpdateLater">×</button>';
 document.body.appendChild(el);el.querySelector('#nbReloadUpdate').onclick=()=>location.reload();el.querySelector('#nbUpdateLater').onclick=()=>el.remove();
}
function setInstallPrompt(e){installPrompt=e;window.dispatchEvent(new CustomEvent('novablu-install-ready'))}
function registerSW(c,reg){
 registration=reg;c.db.mobile.lastUpdateCheck=Date.now();
 if(reg.waiting&&navigator.serviceWorker.controller){c.db.mobile.updateAvailable=true;c.save()}
 reg.addEventListener('updatefound',()=>{
  const w=reg.installing;if(!w)return;
  w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller){c.db.mobile.updateAvailable=true;try{localStorage.setItem('novablu_erp_v1_free',JSON.stringify(c.db))}catch{}showUpdate(c)}})
 });
 if(!reloadPending){reloadPending=true;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(ctx){ctx.db.mobile.updateAvailable=true;try{localStorage.setItem('novablu_erp_v1_free',JSON.stringify(ctx.db))}catch{}showUpdate(ctx)}})}
}
async function checkUpdate(c){
 if(!('serviceWorker'in navigator)){c.toast('Service Worker غير مدعوم');return}
 try{const reg=registration||await navigator.serviceWorker.getRegistration();if(!reg){c.toast('Service Worker غير مسجل');return}c.db.mobile.lastUpdateCheck=Date.now();await reg.update();c.save(reg.waiting?'يوجد تحديث جاهز':'تم فحص التحديثات');if(reg.waiting){c.db.mobile.updateAvailable=true;showUpdate(c)}}catch(e){c.toast('تعذر فحص التحديث الآن')}
}
function viewDevice(c){
 const online=navigator.onLine,installed=standalone(),sw='serviceWorker'in navigator,cache='caches'in window,last=c.db.mobile.lastUpdateCheck?new Date(c.db.mobile.lastUpdateCheck).toLocaleString('ar-IQ'):'لم يفحص';
 return c.pageHead('التطبيق والجهاز','PWA / Offline / Update Center',`<button class="btn primary" id="deviceInstall">${installed?'مثبت كتطبيق':'تثبيت التطبيق'}</button><button class="btn outline" id="deviceUpdate">فحص التحديث</button>`)+
 `<div class="device-hero"><div class="device-orb">${installed?'APP':'WEB'}</div><div><h3>${c.esc(navigator.platform||'هذا الجهاز')}</h3><p>${c.esc(navigator.userAgent)}</p></div></div>
 <div class="device-grid"><div class="card device-stat"><span>الاتصال</span><strong class="${online?'good-text':'warn-text'}">${online?'Online':'Offline'}</strong><small>البرنامج المحلي يستمر بالعمل</small></div><div class="card device-stat"><span>الوضع</span><strong>${installed?'Standalone App':'Browser'}</strong><small>${installed?'مثبت على الجهاز':'يمكن تثبيته إذا سمح المتصفح'}</small></div><div class="card device-stat"><span>Service Worker</span><strong class="${sw?'good-text':'warn-text'}">${sw?'مدعوم':'غير مدعوم'}</strong><small>مسؤول عن Offline Cache</small></div><div class="card device-stat"><span>Cache API</span><strong class="${cache?'good-text':'warn-text'}">${cache?'جاهز':'غير متاح'}</strong><small>ملفات التطبيق المحلية</small></div></div>
 <div class="saas-grid2"><section class="card"><div class="card-head"><h3>حالة التحديث</h3></div><div class="readiness-row"><span>الإصدار الحالي</span><b>0.11</b></div><div class="readiness-row"><span>آخر فحص</span><b>${c.esc(last)}</b></div><div class="readiness-row"><span>تحديث بانتظار Reload</span><b class="${c.db.mobile.updateAvailable?'warn-text':'good-text'}">${c.db.mobile.updateAvailable?'نعم':'لا'}</b></div><div class="notice">التحديث يحافظ على بياناتك المحلية. لا تستخدم Clear Site Data لمسح التطبيق.</div></section>
 <section class="card"><div class="card-head"><h3>استخدام آمن على الهاتف</h3></div><div class="mobile-tips"><p>✓ خذ Backup دوري من قسم البيانات.</p><p>✓ لا تمسح بيانات المتصفح قبل التأكد من النسخة الاحتياطية.</p><p>✓ عند Offline يمكنك متابعة العمل المحلي، لكن Cloud Sync غير مربوط بعد.</p><p>✓ بعد ظهور تحديث جديد استخدم «تحديث الآن» بدل إعادة تثبيت البرنامج.</p></div><button class="btn outline" data-route="data">فتح النسخ الاحتياطي</button></section></div>`;
}
function wireDevice(c){
 document.querySelector('#deviceInstall')?.addEventListener('click',()=>{if(standalone())c.toast('NovaBlu مثبت كتطبيق بالفعل');else install(c)});
 document.querySelector('#deviceUpdate')?.addEventListener('click',()=>checkUpdate(c));
}
function initGlobal(c){
 ctx=c;migrate(c);
 window.addEventListener('online',()=>ensureChrome(c));window.addEventListener('offline',()=>ensureChrome(c));
 window.addEventListener('novablu-install-ready',()=>ensureChrome(c));
 window.addEventListener('appinstalled',()=>{c.db.mobile.installedAt=Date.now();c.save('تم تثبيت NovaBlu على الجهاز');document.querySelector('#nbInstallBanner')?.remove();ensureChrome(c)});
 setTimeout(()=>ensureChrome(c),0);
}
function postRender(c,route){ensureChrome(c)}
window.NBMOBILE={migrate,initGlobal,postRender,setInstallPrompt,registerSW,checkUpdate,viewDevice,wireDevice};
})();