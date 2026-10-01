
(function(){
'use strict';

function safeCustomer(c,i){
  const live=c.db.customers.find(x=>x.id===i.customerId)||{};
  return Object.assign({
    title:'الأستاذ',
    name:live.name||'عميل نقدي',
    phone:live.phone||'',
    governorate:'',
    address:live.address||''
  },i.customerSnapshot||{});
}
function ensureInvoice(i,c){
  i.items=(i.items||[]).map(x=>Object.assign({color:'',size:'',discount:0,tax:0},x));
  i.customerSnapshot=safeCustomer(c,i);
  i.time=i.time||new Date(i.createdAt||Date.now()).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  i.employee=i.employee||c.currentUser().name||'';
  return i;
}
function formTotals(c){
  const rows=[...document.querySelectorAll('#invLines tr[data-inv-row]')];
  let sub=0;
  rows.forEach(tr=>{
    const qty=Number(tr.querySelector('.inv-qty')?.value||0);
    const price=Number(tr.querySelector('.inv-price')?.value||0);
    const disc=Number(tr.querySelector('.inv-discount')?.value||0);
    const tax=Number(tr.querySelector('.inv-tax')?.value||0);
    const line=qty*price*(1-disc/100)*(1+tax/100);
    sub+=line;
    const out=tr.querySelector('.inv-line-total');
    if(out)out.textContent=c.fmt(line);
  });
  const f=document.querySelector('#invoiceForm');
  const shipping=Number(f?.elements.shipping?.value||0);
  const direct=Number(f?.elements.discount?.value||0);
  const total=Math.max(0,sub+shipping-direct);
  const id=f?.dataset.id||'';
  const old=id?c.db.invoices.find(x=>x.id===id):null;
  const paid=(old?.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0);
  const set=(id,val)=>{const el=document.querySelector(id);if(el)el.textContent=val};
  set('#fSub',c.fmt(sub));
  set('#fShipping',c.fmt(shipping));
  set('#fDirect',c.fmt(direct));
  set('#fPaid',c.fmt(paid));
  set('#fTotal',c.fmt(total));
  set('#fDue',c.fmt(Math.max(0,total-paid)));
  return {sub,total,paid,due:Math.max(0,total-paid)};
}
function invLine(c,x){
  x=Object.assign({productId:'',name:'',color:'',size:'',qty:1,price:0,discount:0,tax:0},x||{});
  const products=c.db.products.filter(p=>p.companyId===c.db.session.companyId&&p.active);
  return `<tr data-inv-row>
    <td class="invoice-product-cell">
      <select class="inv-prod"><option value="">منتج يدوي</option>${products.map(p=>`<option value="${p.id}" ${p.id===x.productId?'selected':''}>${c.esc(p.nameAr)}${p.sku?' • '+c.esc(p.sku):''}</option>`).join('')}</select>
      <input class="inv-name" value="${c.esc(x.name||'')}" placeholder="اسم الصنف">
      <div class="variant-fields">
        <input class="inv-color" value="${c.esc(x.color||'')}" placeholder="لون / وصف">
        <input class="inv-size" value="${c.esc(x.size||'')}" placeholder="قياس / نوع">
      </div>
    </td>
    <td><input class="inv-qty" type="number" min=".01" step=".01" value="${Number(x.qty||1)}"></td>
    <td><input class="inv-price" type="number" min="0" step=".01" value="${Number(x.price||0)}"></td>
    <td><input class="inv-discount" type="number" min="0" max="100" step=".01" value="${Number(x.discount||0)}"></td>
    <td><input class="inv-tax" type="number" min="0" max="100" step=".01" value="${Number(x.tax||0)}"></td>
    <td class="inv-line-total-cell"><strong class="inv-line-total">${c.fmt(Number(x.qty||1)*Number(x.price||0))}</strong></td>
    <td><button type="button" class="btn red sm remove-line" aria-label="حذف السطر">×</button></td>
  </tr>`;
}
function invoiceForm(c,id){
  const w=c.warehouse(),existing=id?c.db.invoices.find(x=>x.id===id):null;
  const base=existing?c.clone(existing):{
    id:'',companyId:c.db.session.companyId,branchId:c.db.session.branchId,warehouseId:w?.id||'',
    number:`${c.db.settings.invoicePrefix}-${c.db.settings.nextInvoice}`,date:c.today(),
    time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),
    employee:c.currentUser().name||'',customerId:'',customerSnapshot:{title:'الأستاذ',name:'',phone:'',governorate:'',address:''},
    status:'draft',items:[{productId:'',name:'',color:'',size:'',qty:1,price:0,discount:0,tax:0}],
    shipping:0,discount:0,notes:'',payments:[],createdAt:c.now(),deletedAt:null
  };
  const i=ensureInvoice(base,c),t=c.invTotals(i),cs=i.customerSnapshot;
  const customerOpts=c.db.customers.filter(x=>x.companyId===c.db.session.companyId).map(x=>`<option value="${x.id}" ${x.id===i.customerId?'selected':''}>${c.esc(x.name)}${x.phone?' • '+c.esc(x.phone):''}</option>`).join('');
  const statuses=['draft','confirmed','partial','paid','cancelled','returned'];
  return `<form id="invoiceForm" data-id="${c.esc(i.id||'')}">
    <div class="invoice-editor-head">
      <div>
        <span class="eyebrow">NovaBlu Sales</span>
        <h3>${i.id?'تعديل الفاتورة':'فاتورة مبيعات جديدة'}</h3>
        <div class="sub">تحرير سريع وواضح للفواتير</div>
      </div>
      <div class="invoice-number-chip">${c.icon('sales',18)} <strong>${c.esc(i.number)}</strong></div>
    </div>

    <section class="invoice-editor-section">
      <div class="section-title">${c.icon('file',18)} بيانات المستند</div>
      <div class="form-grid invoice-meta-grid">
        <div class="field"><label>رقم الفاتورة</label><input name="number" value="${c.esc(i.number)}" required></div>
        <div class="field"><label>التاريخ</label><input name="date" type="date" value="${c.esc(i.date)}" required></div>
        <div class="field"><label>الوقت</label><input name="time" type="time" value="${c.esc(i.time||'')}"></div>
        <div class="field"><label>الموظف</label><input name="employee" value="${c.esc(i.employee||'')}"></div>
        <div class="field"><label>الحالة</label><select name="status">${statuses.map(s=>`<option value="${s}" ${s===i.status?'selected':''}>${c.statusBadge(s).replace(/<[^>]+>/g,'')}</option>`).join('')}</select></div>
      </div>
    </section>

    <section class="invoice-editor-section customer-editor-card">
      <div class="section-title">${c.icon('customers',18)} بيانات العميل</div>
      <div class="form-grid">
        <div class="field full"><label>اختيار من العملاء</label><select name="customerId" id="invoiceCustomer"><option value="">عميل نقدي / إدخال يدوي</option>${customerOpts}</select></div>
        <div class="field"><label>اللقب</label><select name="customerTitle"><option ${cs.title==='الأستاذ'?'selected':''}>الأستاذ</option><option ${cs.title==='السيدة'?'selected':''}>السيدة</option><option ${cs.title==='شركة'?'selected':''}>شركة</option><option ${cs.title==='السادة'?'selected':''}>السادة</option></select></div>
        <div class="field"><label>الاسم</label><input name="customerName" value="${c.esc(cs.name||'')}"></div>
        <div class="field"><label>رقم الهاتف</label><input name="customerPhone" inputmode="tel" value="${c.esc(cs.phone||'')}"></div>
        <div class="field"><label>المدينة / المحافظة</label><input name="customerGovernorate" value="${c.esc(cs.governorate||'')}"></div>
        <div class="field full"><label>العنوان</label><input name="customerAddress" value="${c.esc(cs.address||'')}"></div>
      </div>
    </section>

    <section class="invoice-editor-section">
      <div class="section-title-row"><div class="section-title">${c.icon('products',18)} الأصناف</div><button type="button" class="btn sm" id="addInvLine">${c.icon('plus',16)} إضافة سطر</button></div>
      <div class="table-wrap invoice-editor-table"><table class="invoice-lines">
        <thead><tr><th>المنتج والتفاصيل</th><th>الكمية</th><th>السعر</th><th>خصم %</th><th>ضريبة %</th><th>الإجمالي</th><th></th></tr></thead>
        <tbody id="invLines">${i.items.map(x=>invLine(c,x)).join('')}</tbody>
      </table></div>
    </section>

    <div class="invoice-bottom-grid">
      <div>
        <section class="invoice-editor-section">
          <div class="section-title">${c.icon('sliders',18)} الخصم والشحن</div>
          <div class="form-grid">
            <div class="field"><label>خصم مباشر</label><input name="discount" type="number" min="0" step=".01" value="${Number(i.discount||0)}"></div>
            <div class="field"><label>الشحن</label><input name="shipping" type="number" min="0" step=".01" value="${Number(i.shipping||0)}"></div>
            <div class="field full"><label>ملاحظات الفاتورة</label><textarea name="notes" placeholder="ملاحظات تظهر في الفاتورة...">${c.esc(i.notes||'')}</textarea></div>
          </div>
        </section>
        <section class="invoice-editor-section">
          <div class="section-title-row"><div class="section-title">${c.icon('cash',18)} الدفعات</div><button type="button" class="btn sm" id="addPayment">${c.icon('plus',16)} إضافة دفعة</button></div>
          <div id="payments">${(i.payments||[]).map(p=>`<div class="stat-row"><div class="grow"><strong>${c.esc(paymentMethodLabel(p.method))}</strong><div class="sub">${c.esc(p.date||'')}</div></div><strong>${c.fmt(p.amount)}</strong></div>`).join('')||'<div class="empty compact">لا توجد دفعات مسجلة</div>'}</div>
        </section>
      </div>
      <aside class="invoice-live-summary">
        <span class="eyebrow">ملخص الفاتورة</span>
        <div class="summary-line"><span>المجموع</span><strong id="fSub">${c.fmt(t.sub)}</strong></div>
        <div class="summary-line"><span>الشحن</span><strong id="fShipping">${c.fmt(i.shipping||0)}</strong></div>
        <div class="summary-line"><span>الخصم</span><strong id="fDirect">${c.fmt(i.discount||0)}</strong></div>
        <div class="summary-line"><span>المدفوع</span><strong id="fPaid">${c.fmt(t.paid)}</strong></div>
        <div class="summary-total"><span>الإجمالي</span><strong id="fTotal">${c.fmt(t.total)}</strong></div>
        <div class="summary-due"><span>المتبقي</span><strong id="fDue">${c.fmt(t.due)}</strong></div>
      </aside>
    </div>

    <div class="invoice-actionbar">
      <button class="btn primary" type="submit">${c.icon('check',17)} حفظ الفاتورة</button>
      ${i.id?`<button class="btn outline" type="button" id="previewInvoice">${c.icon('file',17)} معاينة</button>
      <button class="btn outline" type="button" id="printInvoice">${c.icon('receipt',17)} طباعة / PDF</button>
      <button class="btn outline" type="button" id="shareInvoice">${c.icon('arrowdown',17)} مشاركة</button>
      <button class="btn outline" type="button" id="duplicateInvoice">${c.icon('plus',17)} نسخة جديدة</button>
      <button class="btn red" type="button" id="deleteInvoice">${c.icon('trash',17)} حذف</button>`:''}
      <button class="btn" type="button" data-close>إلغاء</button>
    </div>
  </form>`;
}
function readInvoiceForm(c){
  const f=document.querySelector('#invoiceForm'),fd=new FormData(f),items=[];
  document.querySelectorAll('#invLines tr[data-inv-row]').forEach(tr=>{
    const pid=tr.querySelector('.inv-prod')?.value||'',p=c.db.products.find(x=>x.id===pid);
    items.push({
      productId:pid,
      name:tr.querySelector('.inv-name')?.value||p?.nameAr||'صنف',
      color:tr.querySelector('.inv-color')?.value||'',
      size:tr.querySelector('.inv-size')?.value||'',
      qty:Number(tr.querySelector('.inv-qty')?.value||1),
      price:Number(tr.querySelector('.inv-price')?.value||0),
      discount:Number(tr.querySelector('.inv-discount')?.value||0),
      tax:Number(tr.querySelector('.inv-tax')?.value||0)
    });
  });
  const old=f.dataset.id?c.db.invoices.find(x=>x.id===f.dataset.id):null;
  return {
    id:f.dataset.id||c.uid('inv'),companyId:c.db.session.companyId,branchId:c.db.session.branchId,warehouseId:c.warehouse()?.id||'',
    number:fd.get('number'),date:fd.get('date'),time:fd.get('time')||'',employee:fd.get('employee')||'',
    customerId:fd.get('customerId'),customerSnapshot:{title:fd.get('customerTitle')||'',name:fd.get('customerName')||'',phone:fd.get('customerPhone')||'',governorate:fd.get('customerGovernorate')||'',address:fd.get('customerAddress')||''},
    status:fd.get('status'),items,shipping:Number(fd.get('shipping')||0),discount:Number(fd.get('discount')||0),notes:fd.get('notes')||'',
    payments:old?.payments||[],createdAt:old?.createdAt||c.now(),updatedAt:c.now(),deletedAt:null
  };
}
function invoiceCard(c,i){
  const cs=safeCustomer(c,i),t=c.invTotals(i);
  return `<article class="invoice-list-card" data-invoice-card data-row="${c.esc((i.number+' '+cs.name+' '+cs.phone).toLowerCase())}" data-status="${c.esc(i.status)}">
    <button class="invoice-list-main" type="button" data-invoice-toggle="${c.esc(i.id)}" aria-expanded="false">
      <div class="invoice-list-id"><span class="invoice-doc-icon">${c.icon('sales',19)}</span><div><strong>${c.esc(i.number)}</strong><small>${c.esc(i.date)}${i.time?' • '+c.esc(i.time):''}</small></div></div>
      <div class="invoice-list-customer"><strong>${c.esc(cs.name||'عميل نقدي')}</strong><small>${c.esc(cs.phone||'')}</small></div>
      <div class="invoice-list-money"><strong>${c.fmt(t.total)}</strong><small>${t.due>0?'متبقي '+c.fmt(t.due):'مسدد بالكامل'}</small></div>
      <div>${c.statusBadge(i.status)}</div>
      <span class="invoice-chevron">${c.icon('chevron',17)}</span>
    </button>
    <div class="invoice-list-detail hidden">
      <div class="invoice-detail-grid">
        <div><span>العنوان</span><strong>${c.esc([cs.governorate,cs.address].filter(Boolean).join(' • ')||'—')}</strong></div>
        <div><span>الموظف</span><strong>${c.esc(i.employee||'—')}</strong></div>
        <div><span>المدفوع</span><strong>${c.fmt(t.paid)}</strong></div>
        <div><span>المتبقي</span><strong>${c.fmt(t.due)}</strong></div>
        <div><span>الأصناف</span><strong>${(i.items||[]).length}</strong></div>
      </div>
      <div class="invoice-card-actions">
        <button class="btn sm" data-invoice="${c.esc(i.id)}">${c.icon('sliders',15)} تعديل</button>
        <button class="btn sm outline" data-preview-invoice="${c.esc(i.id)}">${c.icon('file',15)} معاينة</button>
        <button class="btn sm outline" data-share-invoice="${c.esc(i.id)}">${c.icon('arrowdown',15)} مشاركة</button>
        <button class="btn sm outline" data-duplicate-invoice="${c.esc(i.id)}">${c.icon('plus',15)} تكرار</button>
      </div>
    </div>
  </article>`;
}
function viewSales(c){
  const arr=c.db.invoices.filter(i=>i.companyId===c.db.session.companyId&&!i.deletedAt).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const active=arr.filter(i=>['confirmed','partial','paid'].includes(i.status));
  const total=active.reduce((s,i)=>s+c.invTotals(i).total,0);
  const due=active.reduce((s,i)=>s+c.invTotals(i).due,0);
  return c.pageHead('المبيعات والفواتير',`${arr.length} مستند`,`<button class="btn primary" data-q="invoice">${c.icon('plus',17)} فاتورة جديدة</button>`)+
    `<div class="invoice-kpis">
      <div><span>إجمالي الفواتير</span><strong>${c.fmt(total)}</strong></div>
      <div><span>المستحق</span><strong>${c.fmt(due)}</strong></div>
      <div><span>مدفوعة</span><strong>${arr.filter(i=>i.status==='paid').length}</strong></div>
      <div><span>تحتاج متابعة</span><strong>${arr.filter(i=>c.invTotals(i).due>0&&!['cancelled','returned'].includes(i.status)).length}</strong></div>
    </div>
    <div class="toolbar invoice-toolbar">
      <div class="invoice-search">${c.icon('search',18)}<input id="salesSearch" placeholder="ابحث برقم الفاتورة أو العميل أو الهاتف..."></div>
      <select id="salesStatus"><option value="">كل الحالات</option><option value="draft">مسودة</option><option value="confirmed">مؤكدة</option><option value="partial">مدفوعة جزئياً</option><option value="paid">مدفوعة</option><option value="cancelled">ملغاة</option><option value="returned">مرتجعة</option></select>
      <button class="btn outline" id="exportSales">${c.icon('data',17)} تصدير CSV</button>
    </div>
    <div class="invoice-list" id="salesBody">${arr.map(i=>invoiceCard(c,i)).join('')||'<div class="card empty">لا توجد فواتير حتى الآن</div>'}</div>`;
}
function wireSales(c){
  const filter=()=>{
    const q=(document.querySelector('#salesSearch')?.value||'').trim().toLowerCase(),st=document.querySelector('#salesStatus')?.value||'';
    document.querySelectorAll('[data-invoice-card]').forEach(card=>card.style.display=(card.dataset.row.includes(q)&&(!st||card.dataset.status===st))?'':'none');
  };
  const search=document.querySelector('#salesSearch'),status=document.querySelector('#salesStatus');
  if(search)search.oninput=filter;if(status)status.onchange=filter;
  const ex=document.querySelector('#exportSales');if(ex){if(c.can&&!c.can('sales','export'))ex.remove();else ex.onclick=()=>c.csv('novablu-sales-'+c.today()+'.csv',[['number','date','time','customer','phone','total','paid','due','status','employee'],...c.db.invoices.filter(i=>!i.deletedAt).map(i=>{const cs=safeCustomer(c,i),t=c.invTotals(i);return[i.number,i.date,i.time||'',cs.name,cs.phone,t.total,t.paid,t.due,i.status,i.employee||'']})]);}
  document.querySelectorAll('[data-invoice-toggle]').forEach(b=>b.onclick=()=>{
    const card=b.closest('[data-invoice-card]'),d=card?.querySelector('.invoice-list-detail');if(!d)return;
    const willOpen=d.classList.contains('hidden');d.classList.toggle('hidden');b.setAttribute('aria-expanded',willOpen?'true':'false');card.classList.toggle('open',willOpen);
  });
  document.querySelectorAll('[data-preview-invoice]').forEach(b=>b.onclick=()=>showPreview(c,c.db.invoices.find(x=>x.id===b.dataset.previewInvoice)));
  document.querySelectorAll('[data-share-invoice]').forEach(b=>b.onclick=()=>shareInvoice(c,c.db.invoices.find(x=>x.id===b.dataset.shareInvoice)));
  document.querySelectorAll('[data-duplicate-invoice]').forEach(b=>b.onclick=()=>duplicateInvoice(c,c.db.invoices.find(x=>x.id===b.dataset.duplicateInvoice)));
}

function invoicePrice(c,p,qty){
 const customerId=document.querySelector('#invoiceCustomer')?.value||'';
 if(window.NBADV&&NBADV.priceFor)return NBADV.priceFor(c,p,qty,customerId);
 return Number(p.price||0)
}
function productQtyMap(items){
 const m={};(items||[]).forEach(x=>{if(!x.productId)return;m[x.productId]=(m[x.productId]||0)+Number(x.qty||0)});return m
}
function invoicePostsStock(i){return ['confirmed','partial','paid'].includes(i?.status)}
function existingStockPosted(c,i){
 if(!i)return false;if(i.stockPosted===true)return true;
 return c.db.stockMoves.some(m=>m.ref===i.number&&m.warehouseId===i.warehouseId&&m.type==='delivery')
}
function syncInvoiceStock(c,oldI,newI){
 const oldPosted=existingStockPosted(c,oldI),newPosted=invoicePostsStock(newI);
 const oldMap=oldPosted?productQtyMap(oldI?.items):{},newMap=newPosted?productQtyMap(newI?.items):{};
 const oldWh=oldI?.warehouseId||newI.warehouseId,newWh=newI.warehouseId;
 const useAvailable=(pid,wid)=>window.NBADV&&NBADV.availableStock?NBADV.availableStock(c,pid,wid):c.stock(pid,wid);
 if(oldPosted&&oldWh!==newWh){
   for(const [pid,qty] of Object.entries(oldMap)){if(qty>0)c.db.stockMoves.push({id:c.uid('sm'),companyId:newI.companyId,warehouseId:oldWh,productId:pid,type:'receipt',qty,date:c.today(),ref:newI.number,note:'إلغاء ترحيل فاتورة من مخزن سابق'})}
   for(const [pid,qty] of Object.entries(newMap)){if(qty>0&&useAvailable(pid,newWh)<qty){c.toast('المخزون غير كافٍ بعد تغيير المخزن');return false}}
   for(const [pid,qty] of Object.entries(newMap)){if(qty>0)c.db.stockMoves.push({id:c.uid('sm'),companyId:newI.companyId,warehouseId:newWh,productId:pid,type:'delivery',qty,date:c.today(),ref:newI.number,note:'ترحيل فاتورة بعد تغيير المخزن'})}
 }else{
   const ids=new Set([...Object.keys(oldMap),...Object.keys(newMap)]);
   for(const pid of ids){const diff=Number(newMap[pid]||0)-Number(oldMap[pid]||0);if(diff>0&&useAvailable(pid,newWh)<diff){c.toast('المخزون غير كافٍ لـ '+(c.db.products.find(p=>p.id===pid)?.nameAr||pid));return false}}
   for(const pid of ids){const diff=Number(newMap[pid]||0)-Number(oldMap[pid]||0);if(diff===0)continue;c.db.stockMoves.push({id:c.uid('sm'),companyId:newI.companyId,warehouseId:newWh,productId:pid,type:diff>0?'delivery':'receipt',qty:Math.abs(diff),date:c.today(),ref:newI.number,note:'تسوية مخزون فاتورة'})}
 }
 newI.stockPosted=newPosted;
 return true
}
function wireInvoiceLines(c){
  document.querySelectorAll('#invLines .remove-line').forEach(b=>b.onclick=()=>{if(document.querySelectorAll('#invLines tr[data-inv-row]').length>1)b.closest('tr').remove();formTotals(c)});
  document.querySelectorAll('#invLines .inv-prod').forEach(sel=>sel.onchange=()=>{
    const p=c.db.products.find(x=>x.id===sel.value),tr=sel.closest('tr');if(p&&tr){const qty=Number(tr.querySelector('.inv-qty')?.value||1);tr.querySelector('.inv-name').value=p.nameAr;tr.querySelector('.inv-price').value=invoicePrice(c,p,qty);tr.querySelector('.inv-tax').value=p.tax||0}formTotals(c)
  });
  document.querySelectorAll('#invLines input').forEach(inp=>inp.oninput=()=>{const tr=inp.closest('tr');if(inp.classList.contains('inv-qty')&&tr){const p=c.db.products.find(x=>x.id===tr.querySelector('.inv-prod')?.value);if(p)tr.querySelector('.inv-price').value=invoicePrice(c,p,Number(inp.value||1))}formTotals(c)});
}
function wireInvoiceForm(c){
  const f=document.querySelector('#invoiceForm');if(!f)return;
  const add=document.querySelector('#addInvLine');if(add)add.onclick=()=>{document.querySelector('#invLines').insertAdjacentHTML('beforeend',invLine(c,{qty:1}));wireInvoiceLines(c);formTotals(c)};
  wireInvoiceLines(c);
  ['shipping','discount'].forEach(n=>{const el=f.elements[n];if(el)el.oninput=()=>formTotals(c)});
  const cust=document.querySelector('#invoiceCustomer');if(cust)cust.onchange=()=>{
    const x=c.db.customers.find(v=>v.id===cust.value);if(x){f.elements.customerName.value=x.name||'';f.elements.customerPhone.value=x.phone||'';f.elements.customerAddress.value=x.address||''}
    document.querySelectorAll('#invLines tr[data-inv-row]').forEach(tr=>{const p=c.db.products.find(v=>v.id===tr.querySelector('.inv-prod')?.value);if(p)tr.querySelector('.inv-price').value=invoicePrice(c,p,Number(tr.querySelector('.inv-qty')?.value||1))});formTotals(c)
  };
  f.onsubmit=e=>{
    e.preventDefault();const i=readInvoiceForm(c),ix=c.db.invoices.findIndex(x=>x.id===i.id),old=ix>=0?c.clone(c.db.invoices[ix]):null;
    if(window.NBADV&&old&&!NBADV.guardFinancialEdit(c,old))return;
    const duplicate=c.db.invoices.find(x=>x.id!==i.id&&!x.deletedAt&&String(x.number).trim()===String(i.number).trim());if(duplicate){c.toast('رقم الفاتورة مستخدم مسبقاً: '+i.number);return}
    const customer=c.db.customers.find(x=>x.id===i.customerId);if(customer&&Number(customer.creditLimit||0)>0){const otherDue=c.db.invoices.filter(x=>x.customerId===customer.id&&x.id!==i.id&&!x.deletedAt&&!['cancelled','returned'].includes(x.status)).reduce((sum,x)=>sum+c.invTotals(x).due,0),newDue=c.invTotals(i).due,totalCredit=otherDue+newDue;if(totalCredit>Number(customer.creditLimit)){const privileged=['Owner','Admin','Manager'].includes(c.currentUser().role);if(!privileged){c.toast('تجاوز حد ائتمان العميل');return}if(!confirm('سيتجاوز العميل حده الائتماني. متابعة بصلاحية '+c.currentUser().role+'؟'))return;c.audit('تجاوز حد ائتماني','Invoice',i.number+' / '+customer.name)}}if(!syncInvoiceStock(c,old,i))return;
    if(ix>=0){c.db.invoices[ix]=i;if(window.NBADV)NBADV.recordChange(c,'Invoice',i.id,old,i,'تعديل');c.audit('تعديل فاتورة','Invoice',i.number)}
    else{c.db.invoices.push(i);c.db.settings.nextInvoice++;if(window.NBADV)NBADV.recordChange(c,'Invoice',i.id,null,i,'إنشاء');c.audit('إنشاء فاتورة','Invoice',i.number)}
    c.save('تم حفظ الفاتورة');c.closeModal();c.render();
  };
  const ap=document.querySelector('#addPayment');if(ap)ap.onclick=()=>{
    const id=f.dataset.id;if(!id){c.toast('احفظ الفاتورة أولاً ثم أضف الدفعة');return}
    const inv=c.db.invoices.find(x=>x.id===id),max=c.invTotals(inv).due;if(window.NBADV&&!NBADV.guardFinancialEdit(c,inv))return;if(max<=0){c.toast('الفاتورة مسددة بالكامل');return}
    const amt=prompt('مبلغ الدفعة',String(max));if(!amt||Number(amt)<=0)return;
    const meth=prompt('طريقة الدفع: cash / card / bank','cash')||'cash';
    inv.payments=inv.payments||[];inv.payments.push({id:c.uid('pay'),amount:Math.min(Number(amt),max),method:meth,date:c.today()});
    const t=c.invTotals(inv);inv.status=t.due<=0?'paid':'partial';
    c.db.cashTransactions.push({id:c.uid('ct'),companyId:inv.companyId,accountId:c.db.cashAccounts[0]?.id,date:c.today(),type:'in',amount:Math.min(Number(amt),max),ref:inv.number,note:'دفعة فاتورة',createdAt:c.now()});
    c.audit('إضافة دفعة','Invoice',inv.number+' '+amt);c.save('تم تسجيل الدفعة');c.closeModal();c.quick('invoice',id);
  };
  const getInv=()=>c.db.invoices.find(x=>x.id===f.dataset.id);
  const pv=document.querySelector('#previewInvoice');if(pv)pv.onclick=()=>showPreview(c,getInv());
  const pr=document.querySelector('#printInvoice');if(pr)pr.onclick=()=>printInvoiceDoc(c,getInv());
  const sh=document.querySelector('#shareInvoice');if(sh)sh.onclick=()=>shareInvoice(c,getInv());
  const du=document.querySelector('#duplicateInvoice');if(du)du.onclick=()=>duplicateInvoice(c,getInv());
  const del=document.querySelector('#deleteInvoice');if(del)del.onclick=()=>{if(c.can&&!c.can('sales','delete')){c.toast('لا توجد صلاحية حذف فاتورة');return}const i=getInv();if(!i)return;if(existingStockPosted(c,i)){c.toast('لا يمكن حذف فاتورة مرحّلة. استخدم الإلغاء أو المرتجع أولاً');return}if(!confirm('نقل الفاتورة إلى سلة المحذوفات لمدة 7 أيام؟'))return;i.deletedAt=c.now();c.db.trash.push({id:c.uid('tr'),type:'invoice',entityId:i.id,label:i.number,deletedAt:i.deletedAt,data:null});c.audit('حذف إلى السلة','Invoice',i.number);c.save('تم النقل إلى السلة');c.closeModal();c.render()};
  formTotals(c);
}
function duplicateInvoice(c,i){
  if(!i)return;
  const copy=c.clone(i);copy.id=c.uid('inv');copy.number=`${c.db.settings.invoicePrefix}-${c.db.settings.nextInvoice++}`;copy.date=c.today();copy.time=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});copy.status='draft';copy.payments=[];copy.createdAt=c.now();copy.updatedAt=c.now();copy.deletedAt=null;
  c.db.invoices.push(copy);c.audit('تكرار فاتورة','Invoice',i.number+' → '+copy.number);c.save('تم إنشاء '+copy.number);c.closeModal();c.quick('invoice',copy.id);
}
function paymentMethodLabel(m){return ({cash:'نقدي',card:'بطاقة',bank:'تحويل مصرفي',other:'أخرى'})[m]||m||'دفعة'}
function invoiceDocument(c,i,forPrint=false){
  i=ensureInvoice(c.clone(i),c);const cs=safeCustomer(c,i),t=c.invTotals(i),co=c.company(),style=c.db.settings.invoiceStyle||{},items=(i.items||[]).filter(x=>String(x.name||'').trim());
  const rows=items.map((x,n)=>{
    const extras=[x.color?'اللون: '+c.esc(x.color):'',x.size?'القياس/النوع: '+c.esc(x.size):''].filter(Boolean).join(' • ');
    const line=Number(x.qty||0)*Number(x.price||0)*(1-Number(x.discount||0)/100)*(1+Number(x.tax||0)/100);
    return `<tr><td>${n+1}</td><td class="doc-product"><strong>${c.esc(x.name)}</strong>${extras?`<small>${extras}</small>`:''}</td><td>${x.qty}</td><td>${c.fmt(x.price)}</td><td>${x.discount?x.discount+'%':'—'}</td><td>${x.tax?x.tax+'%':'—'}</td><td><strong>${c.fmt(line)}</strong></td></tr>`;
  }).join('');
  return `<article class="nb-invoice-doc ${forPrint?'print-doc':''}" dir="rtl">
    <header class="doc-hero">
      <div class="doc-brandmark">N</div>
      <div class="doc-brandcopy"><h1>${c.esc(co.name||'NovaBlu ERP')}</h1><span>${c.esc(style.subtitle||'نظام إدارة الأعمال')}</span></div>
      <div class="doc-title"><span>${c.esc(style.title||'فاتورة مبيعات')}</span><strong>${c.esc(i.number)}</strong></div>
    </header>
    <div class="doc-rule"></div>
    <section class="doc-info-layout">
      <div class="doc-customer">
        <h3>${c.icon('customers',17)} بيانات العميل</h3>
        <div class="doc-data-grid">
          <div><span>الاسم</span><strong>${c.esc([cs.title,cs.name].filter(Boolean).join(' / ')||'عميل نقدي')}</strong></div>
          <div><span>الهاتف</span><strong>${c.esc(cs.phone||'—')}</strong></div>
          <div><span>المدينة / المحافظة</span><strong>${c.esc(cs.governorate||'—')}</strong></div>
          <div><span>العنوان</span><strong>${c.esc(cs.address||'—')}</strong></div>
        </div>
      </div>
      <div class="doc-meta">
        <div><span>التاريخ</span><strong>${c.esc(i.date||'')}</strong></div>
        <div><span>الوقت</span><strong>${c.esc(i.time||'—')}</strong></div>
        <div><span>الموظف</span><strong>${c.esc(i.employee||'—')}</strong></div>
        <div><span>الحالة</span><strong>${c.statusBadge(i.status).replace(/<[^>]+>/g,'')}</strong></div>
      </div>
    </section>
    <section class="doc-products"><table><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>خصم</th><th>ضريبة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table></section>
    <section class="doc-summary">
      <div><span>المجموع</span><strong>${c.fmt(t.sub)}</strong></div>
      ${Number(i.shipping||0)?`<div><span>الشحن</span><strong>${c.fmt(i.shipping)}</strong></div>`:''}
      ${Number(i.discount||0)?`<div><span>الخصم المباشر</span><strong>− ${c.fmt(i.discount)}</strong></div>`:''}
      <div class="doc-grand"><span>الإجمالي</span><strong>${c.fmt(t.total)}</strong></div>
      <div><span>المدفوع</span><strong>${c.fmt(t.paid)}</strong></div>
      <div class="${t.due>0?'doc-due':''}"><span>المتبقي</span><strong>${c.fmt(t.due)}</strong></div>
    </section>
    ${i.notes?`<section class="doc-notes"><strong>ملاحظات</strong><p>${c.esc(i.notes).replace(/\n/g,'<br>')}</p></section>`:''}
    <footer class="doc-footer"><div><strong>${c.esc(co.name||'')}</strong><span>${c.esc([co.phone,co.email].filter(Boolean).join(' • '))}</span></div><div>${c.esc(style.footer||'شكراً لتعاملكم معنا')}</div><small>Generated by NovaBlu ERP • 0.11</small></footer>
  </article>`;
}
function showPreview(c,i){
  if(!i)return;
  c.openModal('معاينة الفاتورة',`<div class="invoice-preview-wrap">${invoiceDocument(c,i,false)}</div><div class="invoice-preview-actions no-print"><button class="btn primary" id="previewPrint">${c.icon('receipt',17)} طباعة / PDF</button><button class="btn outline" id="previewShare">${c.icon('arrowdown',17)} مشاركة</button><button class="btn outline" id="previewEdit">${c.icon('sliders',17)} تعديل</button><button class="btn" data-close>إغلاق</button></div>`,true);
  setTimeout(()=>{
    const pp=document.querySelector('#previewPrint');if(pp)pp.onclick=()=>printInvoiceDoc(c,i);
    const ps=document.querySelector('#previewShare');if(ps)ps.onclick=()=>shareInvoice(c,i);
    const pe=document.querySelector('#previewEdit');if(pe)pe.onclick=()=>{c.closeModal();c.quick('invoice',i.id)};
  },0);
}
function printInvoiceDoc(c,i){
  if(!i)return;const w=window.open('','_blank');if(!w){c.toast('اسمح بالنوافذ المنبثقة للطباعة');return}
  const font=Number(c.db.settings.invoiceStyle?.fontSize||12);
  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${c.esc(i.number)}</title><style>
  *{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;margin:0;background:#fff;color:#111;font-size:${font}px}.nb-invoice-doc{width:198mm;max-width:100%;margin:0 auto;padding:7mm}.doc-hero{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}.doc-brandmark{width:18mm;height:18mm;border-radius:5mm;background:#1d4ed8;color:#fff;display:grid;place-items:center;font-size:9mm;font-weight:900}.doc-brandcopy h1{margin:0;font-size:20px}.doc-brandcopy span,.doc-title span,.doc-data-grid span,.doc-meta span,.doc-footer span,.doc-footer small{display:block;color:#666;font-size:10px}.doc-title{text-align:left}.doc-title strong{font-size:16px;color:#1d4ed8}.doc-rule{height:2px;background:#1d4ed8;margin:4mm 0}.doc-info-layout{display:grid;grid-template-columns:1.4fr .8fr;gap:4mm}.doc-customer{border:1px solid #dbe3ef;border-radius:4mm;overflow:hidden}.doc-customer h3{margin:0;padding:3mm 4mm;background:#eff6ff;color:#1e40af;font-size:12px}.doc-data-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;padding:2mm 4mm}.doc-data-grid>div{padding:2mm;border-bottom:1px dotted #d5dbe5}.doc-data-grid strong,.doc-meta strong{display:block;margin-top:1mm}.doc-meta{display:grid;gap:2mm}.doc-meta>div{border:1px solid #dbe3ef;border-radius:3mm;padding:2.2mm 3mm}.doc-products{margin-top:4mm}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#0f172a;color:#fff}th,td{border:1px solid #dce2ea;padding:2mm 1.5mm;text-align:center}th:nth-child(2),td:nth-child(2){text-align:right;width:34%}.doc-product small{display:block;color:#666;margin-top:1mm;font-size:9px}.doc-summary{width:48%;margin-right:auto;margin-top:4mm;border:1px solid #cbd5e1;border-radius:3mm;overflow:hidden}.doc-summary>div{display:flex;justify-content:space-between;padding:2mm 3mm;border-bottom:1px solid #e5e7eb}.doc-summary>div:last-child{border:0}.doc-grand{background:#1d4ed8;color:#fff;font-size:14px}.doc-due{color:#b45309}.doc-notes{margin-top:4mm;border:1px solid #dbe3ef;border-radius:3mm;padding:3mm}.doc-notes p{margin:2mm 0 0;line-height:1.6}.doc-footer{margin-top:5mm;padding-top:3mm;border-top:1px solid #cbd5e1;display:grid;grid-template-columns:1fr 1fr auto;gap:3mm;align-items:end}.doc-footer>div:nth-child(2){text-align:center}.doc-footer small{text-align:left}@page{size:A4 portrait;margin:4mm}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.nb-invoice-doc{padding:3mm}.doc-brandmark{width:15mm;height:15mm}.doc-products{margin-top:2.5mm}th,td{padding:1.4mm 1mm}.doc-summary{margin-top:2.5mm}.doc-notes{margin-top:2.5mm}.doc-footer{margin-top:3mm}}
  </style></head><body>${invoiceDocument(c,i,true)}<script>window.onload=()=>{setTimeout(()=>window.print(),100)}<\/script></body></html>`);
  w.document.close();
}
async function shareInvoice(c,i){
  if(!i)return;const cs=safeCustomer(c,i),t=c.invTotals(i);
  const text=`${c.db.settings.invoiceStyle?.title||'فاتورة'} ${i.number}\n${cs.name||'عميل نقدي'}\nالإجمالي: ${c.fmt(t.total)}\nالمدفوع: ${c.fmt(t.paid)}\nالمتبقي: ${c.fmt(t.due)}`;
  try{
    if(navigator.share){await navigator.share({title:`فاتورة ${i.number}`,text});c.audit('مشاركة فاتورة','Invoice',i.number);c.save()}
    else if(navigator.clipboard){await navigator.clipboard.writeText(text);c.toast('تم نسخ ملخص الفاتورة للمشاركة')}
    else c.toast('المشاركة غير مدعومة في هذا المتصفح');
  }catch(e){if(e?.name!=='AbortError')c.toast('تعذر فتح المشاركة')}
}
window.NBINVOICE={viewSales,invoiceForm,invLine,readInvoiceForm,wireSales,wireInvoiceForm,wireInvoiceLines,printInvoiceDoc,showPreview,shareInvoice,duplicateInvoice,invoiceDocument};
})();
