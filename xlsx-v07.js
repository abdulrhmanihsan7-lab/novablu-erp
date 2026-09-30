
(function(){
'use strict';
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function u16(v){const a=new Uint8Array(2);new DataView(a.buffer).setUint16(0,v,true);return a}
function u32(v){const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,v>>>0,true);return a}
function cat(parts){let len=0;parts.forEach(x=>len+=x.length);const out=new Uint8Array(len);let p=0;parts.forEach(x=>{out.set(x,p);p+=x.length});return out}
function zip(entries){
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 for(const e of entries){
  const name=enc.encode(e.name),data=enc.encode(e.data),crc=crc32(data);
  const local=cat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
  parts.push(local);
  central.push(cat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));
  offset+=local.length;
 }
 const cdStart=offset,cdSize=central.reduce((s,x)=>s+x.length,0);
 const end=cat([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(cdSize),u32(cdStart),u16(0)]);
 return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function col(i){let s='';i++;while(i){s=String.fromCharCode(65+(i-1)%26)+s;i=Math.floor((i-1)/26)}return s}
function download(name,rows){
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+
 rows.map((r,ri)=>'<row r="'+(ri+1)+'">'+r.map((v,ci)=>{const ref=col(ci)+(ri+1);return typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t>'+esc(v)+'</t></is></c>'}).join('')+'</row>').join('')+'</sheetData></worksheet>';
 const entries=[
  {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'},
  {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
  {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="NovaBlu" sheetId="1" r:id="rId1"/></sheets></workbook>'},
  {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'},
  {name:'xl/worksheets/sheet1.xml',data:sheet}
 ];
 const blob=zip(entries),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
window.NBXLSX={download};
})();
