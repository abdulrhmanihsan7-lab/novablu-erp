(function(){
'use strict';
let ctx=null,currentRoute='',history=[],bound=false,restoreTimer=null;
function migrate(c){
 const d=c.db;d.meta=d.meta||{};d.meta.version=Math.max(Number(d.meta.version||1),13);
 d.ui=d.ui||{};d.ui.routeScroll=d.ui.routeScroll||{};d.ui.routeHistory=d.ui.routeHistory||[];
 d.userPreferences=d.userPreferences||{};const p=d.userPreferences[d.session.userId]||(d.userPreferences[d.session.userId]={});
 Object.assign(p,{fontScale:p.fontScale||100,highContrast:!!p.highContrast,compactTables:!!p.compactTables,keyboardHints:p.keyboardHints!==false});
 d.settings.modules=d.settings.modules||{};if(d.settings.modules.experience===undefined)d.settings.modules.experience=true;
 const acts=['view','create','edit','delete','approve','export'];
 Object.keys(d.permissions||{}).forEach(role=>{if(!d.permissions[role].experience){d.permissions[role].experience={};acts.forEach(a=>d.permissions[role].experience[a]=a==='view'||['Owner','Admin'].includes(role))}});
 history=[...(d.ui.routeHistory||[])].slice(-20);
}
function pref(c){return c.db.userPreferences[c.db.session.userId]||(c.db.userPreferences[c.db.session.userId]={})}
function applyPrefs(c){
 const p=pref(c);document.documentElement.style.setProperty('--nb-font-scale',(Number(p.fontScale||100)/100));
 document.body.classList.toggle('high-contrast',!!p.highContrast);document.body.classList.toggle('compact-tables',!!p.compactTables);
}
function labelTables(root=document){
 root.querySelectorAll('table').forEach(table=>{
  const heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
  table.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>{if(heads[i]&&!td.dataset.label)td.dataset.label=heads[i]}));
 });
}
function accessibility(root=document){
 root.querySelectorAll('button').forEach(b=>{if(!b.getAttribute('aria-label')&&!b.textContent.trim())b.setAttribute('aria-label',b.title||'زر')});
 root.querySelectorAll('input,select,textarea').forEach(el=>{
  if(!el.getAttribute('aria-label')&&!el.id){const lab=el.closest('.field')?.querySelector('label')?.textContent?.trim();if(lab)el.setAttribute('aria-label',lab)}
  if(el.type==='tel'||/phone|mobile/i.test(el.name||''))el.setAttribute('inputmode','tel');
  if(el.type==='number')el.setAttribute('inputmode','decimal');
 });
 root.querySelectorAll('.modal').forEach(m=>{m.setAttribute('role','dialog');m.setAttribute('aria-modal','true')});
}
function saveScroll(c,route){if(!route)return;c.db.ui.routeScroll[route]=window.scrollY||document.documentElement.scrollTop||0}
function restoreScroll(c,route){clearTimeout(restoreTimer);restoreTimer=setTimeout(()=>window.scrollTo({top:Number(c.db.ui.routeScroll[route]||0),behavior:'auto'}),0)}
function pushRoute(c,route){
 if(!route)return;if(history[history.length-1]!==route)history.push(route);history=history.slice(-25);c.db.ui.routeHistory=[...history];currentRoute=route;
}
function goBack(c){
 if(history.length<2){c.setRoute('dashboard');c.render();return}
 history.pop();const target=history.pop()||'dashboard';c.db.ui.routeHistory=[...history];c.setRoute(target);c.render();
}
function enhanceHead(c,route){
 const h=document.querySelector('.page-head .actions');if(!h||document.querySelector('#nbBackBtn'))return;
 const b=document.createElement('button');b.id='nbBackBtn';b.className='btn outline ux-back';b.innerHTML='← رجوع';b.title='Alt + ←';b.onclick=()=>goBack(c);h.prepend(b);
}
function routeCapture(c){
 if(bound)return;bound=true;
 document.addEventListener('click',e=>{
  const r=e.target.closest('[data-route]');if(r&&currentRoute)saveScroll(c,currentRoute);
 },true);
 document.addEventListener('keydown',e=>{
  const tag=document.activeElement?.tagName?.toLowerCase(),typing=['input','textarea','select'].includes(tag);
  if(e.key==='Escape'){
   if(document.querySelector('#modalRoot .modal')){c.closeModal();return}
   document.querySelector('#accountMenu')?.classList.add('hidden');document.querySelector('#quickMenu')?.classList.add('hidden');
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
   const form=document.activeElement?.closest('form')||document.querySelector('#view form');if(form){e.preventDefault();form.requestSubmit?.()}
  }
  if(e.altKey&&e.key==='ArrowLeft'){e.preventDefault();saveScroll(c,currentRoute);goBack(c)}
  if(e.key==='/'&&!typing){e.preventDefault();document.querySelector('#globalSearch')?.focus()}
  if(e.key==='?'&&!typing){e.preventDefault();showShortcuts(c)}
 },true);
}
function showShortcuts(c){
 c.openModal('اختصارات NovaBlu',`<div class="shortcut-grid"><div><kbd>/</kbd><span>بحث عام</span></div><div><kbd>Ctrl + S</kbd><span>حفظ النموذج الحالي</span></div><div><kbd>Esc</kbd><span>إغلاق النافذة</span></div><div><kbd>Alt + ←</kbd><span>رجوع</span></div><div><kbd>Ctrl + K</kbd><span>Command Palette</span></div><div><kbd>?</kbd><span>هذه الشاشة</span></div></div><div class="notice">الاختصارات لا تعمل داخل حقول الكتابة إلا Ctrl+S عند وجود نموذج.</div>`,false)
}
function view(c){
 const p=pref(c);
 return c.pageHead('تجربة المستخدم','إعدادات شخصية لهذا المستخدم فقط',`<button class="btn outline" id="showShortcuts">اختصارات الكيبورد</button>`)+
 `<div class="saas-grid2"><section class="card"><div class="card-head"><h3>المظهر والقراءة</h3></div><div class="field"><label>حجم الواجهة <strong id="fontScaleValue">${p.fontScale}%</strong></label><input id="fontScale" type="range" min="90" max="120" step="5" value="${p.fontScale}"></div><label class="ux-toggle"><input id="highContrast" type="checkbox" ${p.highContrast?'checked':''}><div><strong>High Contrast</strong><small>يزيد وضوح الحدود والنصوص</small></div></label><label class="ux-toggle"><input id="compactTables" type="checkbox" ${p.compactTables?'checked':''}><div><strong>جداول مضغوطة</strong><small>مفيد للشاشات الكبيرة وكثرة السجلات</small></div></label><label class="ux-toggle"><input id="keyboardHints" type="checkbox" ${p.keyboardHints?'checked':''}><div><strong>تلميحات الاختصارات</strong><small>إظهار اختصارات الاستخدام المتقدم</small></div></label></section>
 <section class="card"><div class="card-head"><h3>التنقل الذكي</h3></div><div class="readiness-row"><span>حفظ مكان الصفحة</span><b class="good-text">فعال</b></div><div class="readiness-row"><span>رجوع لنفس المسار</span><b class="good-text">فعال</b></div><div class="readiness-row"><span>حفظ آخر ${history.length} مسار</span><b class="good-text">فعال</b></div><div class="readiness-row"><span>Mobile table labels</span><b class="good-text">فعال</b></div><button class="btn outline" id="clearNavHistory">مسح سجل التنقل فقط</button></section></div>
 <div class="card"><div class="card-head"><h3>اختصارات العمل</h3></div><div class="shortcut-grid"><div><kbd>/</kbd><span>بحث عام</span></div><div><kbd>Ctrl + S</kbd><span>حفظ</span></div><div><kbd>Esc</kbd><span>إغلاق</span></div><div><kbd>Alt + ←</kbd><span>رجوع</span></div><div><kbd>Ctrl + K</kbd><span>أوامر سريعة</span></div><div><kbd>?</kbd><span>المساعدة</span></div></div></div>`;
}
function wire(c){
 const p=pref(c),scale=document.querySelector('#fontScale');if(scale)scale.oninput=()=>{p.fontScale=Number(scale.value);document.querySelector('#fontScaleValue').textContent=scale.value+'%';applyPrefs(c);c.save()};
 const hc=document.querySelector('#highContrast');if(hc)hc.onchange=()=>{p.highContrast=hc.checked;applyPrefs(c);c.save()};
 const ct=document.querySelector('#compactTables');if(ct)ct.onchange=()=>{p.compactTables=ct.checked;applyPrefs(c);c.save()};
 const kh=document.querySelector('#keyboardHints');if(kh)kh.onchange=()=>{p.keyboardHints=kh.checked;c.save()};
 document.querySelector('#showShortcuts')?.addEventListener('click',()=>showShortcuts(c));
 document.querySelector('#clearNavHistory')?.addEventListener('click',()=>{history=[];c.db.ui.routeHistory=[];c.db.ui.routeScroll={};c.save('تم مسح سجل التنقل فقط');c.render()});
}
function postRender(c,route){
 ctx=c;applyPrefs(c);routeCapture(c);pushRoute(c,route);enhanceHead(c,route);labelTables(document.querySelector('#view')||document);accessibility(document);restoreScroll(c,route);
 const p=pref(c);if(p.keyboardHints&&!document.querySelector('#nbShortcutHint')){const x=document.createElement('button');x.id='nbShortcutHint';x.className='shortcut-hint';x.textContent='?';x.title='اختصارات الاستخدام';x.onclick=()=>showShortcuts(c);document.body.appendChild(x)}
 if(!p.keyboardHints)document.querySelector('#nbShortcutHint')?.remove();
}
window.NBFINALUX={migrate,view,wire,postRender,goBack,showShortcuts,labelTables,accessibility,applyPrefs};
})();