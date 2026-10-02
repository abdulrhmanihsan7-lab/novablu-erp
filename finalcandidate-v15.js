(function(){
'use strict';
const N=v=>Number(v||0);
function migrate(c){
 const d=c.db;d.meta=d.meta||{};d.meta.version=Math.max(Number(d.meta.version||1),15);
 d.pilot=d.pilot||{startedAt:0,completedAt:0,checks:{},notes:[]};
 d.localRelease=d.localRelease||{};d.localRelease.featureFreeze=true;d.localRelease.channel='final-local-candidate';d.localRelease.firstReleaseTarget='1.0';d.localRelease.firstReleaseRequires=['cloud_database','server_auth','multi_device_sync','billing','external_integrations','server_security','migration'];
 d.settings.modules=d.settings.modules||{};if(d.settings.modules.pilot===undefined)d.settings.modules.pilot=true;
 const acts=['view','create','edit','delete','approve','export'];
 Object.keys(d.permissions||{}).forEach(role=>{
  if(!d.permissions[role].pilot){d.permissions[role].pilot={};acts.forEach(a=>d.permissions[role].pilot[a]=a==='view'||['Owner','Admin','Manager'].includes(role))}
 });
}
function posted(c){return c.db.invoices.filter(i=>i.companyId===c.db.session.companyId&&!i.deletedAt&&['confirmed','partial','paid'].includes(i.status))}
function stepState(c){
 const inv=posted(c),po=c.db.purchaseOrders.filter(x=>x.companyId===c.db.session.companyId),mov=c.db.stockMoves.filter(x=>x.companyId===c.db.session.companyId),exp=c.db.expenses.filter(x=>x.companyId===c.db.session.companyId);
 const hasPayment=inv.some(i=>(i.payments||[]).length>0),hasReturn=(c.db.returns||[]).some(r=>inv.some(i=>i.id===r.invoiceId));
 const checks=[
  {id:'catalog',title:'منتج/خدمة جاهزة',ok:c.db.products.some(p=>p.companyId===c.db.session.companyId&&p.active),route:'products',sub:'أضف أو استورد منتجاً'},
  {id:'purchase',title:'عملية شراء',ok:po.length>0,route:'purchasing',sub:'أنشئ PO أو طلب شراء'},
  {id:'receipt',title:'استلام مخزون',ok:mov.some(m=>['receipt','in'].includes(m.type)),route:'inventory',sub:'سجل استلاماً فعلياً'},
  {id:'sale',title:'فاتورة بيع منشورة',ok:inv.length>0,route:'sales',sub:'أنشئ وأكد فاتورة بيع'},
  {id:'payment',title:'تحصيل دفعة',ok:hasPayment,route:'sales',sub:'سجل دفعاً جزئياً أو كاملاً'},
  {id:'return',title:'اختبار مرتجع',ok:hasReturn,route:'sales',sub:'جرّب مرتجعاً جزئياً إن كان مناسباً'},
  {id:'expense',title:'مصروف تشغيلي',ok:exp.some(x=>x.status==='paid'),route:'expenses',sub:'سجل مصروفاً مدفوعاً'},
  {id:'accounting',title:'مراجعة الحسابات',ok:(c.db.journals||[]).length>0||inv.length>0,route:'accounting',sub:'راجع القيود والنتيجة المالية'},
  {id:'backup',title:'Backup فعلي',ok:!!c.db.saas?.lastBackupAt,route:'data',sub:'نزّل نسخة احتياطية'},
  {id:'health',title:'Health / RC QA',ok:Number(c.db.localRelease?.lastScore||0)>=85||(c.db.rcqa?.lastFull?.score||0)>=90,route:'releasecenter',sub:'شغّل الفحص النهائي'}
 ];
 return checks;
}
function viewPilot(c){
 const items=stepState(c),done=items.filter(x=>x.ok).length,pct=Math.round(done/items.length*100);
 if(!c.db.pilot.startedAt)c.db.pilot.startedAt=Date.now();
 if(pct===100&&!c.db.pilot.completedAt)c.db.pilot.completedAt=Date.now();
 return c.pageHead('Pilot Day','اختبار يوم عمل فعلي على بياناتك الحالية — بدون إنشاء بيانات وهمية',`<button class="btn outline" id="pilotNote">إضافة ملاحظة</button><button class="btn primary" id="pilotExport">تصدير نتيجة Pilot</button>`)+
 `<div class="pilot-hero"><div class="pilot-score"><strong>${pct}%</strong><span>${done}/${items.length} مكتمل</span></div><div class="grow"><span class="eyebrow">REAL DATA PILOT</span><h2>${pct===100?'اكتمل سيناريو يوم العمل':'نفّذ العمليات على بياناتك الفعلية'}</h2><p>الصفحة تقرأ ما تم داخل NovaBlu ولا تنشئ فواتير أو حركات من نفسها.</p></div></div>
 <div class="pilot-grid">${items.map((x,i)=>`<button class="pilot-step ${x.ok?'done':''}" data-route="${x.route}"><span>${x.ok?'✓':i+1}</span><div class="grow"><strong>${c.esc(x.title)}</strong><small>${c.esc(x.ok?'تم رصده من بياناتك':x.sub)}</small></div></button>`).join('')}</div>
 <section class="card"><div class="card-head"><h3>ملاحظات التجربة</h3><span class="badge gray">${(c.db.pilot.notes||[]).length}</span></div>${(c.db.pilot.notes||[]).slice().reverse().map(n=>`<div class="stat-row"><div class="grow"><strong>${c.esc(n.text)}</strong><div class="sub">${new Date(n.at).toLocaleString('ar-IQ')}</div></div></div>`).join('')||'<div class="empty">لا توجد ملاحظات بعد</div>'}</section>`;
}
function wirePilot(c){
 document.querySelector('#pilotNote')?.addEventListener('click',()=>openTextModal(c,'ملاحظة Pilot','الملاحظة','',v=>{c.db.pilot.notes.push({id:c.uid('pn'),text:v,at:Date.now()});c.save('تم حفظ الملاحظة');c.render()}));
 document.querySelector('#pilotExport')?.addEventListener('click',()=>{const items=stepState(c);c.download('NovaBlu_Pilot_0.15_'+c.today()+'.json',{version:'0.15',generatedAt:new Date().toISOString(),company:c.company()?.name||'',items,notes:c.db.pilot.notes||[],completedAt:c.db.pilot.completedAt||null})});
}
function openTextModal(c,title,label,value,onSave){
 c.openModal(title,`<form id="fcTextForm"><div class="field"><label>${c.esc(label)}</label><input name="value" value="${c.esc(value||'')}" required autofocus></div><div class="toolbar"><button class="btn primary">حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`,false);
 setTimeout(()=>{const f=document.querySelector('#fcTextForm');if(f)f.onsubmit=e=>{e.preventDefault();const v=String(new FormData(f).get('value')||'').trim();if(!v)return;c.closeModal();onSave(v)}},0);
}
function modalForm(c,title,html,onSubmit,wide=false){
 c.openModal(title,`<form id="fcForm">${html}<div class="toolbar"><button class="btn primary">تنفيذ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`,wide);
 setTimeout(()=>{const f=document.querySelector('#fcForm');if(f)f.onsubmit=e=>{e.preventDefault();onSubmit(new FormData(f),f)}},0);
}
function wireProductPolish(c){
 document.querySelector('#printLabels')?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,'طباعة Barcode Labels',`<div class="field"><label>SKU المطلوبة</label><input name="sku" placeholder="اتركها فارغة لأول 20 منتج"><small>افصل عدة SKU بفاصلة</small></div>`,fd=>{const q=String(fd.get('sku')||''),want=q.split(',').map(x=>x.trim()).filter(Boolean),arr=want.length?c.db.products.filter(p=>want.includes(p.sku)):c.db.products.slice(0,20);if(!arr.length)return c.toast('لا توجد منتجات مطابقة');c.closeModal();window.NBBC?NBBC.printLabels(c,arr):c.toast('وحدة الباركود غير متاحة')})},true);
}
function wirePOSPolish(c){
 document.querySelector('#posExchange')?.addEventListener('click',e=>{e.stopImmediatePropagation();const inv=posted(c);modalForm(c,'استبدال منتج',`<div class="form-grid"><div class="field"><label>الفاتورة</label><select name="invoiceId">${inv.slice(-100).reverse().map(i=>`<option value="${i.id}">${c.esc(i.number)} — ${c.esc(i.customerSnapshot?.name||'')}</option>`).join('')}</select></div><div class="field"><label>المنتج المرجع</label><select name="oldId">${c.db.products.filter(p=>p.active).map(p=>`<option value="${p.id}">${c.esc(p.nameAr)} — ${c.esc(p.sku)}</option>`).join('')}</select></div><div class="field"><label>المنتج البديل</label><select name="newId">${c.db.products.filter(p=>p.active).map(p=>`<option value="${p.id}">${c.esc(p.nameAr)} — ${c.esc(p.sku)}</option>`).join('')}</select></div></div>`,fd=>doExchange(c,fd.get('invoiceId'),fd.get('oldId'),fd.get('newId')),true)},true);
}
function doExchange(c,invoiceId,oldId,newId){
 const i=c.db.invoices.find(x=>x.id===invoiceId&&!x.deletedAt),p1=c.db.products.find(p=>p.id===oldId),p2=c.db.products.find(p=>p.id===newId);if(!i||!p1||!p2)return c.toast('تحقق من الاختيارات');
 const line=(i.items||[]).find(x=>x.productId===p1.id);if(!line)return c.toast('المنتج المرجع غير موجود بالفاتورة');if(NBADV.availableStock(c,p2.id,i.warehouseId)<1)return c.toast('البديل غير متوفر');
 const d=N(p2.price)-N(line.price);c.db.stockMoves.push({id:c.uid('sm'),companyId:i.companyId,warehouseId:i.warehouseId,productId:p1.id,type:'receipt',qty:1,date:c.today(),ref:'EX-'+i.number,note:'استبدال'},{id:c.uid('sm'),companyId:i.companyId,warehouseId:i.warehouseId,productId:p2.id,type:'delivery',qty:1,date:c.today(),ref:'EX-'+i.number,note:'استبدال'});
 c.db.exchanges.unshift({id:c.uid('ex'),invoiceId:i.id,fromProductId:p1.id,toProductId:p2.id,delta:d,date:c.today()});if(d)c.db.cashTransactions.push({id:c.uid('ct'),companyId:i.companyId,accountId:c.db.cashAccounts[0]?.id,date:c.today(),type:d>0?'in':'out',amount:Math.abs(d),ref:'EX-'+i.number,note:'فرق استبدال',createdAt:c.now()});
 c.audit('استبدال منتج','POS',i.number);c.save('تم الاستبدال');c.closeModal();c.render();
}
function wirePurchasingPolish(c){
 document.querySelector('#newVC')?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,'Vendor Credit Note',`<div class="form-grid"><div class="field"><label>المورد</label><select name="supplierId">${c.db.suppliers.map(s=>`<option value="${s.id}">${c.esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>القيمة</label><input name="total" type="number" min="1" required></div></div>`,fd=>{const sid=fd.get('supplierId'),total=N(fd.get('total'));if(!sid||total<=0)return;const x={id:c.uid('vc'),companyId:c.db.session.companyId,number:'VC-'+String(c.db.vendorCredits.length+1).padStart(5,'0'),supplierId:sid,date:c.today(),total,status:'open',createdAt:c.now()};c.db.vendorCredits.unshift(x);c.audit('Vendor Credit','Purchasing',x.number);c.save('تم إنشاء '+x.number);c.closeModal();c.render()})},true);
}
function wireAccountingPolish(c){
 document.querySelector('#newCC')?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,'مركز تكلفة جديد',`<div class="form-grid"><div class="field"><label>الكود</label><input name="code" required></div><div class="field"><label>الاسم</label><input name="name" required></div></div>`,fd=>{const code=String(fd.get('code')||'').trim(),name=String(fd.get('name')||'').trim();if(c.db.costCenters.some(x=>x.code===code))return c.toast('الكود موجود');c.db.costCenters.push({id:c.uid('cc'),code,name,active:true});c.save('تمت إضافة مركز التكلفة');c.closeModal();c.render()})},true);
 document.querySelector('#closePeriod')?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,'إقفال فترة مالية',`<div class="field"><label>الفترة</label><select name="period">${c.db.fiscalPeriods.filter(x=>x.status==='open').map(x=>`<option value="${x.id}">${c.esc(x.name)} — ${x.from} إلى ${x.to}</option>`).join('')}</select></div><div class="notice amber">الإقفال سيضبط Lock Date على نهاية الفترة.</div>`,fd=>{const p=c.db.fiscalPeriods.find(x=>x.id===fd.get('period'));if(!p)return;p.status='closed';c.db.security.lockDate=p.to;c.audit('إقفال فترة','Accounting',p.name);c.save('تم إقفال '+p.name);c.closeModal();c.render()})},true);
}
function wireDocumentsPolish(c){
 const bind=(id,title,html,handler)=>document.querySelector(id)?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,title,html,fd=>{handler(fd);c.closeModal()})},true);
 bind('#docReceipt','سند قبض',`<div class="form-grid"><div class="field"><label>استلمنا من</label><input name="party" required></div><div class="field"><label>المبلغ</label><input name="amount" type="number" min="1" required></div></div>`,fd=>simpleDoc2(c,'سند قبض',[['استلمنا من',fd.get('party')],['المبلغ',c.fmt(N(fd.get('amount')))],['التاريخ',c.today()]]));
 bind('#docPayment','سند صرف',`<div class="form-grid"><div class="field"><label>دفعنا إلى</label><input name="party" required></div><div class="field"><label>المبلغ</label><input name="amount" type="number" min="1" required></div></div>`,fd=>simpleDoc2(c,'سند صرف',[['دفعنا إلى',fd.get('party')],['المبلغ',c.fmt(N(fd.get('amount')))],['التاريخ',c.today()]]));
 bind('#docStatement','كشف حساب عميل',`<div class="field"><label>العميل</label><select name="customerId">${c.db.customers.map(x=>`<option value="${x.id}">${c.esc(x.name)} — ${c.esc(x.phone||'')}</option>`).join('')}</select></div>`,fd=>{const u=c.db.customers.find(x=>x.id===fd.get('customerId'));if(!u)return;const a=c.db.invoices.filter(i=>i.customerId===u.id&&!i.deletedAt),tot=a.reduce((s,i)=>s+c.invTotals(i).total,0),paid=a.reduce((s,i)=>s+c.invTotals(i).paid,0);simpleDoc2(c,'كشف حساب',[['العميل',u.name],['الإجمالي',c.fmt(tot)],['المدفوع',c.fmt(paid)],['المتبقي',c.fmt(tot-paid)]],u.phone)});
 bind('#docSalary','كشف راتب',`<div class="field"><label>الموظف</label><select name="employeeId">${c.db.employees.map(x=>`<option value="${x.id}">${c.esc(x.name)}</option>`).join('')}</select></div>`,fd=>{const u=c.db.employees.find(x=>x.id===fd.get('employeeId'));if(u)simpleDoc2(c,'كشف راتب',[['الموظف',u.name],['الوظيفة',u.jobTitle||''],['الراتب',c.fmt(u.salary||0)],['الفترة',c.today().slice(0,7)]],u.id)});
 bind('#docThermal','فاتورة حرارية',`<div class="field"><label>الفاتورة</label><select name="invoiceId">${posted(c).slice(-100).reverse().map(i=>`<option value="${i.id}">${c.esc(i.number)} — ${c.esc(i.customerSnapshot?.name||'')}</option>`).join('')}</select></div>`,fd=>{const i=c.db.invoices.find(x=>x.id===fd.get('invoiceId'));if(i&&window.NBRELEASE)NBRELEASE.printThermal(c,i)});
}
function simpleDoc2(c,title,rows,ref=''){
 const w=window.open('','_blank');if(!w)return c.toast('اسمح بالنوافذ المنبثقة');w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}body{font-family:Arial}.h{display:flex;justify-content:space-between;border-bottom:3px solid #2563eb}.r{display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid #eee}.b{border:1px solid #ddd;border-radius:10px;padding:14px;margin-top:20px}</style></head><body><div class="h"><h2>${c.esc(c.company().name)}</h2><div><h2>${c.esc(title)}</h2><strong>${c.esc(ref)}</strong></div></div><div class="b">${rows.map(x=>`<div class="r"><span>${c.esc(x[0])}</span><strong>${c.esc(String(x[1]??''))}</strong></div>`).join('')}</div><script>onload=()=>print()<\/script></body></html>`);w.document.close()
}

