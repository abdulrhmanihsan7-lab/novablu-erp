
(function(){
'use strict';

function migrate(c){
  const d=c.db;
  d.meta=d.meta||{}; d.meta.version=Math.max(Number(d.meta.version||1),4);
  d.ui=d.ui||{};
  d.inventoryTransfers=d.inventoryTransfers||[];
  d.inventoryCounts=d.inventoryCounts||[];
  d.posSuspended=d.posSuspended||[];
  d.posShifts=d.posShifts||[];
  d.settings=d.settings||{};
  d.settings.defaultTax=Number(d.settings.defaultTax||0);
  d.settings.defaultPaymentTerms=d.settings.defaultPaymentTerms||'نقدي';
  d.settings.productImageMaxKB=Number(d.settings.productImageMaxKB||450);
  d.products=(d.products||[]).map(p=>Object.assign({image:'',brand:'',tags:'',variants:[],wholesalePrice:0,price6:0,price12:0,price24:0,minQty:1,location:''},p));
  d.customers=(d.customers||[]).map(x=>Object.assign({governorate:'',tags:'',creditLimit:0},x));
  d.suppliers=(d.suppliers||[]).map(x=>Object.assign({governorate:'',tags:'',creditLimit:0},x));
  d.purchaseOrders=(d.purchaseOrders||[]).map(p=>Object.assign({payments:[],receivedByProduct:{},supplierInvoice:'',dueDate:''},p));
  if(!d.accounts.some(a=>a.code==='1200'))d.accounts.push({id:'a7',code:'1200',name:'المخزون',type:'asset'});
  if(!d.accounts.some(a=>a.code==='2100'))d.accounts.push({id:'a8',code:'2100',name:'الضرائب المستحقة',type:'liability'});
}
function stockAt(c,productId,warehouseId){
  return c.db.stockMoves.filter(m=>m.companyId===c.db.session.companyId&&m.productId===productId&&m.warehouseId===warehouseId)
    .reduce((s,m)=>s+(['delivery','out','return_supplier'].includes(m.type)?-Number(m.qty||0):Number(m.qty||0)),0);
}
function productImage(c,p,size='md'){
  if(p.image)return `<img class="hyper-product-img ${size}" src="${c.esc(p.image)}" alt="${c.esc(p.nameAr||'')}">`;
  return `<div class="hyper-product-img placeholder ${size}">${c.icon('products',size==='lg'?30:22)}</div>`;
}
function productMargin(p){return Number(p.price||0)-Number(p.cost||0)}
function viewProducts(c){
  const ps=c.db.products.filter(p=>p.companyId===c.db.session.companyId);
  const active=ps.filter(p=>p.active),low=active.filter(p=>p.trackStock&&c.stock(p.id)<=Number(p.reorder||0));
  const value=active.reduce((s,p)=>s+(p.trackStock?Math.max(0,c.stock(p.id))*Number(p.cost||0):0),0);
  return c.pageHead('المنتجات','كتالوج شامل وتسعير ومخزون',`<button class="btn primary" data-q="product">${c.icon('plus',17)} منتج جديد</button>`)+
  `<div class="hyper-kpis"><div><span>المنتجات</span><strong>${ps.length}</strong></div><div><span>النشطة</span><strong>${active.length}</strong></div><div><span>منخفض المخزون</span><strong class="${low.length?'warn-text':''}">${low.length}</strong></div><div><span>قيمة المخزون</span><strong>${c.fmt(value)}</strong></div></div>
  <div class="hyper-toolbar"><div class="hyper-search">${c.icon('search',18)}<input id="prodSearch" placeholder="اسم، SKU، باركود، ماركة..."></div><select id="prodStockFilter"><option value="">كل المخزون</option><option value="low">منخفض</option><option value="out">نافذ</option><option value="ok">متوفر</option></select><button class="btn outline" id="exportProducts">${c.icon('data',17)} CSV</button></div>
  <div class="hyper-product-grid" id="prodBody">${ps.map(p=>productCard(c,p)).join('')||'<div class="card empty">لا توجد منتجات</div>'}</div>`;
}
function productCard(c,p){
  const q=p.trackStock?c.stock(p.id):null,low=p.trackStock&&q<=Number(p.reorder||0);
  const search=(p.nameAr+' '+(p.nameEn||'')+' '+(p.sku||'')+' '+(p.barcode||'')+' '+(p.brand||'')+' '+(p.tags||'')).toLowerCase();
  return `<article class="hyper-product-card" data-product-card data-row="${c.esc(search)}" data-stock="${!p.trackStock?'service':q<=0?'out':low?'low':'ok'}">
    <div class="product-visual">${productImage(c,p,'lg')}${low?`<span class="stock-flag ${q<=0?'red':'amber'}">${q<=0?'نافذ':'منخفض'}</span>`:''}</div>
    <div class="product-card-body"><div class="product-title-row"><div><strong>${c.esc(p.nameAr)}</strong><small>${c.esc(p.nameEn||p.brand||'')}</small></div><button class="mini-icon-btn" data-product="${p.id}" title="تعديل">${c.icon('sliders',17)}</button></div>
    <div class="product-tags"><span>${c.esc(p.sku||'بدون SKU')}</span>${p.barcode?`<span>${c.esc(p.barcode)}</span>`:''}</div>
    <div class="product-price-row"><div><small>البيع</small><strong>${c.fmt(p.price)}</strong></div><div><small>الهامش</small><strong>${c.fmt(productMargin(p))}</strong></div><div><small>المخزون</small><strong>${p.trackStock?q:'∞'}</strong></div></div>
    ${(p.variants||[]).length?`<div class="variant-chips">${p.variants.slice(0,4).map(v=>`<span>${c.esc(v)}</span>`).join('')}${p.variants.length>4?`<span>+${p.variants.length-4}</span>`:''}</div>`:''}
    </div></article>`;
}
function productForm(c,id){
  const p=id?c.db.products.find(x=>x.id===id):{id:'',nameAr:'',nameEn:'',image:'',brand:'',tags:'',sku:'',barcode:'',categoryId:'',unit:'قطعة',uoms:['قطعة'],cost:0,price:0,wholesalePrice:0,price6:0,price12:0,price24:0,tax:c.db.settings.defaultTax||0,trackStock:true,reorder:0,minQty:1,supplierId:'',location:'',variants:[],lotTracked:false,serialTracked:false,expiryTracked:false,active:true};
  return `<form id="productForm" data-id="${c.esc(p.id||'')}"><div class="product-form-head">${productImage(c,p,'lg')}<div class="grow"><h3>${p.id?'تعديل المنتج':'منتج جديد'}</h3><div class="sub">بيانات المنتج والتسعير والمخزون</div><input type="file" id="productImageFile" accept="image/*"><small class="sub">يفضل صورة خفيفة أقل من ${c.db.settings.productImageMaxKB||450}KB</small></div></div>
  <div class="form-grid">
    <div class="field"><label>الاسم العربي</label><input name="nameAr" value="${c.esc(p.nameAr)}" required></div><div class="field"><label>الاسم الإنجليزي</label><input name="nameEn" value="${c.esc(p.nameEn||'')}"></div>
    <div class="field"><label>الماركة</label><input name="brand" value="${c.esc(p.brand||'')}"></div><div class="field"><label>وسوم</label><input name="tags" value="${c.esc(p.tags||'')}" placeholder="مثال: جديد، فاخر"></div>
    <div class="field"><label>SKU</label><input name="sku" value="${c.esc(p.sku)}" required></div><div class="field"><label>الباركود</label><input name="barcode" value="${c.esc(p.barcode||'')}"></div>
    <div class="field"><label>القسم</label><select name="categoryId"><option value="">بدون قسم</option>${c.db.categories.map(x=>`<option value="${x.id}" ${x.id===p.categoryId?'selected':''}>${c.esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>الوحدة</label><input name="unit" value="${c.esc(p.unit||'قطعة')}"></div>
    <div class="field"><label>التكلفة</label><input type="number" step=".01" name="cost" min="0" value="${Number(p.cost||0)}"></div><div class="field"><label>سعر البيع</label><input type="number" step=".01" name="price" min="0" value="${Number(p.price||0)}"></div>
    <div class="field"><label>سعر جملة مفرد</label><input type="number" step=".01" name="wholesalePrice" min="0" value="${Number(p.wholesalePrice||0)}"></div><div class="field"><label>سعر 6 قطع</label><input type="number" step=".01" name="price6" min="0" value="${Number(p.price6||0)}"></div>
    <div class="field"><label>سعر 12 قطعة</label><input type="number" step=".01" name="price12" min="0" value="${Number(p.price12||0)}"></div><div class="field"><label>سعر 24 قطعة</label><input type="number" step=".01" name="price24" min="0" value="${Number(p.price24||0)}"></div>
    <div class="field"><label>الضريبة %</label><input type="number" step=".01" name="tax" min="0" max="100" value="${Number(p.tax||0)}"></div><div class="field"><label>الحد الأدنى للبيع</label><input type="number" step=".01" name="minQty" min=".01" value="${Number(p.minQty||1)}"></div>
    <div class="field"><label>حد إعادة الطلب</label><input type="number" name="reorder" min="0" value="${Number(p.reorder||0)}"></div><div class="field"><label>موقع الرف / التخزين</label><input name="location" value="${c.esc(p.location||'')}"></div>
    <div class="field"><label>المورد المفضل</label><select name="supplierId"><option value="">—</option>${c.db.suppliers.map(s=>`<option value="${s.id}" ${s.id===p.supplierId?'selected':''}>${c.esc(s.name)}</option>`).join('')}</select></div>
    <div class="field full"><label>المتغيرات</label><input name="variants" value="${c.esc((p.variants||[]).join(', '))}" placeholder="مثال: أسود، أبيض، M، L"></div>
    <div class="field full"><label>وحدات القياس</label><input name="uoms" value="${c.esc((p.uoms||[p.unit||'قطعة']).join(', '))}" placeholder="قطعة، كرتون، متر"></div>
    <div class="field"><label class="switch"><input type="checkbox" name="trackStock" ${p.trackStock?'checked':''}> تتبع المخزون</label></div>
    <div class="field"><label class="switch"><input type="checkbox" name="lotTracked" ${p.lotTracked?'checked':''}> تتبع Lot / Batch</label></div>
    <div class="field"><label class="switch"><input type="checkbox" name="serialTracked" ${p.serialTracked?'checked':''}> تتبع Serial</label></div>
    <div class="field"><label class="switch"><input type="checkbox" name="expiryTracked" ${p.expiryTracked?'checked':''}> تتبع الصلاحية</label></div>
    <div class="field"><label class="switch"><input type="checkbox" name="active" ${p.active?'checked':''}> نشط</label></div>
  </div><div class="toolbar" style="margin-top:16px"><button class="btn primary">${c.icon('check',17)} حفظ المنتج</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`;
}
async function imageToDataUrl(file,maxKB){
  if(!file)return '';
  if(file.size<=maxKB*1024)return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
  return await new Promise((res,rej)=>{
    const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const max=700,scale=Math.min(1,max/Math.max(img.width,img.height)),cv=document.createElement('canvas');cv.width=Math.round(img.width*scale);cv.height=Math.round(img.height*scale);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);res(cv.toDataURL('image/jpeg',.72))};img.onerror=rej;img.src=fr.result};fr.onerror=rej;fr.readAsDataURL(file);
  });
}
function wireProducts(c){
  const q=document.querySelector('#prodSearch'),sf=document.querySelector('#prodStockFilter');
  const filter=()=>document.querySelectorAll('[data-product-card]').forEach(x=>x.style.display=(x.dataset.row.includes((q?.value||'').toLowerCase())&&(!sf?.value||x.dataset.stock===sf.value))?'':'none');
  if(q)q.oninput=filter;if(sf)sf.onchange=filter;
  const ex=document.querySelector('#exportProducts');if(ex)ex.onclick=()=>c.csv('products-'+c.today()+'.csv',[['name_ar','name_en','brand','sku','barcode','cost','price','wholesale','price6','price12','price24','stock','reorder','location'],...c.db.products.map(p=>[p.nameAr,p.nameEn,p.brand,p.sku,p.barcode,p.cost,p.price,p.wholesalePrice,p.price6,p.price12,p.price24,p.trackStock?c.stock(p.id):'',p.reorder,p.location])]);
}
function wireProductForm(c){
  const f=document.querySelector('#productForm');if(!f)return;
  f.onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(f),id=f.dataset.id||c.uid('p'),old=c.db.products.find(x=>x.id===id)||{},file=document.querySelector('#productImageFile')?.files?.[0];
    let image=old.image||'';if(file)image=await imageToDataUrl(file,c.db.settings.productImageMaxKB||450);
    const p={id,companyId:c.db.session.companyId,nameAr:fd.get('nameAr'),nameEn:fd.get('nameEn'),image,brand:fd.get('brand'),tags:fd.get('tags'),sku:fd.get('sku'),barcode:fd.get('barcode'),categoryId:fd.get('categoryId'),unit:fd.get('unit'),cost:Number(fd.get('cost')||0),price:Number(fd.get('price')||0),wholesalePrice:Number(fd.get('wholesalePrice')||0),price6:Number(fd.get('price6')||0),price12:Number(fd.get('price12')||0),price24:Number(fd.get('price24')||0),tax:Number(fd.get('tax')||0),trackStock:fd.get('trackStock')==='on',reorder:Number(fd.get('reorder')||0),minQty:Number(fd.get('minQty')||1),supplierId:fd.get('supplierId'),location:fd.get('location'),variants:String(fd.get('variants')||'').split(',').map(x=>x.trim()).filter(Boolean),uoms:String(fd.get('uoms')||fd.get('unit')||'قطعة').split(',').map(x=>x.trim()).filter(Boolean),lotTracked:fd.get('lotTracked')==='on',serialTracked:fd.get('serialTracked')==='on',expiryTracked:fd.get('expiryTracked')==='on',active:fd.get('active')==='on'};
    const dupSku=c.db.products.find(x=>x.id!==id&&String(x.sku||'').trim()&&String(x.sku||'').trim().toLowerCase()===String(p.sku||'').trim().toLowerCase());if(dupSku){c.toast('SKU مستخدم مسبقاً: '+p.sku);return}
    const ix=c.db.products.findIndex(x=>x.id===id);const before=ix>=0?c.clone(c.db.products[ix]):null;if(ix>=0)c.db.products[ix]=p;else c.db.products.push(p);
    if(window.NBADV)NBADV.recordChange(c,'Product',id,before,p,ix>=0?'تعديل':'إنشاء');c.audit(ix>=0?'تعديل منتج':'إنشاء منتج','Product',p.nameAr);c.save('تم حفظ المنتج');c.closeModal();c.render();
  };
}

function customerMetrics(c,x){
  const inv=c.db.invoices.filter(i=>i.customerId===x.id&&!i.deletedAt&&!['cancelled','returned'].includes(i.status));
  const total=inv.reduce((s,i)=>s+c.invTotals(i).total,0),paid=inv.reduce((s,i)=>s+c.invTotals(i).paid,0);
  return {inv,total,paid,due:Math.max(0,total-paid),last:inv.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0]};
}
function supplierMetrics(c,x){
  const po=c.db.purchaseOrders.filter(p=>p.supplierId===x.id&&!['cancelled'].includes(p.status));
  const total=po.reduce((s,p)=>s+p.items.reduce((z,i)=>z+Number(i.qty||0)*Number(i.cost||0),0),0),paid=po.reduce((s,p)=>s+(p.payments||[]).reduce((z,v)=>z+Number(v.amount||0),0),0);
  return {po,total,paid,due:Math.max(0,total-paid)};
}
function viewContacts(c,kind){
  const customer=kind==='customers',arr=(customer?c.db.customers:c.db.suppliers).filter(x=>x.companyId===c.db.session.companyId);
  return c.pageHead(customer?'العملاء':'الموردون',customer?'ملفات العملاء والمشتريات والذمم':'ملفات الموردين والمشتريات والذمم',`<button class="btn primary" data-q="${customer?'customer':'supplier'}">${c.icon('plus',17)} ${customer?'عميل':'مورد'}</button>`)+
  `<div class="hyper-toolbar"><div class="hyper-search">${c.icon('search',18)}<input id="contactSearch" placeholder="بحث بالاسم أو الهاتف أو البريد..."></div>${customer?'<select id="contactDebtFilter"><option value="">كل العملاء</option><option value="due">عليه مستحقات</option><option value="clear">مسدد</option></select>':''}</div>
  <div class="contact-card-grid" id="contactBody">${arr.map(x=>contactCard(c,x,kind)).join('')||'<div class="card empty">لا توجد سجلات</div>'}</div>`;
}
function contactCard(c,x,kind){
  const customer=kind==='customers',m=customer?customerMetrics(c,x):supplierMetrics(c,x),search=(x.name+' '+(x.phone||'')+' '+(x.email||'')+' '+(x.governorate||'')+' '+(x.tags||'')).toLowerCase();
  return `<article class="contact-profile-card" data-contact-card data-row="${c.esc(search)}" data-debt="${m.due>0?'due':'clear'}">
    <div class="contact-avatar">${c.esc((x.name||'?').trim().slice(0,2))}</div><div class="grow"><div class="contact-name"><strong>${c.esc(x.name)}</strong>${x.tags?`<span>${c.esc(x.tags.split(',')[0])}</span>`:''}</div><div class="sub">${c.esc(x.phone||'بدون هاتف')} • ${c.esc(x.governorate||x.address||'')}</div></div>
    <div class="contact-money"><span>${customer?'إجمالي الشراء':'إجمالي الشراء من المورد'}</span><strong>${c.fmt(m.total)}</strong><small class="${m.due>0?'warn-text':''}">${m.due>0?'مستحق '+c.fmt(m.due):'لا توجد مستحقات'}</small></div>
    <div class="contact-actions"><button class="btn sm outline" data-contact-profile="${x.id}" data-kind="${kind}">${c.icon('file',15)} الملف</button><button class="btn sm" data-contact="${x.id}" data-kind="${kind}">${c.icon('sliders',15)} تعديل</button></div>
  </article>`;
}
function contactForm(c,kind,id){
  const arr=kind==='customers'?c.db.customers:c.db.suppliers,x=id?arr.find(v=>v.id===id):{id:'',name:'',phone:'',email:'',governorate:'',address:'',taxId:'',notes:'',terms:'',tags:'',creditLimit:0};
  return `<form id="contactForm" data-kind="${kind}" data-id="${c.esc(x.id||'')}"><div class="form-grid">
    <div class="field"><label>الاسم</label><input name="name" value="${c.esc(x.name)}" required></div><div class="field"><label>الهاتف</label><input name="phone" inputmode="tel" value="${c.esc(x.phone||'')}"></div>
    <div class="field"><label>البريد</label><input name="email" type="email" value="${c.esc(x.email||'')}"></div><div class="field"><label>المحافظة / المدينة</label><input name="governorate" value="${c.esc(x.governorate||'')}"></div>
    <div class="field full"><label>العنوان</label><input name="address" value="${c.esc(x.address||'')}"></div><div class="field"><label>الرقم الضريبي</label><input name="taxId" value="${c.esc(x.taxId||'')}"></div>
    <div class="field"><label>وسوم</label><input name="tags" value="${c.esc(x.tags||'')}" placeholder="VIP، جملة، متابعة"></div><div class="field"><label>حد ائتماني</label><input type="number" name="creditLimit" min="0" value="${Number(x.creditLimit||0)}"></div>
    ${kind==='suppliers'?`<div class="field"><label>شروط الدفع</label><input name="terms" value="${c.esc(x.terms||'')}"></div>`:''}
    <div class="field full"><label>ملاحظات</label><textarea name="notes">${c.esc(x.notes||'')}</textarea></div>
  </div><div class="toolbar" style="margin-top:16px"><button class="btn primary">${c.icon('check',17)} حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`;
}
function showContactProfile(c,id,kind){
  const arr=kind==='customers'?c.db.customers:c.db.suppliers,x=arr.find(v=>v.id===id);if(!x)return;
  const customer=kind==='customers',m=customer?customerMetrics(c,x):supplierMetrics(c,x);
  const history=customer?m.inv.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,20).map(i=>{const t=c.invTotals(i);return `<div class="profile-history-row"><div><strong>${c.esc(i.number)}</strong><small>${c.esc(i.date)}</small></div><strong>${c.fmt(t.total)}</strong>${c.statusBadge(i.status)}</div>`}).join(''):m.po.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,20).map(p=>`<div class="profile-history-row"><div><strong>${c.esc(p.number)}</strong><small>${c.esc(p.date)}</small></div><strong>${c.fmt(p.items.reduce((s,i)=>s+i.qty*i.cost,0))}</strong>${c.statusBadge(p.status)}</div>`).join('');
  c.openModal(customer?'ملف العميل':'ملف المورد',`<div class="contact-profile-head"><div class="contact-avatar big">${c.esc((x.name||'?').trim().slice(0,2))}</div><div class="grow"><h2>${c.esc(x.name)}</h2><div class="sub">${c.esc(x.phone||'')} • ${c.esc(x.email||'')}</div><div class="sub">${c.esc([x.governorate,x.address].filter(Boolean).join(' • '))}</div></div></div>
    <div class="hyper-kpis profile-kpis"><div><span>الإجمالي</span><strong>${c.fmt(m.total)}</strong></div><div><span>المدفوع</span><strong>${c.fmt(m.paid)}</strong></div><div><span>المستحق</span><strong class="${m.due?'warn-text':''}">${c.fmt(m.due)}</strong></div><div><span>${customer?'الفواتير':'أوامر الشراء'}</span><strong>${customer?m.inv.length:m.po.length}</strong></div></div>
    <div class="card inner-card"><div class="card-head"><h3>السجل</h3></div>${history||'<div class="empty">لا يوجد سجل</div>'}</div>
    ${x.notes?`<div class="notice">${c.esc(x.notes)}</div>`:''}<div class="toolbar"><button class="btn primary" data-contact="${x.id}" data-kind="${kind}">${c.icon('sliders',16)} تعديل</button>${customer?`<button class="btn outline" data-new-customer-invoice="${x.id}">${c.icon('sales',16)} فاتورة جديدة</button>`:''}<button class="btn" data-close>إغلاق</button></div>`,true);
  setTimeout(()=>{
    document.querySelectorAll('[data-contact]').forEach(b=>b.onclick=()=>{c.closeModal();c.quick(b.dataset.kind==='customers'?'customer':'supplier',b.dataset.contact)});
    const ni=document.querySelector('[data-new-customer-invoice]');if(ni)ni.onclick=()=>{c.closeModal();c.quick('invoice');setTimeout(()=>{const sel=document.querySelector('#invoiceCustomer');if(sel){sel.value=ni.dataset.newCustomerInvoice;sel.dispatchEvent(new Event('change'))}},50)};
  },0);
}
function wireContacts(c,kind){
  const q=document.querySelector('#contactSearch'),df=document.querySelector('#contactDebtFilter');
  const filter=()=>document.querySelectorAll('[data-contact-card]').forEach(x=>x.style.display=(x.dataset.row.includes((q?.value||'').toLowerCase())&&(!df?.value||x.dataset.debt===df.value))?'':'none');
  if(q)q.oninput=filter;if(df)df.onchange=filter;
  document.querySelectorAll('[data-contact-profile]').forEach(b=>b.onclick=()=>showContactProfile(c,b.dataset.contactProfile,b.dataset.kind));
}
function wireContactForm(c){
  const f=document.querySelector('#contactForm');if(!f)return;
  f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f),kind=f.dataset.kind,arr=kind==='customers'?c.db.customers:c.db.suppliers,id=f.dataset.id||c.uid(kind==='customers'?'c':'s'),old=arr.find(x=>x.id===id)||{};
    const obj={id,companyId:c.db.session.companyId,name:fd.get('name'),phone:fd.get('phone'),email:fd.get('email'),governorate:fd.get('governorate'),address:fd.get('address'),taxId:fd.get('taxId'),notes:fd.get('notes'),terms:fd.get('terms')||'',tags:fd.get('tags'),creditLimit:Number(fd.get('creditLimit')||0),createdAt:old.createdAt||c.now()};
    const ix=arr.findIndex(x=>x.id===id);if(ix>=0)arr[ix]=obj;else arr.push(obj);c.audit(ix>=0?'تعديل جهة اتصال':'إنشاء جهة اتصال',kind,obj.name);c.save('تم الحفظ');c.closeModal();c.render();
  };
}

function viewInventory(c){
  const ws=c.db.warehouses.filter(w=>w.companyId===c.db.session.companyId),wid=c.db.ui.inventoryWarehouseId||c.warehouse()?.id||ws[0]?.id;c.db.ui.inventoryWarehouseId=wid;
  const ps=c.db.products.filter(p=>p.companyId===c.db.session.companyId&&p.trackStock),low=ps.filter(p=>stockAt(c,p.id,wid)<=Number(p.reorder||0)),value=ps.reduce((s,p)=>s+Math.max(0,stockAt(c,p.id,wid))*Number(p.cost||0),0);
  return c.pageHead('المخزون','تحويلات وجرد وتتبع متعدد المخازن',`<button class="btn primary" id="newStockMove">${c.icon('plus',17)} حركة</button>`)+
  `<div class="hyper-toolbar"><select id="inventoryWarehouse">${ws.map(w=>`<option value="${w.id}" ${w.id===wid?'selected':''}>${c.esc(w.name)}</option>`).join('')}</select><button class="btn outline" id="newTransfer">${c.icon('arrowdown',16)} تحويل مخزون</button><button class="btn outline" id="newCount">${c.icon('check',16)} جرد وتسوية</button></div>
  <div class="hyper-kpis"><div><span>منتجات متتبعة</span><strong>${ps.length}</strong></div><div><span>منخفض</span><strong class="${low.length?'warn-text':''}">${low.length}</strong></div><div><span>قيمة المخزون</span><strong>${c.fmt(value)}</strong></div><div><span>حركات اليوم</span><strong>${c.db.stockMoves.filter(m=>m.date===c.today()&&m.warehouseId===wid).length}</strong></div></div>
  <div class="card responsive-table"><div class="card-head"><h3>أرصدة ${c.esc(ws.find(w=>w.id===wid)?.name||'')}</h3></div><div class="table-wrap"><table><thead><tr><th>المنتج</th><th>SKU</th><th>الموقع</th><th>المتاح</th><th>حد الطلب</th><th>القيمة</th><th>الحالة</th><th>سجل</th></tr></thead><tbody>${ps.map(p=>{const q=stockAt(c,p.id,wid);return `<tr><td data-label="المنتج"><strong>${c.esc(p.nameAr)}</strong></td><td data-label="SKU">${c.esc(p.sku)}</td><td data-label="الموقع">${c.esc(p.location||'—')}</td><td data-label="المتاح"><strong>${q}</strong></td><td data-label="حد الطلب">${p.reorder}</td><td data-label="القيمة">${c.fmt(q*p.cost)}</td><td data-label="الحالة">${q<=0?'<span class="badge red">نافذ</span>':q<=p.reorder?'<span class="badge amber">منخفض</span>':'<span class="badge green">جيد</span>'}</td><td data-label="سجل"><button class="btn sm" data-stock-ledger="${p.id}">فتح</button></td></tr>`}).join('')}</tbody></table></div></div>
  <div class="grid cards2"><div class="card"><div class="card-head"><h3>آخر التحويلات</h3></div>${c.db.inventoryTransfers.slice().reverse().slice(0,8).map(t=>`<div class="stat-row"><div class="grow"><strong>${c.esc(c.db.products.find(p=>p.id===t.productId)?.nameAr||'')}</strong><div class="sub">${c.esc(c.db.warehouses.find(w=>w.id===t.from)?.name||'')} → ${c.esc(c.db.warehouses.find(w=>w.id===t.to)?.name||'')} • ${t.date}</div></div><strong>${t.qty}</strong></div>`).join('')||'<div class="empty">لا توجد تحويلات</div>'}</div><div class="card"><div class="card-head"><h3>آخر عمليات الجرد</h3></div>${c.db.inventoryCounts.slice().reverse().slice(0,8).map(t=>`<div class="stat-row"><div class="grow"><strong>${c.esc(c.db.products.find(p=>p.id===t.productId)?.nameAr||'')}</strong><div class="sub">${t.date} • فرق ${t.diff}</div></div><strong>${t.actual}</strong></div>`).join('')||'<div class="empty">لا توجد عمليات جرد</div>'}</div></div>`;
}
function stockMoveForm(c){
  return `<form id="hyperStockMoveForm"><div class="form-grid"><div class="field"><label>المخزن</label><select name="warehouseId">${c.db.warehouses.filter(w=>w.companyId===c.db.session.companyId).map(w=>`<option value="${w.id}">${c.esc(w.name)}</option>`).join('')}</select></div><div class="field"><label>المنتج</label><select name="productId">${c.db.products.filter(p=>p.trackStock&&p.active).map(p=>`<option value="${p.id}">${c.esc(p.nameAr)}</option>`).join('')}</select></div><div class="field"><label>النوع</label><select name="type"><option value="receipt">إدخال / استلام</option><option value="out">إخراج</option><option value="return">مرتجع عميل</option><option value="return_supplier">مرتجع مورد</option></select></div><div class="field"><label>الكمية</label><input name="qty" type="number" min=".01" step=".01" required></div><div class="field"><label>التاريخ</label><input name="date" type="date" value="${c.today()}"></div><div class="field"><label>المرجع</label><input name="ref"></div><div class="field full"><label>ملاحظة</label><input name="note"></div></div><div class="toolbar"><button class="btn primary">تسجيل</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`;
}
function transferForm(c){
  const ws=c.db.warehouses.filter(w=>w.companyId===c.db.session.companyId);
  return `<form id="transferForm"><div class="form-grid"><div class="field"><label>من مخزن</label><select name="from">${ws.map(w=>`<option value="${w.id}">${c.esc(w.name)}</option>`).join('')}</select></div><div class="field"><label>إلى مخزن</label><select name="to">${ws.map(w=>`<option value="${w.id}">${c.esc(w.name)}</option>`).join('')}</select></div><div class="field"><label>المنتج</label><select name="productId">${c.db.products.filter(p=>p.trackStock&&p.active).map(p=>`<option value="${p.id}">${c.esc(p.nameAr)}</option>`).join('')}</select></div><div class="field"><label>الكمية</label><input name="qty" type="number" min=".01" step=".01" required></div><div class="field"><label>التاريخ</label><input name="date" type="date" value="${c.today()}"></div><div class="field full"><label>ملاحظة</label><input name="note"></div></div><div class="toolbar"><button class="btn primary">تنفيذ التحويل</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`;
}
function countForm(c){
  return `<form id="countForm"><div class="form-grid"><div class="field"><label>المخزن</label><select name="warehouseId">${c.db.warehouses.filter(w=>w.companyId===c.db.session.companyId).map(w=>`<option value="${w.id}">${c.esc(w.name)}</option>`).join('')}</select></div><div class="field"><label>المنتج</label><select name="productId">${c.db.products.filter(p=>p.trackStock&&p.active).map(p=>`<option value="${p.id}">${c.esc(p.nameAr)}</option>`).join('')}</select></div><div class="field"><label>الكمية الفعلية</label><input name="actual" type="number" min="0" step=".01" required></div><div class="field"><label>التاريخ</label><input name="date" type="date" value="${c.today()}"></div><div class="field full"><label>ملاحظة</label><input name="note" value="جرد فعلي"></div></div><div class="toolbar"><button class="btn primary">تسوية المخزون</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`;
}
function stockLedger(c,pid,wid){
  const p=c.db.products.find(x=>x.id===pid),moves=c.db.stockMoves.filter(m=>m.productId===pid&&(!wid||m.warehouseId===wid)).slice().reverse().slice(0,100);
  c.openModal('سجل حركة '+(p?.nameAr||''),`<div class="card responsive-table inner-card"><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المخزن</th><th>النوع</th><th>الكمية</th><th>المرجع</th><th>ملاحظة</th></tr></thead><tbody>${moves.map(m=>`<tr><td>${m.date}</td><td>${c.esc(c.db.warehouses.find(w=>w.id===m.warehouseId)?.name||'')}</td><td>${c.esc(m.type)}</td><td>${m.qty}</td><td>${c.esc(m.ref||'')}</td><td>${c.esc(m.note||'')}</td></tr>`).join('')}</tbody></table></div></div><div class="toolbar"><button class="btn" data-close>إغلاق</button></div>`,true);
}
function wireInventory(c){
  const wh=document.querySelector('#inventoryWarehouse');if(wh)wh.onchange=()=>{c.db.ui.inventoryWarehouseId=wh.value;c.save();c.render()};
  const sm=document.querySelector('#newStockMove');if(sm)sm.onclick=()=>{c.openModal('حركة مخزون',stockMoveForm(c),false);setTimeout(()=>wireStockMoveForm(c),0)};
  const tr=document.querySelector('#newTransfer');if(tr)tr.onclick=()=>{c.openModal('تحويل بين المخازن',transferForm(c),false);setTimeout(()=>wireTransferForm(c),0)};
  const ct=document.querySelector('#newCount');if(ct)ct.onclick=()=>{c.openModal('جرد وتسوية',countForm(c),false);setTimeout(()=>wireCountForm(c),0)};
  document.querySelectorAll('[data-stock-ledger]').forEach(b=>b.onclick=()=>stockLedger(c,b.dataset.stockLedger,c.db.ui.inventoryWarehouseId));
}
function wireStockMoveForm(c){
  const f=document.querySelector('#hyperStockMoveForm');if(!f)return;f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f),wid=fd.get('warehouseId'),pid=fd.get('productId'),type=fd.get('type'),qty=Number(fd.get('qty')||0);
    if(c.db.settings.preventNegativeStock&&['out','return_supplier'].includes(type)&&stockAt(c,pid,wid)<qty){c.toast('الكمية غير متوفرة في هذا المخزن');return}
    c.db.stockMoves.push({id:c.uid('sm'),companyId:c.db.session.companyId,warehouseId:wid,productId:pid,type:type==='return'?'receipt':type,qty,date:fd.get('date'),ref:fd.get('ref'),note:fd.get('note')});c.audit('حركة مخزون','Stock',`${pid} ${type} ${qty}`);c.save('تم تسجيل الحركة');c.closeModal();c.render();
  };
}
function wireTransferForm(c){
  const f=document.querySelector('#transferForm');if(!f)return;f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f),from=fd.get('from'),to=fd.get('to'),pid=fd.get('productId'),qty=Number(fd.get('qty')||0),date=fd.get('date');
    if(from===to){c.toast('اختر مخزنين مختلفين');return}if(stockAt(c,pid,from)<qty){c.toast('الكمية غير متوفرة في مخزن المصدر');return}
    const ref='TR-'+String(c.db.inventoryTransfers.length+1).padStart(4,'0');c.db.stockMoves.push({id:c.uid('sm'),companyId:c.db.session.companyId,warehouseId:from,productId:pid,type:'out',qty,date,ref,note:'تحويل إلى '+(c.db.warehouses.find(w=>w.id===to)?.name||'')},{id:c.uid('sm'),companyId:c.db.session.companyId,warehouseId:to,productId:pid,type:'receipt',qty,date,ref,note:'تحويل من '+(c.db.warehouses.find(w=>w.id===from)?.name||'')});c.db.inventoryTransfers.push({id:c.uid('trf'),companyId:c.db.session.companyId,from,to,productId:pid,qty,date,note:fd.get('note'),ref,createdAt:c.now()});c.audit('تحويل مخزون','Stock',ref);c.save('تم التحويل');c.closeModal();c.render();
  };
}
function wireCountForm(c){
  const f=document.querySelector('#countForm');if(!f)return;f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f),wid=fd.get('warehouseId'),pid=fd.get('productId'),actual=Number(fd.get('actual')||0),before=stockAt(c,pid,wid),diff=actual-before,date=fd.get('date');
    if(diff!==0)c.db.stockMoves.push({id:c.uid('sm'),companyId:c.db.session.companyId,warehouseId:wid,productId:pid,type:diff>0?'receipt':'out',qty:Math.abs(diff),date,ref:'COUNT',note:fd.get('note')||'جرد فعلي'});
    c.db.inventoryCounts.push({id:c.uid('cnt'),companyId:c.db.session.companyId,warehouseId:wid,productId:pid,before,actual,diff,date,note:fd.get('note'),createdAt:c.now()});c.audit('جرد مخزون','Stock',`${pid}: ${before}→${actual}`);c.save('تمت التسوية');c.closeModal();c.render();
  };
}

function poTotal(po){return (po.items||[]).reduce((s,x)=>s+Number(x.qty||0)*Number(x.cost||0),0)}
function poPaid(po){return (po.payments||[]).reduce((s,x)=>s+Number(x.amount||0),0)}
function poReceivedQty(po,pid){return Number((po.receivedByProduct||{})[pid]||0)}
function viewPurchasing(c){
  const arr=c.db.purchaseOrders.filter(p=>p.companyId===c.db.session.companyId).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)),open=arr.filter(p=>!['closed','cancelled'].includes(p.status)),total=arr.reduce((s,p)=>s+poTotal(p),0),due=arr.reduce((s,p)=>s+Math.max(0,poTotal(p)-poPaid(p)),0);
  return c.pageHead('المشتريات','أوامر شراء واستلام وذمم الموردين',`<button class="btn primary" data-q="purchase">${c.icon('plus',17)} أمر شراء</button>`)+
  `<div class="hyper-kpis"><div><span>أوامر الشراء</span><strong>${arr.length}</strong></div><div><span>المفتوحة</span><strong>${open.length}</strong></div><div><span>إجمالي المشتريات</span><strong>${c.fmt(total)}</strong></div><div><span>ذمم الموردين</span><strong class="${due?'warn-text':''}">${c.fmt(due)}</strong></div></div>
  <div class="purchase-grid">${arr.map(p=>purchaseCard(c,p)).join('')||'<div class="card empty">لا توجد أوامر شراء</div>'}</div>`;
}
function purchaseCard(c,p){
  const s=c.db.suppliers.find(x=>x.id===p.supplierId),total=poTotal(p),paid=poPaid(p),due=Math.max(0,total-paid),ordered=(p.items||[]).reduce((z,x)=>z+Number(x.qty||0),0),received=Object.values(p.receivedByProduct||{}).reduce((z,x)=>z+Number(x||0),0)||(p.receivedQty||0);
  return `<article class="purchase-card"><div class="purchase-head"><div><strong>${c.esc(p.number)}</strong><small>${c.esc(p.date)} • ${c.esc(s?.name||'بدون مورد')}</small></div>${c.statusBadge(p.status)}</div><div class="purchase-stats"><div><span>القيمة</span><strong>${c.fmt(total)}</strong></div><div><span>المستلم</span><strong>${received}/${ordered}</strong></div><div><span>المدفوع</span><strong>${c.fmt(paid)}</strong></div><div><span>المتبقي</span><strong class="${due?'warn-text':''}">${c.fmt(due)}</strong></div></div><div class="purchase-actions"><button class="btn sm" data-po="${p.id}">فتح</button>${p.status!=='cancelled'&&received<ordered?`<button class="btn sm outline" data-receive-po="${p.id}">استلام</button>`:''}${due>0&&p.status!=='cancelled'?`<button class="btn sm outline" data-pay-po="${p.id}">دفعة</button>`:''}</div></article>`;
}
function poForm(c,id){
  const p=id?c.db.purchaseOrders.find(x=>x.id===id):{id:'',number:'PO-'+String(c.db.purchaseOrders.length+1).padStart(4,'0'),date:c.today(),supplierId:'',status:'draft',warehouseId:c.warehouse()?.id||'',items:[{productId:'',qty:1,cost:0}],notes:'',receivedQty:0,payments:[],receivedByProduct:{},supplierInvoice:'',dueDate:''};
  return `<form id="poForm" data-id="${c.esc(p.id||'')}"><div class="form-grid"><div class="field"><label>الرقم</label><input name="number" value="${c.esc(p.number)}"></div><div class="field"><label>التاريخ</label><input name="date" type="date" value="${c.esc(p.date)}"></div><div class="field"><label>المورد</label><select name="supplierId" required><option value="">اختر</option>${c.db.suppliers.map(s=>`<option value="${s.id}" ${s.id===p.supplierId?'selected':''}>${c.esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>المخزن</label><select name="warehouseId">${c.db.warehouses.filter(w=>w.companyId===c.db.session.companyId).map(w=>`<option value="${w.id}" ${w.id===p.warehouseId?'selected':''}>${c.esc(w.name)}</option>`).join('')}</select></div><div class="field"><label>فاتورة المورد</label><input name="supplierInvoice" value="${c.esc(p.supplierInvoice||'')}"></div><div class="field"><label>تاريخ الاستحقاق</label><input name="dueDate" type="date" value="${c.esc(p.dueDate||'')}"></div><div class="field"><label>الحالة</label><select name="status">${['draft','sent','pending','approved','received','closed','cancelled'].map(s=>`<option value="${s}" ${s===p.status?'selected':''}>${s}</option>`).join('')}</select></div></div>
  <div class="card inner-card" style="margin-top:12px"><div class="card-head"><h3>الأصناف</h3><div class="grow"></div><button type="button" class="btn sm" id="addPOLine">${c.icon('plus',15)} سطر</button></div><div class="table-wrap"><table><thead><tr><th>المنتج</th><th>الكمية</th><th>التكلفة</th><th>مستلم</th><th></th></tr></thead><tbody id="poLines">${p.items.map((x,n)=>poLine(c,x,n,p)).join('')}</tbody></table></div></div><div class="field"><label>ملاحظات</label><textarea name="notes">${c.esc(p.notes||'')}</textarea></div><div class="toolbar" style="margin-top:15px"><button class="btn primary">حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`;
}
function poLine(c,x,n,p){return `<tr><td><select class="po-product" required><option value="">اختر</option>${c.db.products.filter(v=>v.trackStock).map(v=>`<option value="${v.id}" ${v.id===x.productId?'selected':''}>${c.esc(v.nameAr)}</option>`).join('')}</select></td><td><input class="po-qty" type="number" min=".01" step=".01" value="${Number(x.qty||1)}"></td><td><input class="po-cost" type="number" min="0" step=".01" value="${Number(x.cost||0)}"></td><td>${poReceivedQty(p,x.productId)}</td><td><button type="button" class="btn red sm remove-po-line">×</button></td></tr>`}
function receivePOForm(c,p){
  return `<form id="receivePOForm" data-id="${p.id}"><div class="table-wrap"><table><thead><tr><th>المنتج</th><th>مطلوب</th><th>مستلم</th><th>استلام الآن</th></tr></thead><tbody>${p.items.map(x=>{const got=poReceivedQty(p,x.productId),remain=Math.max(0,Number(x.qty)-got);return `<tr data-pid="${x.productId}"><td>${c.esc(c.db.products.find(v=>v.id===x.productId)?.nameAr||'')}</td><td>${x.qty}</td><td>${got}</td><td><input class="receive-now" type="number" min="0" max="${remain}" step=".01" value="${remain}"></td></tr>`}).join('')}</tbody></table></div><div class="field"><label>تاريخ الاستلام</label><input name="date" type="date" value="${c.today()}"></div><div class="toolbar"><button class="btn primary">تأكيد الاستلام</button><button type="button" class="btn" data-close>إلغاء</button></div></form>`;
}
function wirePurchasing(c){
  document.querySelectorAll('[data-receive-po]').forEach(b=>b.onclick=()=>{const p=c.db.purchaseOrders.find(x=>x.id===b.dataset.receivePo);c.openModal('استلام أمر '+p.number,receivePOForm(c,p),false);setTimeout(()=>wireReceivePO(c),0)});
  document.querySelectorAll('[data-pay-po]').forEach(b=>b.onclick=()=>payPO(c,b.dataset.payPo));
}
function wirePOForm(c){
  const f=document.querySelector('#poForm');if(!f)return;
  const add=document.querySelector('#addPOLine');if(add)add.onclick=()=>{document.querySelector('#poLines').insertAdjacentHTML('beforeend',poLine(c,{productId:'',qty:1,cost:0},document.querySelectorAll('#poLines tr').length,{receivedByProduct:{}}));wirePOLines()};
  wirePOLines();
  f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f),items=[...document.querySelectorAll('#poLines tr')].map(tr=>({productId:tr.querySelector('.po-product')?.value||'',qty:Number(tr.querySelector('.po-qty')?.value||0),cost:Number(tr.querySelector('.po-cost')?.value||0)})).filter(x=>x.productId&&x.qty>0),id=f.dataset.id||c.uid('po'),old=c.db.purchaseOrders.find(x=>x.id===id)||{};
    const obj={id,companyId:c.db.session.companyId,branchId:c.db.session.branchId,warehouseId:fd.get('warehouseId'),number:fd.get('number'),date:fd.get('date'),supplierId:fd.get('supplierId'),supplierInvoice:fd.get('supplierInvoice'),dueDate:fd.get('dueDate'),status:fd.get('status'),items,notes:fd.get('notes')||'',receivedQty:old.receivedQty||0,receivedByProduct:old.receivedByProduct||{},payments:old.payments||[],createdAt:old.createdAt||c.now()};const total=items.reduce((sum,x)=>sum+Number(x.qty||0)*Number(x.cost||0),0),limit=Number(c.db.security?.approvalLimit||0),privileged=['Owner','Admin','Manager'].includes(c.currentUser().role);if(obj.status==='approved'&&limit>0&&total>limit&&!privileged){obj.status='pending';if(!c.db.approvals.some(a=>a.refType==='purchase_order'&&a.refId===id&&a.status==='pending'))c.db.approvals.unshift({id:c.uid('ap'),companyId:c.db.session.companyId,type:'شراء',title:'اعتماد '+obj.number,requester:c.currentUser().name,amount:total,status:'pending',refType:'purchase_order',refId:id,createdAt:c.now()});c.notify('موافقة مطلوبة',obj.number+' تجاوز حد الموافقة','approval')}
    const ix=c.db.purchaseOrders.findIndex(x=>x.id===id);if(ix>=0)c.db.purchaseOrders[ix]=obj;else c.db.purchaseOrders.push(obj);c.audit(ix>=0?'تعديل أمر شراء':'إنشاء أمر شراء','PurchaseOrder',obj.number);c.save('تم حفظ أمر الشراء');c.closeModal();c.render();
  };
}
function wirePOLines(){document.querySelectorAll('.remove-po-line').forEach(b=>b.onclick=()=>{if(document.querySelectorAll('#poLines tr').length>1)b.closest('tr').remove()})}
function wireReceivePO(c){
  const f=document.querySelector('#receivePOForm');if(!f)return;f.onsubmit=e=>{e.preventDefault();const p=c.db.purchaseOrders.find(x=>x.id===f.dataset.id),date=new FormData(f).get('date');p.receivedByProduct=p.receivedByProduct||{};let add=0;
    document.querySelectorAll('#receivePOForm tbody tr').forEach(tr=>{const pid=tr.dataset.pid,qty=Number(tr.querySelector('.receive-now')?.value||0);if(qty>0){const item=p.items.find(i=>i.productId===pid),prod=c.db.products.find(v=>v.id===pid),before=c.stock(pid,p.warehouseId),unitCost=Number(item?.cost||prod?.cost||0);if(prod&&before+qty>0)prod.cost=((Math.max(0,before)*Number(prod.cost||0))+(qty*unitCost))/(Math.max(0,before)+qty);p.receivedByProduct[pid]=poReceivedQty(p,pid)+qty;add+=qty;c.db.stockMoves.push({id:c.uid('sm'),companyId:p.companyId,warehouseId:p.warehouseId,productId:pid,type:'receipt',qty,unitCost,date,ref:p.number,note:'استلام مشتريات'})}});
    p.receivedQty=Object.values(p.receivedByProduct).reduce((s,x)=>s+Number(x||0),0);const ordered=p.items.reduce((s,x)=>s+Number(x.qty||0),0);if(p.receivedQty>=ordered)p.status='received';else if(p.receivedQty>0)p.status='approved';c.audit('استلام مشتريات','PurchaseOrder',p.number+' '+add);c.save('تم تسجيل الاستلام');c.closeModal();c.render();
  };
}
function payPO(c,id){
  const p=c.db.purchaseOrders.find(x=>x.id===id),due=Math.max(0,poTotal(p)-poPaid(p));if(due<=0){c.toast('أمر الشراء مسدد');return}
  const amount=Number(prompt('مبلغ دفعة المورد',String(due))||0);if(amount<=0)return;const accountId=c.db.cashAccounts[0]?.id,amt=Math.min(amount,due);p.payments=p.payments||[];p.payments.push({id:c.uid('pp'),amount:amt,date:c.today(),accountId});
  c.db.cashTransactions.push({id:c.uid('ct'),companyId:c.db.session.companyId,accountId,date:c.today(),type:'out',amount:amt,ref:p.number,note:'دفعة مورد',createdAt:c.now()});if(poPaid(p)>=poTotal(p)&&p.status==='received')p.status='closed';c.audit('دفعة مورد','PurchaseOrder',p.number+' '+amt);c.save('تم تسجيل الدفعة');c.render();
}

function openShift(c){
  const active=c.db.posShifts.find(x=>x.companyId===c.db.session.companyId&&!x.closedAt);if(active)return active;
  const opening=Number(prompt('رصيد افتتاح الوردية','0')||0);const sh={id:c.uid('shift'),companyId:c.db.session.companyId,userId:c.currentUser().id,openedAt:c.now(),opening,closedAt:null,closing:null};c.db.posShifts.push(sh);c.save('تم فتح الوردية');return sh;
}
function currentShift(c){return c.db.posShifts.find(x=>x.companyId===c.db.session.companyId&&!x.closedAt)}
function viewPOS(c){
  const ps=c.db.products.filter(p=>p.companyId===c.db.session.companyId&&p.active),cart=c.state.posCart,totalBase=cart.reduce((s,x)=>s+x.qty*x.price,0),disc=Number(c.db.ui.posDiscount||0),total=Math.max(0,totalBase-disc),shift=currentShift(c);
  return c.pageHead('نقطة البيع','كاشير سريع وورديات وتعليق ومرتجعات',`<button class="btn ${shift?'outline':'primary'}" id="shiftBtn">${shift?'إغلاق الوردية':'فتح وردية'}</button>`)+
  `<div class="pos hyper-pos"><div><div class="hyper-toolbar"><div class="hyper-search">${c.icon('search',18)}<input id="posSearch" placeholder="اسم / SKU / باركود"></div><select id="posCat"><option value="">كل الأقسام</option>${c.db.categories.map(x=>`<option value="${x.id}">${c.esc(x.name)}</option>`).join('')}</select><button class="btn outline" id="posReturn">${c.icon('history',16)} مرتجع</button></div>
  <div class="product-grid hyper-pos-products" id="posProducts">${ps.map(p=>`<button class="product-card hyper-pos-product" data-pos-add="${p.id}" data-search="${c.esc((p.nameAr+' '+p.sku+' '+p.barcode).toLowerCase())}" data-cat="${p.categoryId}">${productImage(c,p,'md')}<div><strong>${c.esc(p.nameAr)}</strong><div class="sub">${c.esc(p.sku)} • ${p.trackStock?'مخزون '+c.stock(p.id):'خدمة'}</div><b>${c.fmt(p.price)}</b></div></button>`).join('')}</div></div>
  <aside class="card pos-cart"><div class="card-head"><h3>السلة</h3><div class="grow"></div><span class="badge">${cart.reduce((s,x)=>s+x.qty,0)} قطعة</span></div><div id="cartItems">${cart.length?cart.map(x=>`<div class="cart-item"><div class="grow"><strong>${c.esc(x.name)}</strong><div class="sub">${c.fmt(x.price)}</div></div><div class="qty"><button data-cart-minus="${x.productId}">−</button><b>${x.qty}</b><button data-cart-plus="${x.productId}">+</button></div></div>`).join(''):'<div class="empty">السلة فارغة</div>'}</div>
  <div class="field"><label>خصم مباشر</label><input id="posDiscount" type="number" min="0" value="${disc}"></div><div class="total-line"><span>قبل الخصم</span><strong>${c.fmt(totalBase)}</strong></div><div class="total-line grand"><span>الإجمالي</span><strong>${c.fmt(total)}</strong></div>
  <div class="field"><label>العميل</label><select id="posCustomer"><option value="">عميل نقدي</option>${c.db.customers.map(x=>`<option value="${x.id}">${c.esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>طريقة الدفع</label><select id="posMethod"><option value="cash">نقدي</option><option value="card">بطاقة</option><option value="bank">تحويل</option><option value="other">أخرى</option></select></div>
  <div class="pos-actions"><button class="btn outline" id="suspendPOS" ${!cart.length?'disabled':''}>تعليق</button><button class="btn outline" id="resumePOS" ${!c.db.posSuspended.length?'disabled':''}>استرجاع (${c.db.posSuspended.length})</button><button class="btn primary" id="completePOS" ${!cart.length?'disabled':''}>إتمام البيع</button></div></aside></div>`;
}
function wirePOS(c){
  document.querySelectorAll('#posProducts [data-pos-add]').forEach(b=>b.onclick=()=>{const p=c.db.products.find(x=>x.id===b.dataset.posAdd),x=c.state.posCart.find(x=>x.productId===p.id);if(c.db.settings.preventNegativeStock&&p.trackStock&&c.stock(p.id)<=(x?.qty||0)){c.toast('الكمية غير متوفرة');return}if(x)x.qty++;else c.state.posCart.push({productId:p.id,name:p.nameAr,qty:1,price:p.price});c.render()});
  const filt=()=>document.querySelectorAll('#posProducts .product-card').forEach(b=>b.style.display=(b.dataset.search.includes((document.querySelector('#posSearch')?.value||'').toLowerCase())&&(!document.querySelector('#posCat')?.value||b.dataset.cat===document.querySelector('#posCat').value))?'':'none');
  document.querySelector('#posSearch').oninput=filt;document.querySelector('#posCat').onchange=filt;
  document.querySelectorAll('[data-cart-plus]').forEach(b=>b.onclick=()=>{const x=c.state.posCart.find(v=>v.productId===b.dataset.cartPlus),p=c.db.products.find(v=>v.id===x.productId);if(c.db.settings.preventNegativeStock&&p.trackStock&&c.stock(p.id)<=x.qty){c.toast('الكمية غير متوفرة');return}x.qty++;c.render()});
  document.querySelectorAll('[data-cart-minus]').forEach(b=>b.onclick=()=>{const x=c.state.posCart.find(v=>v.productId===b.dataset.cartMinus);x.qty--;if(x.qty<=0)c.state.posCart=c.state.posCart.filter(z=>z!==x);c.render()});
  const di=document.querySelector('#posDiscount');if(di)di.onchange=()=>{c.db.ui.posDiscount=Math.max(0,Number(di.value||0));c.save();c.render()};
  document.querySelector('#suspendPOS').onclick=()=>{if(!c.state.posCart.length)return;c.db.posSuspended.push({id:c.uid('hold'),items:c.clone(c.state.posCart),discount:Number(c.db.ui.posDiscount||0),createdAt:c.now()});c.state.posCart=[];c.db.ui.posDiscount=0;c.save('تم تعليق الطلب');c.render()};
  document.querySelector('#resumePOS').onclick=()=>{const x=c.db.posSuspended.shift();if(!x)return;c.state.posCart=x.items;c.db.ui.posDiscount=x.discount||0;c.save('تم استرجاع الطلب');c.render()};
  document.querySelector('#completePOS').onclick=()=>completePOS(c);
  document.querySelector('#shiftBtn').onclick=()=>{const sh=currentShift(c);if(!sh){openShift(c);c.render();return}const sales=c.db.invoices.filter(i=>i.shiftId===sh.id&&!i.deletedAt).reduce((s,i)=>s+c.invTotals(i).paid,0),expected=Number(sh.opening||0)+sales,closing=Number(prompt('الرصيد الفعلي عند الإغلاق',String(expected))||expected);sh.closedAt=c.now();sh.closing=closing;sh.expected=expected;sh.difference=closing-expected;c.audit('إغلاق وردية','POS','فرق '+sh.difference);c.save('تم إغلاق الوردية');c.render()};
  document.querySelector('#posReturn').onclick=()=>returnPOS(c);
}
function completePOS(c){
  if(!c.state.posCart.length)return;let shift=currentShift(c);if(!shift)shift=openShift(c);
  const base=c.state.posCart.reduce((s,x)=>s+x.qty*x.price,0),discount=Math.min(base,Number(c.db.ui.posDiscount||0)),pay=base-discount,number=`${c.db.settings.invoicePrefix}-${c.db.settings.nextInvoice++}`,customerId=document.querySelector('#posCustomer').value,method=document.querySelector('#posMethod').value;
  const inv={id:c.uid('inv'),companyId:c.db.session.companyId,branchId:c.db.session.branchId,warehouseId:c.warehouse()?.id||'',number,date:c.today(),time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),employee:c.currentUser().name,shiftId:shift.id,customerId,status:'paid',items:c.state.posCart.map(x=>({...x,discount:0,tax:0,color:'',size:''})),shipping:0,discount,notes:'POS',payments:[{id:c.uid('pay'),amount:pay,method,date:c.today()}],createdAt:c.now(),deletedAt:null};c.db.invoices.push(inv);
  inv.items.forEach(x=>{const p=c.db.products.find(v=>v.id===x.productId);if(p?.trackStock)c.db.stockMoves.push({id:c.uid('sm'),companyId:c.db.session.companyId,warehouseId:inv.warehouseId,productId:x.productId,type:'delivery',qty:x.qty,date:c.today(),ref:number,note:'بيع POS'})});
  c.db.cashTransactions.push({id:c.uid('ct'),companyId:c.db.session.companyId,accountId:c.db.cashAccounts[0]?.id,date:c.today(),type:'in',amount:pay,ref:number,note:'بيع POS '+method,createdAt:c.now()});c.audit('بيع نقطة بيع','POS',number);c.save('تمت عملية البيع');c.state.posCart=[];c.db.ui.posDiscount=0;c.printInvoiceDoc(inv);c.render();
}
function returnPOS(c){
  const no=prompt('رقم الفاتورة المراد إرجاعها');if(!no)return;const i=c.db.invoices.find(x=>x.number===no&&!x.deletedAt);if(!i){c.toast('الفاتورة غير موجودة');return}if(i.status==='returned'){c.toast('الفاتورة مرتجعة مسبقاً');return}if(!confirm('تنفيذ مرتجع كامل وإعادة الأصناف للمخزون؟'))return;
  const t=c.invTotals(i);i.status='returned';i.returnedAt=c.now();(i.items||[]).forEach(x=>{const p=c.db.products.find(v=>v.id===x.productId);if(p?.trackStock)c.db.stockMoves.push({id:c.uid('sm'),companyId:i.companyId,warehouseId:i.warehouseId,productId:x.productId,type:'receipt',qty:x.qty,date:c.today(),ref:i.number,note:'مرتجع بيع'})});if(t.paid>0)c.db.cashTransactions.push({id:c.uid('ct'),companyId:i.companyId,accountId:c.db.cashAccounts[0]?.id,date:c.today(),type:'out',amount:t.paid,ref:i.number,note:'استرداد مرتجع بيع',createdAt:c.now()});c.audit('مرتجع بيع','POS',i.number);c.save('تم تنفيذ المرتجع');c.render();
}

function autoJournals(c){
  const out=[],acc=code=>c.db.accounts.find(a=>a.code===code)?.id;
  c.db.invoices.filter(i=>i.companyId===c.db.session.companyId&&!i.deletedAt&&!['cancelled','returned'].includes(i.status)).forEach(i=>{
    const t=c.invTotals(i),cost=(i.items||[]).reduce((s,x)=>s+Number(c.db.products.find(p=>p.id===x.productId)?.cost||0)*Number(x.qty||0),0);
    out.push({id:'auto-sale-'+i.id,number:'AUTO-'+i.number,date:i.date,memo:'مبيعات '+i.number,auto:true,lines:[{accountId:acc('1100'),debit:t.total,credit:0},{accountId:acc('4000'),debit:0,credit:t.total}]});
    if(t.paid>0)out.push({id:'auto-pay-'+i.id,number:'PAY-'+i.number,date:i.date,memo:'تحصيل '+i.number,auto:true,lines:[{accountId:acc('1000'),debit:t.paid,credit:0},{accountId:acc('1100'),debit:0,credit:t.paid}]});
    if(cost>0)out.push({id:'auto-cogs-'+i.id,number:'COGS-'+i.number,date:i.date,memo:'تكلفة '+i.number,auto:true,lines:[{accountId:acc('5000'),debit:cost,credit:0},{accountId:acc('1200'),debit:0,credit:cost}]});
  });
  c.db.expenses.filter(e=>e.companyId===c.db.session.companyId&&e.status==='paid').forEach(e=>out.push({id:'auto-exp-'+e.id,number:'EXP-'+e.id.slice(-5),date:e.date,memo:e.category,auto:true,lines:[{accountId:acc('5100'),debit:Number(e.amount||0),credit:0},{accountId:acc('1000'),debit:0,credit:Number(e.amount||0)}]}));
  c.db.purchaseOrders.filter(p=>p.companyId===c.db.session.companyId&&['received','closed'].includes(p.status)).forEach(p=>{const total=poTotal(p),paid=poPaid(p);out.push({id:'auto-po-'+p.id,number:'BUY-'+p.number,date:p.date,memo:'مشتريات '+p.number,auto:true,lines:[{accountId:acc('1200'),debit:total,credit:0},{accountId:acc('2000'),debit:0,credit:total}]});if(paid>0)out.push({id:'auto-popay-'+p.id,number:'VEND-'+p.number,date:p.date,memo:'دفع مورد '+p.number,auto:true,lines:[{accountId:acc('2000'),debit:paid,credit:0},{accountId:acc('1000'),debit:0,credit:paid}]})});
  return out.filter(j=>j.lines.every(l=>l.accountId));
}
function viewAccounting(c){
  const manual=c.db.journals.filter(j=>!j.auto),auto=autoJournals(c),all=[...manual,...auto],balances={};c.db.accounts.forEach(a=>balances[a.id]=0);all.forEach(j=>(j.lines||[]).forEach(l=>balances[l.accountId]=(balances[l.accountId]||0)+Number(l.debit||0)-Number(l.credit||0)));
  const deb=all.flatMap(x=>x.lines||[]).reduce((s,l)=>s+Number(l.debit||0),0),cre=all.flatMap(x=>x.lines||[]).reduce((s,l)=>s+Number(l.credit||0),0);
  return c.pageHead('المحاسبة','قيود تشغيلية تلقائية + قيود يدوية',`<button class="btn primary" id="newJournal">${c.icon('plus',17)} قيد يدوي</button>`)+`<div class="notice amber"><strong>تشغيلي:</strong> القيود التلقائية هنا للإدارة الداخلية وليست بديلاً عن إعداد ضريبي/قانوني معتمد لبلد المنشأة.</div><div class="hyper-kpis"><div><span>إجمالي المدين</span><strong>${c.fmt(deb)}</strong></div><div><span>إجمالي الدائن</span><strong>${c.fmt(cre)}</strong></div><div><span>الفرق</span><strong class="${Math.abs(deb-cre)>.01?'warn-text':''}">${c.fmt(deb-cre)}</strong></div><div><span>قيود تلقائية</span><strong>${auto.length}</strong></div></div>
  <div class="grid cards2"><div class="card"><div class="card-head"><h3>ميزان المراجعة</h3></div>${c.db.accounts.map(a=>`<div class="stat-row"><span class="badge">${a.code}</span><div class="grow"><strong>${c.esc(a.name)}</strong><div class="sub">${c.esc(a.type)}</div></div><strong>${c.fmt(Math.abs(balances[a.id]||0))}</strong><span class="badge ${(balances[a.id]||0)>=0?'green':'purple'}">${(balances[a.id]||0)>=0?'مدين':'دائن'}</span></div>`).join('')}</div><div class="card"><div class="card-head"><h3>آخر القيود</h3></div>${all.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,18).map(x=>`<div class="stat-row"><div class="grow"><strong>${c.esc(x.number)}</strong><div class="sub">${c.esc(x.date)} • ${c.esc(x.memo||'')}</div></div><strong>${c.fmt((x.lines||[]).reduce((s,l)=>s+Number(l.debit||0),0))}</strong>${x.auto?'<span class="badge blue">آلي</span>':'<span class="badge gray">يدوي</span>'}</div>`).join('')||'<div class="empty">لا توجد قيود</div>'}</div></div>`;
}

function inRange(x,from,to){const d=String(x||'');return(!from||d>=from)&&(!to||d<=to)}
function reportData(c){
  const from=c.db.ui.reportFrom||'',to=c.db.ui.reportTo||'',inv=c.db.invoices.filter(i=>i.companyId===c.db.session.companyId&&!i.deletedAt&&!['cancelled','returned'].includes(i.status)&&inRange(i.date,from,to)),exp=c.db.expenses.filter(e=>e.companyId===c.db.session.companyId&&e.status==='paid'&&inRange(e.date,from,to));
  const sales=inv.reduce((s,i)=>s+c.invTotals(i).total,0),paid=inv.reduce((s,i)=>s+c.invTotals(i).paid,0),cost=inv.reduce((s,i)=>s+(i.items||[]).reduce((z,x)=>z+Number(c.db.products.find(p=>p.id===x.productId)?.cost||0)*Number(x.qty||0),0),0),expenses=exp.reduce((s,e)=>s+Number(e.amount||0),0),gross=sales-cost,net=gross-expenses;
  return {from,to,inv,exp,sales,paid,due:Math.max(0,sales-paid),cost,expenses,gross,net,avg:inv.length?sales/inv.length:0};
}
function viewReports(c){
  const r=reportData(c),prod={};r.inv.forEach(i=>(i.items||[]).forEach(x=>{const k=x.productId||x.name;prod[k]=(prod[k]||0)+Number(x.qty||0)*Number(x.price||0)}));const tops=Object.entries(prod).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const cust=c.db.customers.map(x=>({x,val:r.inv.filter(i=>i.customerId===x.id).reduce((s,i)=>s+c.invTotals(i).total,0)})).filter(x=>x.val>0).sort((a,b)=>b.val-a.val).slice(0,8);
  return c.pageHead('التقارير والتحليلات','فلترة زمنية ونتائج تشغيلية',`<button class="btn outline" id="printReport">${c.icon('receipt',16)} PDF / طباعة</button><button class="btn outline" id="exportReportExcel">${c.icon('data',16)} Excel</button><button class="btn outline" id="exportAllReports">${c.icon('data',16)} CSV</button>`)+
  `<div class="report-filter card"><div class="field"><label>من</label><input id="reportFrom" type="date" value="${c.esc(r.from)}"></div><div class="field"><label>إلى</label><input id="reportTo" type="date" value="${c.esc(r.to)}"></div><button class="btn primary" id="applyReport">تطبيق</button><button class="btn" id="clearReport">مسح</button></div>
  <div class="hyper-kpis report-kpis"><div><span>المبيعات</span><strong>${c.fmt(r.sales)}</strong></div><div><span>المستحق</span><strong>${c.fmt(r.due)}</strong></div><div><span>تكلفة البضاعة</span><strong>${c.fmt(r.cost)}</strong></div><div><span>مجمل الربح</span><strong>${c.fmt(r.gross)}</strong></div><div><span>المصروفات</span><strong>${c.fmt(r.expenses)}</strong></div><div><span>صافي تقديري</span><strong class="${r.net<0?'danger-text':'good-text'}">${c.fmt(r.net)}</strong></div><div><span>عدد الفواتير</span><strong>${r.inv.length}</strong></div><div><span>متوسط الفاتورة</span><strong>${c.fmt(r.avg)}</strong></div></div>
  <div class="grid cards2"><div class="card"><div class="card-head"><h3>أعلى المنتجات</h3></div>${tops.map(([k,v],n)=>`<div class="rank-row"><span>${n+1}</span><div class="grow"><strong>${c.esc(c.db.products.find(p=>p.id===k)?.nameAr||k)}</strong></div><strong>${c.fmt(v)}</strong></div>`).join('')||'<div class="empty">لا توجد بيانات</div>'}</div><div class="card"><div class="card-head"><h3>أعلى العملاء</h3></div>${cust.map((z,n)=>`<div class="rank-row"><span>${n+1}</span><div class="grow"><strong>${c.esc(z.x.name)}</strong><small>${c.esc(z.x.phone||'')}</small></div><strong>${c.fmt(z.val)}</strong></div>`).join('')||'<div class="empty">لا توجد بيانات</div>'}</div></div>
  <div class="card responsive-table"><div class="card-head"><h3>الذمم المدينة</h3></div><div class="table-wrap"><table><thead><tr><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>آخر فاتورة</th></tr></thead><tbody>${c.db.customers.map(x=>{const m=customerMetrics(c,x);return m.total?`<tr><td>${c.esc(x.name)}</td><td>${c.fmt(m.total)}</td><td>${c.fmt(m.paid)}</td><td><strong>${c.fmt(m.due)}</strong></td><td>${c.esc(m.last?.date||'—')}</td></tr>`:''}).join('')}</tbody></table></div></div>`;
}
function wireReports(c){
  const apply=document.querySelector('#applyReport');if(apply)apply.onclick=()=>{c.db.ui.reportFrom=document.querySelector('#reportFrom').value;c.db.ui.reportTo=document.querySelector('#reportTo').value;c.save();c.render()};
  const clear=document.querySelector('#clearReport');if(clear)clear.onclick=()=>{c.db.ui.reportFrom='';c.db.ui.reportTo='';c.save();c.render()};
  const ex=document.querySelector('#exportAllReports');if(ex)ex.onclick=()=>{const r=reportData(c);c.csv('report-'+c.today()+'.csv',[['metric','value'],['sales',r.sales],['paid',r.paid],['due',r.due],['cost',r.cost],['gross_profit',r.gross],['expenses',r.expenses],['net_estimate',r.net],['invoice_count',r.inv.length],['average_invoice',r.avg]])};const xl=document.querySelector('#exportReportExcel');if(xl)xl.onclick=()=>{const r=reportData(c),rows=[['المؤشر','القيمة'],['المبيعات',r.sales],['المدفوع',r.paid],['المستحق',r.due],['تكلفة البضاعة',r.cost],['مجمل الربح',r.gross],['المصروفات',r.expenses],['الصافي التقديري',r.net],['عدد الفواتير',r.inv.length],['متوسط الفاتورة',r.avg]];if(window.NBADV?.excelDownload)NBADV.excelDownload(c,'NovaBlu_Report_'+c.today()+'.xls',rows)};
  const pr=document.querySelector('#printReport');if(pr)pr.onclick=()=>window.print();
}

function viewDocuments(c){
  const inv=c.db.invoices.filter(i=>!i.deletedAt),quotes=c.db.quotations||[],po=c.db.purchaseOrders||[],returns=inv.filter(i=>i.status==='returned'),cash=c.db.cashTransactions||[];
  return c.pageHead('مركز المستندات','كل المستندات التجارية من مكان واحد')+`<div class="document-grid">
    <button class="document-tile" data-route="quotes">${c.icon('quotes',28)}<strong>عروض الأسعار</strong><span>${quotes.length} مستند</span></button>
    <button class="document-tile" data-route="sales">${c.icon('sales',28)}<strong>فواتير المبيعات</strong><span>${inv.length} مستند</span></button>
    <button class="document-tile" data-route="purchasing">${c.icon('purchasing',28)}<strong>أوامر الشراء</strong><span>${po.length} مستند</span></button>
    <button class="document-tile" data-route="cash">${c.icon('cash',28)}<strong>سندات القبض والصرف</strong><span>${cash.length} حركة</span></button>
    <button class="document-tile" data-route="sales">${c.icon('history',28)}<strong>مرتجعات المبيعات</strong><span>${returns.length} مرتجع</span></button>
    <button class="document-tile" data-route="activity">${c.icon('activity',28)}<strong>سجل العمليات</strong><span>${c.db.audit.length} حدث</span></button>
  </div>`;
}

function viewData(c){
  return c.pageHead('البيانات والاستيراد','نسخ احتياطي، استيراد وتصدير جماعي')+`<div class="grid cards2">
  <div class="card"><div class="card-head"><h3>نسخة احتياطية كاملة</h3></div><p class="sub">جميع بيانات NovaBlu ERP في ملف JSON واحد.</p><button class="btn primary" id="backupJson">${c.icon('data',17)} تنزيل JSON</button></div>
  <div class="card"><div class="card-head"><h3>استعادة نسخة</h3></div><input type="file" id="restoreFile" accept="application/json"><button class="btn outline" id="restoreBtn">استعادة</button></div>
  <div class="card"><div class="card-head"><h3>استيراد المنتجات CSV</h3></div><p class="sub">الأعمدة: name_ar, name_en, sku, barcode, cost, price, stock</p><input type="file" id="importProductsCsv" accept=".csv,text/csv"><button class="btn outline" id="productTemplate">تنزيل نموذج</button></div>
  <div class="card"><div class="card-head"><h3>استيراد العملاء CSV</h3></div><p class="sub">الأعمدة: name, phone, email, governorate, address</p><input type="file" id="importCustomersCsv" accept=".csv,text/csv"><button class="btn outline" id="customerTemplate">تنزيل نموذج</button></div></div>
  <div class="card"><div class="card-head"><h3>تصدير شامل CSV</h3></div><div class="toolbar"><button class="btn outline" id="exportProductsFull">المنتجات</button><button class="btn outline" id="exportCustomersFull">العملاء</button><button class="btn outline" id="exportInvoicesFull">الفواتير</button><button class="btn outline" id="exportStockFull">المخزون</button></div></div>`;
}
function parseCSV(text){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i],n=text[i+1];if(ch==='"'){if(q&&n==='"'){cell+='"';i++}else q=!q}else if(ch===','&&!q){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&n==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell=''}else cell+=ch}
  row.push(cell);if(row.some(x=>x!==''))rows.push(row);return rows;
}
function wireData(c){
  document.querySelector('#backupJson').onclick=()=>c.download('NovaBlu_ERP_backup_'+c.today()+'.json',c.db);
  document.querySelector('#restoreBtn').onclick=()=>{const f=document.querySelector('#restoreFile').files[0];if(!f){c.toast('اختر ملفاً');return}const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.meta||!x.companies)throw 0;if(confirm('استبدال البيانات الحالية؟')){Object.keys(c.db).forEach(k=>delete c.db[k]);Object.assign(c.db,x);migrate(c);c.save('تمت الاستعادة');c.render()}}catch{c.toast('ملف غير صالح')}};r.readAsText(f)};
  document.querySelector('#productTemplate').onclick=()=>c.csv('products-template.csv',[['name_ar','name_en','sku','barcode','cost','price','stock'],['منتج تجريبي','Sample','SKU-001','100001','1000','1500','10']]);
  document.querySelector('#customerTemplate').onclick=()=>c.csv('customers-template.csv',[['name','phone','email','governorate','address'],['عميل تجريبي','07700000000','client@example.com','البصرة','العنوان']]);
  const ip=document.querySelector('#importProductsCsv');if(ip)ip.onchange=()=>importProducts(c,ip.files[0]);
  const ic=document.querySelector('#importCustomersCsv');if(ic)ic.onchange=()=>importCustomers(c,ic.files[0]);
  document.querySelector('#exportProductsFull').onclick=()=>c.csv('products-'+c.today()+'.csv',[['name_ar','name_en','sku','barcode','cost','price','stock'],...c.db.products.map(p=>[p.nameAr,p.nameEn,p.sku,p.barcode,p.cost,p.price,p.trackStock?c.stock(p.id):''])]);
  document.querySelector('#exportCustomersFull').onclick=()=>c.csv('customers-'+c.today()+'.csv',[['name','phone','email','governorate','address','due'],...c.db.customers.map(x=>[x.name,x.phone,x.email,x.governorate,x.address,customerMetrics(c,x).due])]);
  document.querySelector('#exportInvoicesFull').onclick=()=>c.csv('invoices-'+c.today()+'.csv',[['number','date','customer','total','paid','due','status'],...c.db.invoices.filter(i=>!i.deletedAt).map(i=>[i.number,i.date,c.db.customers.find(x=>x.id===i.customerId)?.name||i.customerSnapshot?.name||'',c.invTotals(i).total,c.invTotals(i).paid,c.invTotals(i).due,i.status])]);
  document.querySelector('#exportStockFull').onclick=()=>c.csv('stock-'+c.today()+'.csv',[['warehouse','product','sku','qty'],...c.db.warehouses.flatMap(w=>c.db.products.filter(p=>p.trackStock).map(p=>[w.name,p.nameAr,p.sku,stockAt(c,p.id,w.id)]))]);
}
function importProducts(c,file){
  if(!file)return;const r=new FileReader();r.onload=()=>{const rows=parseCSV(r.result),head=rows.shift().map(x=>x.trim().toLowerCase()),ix=n=>head.indexOf(n);let count=0;
    rows.forEach(a=>{const name=a[ix('name_ar')]||'';if(!name)return;const sku=a[ix('sku')]||('IMP-'+c.uid('').slice(-5)),existing=c.db.products.find(p=>p.sku===sku),p=existing||{id:c.uid('p'),companyId:c.db.session.companyId,categoryId:'',unit:'قطعة',tax:0,trackStock:true,reorder:0,supplierId:'',active:true,image:'',brand:'',tags:'',variants:[],wholesalePrice:0,price6:0,price12:0,price24:0,minQty:1,location:''};Object.assign(p,{nameAr:name,nameEn:a[ix('name_en')]||'',sku,barcode:a[ix('barcode')]||'',cost:Number(a[ix('cost')]||0),price:Number(a[ix('price')]||0)});if(!existing)c.db.products.push(p);const qty=Number(a[ix('stock')]||0);if(qty&&!existing)c.db.stockMoves.push({id:c.uid('sm'),companyId:c.db.session.companyId,warehouseId:c.warehouse()?.id||'',productId:p.id,type:'receipt',qty,date:c.today(),ref:'CSV-IMPORT',note:'استيراد CSV'});count++});c.audit('استيراد منتجات','Data',String(count));c.save('تم استيراد '+count+' منتج');c.render()};r.readAsText(file);
}
function importCustomers(c,file){
  if(!file)return;const r=new FileReader();r.onload=()=>{const rows=parseCSV(r.result),head=rows.shift().map(x=>x.trim().toLowerCase()),ix=n=>head.indexOf(n);let count=0;rows.forEach(a=>{const name=a[ix('name')]||'';if(!name)return;c.db.customers.push({id:c.uid('c'),companyId:c.db.session.companyId,name,phone:a[ix('phone')]||'',email:a[ix('email')]||'',governorate:a[ix('governorate')]||'',address:a[ix('address')]||'',taxId:'',notes:'',terms:'',tags:'',creditLimit:0,createdAt:c.now()});count++});c.audit('استيراد عملاء','Data',String(count));c.save('تم استيراد '+count+' عميل');c.render()};r.readAsText(file);
}

window.NBHYPER={migrate,viewProducts,productForm,wireProducts,wireProductForm,viewContacts,contactForm,wireContacts,wireContactForm,viewInventory,wireInventory,viewPurchasing,poForm,wirePurchasing,wirePOForm,viewPOS,wirePOS,viewAccounting,viewReports,wireReports,viewDocuments,viewData,wireData,stockAt,autoJournals};
})();
