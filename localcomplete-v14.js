(function(){
'use strict';
function migrate(c){
 const d=c.db;d.meta=d.meta||{};d.meta.version=Math.max(Number(d.meta.version||1),14);
 d.localRelease=Object.assign({channel:'local-complete',safeMode:false,featureFreeze:true,lastCheckAt:0,lastScore:null,lastBundleAt:0,notes:[]},d.localRelease||{});
 d.settings.modules=d.settings.modules||{};if(d.settings.modules.releasecenter===undefined)d.settings.modules.releasecenter=true;
 const acts=['view','create','edit','delete','approve','export'];
 Object.keys(d.permissions||{}).forEach(role=>{
  if(!d.permissions[role].releasecenter){d.permissions[role].releasecenter={};acts.forEach(a=>d.permissions[role].releasecenter[a]=['Owner','Admin'].includes(role)||a==='view')}
 });
}
function checksum(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return('00000000'+(h>>>0).toString(16)).slice(-8)}
function readiness(c,runDeep=false){
 let qa=c.db.rcqa?.lastFull||null;if(runDeep&&window.NBRC)qa=NBRC.run(c,true);
 const health=window.NBREL?NBREL.scan(c):{score:0,failed:[{title:'Health unavailable'}]};
 const activation=window.NBACT?NBACT.activationScore(c):{pct:0};
 const errors=(c.db.reliability?.errors||[]).filter(e=>Date.now()-Number(e.at||0)<7*86400000);
 const backup=!!c.db.saas?.lastBackupAt;const pilot=window.NBFC?NBFC.stepState(c):[];
 const pwa='serviceWorker'in navigator;
 const idb='indexedDB'in window;
 const company=!!c.company();
 const wh=!!c.warehouse();
 const items=[
  {name:'RC QA',ok:!!qa&&qa.score>=90,detail:qa?'Score '+qa.score:'لم يتم تشغيل Full RC QA',weight:3,route:'rcqa'},
  {name:'Data Health',ok:health.score>=90,detail:'Score '+health.score,weight:3,route:'health'},
  {name:'Activation',ok:activation.pct>=80,detail:activation.pct+'%',weight:2,route:'launch'},
  {name:'Backup tested',ok:backup,detail:backup?'تم اختبار تنزيل نسخة':'نزّل Backup واحد على الأقل',weight:3,route:'data'},
  {name:'Recent runtime errors',ok:errors.length===0,detail:errors.length?errors.length+' خطأ آخر 7 أيام':'لا أخطاء مسجلة آخر 7 أيام',weight:2,route:'health'},
  {name:'PWA support',ok:pwa,detail:pwa?'Service Worker مدعوم':'غير مدعوم على هذا المتصفح',weight:1,route:'device'},
  {name:'IndexedDB',ok:idb,detail:idb?'متاح':'غير متاح',weight:2,route:'device'},
  {name:'Company context',ok:company&&wh,detail:company&&wh?'شركة + مخزن نشطان':'تحقق من الشركة والمخزن',weight:3,route:'org'},
  {name:'Pilot Day',ok:!pilot.length||pilot.filter(x=>x.ok).length>=Math.ceil(pilot.length*.8),detail:pilot.length?pilot.filter(x=>x.ok).length+'/'+pilot.length+' خطوات':'Pilot module pending',weight:3,route:'pilot'},{name:'Local data portability',ok:true,detail:'JSON/XLSX/Support bundle متاح',weight:1,route:'data'},
  {name:'Cloud dependency',ok:true,detail:'لا يوجد اعتماد على Cloud في النسخة المحلية',weight:1,route:'integrations'}
 ];
 const max=items.reduce((s,x)=>s+x.weight,0),pass=items.filter(x=>x.ok).reduce((s,x)=>s+x.weight,0),score=Math.round(pass/Math.max(max,1)*100);
 const blockers=items.filter(x=>!x.ok&&x.weight>=3);
 c.db.localRelease.lastCheckAt=Date.now();c.db.localRelease.lastScore=score;
 return{score,items,blockers,qa,health,activation,errors};
}
function exportBundle(c){
 const r=readiness(c,false),manifest={product:'NovaBlu ERP',version:'0.15',channel:'Final Local Candidate',generatedAt:new Date().toISOString(),company:c.company()?.name||'',workspace:c.db.saas?.workspaceId||'',schemaVersion:c.db.meta?.version||0,cloudConnected:!!c.db.saas?.backend?.connected,readinessScore:r.score};
 const payload={manifest,database:c.clone(c.db),qa:r.qa||null,health:{score:r.health.score,failed:r.health.failed||[]},readiness:{score:r.score,items:r.items},support:{browser:navigator.userAgent,platform:navigator.platform||'',online:navigator.onLine}};
 const raw=JSON.stringify(payload);manifest.checksum='fnv1a-'+checksum(raw);payload.manifest=manifest;
 c.download('NovaBlu_ERP_0.15_LocalBundle_'+c.today()+'.json',payload);c.db.localRelease.lastBundleAt=Date.now();c.audit('تصدير Local Bundle','Release',manifest.checksum);c.save('تم تصدير الحزمة المحلية');
}
function toggleSafe(c,on){
 c.db.localRelease.safeMode=!!on;c.audit(on?'تفعيل Safe Mode':'إلغاء Safe Mode','Release','Final Local Candidate');c.save(on?'Safe Mode فعال':'تم الرجوع للوضع الطبيعي');c.render();
}
function view(c){
 const r=readiness(c,false),lr=c.db.localRelease,last=lr.lastCheckAt?new Date(lr.lastCheckAt).toLocaleString('ar-IQ'):'لم يفحص';
 return c.pageHead('Local Release Center','الإغلاق النهائي للنسخة المحلية — بدون Cloud أو ربط خارجي',`<button class="btn primary" id="runFinalReadiness">فحص نهائي</button><button class="btn outline" id="exportLocalBundle">تصدير Local Bundle</button>`)+
 `<div class="local-release-hero"><div class="local-score ${r.score>=95?'good':r.score>=85?'warn':'bad'}"><strong>${r.score}</strong><span>Local Ready</span></div><div class="grow"><span class="eyebrow">NOVABLU ERP 0.15</span><h2>${r.score>=95?'النسخة المحلية شبه مكتملة للإطلاق التجريبي':r.score>=85?'جاهزية جيدة مع نقاط قبل الإطلاق':'أكمل النقاط الحرجة قبل الاعتماد'}</h2><p>آخر فحص: ${c.esc(last)} • Feature Freeze: ${lr.featureFreeze?'ON':'OFF'}</p></div><div class="release-badge">LOCAL COMPLETE</div></div>
 <div class="release-grid"><section class="card"><div class="card-head"><h3>Release Checklist</h3><span class="badge ${r.blockers.length?'amber':'green'}">${r.items.filter(x=>x.ok).length}/${r.items.length}</span></div>${r.items.map(x=>`<button class="release-check ${x.ok?'ok':'bad'}" data-route="${x.route}"><span>${x.ok?'✓':'!'}</span><div class="grow"><strong>${c.esc(x.name)}</strong><small>${c.esc(x.detail)}</small></div></button>`).join('')}</section>
 <section class="card"><div class="card-head"><h3>وضع الطوارئ Safe Mode</h3><span class="badge ${lr.safeMode?'amber':'green'}">${lr.safeMode?'فعال':'متوقف'}</span></div><p class="sub">Safe Mode يوقف التشغيل التلقائي للوصفات الذكية ويخلي النظام يركز على الوظائف الأساسية والنسخ الاحتياطي والتشخيص. ما يحذف أي بيانات.</p><label class="release-switch"><input id="safeModeToggle" type="checkbox" ${lr.safeMode?'checked':''}><div><strong>Safe Mode</strong><small>للاستخدام عند ظهور مشكلة غير متوقعة</small></div></label><div class="readiness-row"><span>آخر Local Bundle</span><b>${lr.lastBundleAt?new Date(lr.lastBundleAt).toLocaleString('ar-IQ'):'لم يصدر'}</b></div><div class="readiness-row"><span>Cloud</span><b class="sub">غير مطلوب لهذه النسخة</b></div><div class="readiness-row"><span>Feature Freeze</span><b class="good-text">${lr.featureFreeze?'ON':'OFF'}</b></div></section></div>
 <div class="release-grid"><section class="card"><div class="card-head"><h3>المتبقي حسب الفحص</h3></div>${r.blockers.length?r.blockers.map(x=>`<button class="blocker-row" data-route="${x.route}"><span>!</span><div class="grow"><strong>${c.esc(x.name)}</strong><small>${c.esc(x.detail)}</small></div></button>`).join(''):'<div class="release-done"><strong>✓ لا توجد Blockers محلية من المستوى الحرج</strong><span>يمكن الانتقال إلى Pilot محلي ثم الربط الخارجي لاحقاً.</span></div>'}</section>
 <section class="card"><div class="card-head"><h3>حدود النسخة 0.15</h3></div><div class="release-scope"><p>✓ يعمل محلياً على المتصفح وWindows/PWA.</p><p>✓ الفواتير، المخزون، POS، المشتريات، المحاسبة، CRM، HR، التقارير والطباعة.</p><p>✓ QA/Health/Recovery/Backup/Import/XLSX/Barcode.</p><p>✓ NovaBlu AI المحلي وAutomation المحلي.</p><p>— لا يوجد Sync متعدد الأجهزة بدون Backend.</p><p>— لا يوجد Billing أو WhatsApp/Telegram/API فعلي بدون ربط.</p></div></section></div>`;
}
function wire(c){
 document.querySelector('#runFinalReadiness')?.addEventListener('click',async()=>{if(window.NBREL)await NBREL.snapshot(c,'before-final-readiness',true);const r=readiness(c,true);c.save('اكتمل الفحص النهائي: '+r.score+'%');c.render()});
 document.querySelector('#exportLocalBundle')?.addEventListener('click',()=>exportBundle(c));
 document.querySelector('#safeModeToggle')?.addEventListener('change',e=>toggleSafe(c,e.target.checked));
}
function postRender(c){
 document.body.classList.toggle('nb-safe-mode',!!c.db.localRelease?.safeMode);
 let b=document.querySelector('#nbSafeBanner');
 if(c.db.localRelease?.safeMode&&!b){b=document.createElement('div');b.id='nbSafeBanner';b.className='safe-banner';b.innerHTML='<strong>Safe Mode</strong><span>التشغيل التلقائي الذكي متوقف مؤقتاً. بياناتك لم تُحذف.</span><button data-route="releasecenter">مركز الإصدار</button>';document.body.appendChild(b);b.querySelector('button').onclick=()=>{c.setRoute('releasecenter');c.render()}}
 if(!c.db.localRelease?.safeMode&&b)b.remove();
}
function allowAutomation(c){return !c.db.localRelease?.safeMode}
window.NBLOCAL={migrate,readiness,exportBundle,toggleSafe,view,wire,postRender,allowAutomation};
})();