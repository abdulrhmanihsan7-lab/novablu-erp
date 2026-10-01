(function(){
'use strict';
const profiles={
 retail:{name:'تجزئة',landing:'owner',fav:['owner','pos','sales','inventory','products'],modules:{pos:true,crm:true,quotes:true,purchasing:true,payroll:false}},
 wholesale:{name:'جملة',landing:'owner',fav:['owner','sales','products','inventory','purchasing'],modules:{pos:false,crm:true,quotes:true,purchasing:true,payroll:false}},
 services:{name:'خدمات',landing:'owner',fav:['owner','sales','quotes','crm','reports'],modules:{pos:false,inventory:false,purchasing:false,crm:true,quotes:true,payroll:false}},
 fashion:{name:'أزياء',landing:'owner',fav:['owner','pos','products','inventory','sales'],modules:{pos:true,crm:true,quotes:false,purchasing:true,payroll:false}},
 restaurant:{name:'مطعم/كافيه',landing:'owner',fav:['owner','pos','inventory','purchasing','expenses'],modules:{pos:true,crm:false,quotes:false,purchasing:true,payroll:false}}
};
function migrate(c){
 const d=c.db;d.meta=d.meta||{};d.meta.version=Math.max(Number(d.meta.version||1),9);
 d.activation=Object.assign({profileApplied:false,firstValueAt:null,lastTourStep:0,liveReady:false},d.activation||{});
 d.userPreferences=d.userPreferences||{};
}
function pref(c){return c.db.userPreferences[c.db.session.userId]||(c.db.userPreferences[c.db.session.userId]={landingPage:'dashboard',density:'comfortable',language:'ar'})}
function checks(c){
 const companyReal=!!c.company()?.name&&!/تجريب/i.test(c.company().name);
 const hasProducts=c.db.products.some(p=>p.companyId===c.db.session.companyId&&p.active);
 const hasCustomer=c.db.customers.some(x=>x.companyId===c.db.session.companyId);
 const hasInvoice=c.db.invoices.some(i=>i.companyId===c.db.session.companyId&&!i.deletedAt);
 const hasPayment=c.db.invoices.some(i=>i.companyId===c.db.session.companyId&&(i.payments||[]).length);
 const backup=!!c.db.saas?.lastBackupAt;
 return[
  {id:'identity',title:'هوية الشركة',sub:'اسم الشركة والعملة والفرع',ok:companyReal,route:'org'},
  {id:'catalog',title:'المنتجات أو الخدمات',sub:'أضف أو استورد أول قائمة',ok:hasProducts,route:'products'},
  {id:'customer',title:'أول عميل',sub:'سجل عميل واحد على الأقل',ok:hasCustomer,route:'customers'},
  {id:'invoice',title:'أول فاتورة',sub:'أنشئ أول عملية بيع',ok:hasInvoice,route:'sales'},
  {id:'payment',title:'أول تحصيل',sub:'سجل دفعة على فاتورة',ok:hasPayment,route:'sales'},
  {id:'backup',title:'نسخة احتياطية',sub:'اختبر تنزيل نسخة قبل الإطلاق',ok:backup,route:'data'}
 ];
}
function activationScore(c){const a=checks(c),done=a.filter(x=>x.ok).length;return{done,total:a.length,pct:Math.round(done/a.length*100),items:a}}
function suggestions(c){
 const sc=activationScore(c),out=[];
 sc.items.filter(x=>!x.ok).slice(0,3).forEach(x=>out.push({title:x.title,sub:x.sub,route:x.route}));
 if(sc.pct===100)out.push({title:'فعّل تجربة الفريق',sub:'أنشئ مستخدم بصلاحية كاشير أو مبيعات',route:'users'});
 return out;
}
function viewLaunch(c){
 const base=NBSAAS.viewLaunch(c),sc=activationScore(c),type=c.db.saas?.onboarding?.businessType||'',p=profiles[type];
 return base+`<section class="card activation-card"><div class="card-head"><h3>Activation Path</h3><span class="badge ${sc.pct===100?'green':'blue'}">${sc.pct}%</span></div><div class="activation-path">${sc.items.map((x,i)=>`<button class="${x.ok?'done':''}" data-route="${x.route}"><span>${x.ok?'✓':i+1}</span><div><strong>${c.esc(x.title)}</strong><small>${c.esc(x.sub)}</small></div></button>`).join('')}</div></section>
 <section class="card"><div class="card-head"><h3>قالب النشاط</h3><div class="grow"></div>${p?`<span class="badge purple">${c.esc(p.name)}</span>`:''}</div><p class="sub">القالب يرتب الصفحة الرئيسية والمفضلة والوحدات المقترحة فقط؛ ما يحذف أي فاتورة أو منتج أو حركة.</p><div class="profile-grid">${Object.entries(profiles).map(([k,v])=>`<button class="${type===k?'active':''}" data-activation-profile="${k}"><strong>${c.esc(v.name)}</strong><small>${v.fav.map(r=>routeName(r)).join(' • ')}</small></button>`).join('')}</div>${p?`<div class="toolbar"><button class="btn primary" id="applyBusinessProfile">تطبيق ترتيب ${c.esc(p.name)}</button><button class="btn outline" id="previewBusinessProfile">معاينة</button></div>`:''}</section>
 <section class="card first-value-card"><div><span class="eyebrow">FIRST VALUE</span><h3>${sc.pct===100?'الحساب جاهز للتجربة الفعلية':'أقصر طريق لأول قيمة'}</h3><p>${sc.pct===100?'جرّب يوم عمل كامل: بيع، تحصيل، مخزون، ثم راجع لوحة المالك.':'كمل الخطوات الناقصة بالترتيب بدل الدخول بكل الوحدات.'}</p></div><div class="first-value-score"><strong>${sc.done}/${sc.total}</strong><span>خطوات</span></div></section>`;
}
function routeName(r){return({owner:'المالك',pos:'POS',sales:'المبيعات',inventory:'المخزون',products:'المنتجات',purchasing:'المشتريات',quotes:'العروض',crm:'CRM',reports:'التقارير',expenses:'المصروفات'})[r]||r}
function wireLaunch(c){
 NBSAAS.wireLaunch(c);
 document.querySelectorAll('[data-activation-profile]').forEach(b=>b.onclick=()=>{c.db.saas.onboarding.businessType=b.dataset.activationProfile;c.db.settings.businessType=b.dataset.activationProfile;c.save('تم اختيار نشاط '+profiles[b.dataset.activationProfile].name);c.render()});
 document.querySelector('#previewBusinessProfile')?.addEventListener('click',()=>previewProfile(c));
 document.querySelector('#applyBusinessProfile')?.addEventListener('click',()=>applyProfile(c));
}
function previewProfile(c){
 const key=c.db.saas.onboarding.businessType,p=profiles[key];if(!p)return;
 c.openModal('معاينة قالب '+p.name,`<div class="card"><div class="card-head"><h3>المفضلة المقترحة</h3></div><div class="launch-favorites">${p.fav.map(x=>`<span>${c.esc(routeName(x))}</span>`).join('')}</div></div><div class="card"><div class="card-head"><h3>الوحدات المقترحة</h3></div>${Object.entries(p.modules).map(([k,v])=>`<div class="readiness-row"><span>${c.esc(routeName(k))}</span><b class="${v?'good-text':'sub'}">${v?'إظهار':'إخفاء اختياري'}</b></div>`).join('')}</div><div class="notice">المعاينة لا تغير أي شيء.</div>`,false);
}
function applyProfile(c){
 const key=c.db.saas.onboarding.businessType,p=profiles[key];if(!p)return;
 if(!confirm('تطبيق ترتيب النشاط؟ لن يتم حذف أي بيانات.'))return;
 const up=pref(c);up.landingPage=p.landing;up.favoriteRoutes=[...p.fav];
 Object.entries(p.modules).forEach(([k,v])=>{if(c.db.settings.modules[k]!==undefined)c.db.settings.modules[k]=v});
 c.db.activation.profileApplied=true;c.audit('تطبيق قالب نشاط','Activation',key);c.save('تم تطبيق قالب '+p.name);c.render();
}
function viewOwner(c){
 const base=NBSAAS.viewOwner(c),sc=activationScore(c),sg=suggestions(c);
 return base+`<section class="card activation-owner"><div class="card-head"><h3>جاهزية الاستخدام</h3><strong>${sc.pct}%</strong></div><div class="progress"><i style="width:${sc.pct}%"></i></div>${sg.length?`<div class="activation-suggestions">${sg.map(x=>`<button data-route="${x.route}"><strong>${c.esc(x.title)}</strong><small>${c.esc(x.sub)}</small></button>`).join('')}</div>`:'<div class="notice">جاهز لتجربة يوم عمل كامل.</div>'}</section>`;
}
function wireOwner(c){NBSAAS.wireOwner(c)}
function postRender(c,route){
 if(route==='launch'){const sc=activationScore(c);if(sc.pct===100&&!c.db.activation.firstValueAt){c.db.activation.firstValueAt=c.now();c.save()}}
}
window.NBACT={profiles,migrate,activationScore,viewLaunch,wireLaunch,viewOwner,wireOwner,postRender};
})();