function wireCouponPolish(c){
 document.querySelector('#couponManage')?.addEventListener('click',e=>{e.stopImmediatePropagation();openCouponManager(c)},true);
}
function openCouponManager(c){
 c.openModal('إدارة الكوبونات',`<div class="card-head"><h3>الكوبونات</h3></div><form id="fcCouponForm"><div class="form-grid"><div class="field"><label>الكود</label><input name="code" required></div><div class="field"><label>النوع</label><select name="type"><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option></select></div><div class="field"><label>القيمة</label><input name="value" type="number" min="0" required></div><div class="field"><label>حد أدنى للسلة</label><input name="minTotal" type="number" min="0" value="0"></div><div class="field"><label>تاريخ الانتهاء</label><input name="until" type="date"></div></div><button class="btn primary">إضافة كوبون</button></form><div class="card-head" style="margin-top:14px"><h3>الحالية</h3></div><div id="fcCoupons">${c.db.coupons.map(x=>`<div class="stat-row"><div class="grow"><strong>${c.esc(x.code)}</strong><div class="sub">${x.type==='fixed'?'ثابت':'نسبة'} • ${x.value}${x.until?' • '+x.until:''}</div></div><span class="badge ${x.active!==false?'green':'gray'}">${x.active!==false?'فعال':'متوقف'}</span><button class="btn sm" data-fc-coupon="${x.id}">تبديل</button></div>`).join('')||'<div class="empty">لا توجد كوبونات</div>'}</div>`,true);
 setTimeout(()=>{
  const form=document.querySelector('#fcCouponForm');if(form)form.onsubmit=e=>{e.preventDefault();const fd=new FormData(form),code=String(fd.get('code')||'').trim();if(!code)return;if(c.db.coupons.some(x=>x.code.toLowerCase()===code.toLowerCase()))return c.toast('الكود موجود مسبقاً');c.db.coupons.push({id:c.uid('cp'),code,type:fd.get('type')==='fixed'?'fixed':'percent',value:N(fd.get('value')),minTotal:N(fd.get('minTotal')),until:String(fd.get('until')||''),active:true});c.audit('إنشاء كوبون','POS',code);c.save('تم إنشاء الكوبون');c.closeModal();openCouponManager(c)};
  document.querySelectorAll('[data-fc-coupon]').forEach(b=>b.onclick=()=>{const x=c.db.coupons.find(v=>v.id===b.dataset.fcCoupon);if(x)x.active=x.active===false;c.save();c.closeModal();openCouponManager(c)});
 },0);
}
function wireRFQPolish(c){
 document.querySelectorAll('[data-rfq]').forEach(b=>b.addEventListener('click',e=>{e.stopImmediatePropagation();openRFQModern(c,b.dataset.rfq)},true));
}
function openRFQModern(c,id){
 const x=c.db.rfqs.find(r=>r.id===id);if(!x)return;
 c.openModal('RFQ — '+x.number,`<div class="card-head"><h3>${c.esc(c.db.products.find(p=>p.id===x.productId)?.nameAr||'')} × ${x.qty}</h3></div><form id="fcOfferForm"><div class="form-grid"><div class="field"><label>المورد</label><select name="supplierId">${c.db.suppliers.map(s=>`<option value="${s.id}">${c.esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>سعر الوحدة</label><input name="unitCost" type="number" min="0" required></div><div class="field"><label>مدة التوريد بالأيام</label><input name="days" type="number" min="0" value="1" required></div></div><button class="btn primary">إضافة عرض</button></form><div class="card-head" style="margin-top:14px"><h3>مقارنة العروض</h3></div>${(x.offers||[]).map(o=>`<div class="stat-row"><div class="grow"><strong>${c.esc(c.db.suppliers.find(s=>s.id===o.supplierId)?.name||'')}</strong><div class="sub">${o.days} يوم</div></div><strong>${c.fmt(o.unitCost)}</strong><button class="btn sm green" data-fc-award="${o.id}">اختيار</button></div>`).join('')||'<div class="empty">لا توجد عروض</div>'}`,true);
 setTimeout(()=>{
  const f=document.querySelector('#fcOfferForm');if(f)f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f),sid=fd.get('supplierId'),cost=N(fd.get('unitCost')),days=N(fd.get('days'));x.offers=x.offers||[];x.offers.push({id:c.uid('off'),supplierId:sid,unitCost:cost,days});c.db.supplierPriceHistory.unshift({id:c.uid('sph'),supplierId:sid,productId:x.productId,cost,date:c.today(),source:x.number});c.save('تمت إضافة العرض');c.closeModal();openRFQModern(c,id)};
  document.querySelectorAll('[data-fc-award]').forEach(b=>b.onclick=()=>awardRFQModern(c,x,b.dataset.fcAward));
 },0);
}
function awardRFQModern(c,r,offerId){
 const o=(r.offers||[]).find(x=>x.id===offerId);if(!o)return;
 const existing=c.db.purchaseOrders.map(x=>String(x.number||''));let k=1,no;do{no='PO-'+String(k++).padStart(5,'0')}while(existing.includes(no));
 const po={id:c.uid('po'),companyId:c.db.session.companyId,branchId:c.db.session.branchId,warehouseId:c.warehouse()?.id||'',number:no,date:c.today(),supplierId:o.supplierId,status:'approved',items:[{productId:r.productId,qty:r.qty,cost:o.unitCost}],notes:'من '+r.number,receivedQty:0,receivedByProduct:{},payments:[],createdAt:c.now()};
 c.db.purchaseOrders.unshift(po);r.status='awarded';r.awardedOfferId=o.id;const pr=c.db.purchaseRequests.find(x=>x.id===r.requestId);if(pr)pr.status='ordered';c.audit('ترسية RFQ','Purchasing',r.number+' → '+po.number);c.save('تم إنشاء '+po.number);c.closeModal();c.render();
}
function wireAccountingMore(c){
 document.querySelector('#openLedger')?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,'فتح دفتر الأستاذ',`<div class="field"><label>الحساب</label><select name="accountId">${c.db.accounts.map(a=>`<option value="${a.id}">${c.esc(a.code)} — ${c.esc(a.name)}</option>`).join('')}</select></div>`,fd=>showLedgerModern(c,fd.get('accountId')))},true);
 document.querySelector('#newOpening')?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,'رصيد افتتاحي',`<div class="form-grid"><div class="field"><label>الحساب</label><select name="accountId">${c.db.accounts.filter(a=>a.code!=='3100').map(a=>`<option value="${a.id}">${c.esc(a.code)} — ${c.esc(a.name)}</option>`).join('')}</select></div><div class="field"><label>الرصيد</label><input name="value" type="number" step=".01" required><small>موجب = مدين، سالب = دائن</small></div></div>`,fd=>{const a=c.db.accounts.find(x=>x.id===fd.get('accountId')),v=N(fd.get('value')),eq=c.db.accounts.find(x=>x.code==='3100');if(!a||!eq)return c.toast('تحقق من الحسابات');c.db.openingBalances.push({id:c.uid('ob'),accountId:a.id,date:c.today(),debit:v>0?v:0,credit:v<0?Math.abs(v):0});c.db.journals.push({id:c.uid('je'),number:'OPEN-'+String(c.db.journals.length+1).padStart(5,'0'),date:c.today(),memo:'رصيد افتتاحي '+a.name,lines:[{accountId:a.id,debit:v>0?v:0,credit:v<0?Math.abs(v):0},{accountId:eq.id,debit:v<0?Math.abs(v):0,credit:v>0?v:0}]});c.audit('رصيد افتتاحي','Accounting',a.code);c.save('تم حفظ الرصيد');c.closeModal();c.render()})},true);
 ['customer','supplier'].forEach(type=>document.querySelector(type==='customer'?'#customerLedger':'#supplierLedger')?.addEventListener('click',e=>{e.stopImmediatePropagation();const arr=type==='customer'?c.db.customers:c.db.suppliers;modalForm(c,type==='customer'?'كشف عميل':'كشف مورد',`<div class="field"><label>${type==='customer'?'العميل':'المورد'}</label><select name="partyId">${arr.map(x=>`<option value="${x.id}">${c.esc(x.name)} — ${c.esc(x.phone||'')}</option>`).join('')}</select></div>`,fd=>showPartyLedgerModern(c,type,fd.get('partyId')))},true));
}
function showLedgerModern(c,accountId){
 const a=c.db.accounts.find(x=>x.id===accountId);if(!a)return;
 const all=[...(c.db.journals||[]),...(window.NBHYPER?.autoJournals?NBHYPER.autoJournals(c):[])],rows=[];all.forEach(j=>(j.lines||[]).forEach(l=>{if(l.accountId===a.id)rows.push({date:j.date,no:j.number,memo:j.memo,d:N(l.debit),cr:N(l.credit)})}));rows.sort((x,y)=>String(x.date).localeCompare(String(y.date)));let bal=0;c.closeModal();c.openModal('دفتر الأستاذ — '+a.name,`<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>${rows.map(x=>{bal+=x.d-x.cr;return`<tr><td>${x.date}</td><td>${c.esc(x.no||'')}</td><td>${c.esc(x.memo||'')}</td><td>${c.fmt(x.d)}</td><td>${c.fmt(x.cr)}</td><td><strong>${c.fmt(bal)}</strong></td></tr>`}).join('')}</tbody></table></div>`,true);
}
function showPartyLedgerModern(c,type,id){
 const arr=type==='customer'?c.db.customers:c.db.suppliers,p=arr.find(x=>x.id===id);if(!p)return;c.closeModal();
 if(type==='customer'){const rows=c.db.invoices.filter(i=>i.customerId===p.id&&!i.deletedAt).map(i=>[i.date,i.number,c.invTotals(i).total,c.invTotals(i).paid,c.invTotals(i).due]);c.openModal('كشف العميل — '+p.name,`<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الفاتورة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${c.esc(r[1])}</td><td>${c.fmt(r[2])}</td><td>${c.fmt(r[3])}</td><td><strong>${c.fmt(r[4])}</strong></td></tr>`).join('')}</tbody></table></div>`,true)}
 else{const rows=c.db.purchaseOrders.filter(o=>o.supplierId===p.id).map(o=>{const total=(o.items||[]).reduce((z,i)=>z+N(i.qty)*N(i.cost),0),paid=(o.payments||[]).reduce((z,x)=>z+N(x.amount),0);return[o.date,o.number,total,paid,total-paid]});c.openModal('كشف المورد — '+p.name,`<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>PO</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${c.esc(r[1])}</td><td>${c.fmt(r[2])}</td><td>${c.fmt(r[3])}</td><td><strong>${c.fmt(r[4])}</strong></td></tr>`).join('')}</tbody></table></div>`,true)}
}

function confirmModern(c,title,message,onConfirm,danger=false){
 c.openModal(title,`<div class="fc-confirm"><div class="notice ${danger?'amber':''}">${c.esc(message)}</div><div class="toolbar"><button class="btn ${danger?'red':'primary'}" id="fcConfirmYes">${danger?'تأكيد الإجراء':'تأكيد'}</button><button class="btn" type="button" data-close>إلغاء</button></div></div>`,false);
 setTimeout(()=>{const b=document.querySelector('#fcConfirmYes');if(b)b.onclick=async()=>{c.closeModal();await onConfirm()}},0);
}
function wireOrgModern(c){
 document.querySelector('#newBranch')?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,'فرع جديد',`<div class="form-grid"><div class="field"><label>اسم الفرع</label><input name="name" required></div><div class="field"><label>المدينة</label><input name="city"></div></div>`,fd=>{const name=String(fd.get('name')||'').trim();if(!name)return;c.db.branches.push({id:c.uid('br'),companyId:c.db.session.companyId,name,city:String(fd.get('city')||''),active:true});c.audit('إضافة فرع','Organization',name);c.save('تمت إضافة الفرع');c.closeModal();c.render()})},true);
 document.querySelector('#newWarehouse')?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,'مخزن جديد',`<div class="form-grid"><div class="field"><label>اسم المخزن</label><input name="name" required></div><div class="field"><label>الكود</label><input name="code" value="WH" required></div><div class="field"><label>الفرع</label><select name="branchId">${c.db.branches.filter(b=>b.companyId===c.db.session.companyId).map(b=>`<option value="${b.id}">${c.esc(b.name)}</option>`).join('')}</select></div></div>`,fd=>{const name=String(fd.get('name')||'').trim(),code=String(fd.get('code')||'WH').trim().toUpperCase();if(!name)return;if(c.db.warehouses.some(w=>w.companyId===c.db.session.companyId&&w.code===code))return c.toast('كود المخزن مستخدم');c.db.warehouses.push({id:c.uid('wh'),companyId:c.db.session.companyId,branchId:fd.get('branchId')||c.db.session.branchId,name,code,active:true});c.audit('إضافة مخزن','Organization',code);c.save('تمت إضافة المخزن');c.closeModal();c.render()})},true);
}
function wireExpenseDeleteModern(c){
 document.querySelectorAll('[data-del-exp]').forEach(b=>b.addEventListener('click',e=>{e.stopImmediatePropagation();const x=c.db.expenses.find(v=>v.id===b.dataset.delExp);if(!x)return;if(x.status==='paid')return c.toast('لا يمكن حذف مصروف مدفوع مباشرة. استخدم قيد تصحيح');if(c.can&&!c.can('expenses','delete'))return c.toast('لا توجد صلاحية حذف مصروف');if(window.NBADV&&!NBADV.guardFinancialEdit(c,x))return;confirmModern(c,'حذف المصروف','سيتم حذف المصروف غير المدفوع من السجل. متابعة؟',()=>{c.db.expenses=c.db.expenses.filter(v=>v.id!==x.id);if(window.NBADV)NBADV.recordChange(c,'Expense',x.id,x,null,'حذف');c.audit('حذف مصروف','Expense',x.id);c.save('تم الحذف');c.render()},true)},true));
}
function wireTrashModern(c){
 document.querySelectorAll('[data-purge]').forEach(b=>b.addEventListener('click',e=>{e.stopImmediatePropagation();const t=c.db.trash.find(x=>x.id===b.dataset.purge);if(!t)return;confirmModern(c,'حذف نهائي','هذا الإجراء لا يمكن التراجع عنه من سلة المحذوفات. سيتم أخذ Snapshot أولاً.',async()=>{if(window.NBREL)await NBREL.snapshot(c,'before-permanent-delete',true);if(t.type==='invoice')c.db.invoices=c.db.invoices.filter(x=>x.id!==t.entityId);c.db.trash=c.db.trash.filter(x=>x.id!==t.id);c.audit('حذف نهائي','Trash',t.label||t.id);c.save('تم الحذف النهائي');c.render()},true)},true));
}
function wireSettingsDangerModern(c){
 document.querySelector('#resetDemo')?.addEventListener('click',e=>{e.stopImmediatePropagation();confirmModern(c,'إعادة ضبط النسخة التجريبية','سيتم أخذ Snapshot محلي ثم إعادة بيانات التطبيق التجريبية. استخدم هذا فقط إذا كنت تقصد مسح قاعدة البيانات الحالية.',async()=>{if(window.NBREL)await NBREL.snapshot(c,'before-demo-reset',true);localStorage.removeItem('novablu_erp_v1_free');location.reload()},true)},true);
}
function wirePOSOperationsModern(c){
 document.querySelector('#shiftBtn')?.addEventListener('click',e=>{e.stopImmediatePropagation();const sh=c.db.posShifts.find(x=>x.companyId===c.db.session.companyId&&!x.closedAt);if(!sh){modalForm(c,'فتح وردية',`<div class="field"><label>الرصيد الافتتاحي</label><input name="opening" type="number" min="0" step=".01" value="0" required></div>`,fd=>{const opening=N(fd.get('opening'));c.db.posShifts.push({id:c.uid('shift'),companyId:c.db.session.companyId,userId:c.currentUser().id,openedAt:c.now(),opening,closedAt:null,closing:null});c.audit('فتح وردية','POS',String(opening));c.save('تم فتح الوردية');c.closeModal();c.render()});return}
  const sales=c.db.invoices.filter(i=>i.shiftId===sh.id&&!i.deletedAt).reduce((sum,i)=>sum+c.invTotals(i).paid,0),expected=N(sh.opening)+sales;
  modalForm(c,'إغلاق الوردية',`<div class="form-grid"><div class="field"><label>الرصيد المتوقع</label><input value="${expected}" disabled></div><div class="field"><label>الرصيد الفعلي</label><input name="closing" type="number" min="0" step=".01" value="${expected}" required></div></div>`,fd=>{const closing=N(fd.get('closing'));sh.closedAt=c.now();sh.closing=closing;sh.expected=expected;sh.difference=closing-expected;c.audit('إغلاق وردية','POS','فرق '+sh.difference);c.save('تم إغلاق الوردية');c.closeModal();c.render()});
 },true);
 document.querySelector('#posReturn')?.addEventListener('click',e=>{e.stopImmediatePropagation();const inv=posted(c).filter(i=>i.status!=='returned');modalForm(c,'مرتجع مبيعات',`<div class="field"><label>الفاتورة</label><select name="invoiceId">${inv.slice(-150).reverse().map(i=>`<option value="${i.id}">${c.esc(i.number)} — ${c.esc(i.customerSnapshot?.name||'')}</option>`).join('')}</select></div>`,fd=>{const id=fd.get('invoiceId');c.closeModal();if(id&&window.NBADV)NBADV.openPartialReturn(c,id)})},true);
}
function wirePurchasingPaymentModern(c){
 document.querySelectorAll('[data-pay-po]').forEach(b=>b.addEventListener('click',e=>{e.stopImmediatePropagation();const p=c.db.purchaseOrders.find(x=>x.id===b.dataset.payPo);if(!p||!['approved','received'].includes(p.status))return c.toast('يجب اعتماد أمر الشراء قبل الدفع');if(c.can&&!c.can('purchasing','edit'))return c.toast('لا توجد صلاحية دفع للمورد');if(window.NBADV&&!NBADV.guardFinancialEdit(c,{date:c.today()}))return;const total=(p.items||[]).reduce((sum,x)=>sum+N(x.qty)*N(x.cost),0),paid=(p.payments||[]).reduce((sum,x)=>sum+N(x.amount),0),due=Math.max(0,total-paid);if(due<=0)return c.toast('أمر الشراء مسدد');
  modalForm(c,'دفعة مورد — '+p.number,`<div class="form-grid"><div class="field"><label>المتبقي</label><input value="${due}" disabled></div><div class="field"><label>مبلغ الدفعة</label><input name="amount" type="number" min=".01" max="${due}" step=".01" value="${due}" required></div><div class="field"><label>الحساب</label><select name="accountId">${c.db.cashAccounts.filter(a=>a.companyId===c.db.session.companyId&&a.active).map(a=>`<option value="${a.id}">${c.esc(a.name)}</option>`).join('')}</select></div></div>`,fd=>{const amount=Math.min(N(fd.get('amount')),due),accountId=fd.get('accountId');if(amount<=0||!accountId)return;c.db.cashTransactions.push({id:c.uid('ct'),companyId:c.db.session.companyId,accountId,date:c.today(),type:'out',amount,ref:p.number,note:'دفعة مورد',createdAt:c.now()});p.payments=p.payments||[];p.payments.push({id:c.uid('pp'),amount,date:c.today(),accountId});const nowPaid=p.payments.reduce((sum,x)=>sum+N(x.amount),0);if(nowPaid>=total&&p.status==='received')p.status='closed';c.audit('دفعة مورد','PurchaseOrder',p.number+' '+amount);c.save('تم تسجيل الدفعة');c.closeModal();c.render()});
 },true));
}
function wirePayrollModern(c){
 document.querySelector('#newPayroll')?.addEventListener('click',e=>{e.stopImmediatePropagation();const ym=new Date().toISOString().slice(0,7);modalForm(c,'إنشاء مسير راتب',`<div class="field"><label>فترة الراتب</label><input name="period" type="month" value="${ym}" required></div>`,fd=>{const period=String(fd.get('period')||'');if(c.db.payrollRuns.some(x=>x.period===period))return c.toast('الفترة موجودة مسبقاً');const lines=c.db.employees.filter(x=>x.companyId===c.db.session.companyId&&x.status==='active').map(emp=>{const loan=c.db.employeeLoans.filter(x=>x.employeeId===emp.id&&x.status==='open').reduce((s,x)=>s+N(x.installment),0),comm=c.db.commissions.filter(x=>x.employeeId===emp.id&&!x.paid).reduce((s,x)=>s+N(x.amount),0);return{employeeId:emp.id,basic:N(emp.salary),allowances:comm,deductions:loan,net:Math.max(0,N(emp.salary)+comm-loan)}});c.db.payrollRuns.push({id:c.uid('payrun'),companyId:c.db.session.companyId,period,status:'draft',lines,createdAt:c.now()});c.audit('إنشاء مسير راتب','Payroll',period);c.save('تم إنشاء المسير');c.closeModal();c.render()})},true);
 document.querySelector('#newLoan')?.addEventListener('click',e=>{e.stopImmediatePropagation();modalForm(c,'سلفة موظف',`<div class="form-grid"><div class="field"><label>الموظف</label><select name="employeeId">${c.db.employees.filter(x=>x.companyId===c.db.session.companyId&&x.status==='active').map(x=>`<option value="${x.id}">${c.esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>مبلغ السلفة</label><input name="amount" type="number" min=".01" step=".01" required></div><div class="field"><label>الاستقطاع الشهري</label><input name="installment" type="number" min="0" step=".01" required></div></div>`,fd=>{const employeeId=fd.get('employeeId'),amount=N(fd.get('amount')),installment=N(fd.get('installment'));if(!employeeId||amount<=0)return;c.db.employeeLoans.push({id:c.uid('loan'),employeeId,amount,balance:amount,installment,date:c.today(),status:'open'});c.audit('سلفة موظف','Payroll',employeeId+' '+amount);c.save('تم تسجيل السلفة');c.closeModal();c.render()})},true);
}
function wireRestoreModern(c){
 document.querySelector('#restoreBtn')?.addEventListener('click',e=>{e.stopImmediatePropagation();const file=document.querySelector('#restoreFile')?.files?.[0];if(!file)return c.toast('اختر ملفاً');const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.meta||!x.companies)throw new Error('invalid');confirmModern(c,'استعادة النسخة الاحتياطية','سيتم أخذ Snapshot من الوضع الحالي ثم استبدال قاعدة البيانات بالنسخة المختارة.',async()=>{if(window.NBREL)await NBREL.snapshot(c,'before-json-restore',true);Object.keys(c.db).forEach(k=>delete c.db[k]);Object.assign(c.db,x);if(window.NBFC)NBFC.migrate(c);if(window.NBLOCAL)NBLOCAL.migrate(c);c.save('تمت الاستعادة');c.render()},true)}catch{c.toast('ملف غير صالح')}};r.readAsText(file)},true);
 document.querySelector('#restoreMirror')?.addEventListener('click',e=>{e.stopImmediatePropagation();if(!window.NBREL)return c.toast('Recovery غير متاح');NBREL.snapshots().then(rows=>{const x=rows[0];if(!x)return c.toast('لا توجد Snapshot');confirmModern(c,'استعادة آخر Snapshot','النسخة: '+new Date(x.createdAt).toLocaleString('ar-IQ')+'. سيتم أخذ Snapshot من الوضع الحالي أولاً.',()=>NBREL.restore(c,x.id),true)})},true);
}

