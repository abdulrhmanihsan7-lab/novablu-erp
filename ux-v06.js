
(function(){
'use strict';

function migrate(c){
 const d=c.db,u=c.currentUser()?.id||'u';
 d.meta=d.meta||{};d.meta.version=Math.max(Number(d.meta.version||1),6);
 d.ui=d.ui||{};d.ui.savedFilters=d.ui.savedFilters||{};d.ui.recentRoutes=d.ui.recentRoutes||[];
 d.userPreferences=d.userPreferences||{};d.userPreferences[u]=d.userPreferences[u]||{};
 const p=d.userPreferences[u];
 p.dashboardWidgets=p.dashboardWidgets||['sales','invoices','expenses','due','chart','stock','recent','approvals'];
 p.favoriteRoutes=p.favoriteRoutes||['dashboard','sales','products','inventory','reports'];
 p.pageSize=Number(p.pageSize||25);p.reduceMotion=!!p.reduceMotion;
 d.qaRuns=d.qaRuns||[];
}
function pref(c){const u=c.currentUser()?.id||'u';return c.db.userPreferences[u]||(c.db.userPreferences[u]={})}
function addRecent(c,r){if(!r||r==='account')return;const a=c.db.ui.recentRoutes||[];c.db.ui.recentRoutes=[r,...a.filter(x=>x!==r)].slice(0,8)}
function routeLabel(r){
 const labels={dashboard:'لوحة التحكم',sales:'الفواتير',quotes:'عروض الأسعار',workflows:'سير العمل',documents:'المستندات',crm:'CRM',pos:'نقطة البيع',customers:'العملاء',products:'المنتجات',inventory:'المخزون',purchasing:'المشتريات',suppliers:'الموردون',expenses:'المصروفات',cash:'الصندوق والبنوك',accounting:'المحاسبة',financepro:'التحليل المالي',reports:'التقارير',hr:'الموارد البشرية',payroll:'الرواتب',approvals:'الموافقات',automation:'الأتمتة',integrations:'التكاملات',security:'الأمان',qa:'QA',users:'المستخدمون',org:'الشركات والفروع',notifications:'الإشعارات',activity:'النشاط',data:'البيانات',settings:'الإعدادات'};return labels[r]||r
}
function dashboardData(c){
 const inv=c.db.invoices.filter(i=>i.companyId===c.db.session.companyId&&!i.deletedAt&&['confirmed','partial','paid'].includes(i.status));
 const sales=inv.reduce((s,i)=>s+c.invTotals(i).total,0),due=inv.reduce((s,i)=>s+c.invTotals(i).due,0),exp=c.db.expenses.filter(e=>e.companyId===c.db.session.companyId&&e.status==='paid').reduce((s,e)=>s+Number(e.amount||0),0);
 const low=c.db.products.filter(p=>p.companyId===c.db.session.companyId&&p.trackStock&&(window.NBADV?NBADV.availableStock(c,p.id,c.warehouse()?.id):c.stock(p.id))<=Number(p.reorder||0));
 const months=[];for(let k=5;k>=0;k--){const dt=new Date();dt.setMonth(dt.getMonth()-k);const key=dt.toISOString().slice(0,7),val=inv.filter(i=>(i.date||'').startsWith(key)).reduce((s,i)=>s+c.invTotals(i).total,0);months.push({key,label:dt.toLocaleDateString('ar-IQ',{month:'short'}),val})}
 return {inv,sales,due,exp,low,months}
}
function widget(c,key,d){
 const max=Math.max(...d.months.map(x=>x.val),1);
 const map={
 sales:`<div class="kpi ux-widget"><div class="bubble">${c.icon('reports',18)}</div><div class="lab">إجمالي المبيعات</div><div class="val">${c.fmt(d.sales)}</div><div class="trend good-text">من ${d.inv.length} فاتورة مرحّلة</div></div>`,
 invoices:`<div class="kpi ux-widget"><div class="bubble">${c.icon('sales',18)}</div><div class="lab">الفواتير</div><div class="val">${d.inv.length}</div><div class="trend">${d.inv.filter(i=>c.invTotals(i).due>0).length} تحتاج متابعة</div></div>`,
 expenses:`<div class="kpi ux-widget"><div class="bubble">${c.icon('expenses',18)}</div><div class="lab">المصروفات</div><div class="val">${c.fmt(d.exp)}</div><div class="trend">مدفوعة</div></div>`,
 due:`<div class="kpi ux-widget"><div class="bubble">${c.icon('cash',18)}</div><div class="lab">مستحقات العملاء</div><div class="val">${c.fmt(d.due)}</div><div class="trend warn-text">${d.low.length} تنبيه مخزون</div></div>`,
 chart:`<div class="card ux-widget ux-wide"><div class="card-head"><h3>المبيعات — آخر 6 أشهر</h3></div><div class="bar-chart">${d.months.map(x=>`<div class="bar-col"><div class="bar" style="height:${Math.max(8,x.val/max*180)}px" title="${c.fmt(x.val)}"></div><span>${x.label}</span></div>`).join('')}</div></div>`,
 stock:`<div class="card ux-widget"><div class="card-head"><h3>تنبيهات المخزون</h3><div class="grow"></div><button class="btn sm" data-route="inventory">عرض الكل</button></div>${d.low.length?d.low.slice(0,7).map(p=>`<div class="stat-row"><span>${c.icon('inventory',17)}</span><div class="grow"><strong>${c.esc(p.nameAr)}</strong><div class="sub">المتاح ${window.NBADV?NBADV.availableStock(c,p.id,c.warehouse()?.id):c.stock(p.id)} • حد ${p.reorder}</div></div></div>`).join(''):'<div class="empty ux-empty">'+c.icon('check',28)+'<strong>المخزون ضمن الحدود</strong><span>لا توجد تنبيهات حالياً</span></div>'}</div>`,
 recent:`<div class="card ux-widget"><div class="card-head"><h3>أحدث الفواتير</h3><div class="grow"></div><button class="btn sm" data-route="sales">عرض الكل</button></div>${d.inv.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,7).map(i=>`<button class="ux-row-button" data-open-invoice="${i.id}"><div class="grow"><strong>${c.esc(i.number)}</strong><small>${c.esc(i.customerSnapshot?.name||c.db.customers.find(x=>x.id===i.customerId)?.name||'عميل نقدي')} • ${c.esc(i.date)}</small></div><strong>${c.fmt(c.invTotals(i).total)}</strong>${c.statusBadge(i.status)}</button>`).join('')||'<div class="empty ux-empty">لا توجد فواتير</div>'}</div>`,
 approvals:`<div class="card ux-widget"><div class="card-head"><h3>الموافقات المعلقة</h3><div class="grow"></div><button class="btn sm" data-route="approvals">فتح</button></div>${(c.db.approvals||[]).filter(x=>x.status==='pending').slice(0,7).map(a=>`<div class="stat-row"><div class="grow"><strong>${c.esc(a.title||a.type)}</strong><div class="sub">${c.esc(a.requester||'')} ${a.amount?'• '+c.fmt(a.amount):''}</div></div><span class="badge amber">بانتظار</span></div>`).join('')||'<div class="empty ux-empty">'+c.icon('check',28)+'<strong>لا توجد موافقات معلقة</strong></div>'}</div>`
 };
 return map[key]||''
}
function viewDashboard(c){
 migrate(c);const d=dashboardData(c),p=pref(c),widgets=p.dashboardWidgets||[];
 const kpis=widgets.filter(x=>['sales','invoices','expenses','due'].includes(x)).map(k=>widget(c,k,d)).join('');
 const other=widgets.filter(x=>!['sales','invoices','expenses','due'].includes(x)).map(k=>widget(c,k,d)).join('');
 const recent=(c.db.ui.recentRoutes||[]).filter(r=>r!=='dashboard').slice(0,5),fav=(p.favoriteRoutes||[]).filter(r=>r!=='dashboard').slice(0,6);
 return c.pageHead('لوحة التحكم',`${c.company().name} • ${c.branch()?.name||''}`,`<button class="btn outline" id="customizeDashboard">${c.icon('sliders',16)} تخصيص</button><button class="btn primary" data-q="invoice">${c.icon('plus',16)} فاتورة</button>`)+
 `<div class="ux-launchbar"><div><span>المفضلة</span>${fav.map(r=>`<button data-route="${r}">${c.icon(r,15)} ${c.esc(routeLabel(r))}</button>`).join('')||'<small>أضف صفحات للمفضلة من ☆</small>'}</div>${recent.length?`<div class="ux-recents"><span>حديثاً</span>${recent.map(r=>`<button data-route="${r}">${c.esc(routeLabel(r))}</button>`).join('')}</div>`:''}</div>`+
 (kpis?`<div class="grid kpis ux-dashboard-kpis">${kpis}</div>`:'')+`<div class="ux-dashboard-grid">${other}</div>`;
}
function customizeDashboard(c){
 const p=pref(c),all=[['sales','إجمالي المبيعات'],['invoices','الفواتير'],['expenses','المصروفات'],['due','المستحقات'],['chart','الرسم البياني'],['stock','تنبيهات المخزون'],['recent','أحدث الفواتير'],['approvals','الموافقات']];
 c.openModal('تخصيص لوحة التحكم',`<form id="dashboardCustomize"><div class="ux-widget-options">${all.map(([k,n])=>`<label><input type="checkbox" name="widget" value="${k}" ${(p.dashboardWidgets||[]).includes(k)?'checked':''}><span><strong>${n}</strong></span></label>`).join('')}</div><div class="field"><label>عدد الصفوف الافتراضي</label><select name="pageSize">${[10,25,50,100].map(x=>`<option value="${x}" ${Number(p.pageSize||25)===x?'selected':''}>${x}</option>`).join('')}</select></div><label class="switch"><input type="checkbox" name="reduceMotion" ${p.reduceMotion?'checked':''}> تقليل الحركة</label><div class="toolbar"><button class="btn primary">حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`,false);
 setTimeout(()=>{const f=document.querySelector('#dashboardCustomize');if(!f)return;f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f);p.dashboardWidgets=fd.getAll('widget');p.pageSize=Number(fd.get('pageSize')||25);p.reduceMotion=fd.get('reduceMotion')==='on';c.audit('تخصيص لوحة التحكم','UX',p.dashboardWidgets.join(','));c.save('تم حفظ التخصيص');c.closeModal();c.render()}},0)
}
function wireDashboard(c){document.querySelector('#customizeDashboard')?.addEventListener('click',()=>customizeDashboard(c));document.querySelectorAll('[data-open-invoice]').forEach(b=>b.onclick=()=>c.quick('invoice',b.dataset.openInvoice))}
function toggleFavorite(c,route){const p=pref(c),a=p.favoriteRoutes||[],had=a.includes(route);p.favoriteRoutes=had?a.filter(x=>x!==route):[...a,route];c.save(had?'تمت الإزالة من المفضلة':'تمت الإضافة للمفضلة');decoratePageHead(c,route)}
function decoratePageHead(c,route){
 const h=document.querySelector('.page-head');if(!h)return;let fav=h.querySelector('.ux-favorite');if(!fav){fav=document.createElement('button');fav.className='ux-favorite';h.querySelector('.actions')?.prepend(fav)}
 const active=(pref(c).favoriteRoutes||[]).includes(route);fav.innerHTML=active?'★':'☆';fav.title=active?'إزالة من المفضلة':'إضافة إلى المفضلة';fav.onclick=()=>toggleFavorite(c,route)
}
function saveFilter(c,route,key,value){c.db.ui.savedFilters[route]=c.db.ui.savedFilters[route]||{};c.db.ui.savedFilters[route][key]=value;localStorage.setItem('novablu_erp_v1_free',JSON.stringify(c.db))}
function restoreFilters(c,route){
 const f=c.db.ui.savedFilters?.[route]||{},map={sales:[['#salesSearch','q','input'],['#salesStatus','status','change']],products:[['#prodSearch','q','input'],['#prodStockFilter','stock','change']],customers:[['#contactSearch','q','input'],['#contactDebtFilter','debt','change']],suppliers:[['#contactSearch','q','input']],reports:[['#reportFrom','from','change'],['#reportTo','to','change']]};
 (map[route]||[]).forEach(([sel,key,event])=>{const el=document.querySelector(sel);if(!el)return;if(f[key]!==undefined&&f[key]!==''&&el.value!==f[key]){el.value=f[key];el.dispatchEvent(new Event(event,{bubbles:true}))}el.addEventListener(event,()=>saveFilter(c,route,key,el.value))})
}
function enhanceForms(c){
 document.querySelectorAll('form').forEach(form=>{if(form.dataset.uxEnhanced)return;form.dataset.uxEnhanced='1';form.querySelectorAll('[required]').forEach(el=>{const lab=el.closest('.field')?.querySelector('label');if(lab&&!lab.querySelector('.req'))lab.insertAdjacentHTML('beforeend',' <span class="req">*</span>')});form.addEventListener('submit',e=>{if(!form.checkValidity()){e.preventDefault();e.stopImmediatePropagation();const bad=form.querySelector(':invalid');bad?.classList.add('ux-invalid');bad?.focus();c.toast('أكمل الحقول المطلوبة أو صحح القيم');return}const submit=e.submitter;if(submit&&!submit.dataset.noLock){submit.disabled=true;setTimeout(()=>{if(document.body.contains(submit))submit.disabled=false},1000)}},true);form.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',()=>el.classList.remove('ux-invalid')))})
}
function searchItems(c,q){
 q=(q||'').trim().toLowerCase();if(!q)return[];const res=[],add=(type,id,title,sub,icon)=>{if(res.length<12)res.push({type,id,title,sub,icon})};
 c.db.invoices.filter(x=>!x.deletedAt&&(`${x.number} ${x.customerSnapshot?.name||''} ${x.customerSnapshot?.phone||''}`).toLowerCase().includes(q)).slice(0,4).forEach(x=>add('invoice',x.id,x.number,x.customerSnapshot?.name||'فاتورة','sales'));
 c.db.products.filter(x=>(`${x.nameAr} ${x.nameEn||''} ${x.sku||''} ${x.barcode||''}`).toLowerCase().includes(q)).slice(0,4).forEach(x=>add('product',x.id,x.nameAr,x.sku||'منتج','products'));
 c.db.customers.filter(x=>(`${x.name} ${x.phone||''} ${x.email||''}`).toLowerCase().includes(q)).slice(0,4).forEach(x=>add('customer',x.id,x.name,x.phone||'عميل','customers'));
 c.db.suppliers.filter(x=>(`${x.name} ${x.phone||''}`).toLowerCase().includes(q)).slice(0,2).forEach(x=>add('supplier',x.id,x.name,x.phone||'مورد','suppliers'));return res
}
function wireLiveSearch(c){
 const input=document.querySelector('#globalSearch'),bar=input?.closest('.searchbar');if(!input||!bar)return;let pop=document.querySelector('#uxSearchResults');if(!pop){pop=document.createElement('div');pop.id='uxSearchResults';pop.className='ux-search-results hidden';bar.appendChild(pop)}
 if(input.dataset.uxSearchBound)return;input.dataset.uxSearchBound='1';
 const close=()=>pop.classList.add('hidden'),draw=()=>{const arr=searchItems(c,input.value);if(!input.value.trim()){close();return}pop.innerHTML=arr.length?arr.map(x=>`<button data-search-type="${x.type}" data-search-id="${x.id}">${c.icon(x.icon,18)}<span><strong>${c.esc(x.title)}</strong><small>${c.esc(x.sub||'')}</small></span></button>`).join(''):`<div class="ux-search-empty">${c.icon('search',21)}<span>لا توجد نتيجة مطابقة</span></div>`;pop.classList.remove('hidden');pop.querySelectorAll('[data-search-type]').forEach(b=>b.onclick=()=>{close();input.value='';c.quick(b.dataset.searchType,b.dataset.searchId)})};
 input.addEventListener('input',draw);input.addEventListener('focus',draw);document.addEventListener('click',e=>{if(!bar.contains(e.target))close()})
}
function enhanceTables(c){
 const size=Number(pref(c).pageSize||25);document.querySelectorAll('.table-wrap table tbody').forEach(tb=>{const rows=[...tb.children];if(rows.length<=size)return;rows.forEach((r,i)=>r.classList.toggle('ux-row-hidden',i>=size));const wrap=tb.closest('.table-wrap');if(wrap.parentElement.querySelector('.ux-show-more'))return;const b=document.createElement('button');b.className='btn outline ux-show-more';b.textContent=`عرض الكل (${rows.length})`;b.onclick=()=>{rows.forEach(r=>r.classList.remove('ux-row-hidden'));b.remove()};wrap.after(b)})
}
function emptyStatePolish(c){document.querySelectorAll('.empty').forEach(x=>{if(x.dataset.uxEmpty)return;x.dataset.uxEmpty='1';if(!x.querySelector('.nb-icon'))x.insertAdjacentHTML('afterbegin',c.icon('file',24))})}
function showProgress(){let p=document.querySelector('#uxProgress');if(!p){p=document.createElement('div');p.id='uxProgress';p.className='ux-progress';document.body.appendChild(p)}p.classList.add('run');setTimeout(()=>p.classList.remove('run'),360)}
function postRender(c,route){migrate(c);addRecent(c,route);document.body.classList.toggle('reduce-motion',!!pref(c).reduceMotion);decoratePageHead(c,route);restoreFilters(c,route);enhanceForms(c);enhanceTables(c);emptyStatePolish(c);wireLiveSearch(c);if(route==='dashboard')wireDashboard(c);showProgress()}
function duplicateList(arr){const m={};arr.forEach(x=>{const k=String(x||'').trim().toLowerCase();if(k)m[k]=(m[k]||0)+1});return Object.entries(m).filter(x=>x[1]>1).map(x=>x[0])}
function tests(c){
 const t=[],push=(name,ok,detail,area='Core')=>t.push({name,ok,detail:detail||'',area}),inv=c.db.invoices.filter(i=>!i.deletedAt),posted=inv.filter(i=>['confirmed','partial','paid'].includes(i.status));
 const dInv=duplicateList(inv.map(i=>i.number)),dSku=duplicateList(c.db.products.map(p=>p.sku));push('أرقام الفواتير غير مكررة',!dInv.length,dInv.join(', ')||'سليم','Sales');push('SKU غير مكرر',!dSku.length,dSku.join(', ')||'سليم','Products');
 const badPay=inv.filter(i=>c.invTotals(i).paid>c.invTotals(i).total+.01);push('لا توجد دفعات عملاء زائدة',!badPay.length,badPay.map(x=>x.number).join(', ')||'سليم','Sales');
 const orphan=inv.filter(i=>(i.items||[]).some(x=>x.productId&&!c.db.products.some(p=>p.id===x.productId)));push('روابط أصناف الفواتير سليمة',!orphan.length,orphan.map(x=>x.number).slice(0,5).join(', ')||'سليم','Sales');
 const neg=[];c.db.warehouses.forEach(w=>c.db.products.filter(p=>p.trackStock).forEach(p=>{const a=window.NBADV?NBADV.availableStock(c,p.id,w.id):c.stock(p.id,w.id);if(a<-.0001)neg.push(p.nameAr+' @ '+w.name)}));push('لا يوجد مخزون متاح سالب',!neg.length,neg.slice(0,5).join(', ')||'سليم','Inventory');
 const badRes=c.db.reservations.filter(r=>r.status==='active'&&!c.db.salesOrders.some(o=>o.id===r.refId&&o.status==='reserved'));push('الحجوزات مرتبطة بأوامر بيع محجوزة',!badRes.length,String(badRes.length),'Inventory');
 const badSO=c.db.salesOrders.filter(o=>o.invoiceId&&!c.db.invoices.some(i=>i.id===o.invoiceId&&!i.deletedAt));push('روابط أوامر البيع بالفواتير سليمة',!badSO.length,badSO.map(x=>x.number).join(', ')||'سليم','Workflow');
 const overRet=[];inv.forEach(i=>{const sold={};(i.items||[]).forEach((x,n)=>{const k=x.productId||'m'+n;sold[k]=(sold[k]||0)+Number(x.qty||0)});const ret={};c.db.returns.filter(r=>r.invoiceId===i.id&&r.status==='done').flatMap(r=>r.items||[]).forEach(x=>ret[x.key]=(ret[x.key]||0)+Number(x.qty||0));Object.keys(ret).forEach(k=>{if(ret[k]>(sold[k]||0)+.0001)overRet.push(i.number+':'+k)})});push('المرتجعات لا تتجاوز المباع',!overRet.length,overRet.slice(0,5).join(', ')||'سليم','Returns');
 const postedMissing=posted.filter(i=>(i.items||[]).some(x=>{const p=c.db.products.find(v=>v.id===x.productId);return p?.trackStock&&!c.db.stockMoves.some(m=>m.ref===i.number&&m.productId===x.productId&&m.type==='delivery')}));push('الفواتير المرحلة لها حركة مخزون',!postedMissing.length,postedMissing.map(x=>x.number).slice(0,5).join(', ')||'سليم','Inventory');
 const badPO=c.db.purchaseOrders.filter(p=>(p.payments||[]).reduce((s,x)=>s+Number(x.amount||0),0)>(p.items||[]).reduce((s,x)=>s+Number(x.qty||0)*Number(x.cost||0),0)+.01);push('دفعات الموردين لا تتجاوز الأمر',!badPO.length,badPO.map(x=>x.number).join(', ')||'سليم','Purchasing');
 const badReceived=c.db.purchaseOrders.filter(p=>Object.entries(p.receivedByProduct||{}).some(([pid,q])=>Number(q)>(p.items.find(x=>x.productId===pid)?.qty||0)+.0001));push('الاستلام لا يتجاوز المطلوب',!badReceived.length,badReceived.map(x=>x.number).join(', ')||'سليم','Purchasing');
 const journals=[...(c.db.journals||[]),...(window.NBHYPER?.autoJournals?NBHYPER.autoJournals(c):[])],badJ=journals.filter(j=>Math.abs((j.lines||[]).reduce((s,l)=>s+Number(l.debit||0)-Number(l.credit||0),0))>.01);push('القيود متوازنة',!badJ.length,badJ.map(x=>x.number).slice(0,5).join(', ')||'سليم','Accounting');
 const badMembers=c.db.users.filter(u=>u.active&&!c.db.companies.some(co=>co.id===u.companyId));push('المستخدمون مرتبطون بشركات صحيحة',!badMembers.length,badMembers.map(x=>x.name).join(', ')||'سليم','Security');
 const badBranches=c.db.branches.filter(b=>!c.db.companies.some(co=>co.id===b.companyId));push('الفروع مرتبطة بشركات صحيحة',!badBranches.length,badBranches.map(x=>x.name).join(', ')||'سليم','Organization');
 const credit=c.db.customers.filter(x=>Number(x.creditLimit||0)>0&&window.NBADV&&NBADV.customerOutstanding(c,x.id)>Number(x.creditLimit||0));push('الحدود الائتمانية تحتاج متابعة فقط عند التجاوز',!credit.length,credit.map(x=>x.name).slice(0,5).join(', ')||'سليم','Credit');
 push('يوجد مخزن واحد على الأقل',c.db.warehouses.some(w=>w.companyId===c.db.session.companyId),'','Setup');push('يوجد حساب نقدي واحد على الأقل',c.db.cashAccounts.some(a=>a.companyId===c.db.session.companyId),'','Setup');return t
}
function viewQA(c){
 const t=tests(c),ok=t.filter(x=>x.ok).length,areas=[...new Set(t.map(x=>x.area))];
 return c.pageHead('مركز الجودة QA',`${ok}/${t.length} اختبار ناجح`,`<button class="btn outline" id="exportQA">${c.icon('data',16)} CSV</button><button class="btn primary" id="runFullQA">${c.icon('check',16)} تشغيل الفحص</button>`)+
 `<div class="ux-qa-summary"><div class="ux-qa-ring" style="--p:${Math.round(ok/t.length*100)}"><strong>${Math.round(ok/t.length*100)}%</strong><span>سلامة حالية</span></div><div class="ux-qa-areas">${areas.map(a=>{const arr=t.filter(x=>x.area===a),pass=arr.filter(x=>x.ok).length;return`<div><span>${c.esc(a)}</span><strong>${pass}/${arr.length}</strong><b><i style="width:${pass/arr.length*100}%"></i></b></div>`}).join('')}</div></div>`+
 `<div class="ux-qa-grid">${t.map(x=>`<article class="ux-qa-test ${x.ok?'pass':'fail'}"><span>${c.icon(x.ok?'check':'notifications',19)}</span><div class="grow"><strong>${c.esc(x.name)}</strong><small>${c.esc(x.detail||x.area)}</small></div><b>${x.ok?'PASS':'CHECK'}</b></article>`).join('')}</div><div class="notice">الفحص الحالي يغطي منطق وبيانات النسخة المحلية. التزامن والخادم والاختراق والضغط تؤجل إلى مرحلة Cloud Backend.</div>`
}
function wireQA(c){const run=()=>{const t=tests(c),ok=t.filter(x=>x.ok).length;c.db.qaRuns.unshift({id:c.uid('qa'),at:c.now(),passed:ok,total:t.length,version:'0.06'});c.audit('تشغيل QA شامل','System',ok+'/'+t.length);c.save('اكتمل فحص الجودة');c.render()};document.querySelector('#runFullQA')?.addEventListener('click',run);document.querySelector('#exportQA')?.addEventListener('click',()=>{const t=tests(c);c.csv('NovaBlu_QA_'+c.today()+'.csv',[['Area','Test','Status','Detail'],...t.map(x=>[x.area,x.name,x.ok?'PASS':'CHECK',x.detail])])})}
window.NBUX={migrate,viewDashboard,wireDashboard,postRender,viewQA,wireQA,showProgress,tests};
})();
