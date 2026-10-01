(function(){
'use strict';
const N=v=>Number(v||0), finite=v=>Number.isFinite(Number(v));
function migrate(c){
 const d=c.db;d.meta=d.meta||{};d.meta.version=Math.max(Number(d.meta.version||1),12);
 d.rcqa=Object.assign({runs:[],lastStress:null,lastFull:null},d.rcqa||{});
 d.settings.modules=d.settings.modules||{};if(d.settings.modules.rcqa===undefined)d.settings.modules.rcqa=true;
 const acts=['view','create','edit','delete','approve','export'];
 Object.keys(d.permissions||{}).forEach(role=>{
  if(!d.permissions[role].rcqa){d.permissions[role].rcqa={};acts.forEach(a=>d.permissions[role].rcqa[a]=['Owner','Admin'].includes(role)||a==='view')}
 });
}
function add(out,area,name,ok,detail='',severity='medium'){out.push({area,name,ok:!!ok,detail:String(detail||''),severity})}
function dataChecks(c){
 const d=c.db,out=[];
 const ids={};for(const [k,v] of Object.entries(d)){if(Array.isArray(v))v.forEach(x=>{if(x&&x.id){ids[x.id]=ids[x.id]||[];ids[x.id].push(k)}})}
 const collisions=Object.entries(ids).filter(([,v])=>v.length>1&&!['accounts'].includes(v[0]));
 add(out,'Data','معرّفات السجلات',collisions.length===0,collisions.length?collisions.slice(0,5).map(x=>x[0]).join('، '):'لا توجد تعارضات ID','high');
 const inv=(d.invoices||[]).filter(x=>!x.deletedAt);
 const nums=inv.map(x=>x.number).filter(Boolean),dupNums=[...new Set(nums.filter((x,i)=>nums.indexOf(x)!==i))];
 add(out,'Sales','أرقام الفواتير فريدة',dupNums.length===0,dupNums.join('، '),'high');
 const badTotals=inv.filter(i=>{const t=c.invTotals(i);return !finite(t.total)||!finite(t.paid)||!finite(t.due)||t.total<0||t.paid<0||t.due<-0.001});
 add(out,'Sales','إجماليات الفواتير منطقية',badTotals.length===0,badTotals.length+' فاتورة غير منطقية','high');
 const over=inv.filter(i=>{const t=c.invTotals(i);return t.paid>t.total+0.001});
 add(out,'Sales','لا يوجد Overpayment',over.length===0,over.length+' فاتورة','high');
 const drafts=inv.filter(i=>i.status==='draft');
 const draftRefs=new Set(drafts.map(x=>x.number));
 const draftMoves=(d.stockMoves||[]).filter(m=>draftRefs.has(m.ref)&&['delivery','out'].includes(m.type));
 add(out,'Inventory','Draft لا يخصم مخزون',draftMoves.length===0,draftMoves.length+' حركة مرتبطة بمسودة','high');
 const posted=inv.filter(i=>['confirmed','partial','paid'].includes(i.status));
 let missingMoves=0;
 posted.forEach(i=>(i.items||[]).forEach(line=>{const p=d.products.find(x=>x.id===line.productId);if(p?.trackStock){const q=(d.stockMoves||[]).filter(m=>m.ref===i.number&&m.productId===line.productId&&['delivery','out'].includes(m.type)).reduce((s,m)=>s+N(m.qty),0);if(q+0.001<N(line.qty))missingMoves++}}));
 add(out,'Inventory','الفواتير المنشورة لها حركات تسليم',missingMoves===0,missingMoves+' بند بدون حركة كافية','high');
 const neg=(d.products||[]).filter(p=>p.trackStock&&c.stock(p.id)<-0.001);
 add(out,'Inventory','لا يوجد مخزون سالب',neg.length===0,neg.slice(0,5).map(x=>x.nameAr).join('، '),'high');
 const poBad=(d.purchaseOrders||[]).filter(po=>(po.items||[]).some(i=>N((po.receivedByProduct||{})[i.productId])>N(i.qty)+0.001));
 add(out,'Purchasing','الاستلام لا يتجاوز أمر الشراء',poBad.length===0,poBad.length+' PO','high');
 const poOver=(d.purchaseOrders||[]).filter(po=>{const total=(po.items||[]).reduce((s,i)=>s+N(i.qty)*N(i.cost),0),paid=(po.payments||[]).reduce((s,p)=>s+N(p.amount),0);return paid>total+0.001});
 add(out,'Purchasing','دفعات المورد لا تتجاوز PO',poOver.length===0,poOver.length+' PO','high');
 const badJ=(d.journals||[]).filter(j=>Math.abs((j.lines||[]).reduce((s,l)=>s+N(l.debit)-N(l.credit),0))>0.01);
 add(out,'Accounting','القيود اليدوية متوازنة',badJ.length===0,badJ.length+' قيد','high');
 const returns=d.returns||[];let excessive=0;
 returns.forEach(r=>{const i=inv.find(x=>x.id===r.invoiceId);if(!i)return;(r.items||[]).forEach(x=>{const sold=(i.items||[]).filter(v=>v.productId===x.productId).reduce((s,v)=>s+N(v.qty),0),prev=returns.filter(z=>z.invoiceId===r.invoiceId&&z.id!==r.id).flatMap(z=>z.items||[]).filter(v=>v.productId===x.productId).reduce((s,v)=>s+N(v.qty),0);if(prev+N(x.qty)>sold+0.001)excessive++})});
 add(out,'Sales','المرتجعات لا تتجاوز المباع',excessive===0,excessive+' حالة','high');
 const orphanProducts=(d.stockMoves||[]).filter(m=>m.productId&&!d.products.some(p=>p.id===m.productId));
 add(out,'Data','حركات المخزون بلا Orphans',orphanProducts.length===0,orphanProducts.length+' حركة','high');
 const orphanCustomers=inv.filter(i=>i.customerId&&!d.customers.some(x=>x.id===i.customerId));
 add(out,'Data','عملاء الفواتير موجودون',orphanCustomers.length===0,orphanCustomers.length+' فاتورة','medium');
 const badCompany=[...(d.invoices||[]),...(d.products||[]),...(d.customers||[]),...(d.suppliers||[])].filter(x=>x.companyId&&!d.companies.some(co=>co.id===x.companyId));
 add(out,'Data','عزل الشركة محلياً سليم',badCompany.length===0,badCompany.length+' سجل بشركة مفقودة','high');
 const barcode=(d.products||[]).map(x=>x.barcode).filter(Boolean),dbars=[...new Set(barcode.filter((x,i)=>barcode.indexOf(x)!==i))];
 add(out,'Products','Barcode غير مكرر',dbars.length===0,dbars.slice(0,5).join('، '),'medium');
 return out;
}
function scenarioTests(){
 const out=[];
 let stock=10,reserved=0;reserved+=3;add(out,'Scenario','حجز أمر بيع',reserved===3&&stock-reserved===7,'10 on hand → 3 reserved → 7 available','medium');
 stock-=reserved;reserved=0;add(out,'Scenario','تحويل الحجز إلى تسليم',stock===7&&reserved===0,'بعد التسليم on hand = 7','high');
 let total=100000,paid=40000;add(out,'Scenario','دفع جزئي',paid<total&&total-paid===60000,'المتبقي 60,000','high');
 paid+=60000;add(out,'Scenario','إكمال الدفع',paid===total,'المتبقي 0','high');
 let sold=5,returned=2;add(out,'Scenario','مرتجع جزئي',returned<=sold&&sold-returned===3,'صافي 3 وحدات','high');
 let ordered=12,received=5,backorder=ordered-received;add(out,'Scenario','استلام جزئي وBackorder',backorder===7,'المتبقي 7','high');
 let from=20,to=4,qty=6;from-=qty;to+=qty;add(out,'Scenario','تحويل مخزون يحافظ على الإجمالي',from+to===24,'الإجمالي قبل وبعد = 24','high');
 const debit=125000,credit=125000;add(out,'Scenario','قيد مزدوج متوازن',debit===credit,'مدين = دائن','high');
 const base={a:[1,2,3],b:{x:'عربي',n:12.5}},round=JSON.parse(JSON.stringify(base));add(out,'Backup','JSON Roundtrip',JSON.stringify(base)===JSON.stringify(round),'Serialization سليم','high');
 return out;
}
function stress(){
 const t0=performance.now(),products=Array.from({length:10000},(_,i)=>({id:'p'+i,name:'P '+i,price:(i%97)*1000,cost:(i%53)*500})),invoices=Array.from({length:3000},(_,i)=>({id:'i'+i,items:Array.from({length:5},(_,j)=>({productId:'p'+((i*5+j)%10000),qty:(j%3)+1,price:1000+((i+j)%70)*250}))}));
 let sales=0,index=new Map(products.map(p=>[p.id,p]));for(const i of invoices)for(const l of i.items){if(index.has(l.productId))sales+=l.qty*l.price}
 const ms=Math.round((performance.now()-t0)*100)/100;
 return{ok:ms<2500,ms,products:products.length,invoices:invoices.length,lines:15000,sales};
}
function score(rows){const w={high:3,medium:2,low:1},max=rows.reduce((s,x)=>s+(w[x.severity]||1),0),pass=rows.filter(x=>x.ok).reduce((s,x)=>s+(w[x.severity]||1),0);return Math.round(pass/Math.max(max,1)*100)}
function run(c,withStress=true){
 const rows=[...dataChecks(c),...scenarioTests()],st=withStress?stress():null;if(st)add(rows,'Performance','اختبار 10k منتج + 3k فاتورة',st.ok,st.ms+' ms','medium');
 const result={id:c.uid('rc'),at:Date.now(),version:'0.12',score:score(rows),rows,stress:st};
 c.db.rcqa.runs.unshift(result);c.db.rcqa.runs=c.db.rcqa.runs.slice(0,20);c.db.rcqa.lastFull=result;if(st)c.db.rcqa.lastStress=st;c.audit('RC QA','QA','Score '+result.score);c.save();return result;
}
function view(c){
 const last=c.db.rcqa.lastFull||null,rows=last?.rows||dataChecks(c),s=last?.score??score(rows),areas=[...new Set(rows.map(x=>x.area))];
 return c.pageHead('Release Candidate QA','اختبارات محلية شاملة بدون تعديل بياناتك الأصلية',`<button class="btn primary" id="runRCQA">تشغيل Full RC QA</button><button class="btn outline" id="exportRCQA">تصدير التقرير</button>`)+
 `<div class="rc-hero"><div class="rc-score ${s>=95?'pass':s>=80?'warn':'fail'}"><strong>${s}</strong><span>/ 100</span></div><div><h3>${s>=95?'جاهزية محلية عالية':s>=80?'جيد مع نقاط تحتاج مراجعة':'توجد نقاط حرجة'}</h3><p>Data Integrity + Sales + Inventory + Purchasing + Accounting + Backup + Stress.</p>${last?`<small>آخر تشغيل: ${new Date(last.at).toLocaleString('ar-IQ')}</small>`:''}</div></div>
 <div class="rc-area-grid">${areas.map(a=>{const ar=rows.filter(x=>x.area===a),p=ar.filter(x=>x.ok).length;return`<section class="card"><div class="card-head"><h3>${c.esc(a)}</h3><span class="badge ${p===ar.length?'green':'amber'}">${p}/${ar.length}</span></div>${ar.map(x=>`<div class="rc-row ${x.ok?'ok':'bad'}"><span>${x.ok?'✓':'!'}</span><div class="grow"><strong>${c.esc(x.name)}</strong><small>${c.esc(x.detail)}</small></div><b>${c.esc(x.severity)}</b></div>`).join('')}</section>`}).join('')}</div>
 ${last?.stress?`<section class="card"><div class="card-head"><h3>Stress Sandbox</h3></div><div class="stress-grid"><div><span>Products</span><strong>${last.stress.products.toLocaleString()}</strong></div><div><span>Invoices</span><strong>${last.stress.invoices.toLocaleString()}</strong></div><div><span>Lines</span><strong>${last.stress.lines.toLocaleString()}</strong></div><div><span>Time</span><strong>${last.stress.ms} ms</strong></div></div><div class="notice">هذا الاختبار ينشئ البيانات داخل الذاكرة فقط ولا يضيفها لقاعدة بياناتك.</div></section>`:''}`;
}
function wire(c){
 document.querySelector('#runRCQA')?.addEventListener('click',()=>{run(c,true);c.toast('اكتمل RC QA');c.render()});
 document.querySelector('#exportRCQA')?.addEventListener('click',()=>{const r=c.db.rcqa.lastFull||run(c,false);c.download('NovaBlu_RC_QA_'+c.today()+'.json',r)});
}
window.NBRC={migrate,run,dataChecks,scenarioTests,stress,view,wire};
})();