(function(){
'use strict';
const DB='NovaBluRecovery';
function migrate(c){
 const d=c.db;d.meta=d.meta||{};d.meta.version=Math.max(Number(d.meta.version||1),10);
 d.reliability=Object.assign({lastSnapshotAt:0,lastIntegrityAt:0,lastIntegrityScore:null,errors:[],repairs:[],benchmark:null},d.reliability||{});
 d.settings.modules=d.settings.modules||{};if(d.settings.modules.health===undefined)d.settings.modules.health=true;
 const acts=['view','create','edit','delete','approve','export'];
 Object.keys(d.permissions||{}).forEach(role=>{
  if(!d.permissions[role].health){d.permissions[role].health={};acts.forEach(a=>d.permissions[role].health[a]=['Owner','Admin'].includes(role))}
  if(role==='Manager')d.permissions[role].health.view=true;
 });
}
function openDB(){
 return new Promise((ok,no)=>{
  if(!('indexedDB'in window)){no(new Error('IndexedDB unavailable'));return}
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('snapshots')){const s=d.createObjectStore('snapshots',{keyPath:'id'});s.createIndex('createdAt','createdAt')}};
  r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
 });
}
async function snapshot(c,reason='auto',force=false){
 const now=Date.now(),last=Number(c.db.reliability?.lastSnapshotAt||0);
 if(!force&&now-last<300000)return false;
 try{
  const d=await openDB(),tx=d.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots'),id='snap-'+now;
  store.put({id,createdAt:now,reason,version:c.db.meta?.version||0,companyId:c.db.session?.companyId||'',data:c.clone(c.db)});
  await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});
  d.close();c.db.reliability.lastSnapshotAt=now;
  await trim(6);return true;
 }catch(e){capture(c,e,'snapshot');return false}
}
async function trim(max=6){
 try{const d=await openDB(),tx=d.transaction('snapshots','readwrite'),s=tx.objectStore('snapshots'),g=s.getAll();const rows=await new Promise((ok,no)=>{g.onsuccess=()=>ok(g.result||[]);g.onerror=()=>no(g.error)});rows.sort((a,b)=>b.createdAt-a.createdAt).slice(max).forEach(x=>s.delete(x.id));await new Promise(ok=>{tx.oncomplete=ok;tx.onerror=ok});d.close()}catch{}
}
async function snapshots(){
 try{const d=await openDB(),tx=d.transaction('snapshots','readonly'),g=tx.objectStore('snapshots').getAll();const rows=await new Promise((ok,no)=>{g.onsuccess=()=>ok(g.result||[]);g.onerror=()=>no(g.error)});d.close();return rows.sort((a,b)=>b.createdAt-a.createdAt)}catch{return[]}
}
async function getSnapshot(id){
 try{const d=await openDB(),tx=d.transaction('snapshots','readonly'),g=tx.objectStore('snapshots').get(id);const x=await new Promise(ok=>{g.onsuccess=()=>ok(g.result||null);g.onerror=()=>ok(null)});d.close();return x}catch{return null}
}
async function restore(c,id){
 const x=await getSnapshot(id);if(!x?.data){c.toast('النسخة غير موجودة');return}
 if(!confirm('استعادة هذه النسخة؟ سيتم أخذ Snapshot من الوضع الحالي أولاً ولن تُحذف النسخ السابقة.'))return;
 await snapshot(c,'before-restore',true);
 Object.keys(c.db).forEach(k=>delete c.db[k]);Object.assign(c.db,c.clone(x.data));migrate(c);
 localStorage.setItem('novablu_erp_v1_free',JSON.stringify(c.db));c.audit('استعادة Snapshot','Reliability',id);c.save('تمت الاستعادة');c.render();
}
function checks(c){
 const a=[],add=(id,title,ok,detail='',severity='medium')=>a.push({id,title,ok,detail,severity});
 const d=c.db,company=d.companies.find(x=>x.id===d.session.companyId),branch=d.branches.find(x=>x.id===d.session.branchId),user=d.users.find(x=>x.id===d.session.userId);
 add('session-company','الشركة النشطة موجودة',!!company,company?'سليم':'session.companyId لا يشير لشركة');
 add('session-branch','الفرع النشط موجود',!!branch,branch?'سليم':'session.branchId لا يشير لفرع');
 add('session-user','المستخدم النشط موجود',!!user,user?'سليم':'session.userId لا يشير لمستخدم');
 const nums=d.invoices.filter(x=>!x.deletedAt).map(x=>x.number).filter(Boolean),dup=nums.filter((x,i)=>nums.indexOf(x)!==i);
 add('invoice-unique','أرقام الفواتير غير مكررة',dup.length===0,dup.length?'مكرر: '+[...new Set(dup)].slice(0,5).join('، '):'سليم','high');
 const skus=d.products.filter(x=>x.active).map(x=>x.sku).filter(Boolean),dsku=skus.filter((x,i)=>skus.indexOf(x)!==i);
 add('sku-unique','SKU غير مكرر',dsku.length===0,dsku.length?'مكرر: '+[...new Set(dsku)].slice(0,5).join('، '):'سليم','high');
 const orphans=d.stockMoves.filter(m=>!d.products.some(p=>p.id===m.productId));
 add('stock-orphans','حركات المخزون مرتبطة بمنتجات',orphans.length===0,orphans.length+' حركة يتيمة','high');
 const invOrphans=[];d.invoices.filter(x=>!x.deletedAt).forEach(i=>(i.items||[]).forEach(line=>{if(line.productId&&!d.products.some(p=>p.id===line.productId))invOrphans.push(i.number)}));
 add('invoice-products','بنود الفواتير مرتبطة بمنتجات',invOrphans.length===0,invOrphans.length+' بند/فاتورة تحتاج مراجعة','medium');
 const neg=d.products.filter(p=>p.trackStock&&c.stock(p.id)<0);
 add('negative-stock','لا يوجد مخزون سالب',neg.length===0,neg.length?neg.slice(0,5).map(x=>x.nameAr).join('، '):'سليم','high');
 const badUsers=d.users.filter(u=>(u.companyIds||[]).some(id=>!d.companies.some(co=>co.id===id)));
 add('user-companies','صلاحيات المستخدمين مرتبطة بشركات صحيحة',badUsers.length===0,badUsers.length+' مستخدم يحتاج مراجعة','medium');
 add('warehouse','يوجد مخزن واحد على الأقل',d.warehouses.some(w=>w.companyId===d.session.companyId),d.warehouses.length+' مخزن','high');
 add('cash-account','يوجد حساب نقدي',d.cashAccounts.some(x=>x.companyId===d.session.companyId&&x.active),d.cashAccounts.length+' حساب','medium');
 const paidOver=d.invoices.filter(i=>{const t=c.invTotals(i);return t.paid>t.total+0.001});
 add('overpayment','لا توجد دفعات تتجاوز الفاتورة',paidOver.length===0,paidOver.length+' فاتورة','high');
 return a;
}
function scan(c){
 const list=checks(c),weights={high:3,medium:2,low:1},total=list.reduce((s,x)=>s+weights[x.severity],0),passed=list.filter(x=>x.ok).reduce((s,x)=>s+weights[x.severity],0),score=Math.round(passed/Math.max(total,1)*100);
 c.db.reliability.lastIntegrityAt=Date.now();c.db.reliability.lastIntegrityScore=score;return{list,score,failed:list.filter(x=>!x.ok)}
}
function safeRepair(c){
 const before=c.clone({session:c.db.session,settings:c.db.settings});
 c.db.meta=c.db.meta||{};c.db.settings=c.db.settings||{};c.db.settings.modules=c.db.settings.modules||{};
 ['products','customers','suppliers','invoices','stockMoves','purchaseOrders','expenses','cashAccounts','cashTransactions','users','companies','branches','warehouses','audit','notifications','trash'].forEach(k=>{if(!Array.isArray(c.db[k]))c.db[k]=[]});
 if(!c.db.companies.some(x=>x.id===c.db.session.companyId)&&c.db.companies[0])c.db.session.companyId=c.db.companies[0].id;
 const branches=c.db.branches.filter(x=>x.companyId===c.db.session.companyId);if(!branches.some(x=>x.id===c.db.session.branchId)&&branches[0])c.db.session.branchId=branches[0].id;
 if(!c.db.users.some(x=>x.id===c.db.session.userId)&&c.db.users[0])c.db.session.userId=c.db.users[0].id;
 if(!c.db.warehouses.some(w=>w.companyId===c.db.session.companyId)){c.db.warehouses.push({id:c.uid('wh'),companyId:c.db.session.companyId,branchId:c.db.session.branchId,name:'المخزن الرئيسي',code:'MAIN',active:true})}
 c.db.reliability.repairs.unshift({id:c.uid('repair'),at:Date.now(),before,action:'safe-structure-repair'});c.db.reliability.repairs=c.db.reliability.repairs.slice(0,20);
 c.audit('إصلاح آمن','Reliability','تهيئة البنية والجلسة فقط بدون حذف بيانات');c.save('تم الإصلاح الآمن');c.render();
}
function capture(c,error,context='runtime'){
 try{
  const item={id:c.uid?c.uid('err'):'err-'+Date.now(),at:Date.now(),context,message:String(error?.message||error||'Unknown error'),stack:String(error?.stack||'').slice(0,4000),route:window.location.hash||''};
  c.db.reliability=c.db.reliability||{errors:[]};c.db.reliability.errors=c.db.reliability.errors||[];c.db.reliability.errors.unshift(item);c.db.reliability.errors=c.db.reliability.errors.slice(0,30);
  localStorage.setItem('novablu_erp_v1_free',JSON.stringify(c.db));return item;
 }catch{return null}
}
function benchmark(c){
 const start=performance.now(),ps=c.db.products,inv=c.db.invoices;let x=0;
 for(let i=0;i<25;i++){for(const p of ps)x+=String(p.nameAr||'').length;for(const v of inv)x+=c.invTotals(v).total>0?1:0}
 const ms=Math.round((performance.now()-start)*100)/100,result={at:Date.now(),ms,records:ps.length+inv.length,checksum:x};
 c.db.reliability.benchmark=result;return result;
}
function viewHealth(c){
 const r=scan(c),errors=(c.db.reliability.errors||[]).slice(0,8),bench=c.db.reliability.benchmark;
 return c.pageHead('صحة النظام','Reliability Center — حماية واسترجاع وفحص سلامة',`<button class="btn primary" id="runHealth">إعادة الفحص</button><button class="btn outline" id="makeSnapshot">Snapshot الآن</button>`)+
 `<div class="health-hero"><div class="health-score ${r.score>=90?'good':r.score>=70?'warn':'bad'}"><strong>${r.score}</strong><span>Health Score</span></div><div><h3>${r.failed.length?'توجد '+r.failed.length+' نقطة تحتاج مراجعة':'النظام سليم بالفحص المحلي'}</h3><p>الفحص لا يحذف أي سجل. الإصلاح الآمن يعالج البنية والجلسة فقط.</p><div class="toolbar"><button class="btn outline" id="safeRepair">إصلاح آمن</button><button class="btn outline" id="runBenchmark">اختبار أداء</button></div></div></div>
 <div class="saas-grid2"><section class="card"><div class="card-head"><h3>Integrity Scan</h3><span class="badge ${r.failed.length?'amber':'green'}">${r.list.filter(x=>x.ok).length}/${r.list.length}</span></div><div class="health-checks">${r.list.map(x=>`<div class="${x.ok?'pass':'fail'}"><span>${x.ok?'✓':'!'}</span><div class="grow"><strong>${c.esc(x.title)}</strong><small>${c.esc(x.detail)}</small></div><b>${c.esc(x.severity)}</b></div>`).join('')}</div></section>
 <section class="card"><div class="card-head"><h3>الأداء المحلي</h3></div>${bench?`<div class="benchmark"><strong>${bench.ms} ms</strong><span>قراءة حسابية على ${bench.records} سجل</span><small>${new Date(bench.at).toLocaleString('ar-IQ')}</small></div>`:'<div class="empty">شغّل اختبار الأداء للحصول على قياس محلي</div>'}<div class="notice">هذا Benchmark محلي سريع، وليس اختبار ضغط Server.</div></section></div>
 <div class="saas-grid2"><section class="card"><div class="card-head"><h3>Recovery Snapshots</h3><button class="btn sm" id="refreshSnapshots">تحديث</button></div><div id="snapshotList"><div class="empty">جاري القراءة...</div></div></section>
 <section class="card"><div class="card-head"><h3>آخر الأخطاء الملتقطة</h3><span class="badge gray">${errors.length}</span></div>${errors.map(e=>`<div class="error-row"><div class="grow"><strong>${c.esc(e.context)}</strong><small>${c.esc(e.message)}</small></div><span>${new Date(e.at).toLocaleTimeString('ar-IQ')}</span></div>`).join('')||'<div class="empty">لم يتم التقاط أخطاء Runtime</div>'}</section></div>`;
}
async function loadSnapshotList(c){
 const host=document.querySelector('#snapshotList');if(!host)return;const rows=await snapshots();
 host.innerHTML=rows.length?rows.map(x=>`<div class="snapshot-row"><div class="grow"><strong>${c.esc(x.reason)}</strong><small>${new Date(x.createdAt).toLocaleString('ar-IQ')} • schema ${x.version}</small></div><button class="btn sm" data-restore-snapshot="${x.id}">استعادة</button></div>`).join(''):'<div class="empty">لا توجد Snapshots بعد</div>';
 host.querySelectorAll('[data-restore-snapshot]').forEach(b=>b.onclick=()=>restore(c,b.dataset.restoreSnapshot));
}
function wireHealth(c){
 document.querySelector('#runHealth')?.addEventListener('click',()=>{scan(c);c.save('تم فحص سلامة البيانات');c.render()});
 document.querySelector('#makeSnapshot')?.addEventListener('click',async()=>c.toast(await snapshot(c,'manual',true)?'تم حفظ Snapshot':'تعذر حفظ Snapshot'));
 document.querySelector('#safeRepair')?.addEventListener('click',async()=>{await snapshot(c,'before-safe-repair',true);safeRepair(c)});
 document.querySelector('#runBenchmark')?.addEventListener('click',()=>{benchmark(c);c.save();c.render()});
 document.querySelector('#refreshSnapshots')?.addEventListener('click',()=>loadSnapshotList(c));
 loadSnapshotList(c);
}
function onSave(c){snapshot(c,'auto',false)}
function dirtyGuard(){
 if(window.__nbDirtyGuard)return;window.__nbDirtyGuard=true;let dirty=false;
 document.addEventListener('input',e=>{if(e.target.closest('form'))dirty=true},true);
 document.addEventListener('submit',()=>{dirty=false},true);
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
 document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))dirty=false},true);
}
function initGlobal(c){
 migrate(c);dirtyGuard();snapshot(c,'startup',false);
 window.addEventListener('error',e=>capture(c,e.error||e.message,'window.error'));
 window.addEventListener('unhandledrejection',e=>capture(c,e.reason,'unhandledrejection'));
}
function postRender(c,route){if(route==='health')setTimeout(()=>loadSnapshotList(c),0)}
window.NBREL={migrate,initGlobal,onSave,snapshot,snapshots,restore,scan,safeRepair,capture,benchmark,viewHealth,wireHealth,postRender};
})();