function postRender(c,route){
 if(route==='releasecenter'&&!document.querySelector('#v1Gate')){const host=document.querySelector('#view');if(host)host.insertAdjacentHTML('beforeend',`<section class="card" id="v1Gate"><div class="card-head"><h3>بوابة الإصدار الأول 1.0</h3><span class="badge purple">FINAL LINKING</span></div><div class="release-scope"><p>1.0 يبدأ فقط عند تنفيذ Cloud Database + Server Auth + Multi-device Sync.</p><p>يضاف Billing والتكاملات الحقيقية وServer Security وMigration من 0.15.</p><p>لن يتحول رقم الإصدار إلى 1.0 قبل نجاح اختبارات الربط والمزامنة والأمان.</p></div></section>`) }
 if(route==='products')wireProductPolish(c);
 if(route==='pos'){wirePOSPolish(c);wireCouponPolish(c);wirePOSOperationsModern(c);}
 if(route==='purchasing'){wirePurchasingPolish(c);wireRFQPolish(c);wirePurchasingPaymentModern(c);}
 if(route==='accounting'){wireAccountingPolish(c);wireAccountingMore(c);}
 if(route==='documents')wireDocumentsPolish(c);
 if(route==='org')wireOrgModern(c);
 if(route==='expenses')wireExpenseDeleteModern(c);
 if(route==='trash')wireTrashModern(c);
 if(route==='settings')wireSettingsDangerModern(c);
 if(route==='payroll')wirePayrollModern(c);
 if(route==='data'||route==='security')wireRestoreModern(c);
}
window.NBFC={migrate,viewPilot,wirePilot,postRender,stepState};
})();