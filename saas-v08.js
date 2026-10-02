(function(){
'use strict';
const num=v=>Number(v||0);
const plans={
 trial:{id:'trial',name:'تجربة مجانية',users:3,branches:1,ai:50,features:['الفواتير والمبيعات','المخزون','POS','التقارير','NovaBlu AI محلي'],recommended:false},
 basic:{id:'basic',name:'Basic',users:3,branches:1,ai:100,features:['المبيعات والمخزون','POS','نسخ احتياطي سحابي عند الربط','دعم أساسي'],recommended:false},
 pro:{id:'pro',name:'Pro',users:10,branches:3,ai:1000,features:['كل Basic','CRM والمشتريات','المحاسبة والتحليلات','الأتمتة','NovaBlu AI','WhatsApp عند الربط'],recommended:true},
 business:{id:'business',name:'Business',users:50,branches:20,ai:5000,features:['كل Pro','Multi-company','صلاحيات متقدمة','API/Webhooks','تقارير الإدارة','دعم أولوية'],recommended:false}
};
function migrate(c){
 const d=c.db; d.meta=d.meta||{}; d.meta.version=Math.max(Number(d.meta.version||1),8);
 d.saas=d.saas||{};
 d.saas.workspaceId=d.saas.workspaceId||('ws-'+(d.companies?.[0]?.id||'local'));
 d.saas.trialStartedAt=Number(d.saas.trialStartedAt||Date.now());
 d.saas.trialDays=Number(d.saas.trialDays||14);
 d.saas.plan=d.saas.plan||'trial';
 d.saas.preferredPlan=d.saas.preferredPlan||'pro';
 d.saas.billingStatus=d.saas.billingStatus||'local_preview';
 d.saas.backend=Object.assign({provider:'supabase',connected:false,lastSyncAt:null},d.saas.backend||{});
 d.saas.onboarding=Object.assign({businessType:'',completedAt:null},d.saas.onboarding||{});
 d.saas.lastDigestDate=d.saas.lastDigestDate||'';
 d.assistantHistory=d.assistantHistory||[];
 d.supportTickets=d.supportTickets||[];
 d.automationRecipes=d.automationRecipes||[
  {id:'digest',name:'ملخص المالك اليومي',type:'daily_digest',enabled:true,local:true},
  {id:'low',name:'تنبيه المخزون المنخفض',type:'low_stock_plus',enabled:true,local:true},
  {id:'due',name:'متابعة ديون العملاء',type:'customer_due',enabled:true,local:true},
  {id:'approval',name:'تنبيه الموافقات المعلقة',type:'pending_approval',enabled:true,local:true}
 ];
 d.settings.modules=d.settings.modules||{};
 const saasMods=['owner','assistant','subscription','launch','support'];
 saasMods.forEach(k=>{if(d.settings.modules[k]===undefined)d.settings.modules[k]=true});
 const acts=['view','create','edit','delete','approve','export'];
 Object.keys(d.permissions||{}).forEach(role=>{
  d.permissions[role]=d.permissions[role]||{};
  saasMods.forEach(m=>{if(!d.permissions[role][m]){d.permissions[role][m]={};acts.forEach(a=>d.permissions[role][m][a]=false)}});
  if(['Owner','Admin'].includes(role))saasMods.forEach(m=>acts.forEach(a=>d.permissions[role][m][a]=true));
  if(role==='Manager'){d.permissions[role].owner.view=true;d.permissions[role].assistant.view=true;d.permissions[role].launch.view=true;d.permissions[role].support.view=true}
  if(!['Owner','Admin'].includes(role)){d.permissions[role].assistant.view=true;d.permissions[role].support.view=true;}
 });
}
function companyInvoices(c){return c.db.invoices.filter(i=>i.companyId===c.db.session.companyId&&!i.deletedAt&&['confirmed','partial','paid'].includes(i.status))}
function monthKey(){return new Date().toISOString().slice(0,7)}
function todayInv(c){return companyInvoices(c).filter(i=>i.date===c.today())}
function monthInv(c){return companyInvoices(c).filter(i=>(i.date||'').startsWith(monthKey()))}
function sales(c,arr){return arr.reduce((s,i)=>s+c.invTotals(i).total,0)}
function paid(c,arr){return arr.reduce((s,i)=>s+c.invTotals(i).paid,0)}
function due(c,arr=companyInvoices(c)){return arr.reduce((s,i)=>s+c.invTotals(i).due,0)}
function expenses(c,month=false){return c.db.expenses.filter(e=>e.companyId===c.db.session.companyId&&e.status==='paid'&&(!month||(e.date||'').startsWith(monthKey()))).reduce((s,e)=>s+num(e.amount),0)}
function lowStock(c){return c.db.products.filter(p=>p.companyId===c.db.session.companyId&&p.active&&p.trackStock&&c.stock(p.id)<=num(p.reorder))}
function trialDaysLeft(c){const ms=num(c.db.saas.trialDays||14)*86400000,used=Date.now()-num(c.db.saas.trialStartedAt);return Math.max(0,Math.ceil((ms-used)/86400000))}
function usage(c){return{users:c.db.users.filter(x=>x.active).length,branches:c.db.branches.filter(x=>x.companyId===c.db.session.companyId&&x.active).length,products:c.db.products.filter(x=>x.companyId===c.db.session.companyId&&x.active).length,invoices:monthInv(c).length,ai:c.db.assistantHistory.filter(x=>(x.at||0)>=new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime()&&x.role==='user').length}}
function plan(c){return plans[c.db.saas.plan]||plans.trial}
function attention(c){
 const items=[],low=lowStock(c),d=due(c),pending=(c.db.approvals||[]).filter(x=>x.status==='pending'),vb=(c.db.vendorBills||[]).filter(x=>x.status==='open'&&(!x.dueDate||x.dueDate<=c.today()));
 if(d>0)items.push({kind:'cash',title:'مستحقات العملاء',body:c.fmt(d)+' تحتاج متابعة',route:'sales',level:'amber'});
 if(low.length)items.push({kind:'inventory',title:'مخزون منخفض',body:low.length+' منتج وصل حد إعادة الطلب',route:'inventory',level:'red'});
 if(pending.length)items.push({kind:'approvals',title:'موافقات معلقة',body:pending.length+' عملية تنتظر قرارك',route:'approvals',level:'purple'});
 if(vb.length)items.push({kind:'purchasing',title:'فواتير موردين',body:vb.length+' فاتورة مفتوحة/مستحقة',route:'purchasing',level:'amber'});
 if(!items.length)items.push({kind:'qa',title:'الوضع مستقر',body:'لا توجد نقاط حرجة حالياً',route:'qa',level:'green'});
 return items;
}
function topProduct(c){
 const m={}; companyInvoices(c).forEach(i=>(i.items||[]).forEach(x=>{const k=x.productId||x.name;m[k]=(m[k]||0)+num(x.qty)*num(x.price)}));
 const x=Object.entries(m).sort((a,b)=>b[1]-a[1])[0]; if(!x)return null;
 const p=c.db.products.find(v=>v.id===x[0]); return{name:p?.nameAr||x[0],value:x[1]};
}
function ownerNext(c){
 const out=[],low=lowStock(c),d=due(c),pending=(c.db.approvals||[]).filter(x=>x.status==='pending');
 if(low.length)out.push({title:'جهز طلب إعادة مخزون',sub:'ابدأ بالمنتجات الحرجة',route:'inventory'});
 if(d>0)out.push({title:'راجع الذمم المستحقة',sub:'رتب متابعة العملاء غير المسددين',route:'sales'});
 if(pending.length)out.push({title:'راجع الموافقات',sub:'لا تترك العمليات معلقة',route:'approvals'});
 if(trialDaysLeft(c)<=3)out.push({title:'اختر خطة الاشتراك',sub:'باقي '+trialDaysLeft(c)+' يوم بالتجربة',route:'subscription'});
 if(!out.length)out.push({title:'راجع لوحة التحليل المالي',sub:'راقب الربحية والتدفق النقدي',route:'financepro'});
 return out.slice(0,4);
}
function viewOwner(c){
 const ti=todayInv(c),mi=monthInv(c),att=attention(c),next=ownerNext(c),tp=topProduct(c);
 return c.pageHead('لوحة المالك','شنو صار اليوم؟ شنو يحتاج تدخلك؟ وشنو الخطوة الجاية؟',`<button class="btn primary" data-route="assistant">${c.icon('automation',16)} اسأل NovaBlu AI</button>`)+
 `<div class="saas-hero"><div><span class="eyebrow">TODAY</span><h2>${c.esc(c.company().name)}</h2><p>ملخص تنفيذي سريع بدون الدخول بين تفاصيل النظام.</p></div><div class="trial-ring"><strong>${trialDaysLeft(c)}</strong><span>يوم بالتجربة</span></div></div>
 <div class="owner-kpis"><div><span>مبيعات اليوم</span><strong>${c.fmt(sales(c,ti))}</strong><small>${ti.length} فاتورة</small></div><div><span>مبيعات الشهر</span><strong>${c.fmt(sales(c,mi))}</strong><small>المحصل ${c.fmt(paid(c,mi))}</small></div><div><span>المستحقات</span><strong>${c.fmt(due(c))}</strong><small>ذمم عملاء</small></div><div><span>مصروفات الشهر</span><strong>${c.fmt(expenses(c,true))}</strong><small>مدفوعة</small></div></div>
 <div class="saas-grid2"><section class="card"><div class="card-head"><h3>يحتاج تدخلك</h3><span class="badge amber">${att.length}</span></div>${att.map(x=>`<button class="attention-row" data-route="${x.route}"><span class="attention-dot ${x.level}"></span><div class="grow"><strong>${c.esc(x.title)}</strong><small>${c.esc(x.body)}</small></div>${c.icon('chevron',16)}</button>`).join('')}</section>
 <section class="card"><div class="card-head"><h3>شنو أسوي بعد؟</h3></div>${next.map((x,i)=>`<button class="next-row" data-route="${x.route}"><span>${i+1}</span><div class="grow"><strong>${c.esc(x.title)}</strong><small>${c.esc(x.sub)}</small></div>${c.icon('chevron',16)}</button>`).join('')}</section></div>
 <div class="saas-grid2"><section class="card"><div class="card-head"><h3>نبضة العمل</h3></div><div class="pulse-list"><div><span>أفضل منتج</span><strong>${c.esc(tp?.name||'—')}</strong><small>${tp?c.fmt(tp.value):'لا توجد مبيعات'}</small></div><div><span>تنبيهات المخزون</span><strong>${lowStock(c).length}</strong><small>منتج يحتاج متابعة</small></div><div><span>الفروع</span><strong>${usage(c).branches}</strong><small>فرع نشط</small></div><div><span>المستخدمون</span><strong>${usage(c).users}</strong><small>مستخدم نشط</small></div></div></section>
 <section class="card owner-ai-card"><span class="eyebrow">NOVABLU AI</span><h3>اسأل بيانات شركتك مباشرة</h3><p>مثلاً: «كم مبيعات اليوم؟»، «من أكثر منتج مبيعاً؟»، «كم عندي ديون؟»</p><button class="btn primary" data-route="assistant">فتح المساعد</button></section></div>`;
}
function wireOwner(c){}

function assistantAnswer(c,q){
 const x=String(q||'').trim().toLowerCase(),mi=monthInv(c),ti=todayInv(c),tp=topProduct(c),low=lowStock(c),d=due(c),exp=expenses(c,true);
 if(!x)return{title:'اكتب سؤالك',body:'اسأل عن المبيعات، الديون، المخزون، المصروفات، أفضل منتج أو الربح التشغيلي.',route:''};
 if(/مبيعات.*اليوم|اليوم.*مبيعات|sales today/.test(x))return{title:'مبيعات اليوم',body:`${c.fmt(sales(c,ti))} من ${ti.length} فاتورة، والمحصل ${c.fmt(paid(c,ti))}.`,route:'sales'};
 if(/مبيعات.*شهر|الشهر.*مبيعات|sales.*month/.test(x))return{title:'مبيعات هذا الشهر',body:`${c.fmt(sales(c,mi))} من ${mi.length} فاتورة. المحصل ${c.fmt(paid(c,mi))} والمتبقي ${c.fmt(due(c,mi))}.`,route:'reports'};
 if(/دين|ديون|مستحق|ذمم|due|receivable/.test(x))return{title:'ذمم العملاء',body:`إجمالي المستحق حالياً ${c.fmt(d)}. عندك ${companyInvoices(c).filter(i=>c.invTotals(i).due>0).length} فاتورة تحتاج متابعة.`,route:'sales'};
 if(/مخزون|ناقص|stock|reorder/.test(x))return{title:'المخزون',body:low.length?`${low.length} منتج عند أو تحت حد إعادة الطلب: ${low.slice(0,5).map(p=>p.nameAr).join('، ')}.`:'لا توجد منتجات وصلت حد إعادة الطلب حالياً.',route:'inventory'};
 if(/افضل.*منتج|أكثر.*منتج|top product|best product/.test(x))return{title:'أفضل منتج',body:tp?`${tp.name} هو الأعلى بقيمة مبيعات تقريبية ${c.fmt(tp.value)}.`:'لا توجد بيانات مبيعات كافية بعد.',route:'products'};
 if(/مصروف|expense/.test(x))return{title:'مصروفات الشهر',body:`المصروفات المدفوعة هذا الشهر ${c.fmt(exp)}.`,route:'expenses'};
 if(/ربح|profit/.test(x)){const gross=sales(c,mi)-exp;return{title:'نتيجة تشغيلية تقريبية',body:`المبيعات ${c.fmt(sales(c,mi))} ناقص المصروفات المدفوعة ${c.fmt(exp)} = ${c.fmt(gross)}. هذا مؤشر تشغيلي مبسط وليس صافي ربح محاسبي كامل.`,route:'financepro'};}
 if(/شنو.*اسوي|ماذا.*افعل|next|attention|يحتاج/.test(x)){const a=attention(c).slice(0,3);return{title:'أهم ما يحتاج تدخل',body:a.map(v=>v.title+': '+v.body).join(' • '),route:a[0]?.route||'owner'};}
 return{title:'تحليل محلي',body:`أكدر حالياً أجاوب من بيانات NovaBlu عن المبيعات، الديون، المخزون، المصروفات، أفضل المنتجات والنتيجة التشغيلية. الربط مع نموذج AI سحابي يضيف أسئلة مفتوحة وتحليل أعمق لاحقاً.`,route:'owner'};
}
function viewAssistant(c){
 const h=c.db.assistantHistory.slice(-12);
 return c.pageHead('NovaBlu AI','مساعد أعمال مبني على بيانات النظام الحالية',`<span class="badge purple">Local Analytics</span>`)+
 `<div class="ai-shell"><aside class="ai-side"><span class="eyebrow">اقتراحات</span>${['كم مبيعات اليوم؟','كم عندي ديون؟','شنو ناقص بالمخزون؟','من أكثر منتج مبيعاً؟','كم مصروفات الشهر؟','شنو يحتاج تدخلي؟'].map(q=>`<button class="ai-prompt" data-ai-prompt="${c.esc(q)}">${c.esc(q)}</button>`).join('')}<div class="notice amber">حالياً التحليل يعمل محلياً من بيانات ERP. محرك AI السحابي يتفعل بعد ربط الـBackend.</div></aside>
 <section class="ai-main"><div id="aiHistory" class="ai-history">${h.length?h.map(m=>`<div class="ai-msg ${m.role}"><span>${m.role==='user'?'أنت':'NB'}</span><div><strong>${c.esc(m.title||'')}</strong><p>${c.esc(m.text)}</p>${m.route?`<button class="btn sm" data-route="${m.route}">فتح القسم</button>`:''}</div></div>`).join(''):'<div class="ai-empty"><div class="ai-orb">N</div><h3>شنو تحب تعرف عن شغلك؟</h3><p>اسأل NovaBlu عن بياناتك الحالية.</p></div>'}</div>
 <form id="aiForm" class="ai-compose"><input name="q" autocomplete="off" placeholder="مثلاً: كم مبيعات اليوم؟" required><button class="btn primary">إرسال</button></form></section></div>`;
}
function askAssistant(c,q){
 c.db.assistantHistory.push({id:c.uid('ai'),role:'user',text:q,title:'',route:'',at:c.now()});
 const a=assistantAnswer(c,q);c.db.assistantHistory.push({id:c.uid('ai'),role:'assistant',text:a.body,title:a.title,route:a.route,at:c.now()});
 c.db.assistantHistory=c.db.assistantHistory.slice(-100);c.audit('سؤال للمساعد','Assistant',q.slice(0,80));c.save();c.render();
}
function wireAssistant(c){
 document.querySelectorAll('[data-ai-prompt]').forEach(b=>b.onclick=()=>askAssistant(c,b.dataset.aiPrompt));
 const f=document.querySelector('#aiForm');if(f)f.onsubmit=e=>{e.preventDefault();const q=new FormData(f).get('q');askAssistant(c,q)};
 const h=document.querySelector('#aiHistory');if(h)h.scrollTop=h.scrollHeight;
}
function onboardingChecks(c){
 const co=c.company(),checks=[
  {id:'company',title:'بيانات الشركة',ok:!!co&&co.name&&!/تجريب/.test(co.name),route:'org',sub:'ضع اسم الشركة وبياناتها الحقيقية'},
  {id:'products',title:'أضف المنتجات',ok:c.db.products.filter(x=>x.companyId===c.db.session.companyId).length>0,route:'products',sub:'أضف أو استورد قائمة المنتجات'},
  {id:'customers',title:'أضف العملاء',ok:c.db.customers.filter(x=>x.companyId===c.db.session.companyId).length>0,route:'customers',sub:'عميل واحد على الأقل'},
  {id:'users',title:'جهز فريقك',ok:c.db.users.filter(x=>x.active).length>1,route:'users',sub:'أنشئ مستخدم للكاشير أو الموظف'},
  {id:'invoice',title:'أصدر أول فاتورة',ok:companyInvoices(c).length>0,route:'sales',sub:'اختبر البيع والدفع والطباعة'},
  {id:'backup',title:'اختبر النسخ الاحتياطي',ok:!!c.db.saas.lastBackupAt,route:'data',sub:'نزّل نسخة احتياطية وتأكد منها'}
 ];return checks;
}
function viewLaunch(c){
 const ch=onboardingChecks(c),done=ch.filter(x=>x.ok).length,pct=Math.round(done/ch.length*100),type=c.db.saas.onboarding.businessType||'';
 return c.pageHead('Launch Center','جهّز نشاطك للاستخدام خلال دقائق')+
 `<div class="launch-progress"><div><span>جاهزية الحساب</span><strong>${pct}%</strong></div><div class="progress"><i style="width:${pct}%"></i></div><small>${done} من ${ch.length} خطوات مكتملة</small></div>
 <div class="saas-grid2"><section class="card"><div class="card-head"><h3>قائمة الانطلاق</h3></div>${ch.map((x,i)=>`<button class="launch-step ${x.ok?'done':''}" data-route="${x.route}"><span>${x.ok?'✓':i+1}</span><div class="grow"><strong>${c.esc(x.title)}</strong><small>${c.esc(x.sub)}</small></div>${c.icon('chevron',16)}</button>`).join('')}</section>
 <section class="card"><div class="card-head"><h3>نوع النشاط</h3></div><p class="sub">اختيار النشاط يرتب الوحدات المقترحة بدون حذف بياناتك.</p><div class="business-types">${[['retail','تجزئة'],['wholesale','جملة'],['services','خدمات'],['fashion','أزياء'],['restaurant','مطعم/كافيه']].map(([k,n])=>`<button class="${type===k?'active':''}" data-business-type="${k}">${n}</button>`).join('')}</div><div class="notice">لن نحذف أو نغيّر بياناتك الحالية؛ فقط نحفظ نوع النشاط لتخصيص تجربة NovaBlu لاحقاً.</div></section></div>`;
}
function wireLaunch(c){
 document.querySelectorAll('[data-business-type]').forEach(b=>b.onclick=()=>{c.db.saas.onboarding.businessType=b.dataset.businessType;c.db.settings.businessType=b.dataset.businessType;c.save('تم حفظ نوع النشاط');c.render()});
}
function meter(label,value,max){const p=Math.min(100,Math.round(value/Math.max(max,1)*100));return`<div class="usage-meter"><div><span>${label}</span><strong>${value} / ${max}</strong></div><div class="progress"><i style="width:${p}%"></i></div></div>`}
function viewSubscription(c){
 const u=usage(c),p=plan(c),days=trialDaysLeft(c);
 return c.pageHead('الاشتراك والخطط','إدارة تجربة NovaBlu وحدود الاستخدام')+
 `<div class="subscription-head"><div><span class="eyebrow">CURRENT PLAN</span><h2>${c.esc(p.name)}</h2><p>${c.db.saas.plan==='trial'?days+' يوم متبقي بالتجربة':'الحالة: '+c.esc(c.db.saas.billingStatus)}</p></div><div class="subscription-state"><span class="status-dot ${c.db.saas.backend.connected?'online':'offline'}"></span><div><strong>${c.db.saas.backend.connected?'Cloud Connected':'Local Mode'}</strong><small>${c.db.saas.backend.connected?'المزامنة السحابية فعالة':'الربط السحابي لم يكتمل بعد'}</small></div></div></div>
 <div class="saas-grid2"><section class="card"><div class="card-head"><h3>الاستخدام الحالي</h3></div>${meter('المستخدمون',u.users,p.users)}${meter('الفروع',u.branches,p.branches)}${meter('أسئلة NovaBlu AI هذا الشهر',u.ai,p.ai)}<div class="statement-row"><span>المنتجات</span><strong>${u.products}</strong></div><div class="statement-row"><span>فواتير الشهر</span><strong>${u.invoices}</strong></div></section>
 <section class="card"><div class="card-head"><h3>جاهزية SaaS</h3></div><div class="readiness-row"><span>واجهة الاشتراك</span><b class="good-text">جاهزة</b></div><div class="readiness-row"><span>Usage Meter</span><b class="good-text">جاهز</b></div><div class="readiness-row"><span>Cloud Database</span><b class="${c.db.saas.backend.connected?'good-text':'warn-text'}">${c.db.saas.backend.connected?'متصل':'بانتظار الربط'}</b></div><div class="readiness-row"><span>الدفع التلقائي</span><b class="warn-text">بانتظار بوابة الدفع</b></div><div class="readiness-row"><span>Server-side Auth/RLS</span><b class="warn-text">بانتظار Backend</b></div></section></div>
 <div class="plan-grid">${Object.values(plans).filter(x=>x.id!=='trial').map(x=>`<article class="plan-card ${x.recommended?'recommended':''} ${c.db.saas.preferredPlan===x.id?'selected':''}">${x.recommended?'<span class="plan-ribbon">الأكثر توازناً</span>':''}<h3>${x.name}</h3><div class="plan-price">السعر <strong>يحدد قبل الإطلاق</strong></div><div class="plan-limits"><span>${x.users} مستخدم</span><span>${x.branches} فرع</span><span>${x.ai} AI / شهر</span></div><ul>${x.features.map(f=>`<li>✓ ${c.esc(f)}</li>`).join('')}</ul><button class="btn ${c.db.saas.preferredPlan===x.id?'green':'outline'}" data-plan="${x.id}">${c.db.saas.preferredPlan===x.id?'الخطة المختارة':'اختيار الخطة'}</button></article>`).join('')}</div>
 <div class="notice amber">اختيار الخطة حالياً يحفظ تفضيلك فقط. لا يتم خصم أي مبلغ أو تفعيل اشتراك مدفوع قبل ربط بوابة دفع وBackend حقيقي.</div>`;
}
function wireSubscription(c){document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{c.db.saas.preferredPlan=b.dataset.plan;c.audit('اختيار خطة مفضلة','Subscription',b.dataset.plan);c.save('تم اختيار '+plans[b.dataset.plan].name);c.render()})}
function viewAutomation(c){
 const base=NBADV.viewAutomation(c);
 return base+`<div class="card"><div class="card-head"><h3>NovaBlu Automation Recipes</h3><button class="btn primary" id="runSaaSRecipes">تشغيل الآن</button></div><div class="recipe-grid">${c.db.automationRecipes.map(r=>`<label class="recipe-card"><input type="checkbox" data-recipe="${r.id}" ${r.enabled?'checked':''}><div><strong>${c.esc(r.name)}</strong><small>${r.local?'يعمل محلياً عند فتح النظام / تشغيله يدوياً':'Cloud'}</small></div></label>`).join('')}</div><div class="notice">التشغيل الدقيق المجدول 24/7 يحتاج Backend. النسخة الحالية تشغل الوصفات محلياً داخل التطبيق.</div></div>`;
}
function runRecipes(c,manual=false){
 let hits=0;const enabled=t=>c.db.automationRecipes.some(r=>r.type===t&&r.enabled);
 if(enabled('daily_digest')){const key=c.today();if(manual||c.db.saas.lastDigestDate!==key){c.notify('ملخص اليوم',`مبيعات اليوم ${c.fmt(sales(c,todayInv(c)))} • مستحقات ${c.fmt(due(c))} • مخزون منخفض ${lowStock(c).length}`,'digest');c.db.saas.lastDigestDate=key;hits++}}
 if(enabled('low_stock_plus')&&lowStock(c).length){c.notify('مخزون يحتاج تدخل',lowStock(c).slice(0,4).map(p=>p.nameAr).join('، '),'stock');hits++}
 if(enabled('customer_due')&&due(c)>0){c.notify('متابعة الذمم','إجمالي مستحقات العملاء '+c.fmt(due(c)),'credit');hits++}
 const pa=(c.db.approvals||[]).filter(x=>x.status==='pending').length;if(enabled('pending_approval')&&pa){c.notify('موافقات معلقة',pa+' عملية تحتاج موافقة','approval');hits++}
 if(manual)c.toast(hits?'تم إنشاء '+hits+' تنبيه/ملخص':'لا توجد نتائج جديدة');c.save();return hits;
}
function wireAutomation(c){
 NBADV.wireAutomation(c);
 document.querySelectorAll('[data-recipe]').forEach(x=>x.onchange=()=>{const r=c.db.automationRecipes.find(v=>v.id===x.dataset.recipe);if(r)r.enabled=x.checked;c.save()});
 document.querySelector('#runSaaSRecipes')?.addEventListener('click',()=>{runRecipes(c,true);c.render()});
}
function viewIntegrations(c){
 const base=NBADV.viewIntegrations(c),b=c.db.saas.backend;
 return base+`<div class="card"><div class="card-head"><h3>جاهزية قنوات الاشتراك</h3></div><div class="integration-readiness"><div><span class="channel-icon">☁</span><strong>Cloud Sync</strong><small>${b.connected?'متصل':'Supabase غير مربوط بعد'}</small><span class="badge ${b.connected?'green':'gray'}">${b.connected?'Online':'Pending'}</span></div><div><span class="channel-icon">WA</span><strong>WhatsApp</strong><small>إرسال فواتير وتنبيهات بعد API</small><span class="badge gray">Backend</span></div><div><span class="channel-icon">TG</span><strong>Telegram</strong><small>تقارير وتنبيهات القنوات</small><span class="badge gray">Backend</span></div><div><span class="channel-icon">@</span><strong>Email</strong><small>فواتير وتقارير تلقائية</small><span class="badge gray">Backend</span></div></div></div>`;
}
function wireIntegrations(c){NBADV.wireIntegrations(c)}
function viewSupport(c){
 const connected=!!c.db.saas.backend.connected,tickets=c.db.supportTickets.slice(-10).reverse();
 const checks=[
  ['PWA / Service Worker',!!navigator.serviceWorker],
  ['IndexedDB','indexedDB' in window],
  ['Local database',!!c.db.meta&&Array.isArray(c.db.products)],
  ['Cloud Backend',connected],
  ['Backup tested',!!c.db.saas.lastBackupAt]
 ];
 return c.pageHead('مركز المساعدة','مساعدة، تشخيص، وتقارير دعم من داخل NovaBlu',`<button class="btn outline" id="supportBundle">تصدير تقرير دعم</button>`)+
 `<div class="saas-grid2"><section class="card"><div class="card-head"><h3>تشخيص سريع</h3></div>${checks.map(x=>`<div class="readiness-row"><span>${c.esc(x[0])}</span><b class="${x[1]?'good-text':'warn-text'}">${x[1]?'جاهز':'يحتاج إعداد'}</b></div>`).join('')}</section>
 <section class="card"><div class="card-head"><h3>What's New — 0.15</h3></div><div class="support-news"><p>Final Local Candidate 0.15 مع Pilot Day وFeature Freeze.</p><p>RC QA مع Stress Sandbox وفحوص الحالات الطرفية.</p><p>Health/Recovery Snapshots وSafe Mode.</p><p>Final UX مع رجوع ذكي وحفظ مكان الصفحة واختصارات.</p><p>Mobile/PWA وتحديثات وتثبيت كتطبيق.</p></div></section></div>
 <div class="saas-grid2"><section class="card"><div class="card-head"><h3>أسئلة سريعة</h3></div><details><summary>شلون أبدأ؟</summary><p>افتح مركز الانطلاق وكمل الخطوات من بيانات الشركة إلى أول فاتورة ونسخة احتياطية.</p></details><details><summary>بياناتي وين محفوظة حالياً؟</summary><p>حالياً محلياً على الجهاز مع IndexedDB/LocalStorage. المزامنة السحابية تظهر كمتصلة فقط بعد Backend فعلي.</p></details><details><summary>هل الاشتراك يسحب فلوس حالياً؟</summary><p>لا. صفحة الخطط حالياً مرحلة تجهيز ولا يوجد خصم أو Billing Provider مربوط.</p></details><details><summary>هل NovaBlu AI سحابي؟</summary><p>حالياً تحليل محلي لبيانات ERP. محرك AI السحابي يضاف عند ربط Backend وخدمة AI.</p></details></section>
 <section class="card"><div class="card-head"><h3>طلب دعم</h3></div><form id="supportForm"><div class="field"><label>العنوان</label><input name="title" required></div><div class="field"><label>التفاصيل</label><textarea name="body" rows="5" required></textarea></div><button class="btn primary">حفظ طلب الدعم محلياً</button></form><div class="sub" style="margin-top:8px">إرسال الطلب لفريق الدعم تلقائياً يتفعل بعد Cloud Backend.</div></section></div>
 <div class="card"><div class="card-head"><h3>آخر طلبات الدعم المحلية</h3><span class="badge gray">${tickets.length}</span></div>${tickets.map(t=>`<div class="stat-row"><div class="grow"><strong>${c.esc(t.title)}</strong><div class="sub">${new Date(t.createdAt).toLocaleString('ar-IQ')} • ${c.esc(t.status)}</div></div></div>`).join('')||'<div class="empty">لا توجد طلبات</div>'}</div>`;
}
function wireSupport(c){
 const f=document.querySelector('#supportForm');if(f)f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f);c.db.supportTickets.push({id:c.uid('ticket'),title:String(fd.get('title')||''),body:String(fd.get('body')||''),status:'local-draft',createdAt:c.now(),userId:c.currentUser().id});c.audit('طلب دعم محلي','Support',String(fd.get('title')||''));c.save('تم حفظ طلب الدعم');c.render()};
 document.querySelector('#supportBundle')?.addEventListener('click',()=>{const data={generatedAt:new Date().toISOString(),appVersion:'0.15',browser:navigator.userAgent,workspace:c.db.saas.workspaceId,company:{id:c.company()?.id,name:c.company()?.name},counts:{products:c.db.products.length,invoices:c.db.invoices.length,users:c.db.users.length,stockMoves:c.db.stockMoves.length},backend:c.db.saas.backend,qaRuns:(c.db.qaRuns||[]).slice(-3)};c.download('NovaBlu_Support_'+c.today()+'.json',data)})
}
function postRender(c,route){
 if(!['subscription','launch'].includes(route)){const a=document.querySelector('.page-head .actions');if(a&&!document.querySelector('.saas-plan-chip')){const b=document.createElement('button');b.className='btn outline saas-plan-chip';b.dataset.route='subscription';b.innerHTML='◈ '+c.esc(plan(c).name)+(c.db.saas.plan==='trial'?' • '+trialDaysLeft(c)+' يوم':'');a.appendChild(b);b.onclick=()=>{c.setRoute('subscription');c.render()}}}
 if(c.db.saas.lastDigestDate!==c.today()){runRecipes(c,false)}
}
function markBackup(c){c.db.saas.lastBackupAt=c.now();c.save()}
function init(c){migrate(c)}
window.NBSAAS={plans,migrate,init,usage,plan,trialDaysLeft,viewOwner,wireOwner,viewAssistant,wireAssistant,viewLaunch,wireLaunch,viewSubscription,wireSubscription,viewSupport,wireSupport,viewAutomation,wireAutomation,viewIntegrations,wireIntegrations,postRender,runRecipes,markBackup,assistantAnswer};
})();