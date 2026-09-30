
(function(){
'use strict';
const patterns={
'0':'101001101101','1':'110100101011','2':'101100101011','3':'110110010101','4':'101001101011','5':'110100110101','6':'101100110101','7':'101001011011','8':'110100101101','9':'101100101101',
'A':'110101001011','B':'101101001011','C':'110110100101','D':'101011001011','E':'110101100101','F':'101101100101','G':'101010011011','H':'110101001101','I':'101101001101','J':'101011001101',
'K':'110101010011','L':'101101010011','M':'110110101001','N':'101011010011','O':'110101101001','P':'101101101001','Q':'101010110011','R':'110101011001','S':'101101011001','T':'101011011001',
'U':'110010101011','V':'100110101011','W':'110011010101','X':'100101101011','Y':'110010110101','Z':'100110110101','-':'100101011011','.':'110010101101',' ':'100110101101','*':'100101101101','$':'100100100101','/':'100100101001','+':'100101001001','%':'101001001001'
};
function clean(v){return String(v||'').toUpperCase().split('').filter(ch=>patterns[ch]&&ch!=='*').join('')}
function svg(value){
 const text='*'+clean(value)+'*';let bits='';
 for(const ch of text)bits+=patterns[ch]+'0';
 let x=0,rects='';
 for(const bit of bits){if(bit==='1')rects+='<rect x="'+x+'" y="0" width="1" height="30"/>';x++}
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+x+' 30" preserveAspectRatio="none" style="width:100%;height:10mm"><g fill="#000">'+rects+'</g></svg>';
}
function printLabels(c,arr){
 const w=window.open('','_blank');if(!w){c.toast('اسمح بالنوافذ المنبثقة');return}
 w.document.write('<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{margin:3mm}body{font-family:Arial;display:grid;grid-template-columns:repeat(3,50mm);gap:2mm;margin:0}.l{width:50mm;height:30mm;border:1px solid #aaa;padding:2mm;box-sizing:border-box;text-align:center;overflow:hidden;page-break-inside:avoid}.l strong{display:block;font-size:9px;white-space:nowrap;overflow:hidden}.l small{display:block;font-family:monospace;font-size:8px}.l b{display:block;font-size:10px}</style></head><body>'+
 arr.map(p=>'<div class="l"><strong>'+c.esc(p.nameAr)+'</strong>'+svg(p.barcode||p.sku)+'<small>'+c.esc(p.barcode||p.sku)+'</small><b>'+c.fmt(p.price)+'</b></div>').join('')+
 '<script>onload=()=>print()<\/script></body></html>');
 w.document.close();
}
window.NBBC={svg,printLabels};
})();
