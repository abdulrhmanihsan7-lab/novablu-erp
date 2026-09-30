(function(){
'use strict';
const stages=[
  {id:'new',name:'جديد',cls:'gray'},
  {id:'contacted',name:'تم التواصل',cls:'purple'},
  {id:'proposal',name:'عرض سعر',cls:'amber'},
  {id:'won',name:'مغلق - ناجح',cls:'green'},
  {id:'lost',name:'مغلق - مفقود',cls:'red'}
];
function migrate(db,moduleKeys){
  db.meta=db.meta||{}; db.meta.version=Math.max(Number(db.meta.version||1),2);
  db.settings=db.settings||{}; db.settings.modules=db.settings.modules||{};
  ['crm','quotes','hr','approvals'].forEach(k=>{if(db.settings.modules[k]===undefined)db.settings.modules[k]=true});
  if(!db.settings.nextQuote)db.settings.nextQuote=1001;
  db.leads=db.leads||[];
  db.quotations=db.quotations||[];
  db.employees=db.employees||[];
  db.attendance=db.attendance||[];
  db.leaveRequests=db.leaveRequests||[];
  db.approvals=db.approvals||[];
  const acts=['view','create','edit','delete','approve','export'];
  Object.keys(db.permissions||{}).forEach(r=>{
    ['crm','quotes','hr','approvals'].forEach(m=>{
      if(!db.permissions[r][m]){
        db.permissions[r][m]={};
        acts.forEach(a=>db.permissions[r][m][a]=(r==='Owner'||r==='Admin'||(r==='Viewer'?a==='view':true)));
      }
    });
  });
  if(!db.leads.length)db.leads.push({id:'lead-demo',companyId:db.session.companyId,title:'فرصة مبيعات تجريبية',customerName:'شركة جديدة',phone:'07700000000',value:250000,stage:'new',owner:'مدير النظام',nextAction:'اتصال متابعة',createdAt:Date.now()});
  if(!db.employees.length)db.employees.push({id:'emp-demo',companyId:db.session.companyId,name:'موظف تجريبي',jobTitle:'مبيعات',phone:'07700000001',email:'employee@example.com',salary:750000,status:'active',joinedAt:new Date().toISOString().slice(0,10)});
  if(!db.approvals.length)db.approvals.push({id:'ap-demo',companyId:db.session.companyId,type:'شراء',title:'اعتماد طلب شراء تجريبي',requester:'موظف المشتريات',amount:315000,status:'pending',createdAt:Date.now()});
}
function leadBadge(c,s){const st=stages.find(x=>x.id===s)||stages[0];return '<span class="badge '+st.cls+'">'+st.name+'</span>'}
function viewCRM(c){
  const db=c.db, leads=db.leads.filter(x=>x.companyId===db.session.companyId);
  let body='<div style="display:grid;grid-template-columns:repeat(5,minmax(230px,1fr));gap:12px;overflow:auto;padding-bottom:8px">';
  stages.forEach(st=>{
    const xs=leads.filter(x=>x.stage===st.id);
    body+='<div class="card crm-stage" data-crm-stage="'+st.id+'" style="margin:0;min-height:260px"><div class="card-head"><h3>'+st.name+'</h3><div class="grow"></div><span class="badge '+st.cls+'">'+xs.length+'</span></div>';
    body+=xs.map(x=>'<div class="stat-row crm-lead-card" draggable="true" data-lead-drag="'+x.id+'" style="align-items:flex-start"><div class="grow"><strong>'+c.esc(x.title)+'</strong><div class="sub">'+c.esc(x.customerName||'')+' • '+c.esc(x.phone||'')+'</div><div style="margin-top:7px;font-weight:800">'+c.fmt(x.value||0)+'</div><div class="sub" style="margin-top:4px">التالي: '+c.esc(x.nextAction||'—')+'</div></div><button class="btn sm" data-lead="'+x.id+'">فتح</button></div>').join('')||'<div class="empty">لا توجد فرص</div>';
    body+='</div>';
  });
  body+='</div>';
  return c.pageHead('CRM وإدارة الفرص','من أول تواصل إلى إغلاق الصفقة','<button class="btn primary" id="newLead">＋ فرصة جديدة</button>')+body;
}
function leadForm(c,id){
  const db=c.db,l=id?db.leads.find(x=>x.id===id):{id:'',title:'',customerName:'',phone:'',value:0,stage:'new',owner:c.currentUser().name,nextAction:''};
  return '<form id="leadForm" data-id="'+c.esc(l.id||'')+'"><div class="form-grid">'+
  '<div class="field"><label>عنوان الفرصة</label><input name="title" value="'+c.esc(l.title)+'" required></div>'+
  '<div class="field"><label>اسم العميل / الشركة</label><input name="customerName" value="'+c.esc(l.customerName||'')+'"></div>'+
  '<div class="field"><label>الهاتف</label><input name="phone" value="'+c.esc(l.phone||'')+'"></div>'+
  '<div class="field"><label>القيمة المتوقعة</label><input name="value" type="number" min="0" value="'+Number(l.value||0)+'"></div>'+
  '<div class="field"><label>المرحلة</label><select name="stage">'+stages.map(s=>'<option value="'+s.id+'" '+(s.id===l.stage?'selected':'')+'>'+s.name+'</option>').join('')+'</select></div>'+
  '<div class="field"><label>المسؤول</label><input name="owner" value="'+c.esc(l.owner||'')+'"></div>'+
  '<div class="field full"><label>الإجراء التالي</label><input name="nextAction" value="'+c.esc(l.nextAction||'')+'"></div>'+
  '</div><div class="toolbar" style="margin-top:15px"><button class="btn primary">حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>';
}
function viewQuotes(c){
  const db=c.db, qs=db.quotations.filter(x=>x.companyId===db.session.companyId);
  return c.pageHead('عروض الأسعار','إنشاء واعتماد وتحويل العرض إلى فاتورة','<button class="btn primary" id="newQuote">＋ عرض سعر</button>')+
  '<div class="card responsive-table"><div class="table-wrap"><table><thead><tr><th>الرقم</th><th>العميل</th><th>التاريخ</th><th>صالح لغاية</th><th>القيمة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>'+
  qs.map(q=>'<tr><td data-label="الرقم"><strong>'+c.esc(q.number)+'</strong></td><td data-label="العميل">'+c.esc((db.customers.find(x=>x.id===q.customerId)||{}).name||'—')+'</td><td data-label="التاريخ">'+c.esc(q.date)+'</td><td data-label="صالح لغاية">'+c.esc(q.validUntil||'')+'</td><td data-label="القيمة">'+c.fmt(q.amount||0)+'</td><td data-label="الحالة">'+quoteStatus(q.status)+'</td><td data-label="إجراء"><button class="btn sm" data-quote="'+q.id+'">تعديل</button> '+(q.status!=='accepted'?'<button class="btn green sm" data-quote-invoice="'+q.id+'">تحويل لفاتورة</button>':'')+'</td></tr>').join('')+
  '</tbody></table></div></div>';
}
function quoteStatus(s){const map={draft:['مسودة','gray'],sent:['مرسل','purple'],accepted:['مقبول','green'],rejected:['مرفوض','red'],expired:['منتهي','amber']};const a=map[s]||map.draft;return '<span class="badge '+a[1]+'">'+a[0]+'</span>'}
function quoteForm(c,id){
  const db=c.db,q=id?db.quotations.find(x=>x.id===id):{id:'',number:'Q-'+db.settings.nextQuote,date:c.today(),validUntil:'',customerId:'',amount:0,status:'draft',notes:''};
  return '<form id="quoteForm" data-id="'+c.esc(q.id||'')+'"><div class="form-grid">'+
  '<div class="field"><label>رقم العرض</label><input name="number" value="'+c.esc(q.number)+'" required></div>'+
  '<div class="field"><label>العميل</label><select name="customerId"><option value="">— اختر —</option>'+db.customers.filter(x=>x.companyId===db.session.companyId).map(x=>'<option value="'+x.id+'" '+(x.id===q.customerId?'selected':'')+'>'+c.esc(x.name)+'</option>').join('')+'</select></div>'+
  '<div class="field"><label>التاريخ</label><input name="date" type="date" value="'+c.esc(q.date)+'"></div>'+
  '<div class="field"><label>صالح لغاية</label><input name="validUntil" type="date" value="'+c.esc(q.validUntil||'')+'"></div>'+
  '<div class="field"><label>القيمة الإجمالية</label><input name="amount" type="number" min="0" value="'+Number(q.amount||0)+'"></div>'+
  '<div class="field"><label>الحالة</label><select name="status"><option value="draft" '+(q.status==='draft'?'selected':'')+'>مسودة</option><option value="sent" '+(q.status==='sent'?'selected':'')+'>مرسل</option><option value="accepted" '+(q.status==='accepted'?'selected':'')+'>مقبول</option><option value="rejected" '+(q.status==='rejected'?'selected':'')+'>مرفوض</option></select></div>'+
  '<div class="field full"><label>ملاحظات</label><textarea name="notes">'+c.esc(q.notes||'')+'</textarea></div>'+
  '</div><div class="toolbar" style="margin-top:15px"><button class="btn primary">حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>';
}
function viewHR(c){
  const db=c.db, emps=db.employees.filter(x=>x.companyId===db.session.companyId), today=c.today();
  const present=new Set(db.attendance.filter(x=>x.companyId===db.session.companyId&&x.date===today&&x.checkIn).map(x=>x.employeeId)).size;
  const leaves=db.leaveRequests.filter(x=>x.companyId===db.session.companyId&&x.status==='pending').length;
  return c.pageHead('الموارد البشرية','الموظفون والحضور والإجازات','<button class="btn primary" id="newEmployee">＋ موظف</button>')+
  '<div class="grid kpis"><div class="kpi"><div class="lab">إجمالي الموظفين</div><div class="val">'+emps.length+'</div></div><div class="kpi"><div class="lab">الحضور اليوم</div><div class="val">'+present+'</div></div><div class="kpi"><div class="lab">طلبات إجازة</div><div class="val">'+leaves+'</div></div><div class="kpi"><div class="lab">إجمالي الرواتب</div><div class="val">'+c.fmt(emps.reduce((s,x)=>s+Number(x.salary||0),0))+'</div></div></div>'+
  '<div class="card responsive-table"><div class="card-head"><h3>الموظفون</h3><div class="grow"></div><button class="btn sm" id="newLeave">طلب إجازة</button></div><div class="table-wrap"><table><thead><tr><th>الموظف</th><th>الوظيفة</th><th>الهاتف</th><th>الراتب</th><th>الحالة</th><th>الحضور</th><th>إجراء</th></tr></thead><tbody>'+
  emps.map(e=>{const a=db.attendance.find(x=>x.employeeId===e.id&&x.date===today);return '<tr><td data-label="الموظف"><strong>'+c.esc(e.name)+'</strong></td><td data-label="الوظيفة">'+c.esc(e.jobTitle||'')+'</td><td data-label="الهاتف">'+c.esc(e.phone||'')+'</td><td data-label="الراتب">'+c.fmt(e.salary||0)+'</td><td data-label="الحالة">'+(e.status==='active'?'<span class="badge green">نشط</span>':'<span class="badge gray">موقوف</span>')+'</td><td data-label="الحضور">'+(a&&a.checkIn?'<span class="badge green">دخول '+c.esc(a.checkIn)+'</span> '+(a.checkOut?'<span class="badge gray">خروج '+c.esc(a.checkOut)+'</span>':'<button class="btn sm" data-checkout="'+e.id+'">خروج</button>'):'<button class="btn sm" data-checkin="'+e.id+'">تسجيل دخول</button>')+'</td><td data-label="إجراء"><button class="btn sm" data-employee="'+e.id+'">تعديل</button></td></tr>'}).join('')+
  '</tbody></table></div></div>'+
  '<div class="card"><div class="card-head"><h3>طلبات الإجازة</h3></div>'+(db.leaveRequests.filter(x=>x.companyId===db.session.companyId).map(x=>'<div class="stat-row"><div class="grow"><strong>'+c.esc((db.employees.find(e=>e.id===x.employeeId)||{}).name||'')+'</strong><div class="sub">'+c.esc(x.from)+' → '+c.esc(x.to)+' • '+c.esc(x.reason||'')+'</div></div>'+approvalBadge(x.status)+'</div>').join('')||'<div class="empty">لا توجد طلبات</div>')+'</div>';
}
function employeeForm(c,id){
  const db=c.db,e=id?db.employees.find(x=>x.id===id):{id:'',name:'',jobTitle:'',phone:'',email:'',salary:0,status:'active',joinedAt:c.today()};
  return '<form id="employeeForm" data-id="'+c.esc(e.id||'')+'"><div class="form-grid">'+
  '<div class="field"><label>اسم الموظف</label><input name="name" value="'+c.esc(e.name)+'" required></div>'+
  '<div class="field"><label>المسمى الوظيفي</label><input name="jobTitle" value="'+c.esc(e.jobTitle||'')+'"></div>'+
  '<div class="field"><label>الهاتف</label><input name="phone" value="'+c.esc(e.phone||'')+'"></div>'+
  '<div class="field"><label>البريد</label><input name="email" type="email" value="'+c.esc(e.email||'')+'"></div>'+
  '<div class="field"><label>الراتب</label><input name="salary" type="number" min="0" value="'+Number(e.salary||0)+'"></div>'+
  '<div class="field"><label>تاريخ المباشرة</label><input name="joinedAt" type="date" value="'+c.esc(e.joinedAt||c.today())+'"></div>'+
  '<div class="field"><label>الحالة</label><select name="status"><option value="active" '+(e.status==='active'?'selected':'')+'>نشط</option><option value="inactive" '+(e.status==='inactive'?'selected':'')+'>موقوف</option></select></div>'+
  '</div><div class="toolbar" style="margin-top:15px"><button class="btn primary">حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></form>';
}
function leaveForm(c){
  const db=c.db;
  return '<form id="leaveForm"><div class="form-grid"><div class="field"><label>الموظف</label><select name="employeeId">'+db.employees.filter(x=>x.companyId===db.session.companyId&&x.status==='active').map(e=>'<option value="'+e.id+'">'+c.esc(e.name)+'</option>').join('')+'</select></div><div class="field"><label>من</label><input name="from" type="date" value="'+c.today()+'"></div><div class="field"><label>إلى</label><input name="to" type="date" value="'+c.today()+'"></div><div class="field full"><label>السبب</label><input name="reason"></div></div><div class="toolbar" style="margin-top:15px"><button class="btn primary">إرسال الطلب</button><button type="button" class="btn" data-close>إلغاء</button></div></form>';
}
function approvalBadge(s){return s==='approved'?'<span class="badge green">موافق</span>':s==='rejected'?'<span class="badge red">مرفوض</span>':'<span class="badge amber">بانتظار</span>'}
function viewApprovals(c){
 const db=c.db,xs=db.approvals.filter(x=>x.companyId===db.session.companyId);
 return c.pageHead('الموافقات','طلبات الشراء والمصروفات والموارد البشرية','<button class="btn primary" id="newApproval">＋ طلب موافقة</button>')+
 '<div class="card">'+(xs.map(x=>'<div class="stat-row"><div class="grow"><strong>'+c.esc(x.title)+'</strong><div class="sub">'+c.esc(x.type)+' • بواسطة '+c.esc(x.requester||'')+(x.amount?' • '+c.fmt(x.amount):'')+'</div></div>'+approvalBadge(x.status)+(x.status==='pending'?'<button class="btn green sm" data-approve="'+x.id+'">موافقة</button><button class="btn red sm" data-reject="'+x.id+'">رفض</button>':'')+'</div>').join('')||'<div class="empty">لا توجد طلبات</div>')+'</div>';
}
function approvalForm(c){
 return '<form id="approvalForm"><div class="form-grid"><div class="field"><label>نوع الطلب</label><select name="type"><option>شراء</option><option>مصروف</option><option>إجازة</option><option>خصم</option><option>أخرى</option></select></div><div class="field"><label>العنوان</label><input name="title" required></div><div class="field"><label>المبلغ</label><input name="amount" type="number" min="0" value="0"></div><div class="field"><label>مقدم الطلب</label><input name="requester" value="'+c.esc(c.currentUser().name)+'"></div></div><div class="toolbar" style="margin-top:15px"><button class="btn primary">إرسال</button><button type="button" class="btn" data-close>إلغاء</button></div></form>';
}
function quick(c,type,id){
 if(type==='lead'){c.openModal(id?'تعديل الفرصة':'فرصة جديدة',leadForm(c,id),false);setTimeout(()=>wire(c,'crm'),0);return true}
 if(type==='quote'){c.openModal(id?'تعديل عرض السعر':'عرض سعر جديد',quoteForm(c,id),false);setTimeout(()=>wire(c,'quotes'),0);return true}
 if(type==='employee'){c.openModal(id?'تعديل الموظف':'موظف جديد',employeeForm(c,id),false);setTimeout(()=>wire(c,'hr'),0);return true}
 return false;
}
function wire(c,route){
 const db=c.db;
 if(route==='crm'){
   let dragging='';
   document.querySelectorAll('[data-lead-drag]').forEach(el=>{
     el.ondragstart=e=>{dragging=el.dataset.leadDrag;el.classList.add('dragging');if(e.dataTransfer)e.dataTransfer.effectAllowed='move'};
     el.ondragend=()=>{el.classList.remove('dragging');document.querySelectorAll('[data-crm-stage]').forEach(x=>x.classList.remove('drag-over'))};
   });
   document.querySelectorAll('[data-crm-stage]').forEach(col=>{
     col.ondragover=e=>{e.preventDefault();col.classList.add('drag-over')};
     col.ondragleave=()=>col.classList.remove('drag-over');
     col.ondrop=e=>{e.preventDefault();col.classList.remove('drag-over');const l=db.leads.find(x=>x.id===dragging);if(l&&l.stage!==col.dataset.crmStage){const old=l.stage;l.stage=col.dataset.crmStage;c.audit('نقل فرصة CRM','CRM',l.title+' '+old+' → '+l.stage);c.save('تم تحديث مرحلة الفرصة');c.render()}};
   });
 }

 const nl=document.querySelector('#newLead'); if(nl)nl.onclick=()=>quick(c,'lead');
 document.querySelectorAll('[data-lead]').forEach(b=>b.onclick=()=>quick(c,'lead',b.dataset.lead));
 const lf=document.querySelector('#leadForm'); if(lf)lf.onsubmit=e=>{e.preventDefault();const fd=new FormData(lf),id=lf.dataset.id||c.uid('lead'),o={id,companyId:db.session.companyId,title:fd.get('title'),customerName:fd.get('customerName'),phone:fd.get('phone'),value:Number(fd.get('value')||0),stage:fd.get('stage'),owner:fd.get('owner'),nextAction:fd.get('nextAction'),createdAt:(db.leads.find(x=>x.id===id)||{}).createdAt||c.now()};const ix=db.leads.findIndex(x=>x.id===id);if(ix>=0)db.leads[ix]=o;else db.leads.unshift(o);c.audit(ix>=0?'تعديل فرصة':'إنشاء فرصة','CRM',o.title);c.save('تم حفظ الفرصة');c.closeModal();c.render()};
 const nq=document.querySelector('#newQuote'); if(nq)nq.onclick=()=>quick(c,'quote');
 document.querySelectorAll('[data-quote]').forEach(b=>b.onclick=()=>quick(c,'quote',b.dataset.quote));
 const qf=document.querySelector('#quoteForm'); if(qf)qf.onsubmit=e=>{e.preventDefault();const fd=new FormData(qf),id=qf.dataset.id||c.uid('q'),old=db.quotations.find(x=>x.id===id),o={id,companyId:db.session.companyId,number:fd.get('number'),customerId:fd.get('customerId'),date:fd.get('date'),validUntil:fd.get('validUntil'),amount:Number(fd.get('amount')||0),status:fd.get('status'),notes:fd.get('notes'),createdAt:(old||{}).createdAt||c.now()};const ix=db.quotations.findIndex(x=>x.id===id);if(ix>=0)db.quotations[ix]=o;else{db.quotations.unshift(o);db.settings.nextQuote++}c.audit(ix>=0?'تعديل عرض سعر':'إنشاء عرض سعر','Quotation',o.number);c.save('تم حفظ عرض السعر');c.closeModal();c.render()};
 document.querySelectorAll('[data-quote-invoice]').forEach(b=>b.onclick=()=>{const q=db.quotations.find(x=>x.id===b.dataset.quoteInvoice);if(!q)return;const no=db.settings.invoicePrefix+'-'+db.settings.nextInvoice++;db.invoices.unshift({id:c.uid('inv'),companyId:db.session.companyId,branchId:db.session.branchId,warehouseId:(c.warehouse()||{}).id||'',number:no,date:c.today(),customerId:q.customerId,status:'confirmed',items:[{productId:'',name:'حسب عرض السعر '+q.number,qty:1,price:Number(q.amount||0),discount:0,tax:0}],shipping:0,discount:0,notes:'تم التحويل من '+q.number+(q.notes?' — '+q.notes:''),payments:[],createdAt:c.now(),deletedAt:null});q.status='accepted';c.audit('تحويل عرض سعر إلى فاتورة','Quotation',q.number+' → '+no);c.save('تم إنشاء الفاتورة '+no);c.setRoute('sales');c.render()});
 const ne=document.querySelector('#newEmployee'); if(ne)ne.onclick=()=>quick(c,'employee');
 document.querySelectorAll('[data-employee]').forEach(b=>b.onclick=()=>quick(c,'employee',b.dataset.employee));
 const ef=document.querySelector('#employeeForm'); if(ef)ef.onsubmit=e=>{e.preventDefault();const fd=new FormData(ef),id=ef.dataset.id||c.uid('emp'),old=db.employees.find(x=>x.id===id),o={id,companyId:db.session.companyId,name:fd.get('name'),jobTitle:fd.get('jobTitle'),phone:fd.get('phone'),email:fd.get('email'),salary:Number(fd.get('salary')||0),status:fd.get('status'),joinedAt:fd.get('joinedAt')};const ix=db.employees.findIndex(x=>x.id===id);if(ix>=0)db.employees[ix]=o;else db.employees.unshift(o);c.audit(ix>=0?'تعديل موظف':'إضافة موظف','HR',o.name);c.save('تم حفظ الموظف');c.closeModal();c.render()};
 document.querySelectorAll('[data-checkin]').forEach(b=>b.onclick=()=>{const id=b.dataset.checkin;if(db.attendance.some(x=>x.employeeId===id&&x.date===c.today()&&x.checkIn))return;db.attendance.unshift({id:c.uid('att'),companyId:db.session.companyId,employeeId:id,date:c.today(),checkIn:new Date().toLocaleTimeString('ar-IQ',{hour:'2-digit',minute:'2-digit'}),checkOut:''});c.audit('تسجيل حضور','HR',(db.employees.find(x=>x.id===id)||{}).name||'');c.save('تم تسجيل الحضور');c.render()});
 document.querySelectorAll('[data-checkout]').forEach(b=>b.onclick=()=>{const a=db.attendance.find(x=>x.employeeId===b.dataset.checkout&&x.date===c.today());if(a){a.checkOut=new Date().toLocaleTimeString('ar-IQ',{hour:'2-digit',minute:'2-digit'});c.audit('تسجيل انصراف','HR',(db.employees.find(x=>x.id===b.dataset.checkout)||{}).name||'');c.save('تم تسجيل الانصراف');c.render()}});
 const lv=document.querySelector('#newLeave'); if(lv)lv.onclick=()=>{c.openModal('طلب إجازة',leaveForm(c),false);setTimeout(()=>wire(c,'hr'),0)};
 const lform=document.querySelector('#leaveForm'); if(lform)lform.onsubmit=e=>{e.preventDefault();const fd=new FormData(lform),o={id:c.uid('leave'),companyId:db.session.companyId,employeeId:fd.get('employeeId'),from:fd.get('from'),to:fd.get('to'),reason:fd.get('reason'),status:'pending',createdAt:c.now()};db.leaveRequests.unshift(o);db.approvals.unshift({id:c.uid('ap'),companyId:db.session.companyId,type:'إجازة',title:'طلب إجازة',requester:(db.employees.find(x=>x.id===o.employeeId)||{}).name||'',amount:0,status:'pending',refType:'leave',refId:o.id,createdAt:c.now()});c.audit('طلب إجازة','HR',o.reason);c.save('تم إرسال طلب الإجازة');c.closeModal();c.render()};
 const na=document.querySelector('#newApproval'); if(na)na.onclick=()=>{c.openModal('طلب موافقة',approvalForm(c),false);setTimeout(()=>wire(c,'approvals'),0)};
 const af=document.querySelector('#approvalForm'); if(af)af.onsubmit=e=>{e.preventDefault();const fd=new FormData(af),o={id:c.uid('ap'),companyId:db.session.companyId,type:fd.get('type'),title:fd.get('title'),requester:fd.get('requester'),amount:Number(fd.get('amount')||0),status:'pending',createdAt:c.now()};db.approvals.unshift(o);c.audit('إنشاء طلب موافقة','Approvals',o.title);c.save('تم إرسال الطلب');c.closeModal();c.render()};
 document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>approvalAction(c,b.dataset.approve,'approved'));
 document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>approvalAction(c,b.dataset.reject,'rejected'));
}
function approvalAction(c,id,status){
 const db=c.db,a=db.approvals.find(x=>x.id===id);if(!a)return;a.status=status;
 if(a.refType==='leave'){const l=db.leaveRequests.find(x=>x.id===a.refId);if(l)l.status=status}
 c.audit(status==='approved'?'اعتماد طلب':'رفض طلب','Approvals',a.title);c.save(status==='approved'?'تمت الموافقة':'تم الرفض');c.render();
}
window.NBPRO={migrate,viewCRM,viewQuotes,viewHR,viewApprovals,quick,wire};
})();