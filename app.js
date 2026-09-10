const $ = (id) => document.getElementById(id);
const OCR_WORKER_URL = 'https://weighing-ticket-ocr.yilida-material.workers.dev';
const state = { manifestConfirmed:false, receiptConfirmed:false };
const manifestIds = ['manifestNo','manifestDate','vehicleNo','manifestMaterial','declaredWeight','generatorWeighed','manifestNote'];
const receiptIds = ['customerName','customerNo','receiptNo','receiptTransportDate','item1No','item1Name','item1Weight','item2No','item2Name','item2Weight'];

function setValues(values){ Object.entries(values).forEach(([id,value])=>{ if($(id)) $(id).value=value; }); updateCalculations(); }
function number(id){ const value=parseFloat($(id).value); return Number.isFinite(value)?value:null; }
function fmt(value){ return value==null?'—':value.toLocaleString('zh-TW',{minimumFractionDigits:3,maximumFractionDigits:3}); }
function receiptTotal(){ const values=[number('item1Weight'),number('item2Weight')].filter(v=>v!=null); return values.length?values.reduce((a,b)=>a+b,0):null; }
function declaredWeightKg(){ const tons=number('declaredWeight'); return tons==null?null:tons*1000; }
function scaleNet(){ const g=number('grossWeight'),t=number('tareWeight'),d=number('deductionWeight'); return g==null||t==null||d==null?null:g-t-d; }
function toast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1900); }
function refreshScaleCheck(){
  const expected=receiptTotal(),net=scaleNet(),el=$('scaleCheck'); el.className='scale-check';
  if(!state.receiptConfirmed||expected==null){ el.textContent='請先完成收料單確認'; return; }
  if(net==null){ el.textContent='請輸入總重、空重與扣重'; return; }
  const match=Math.abs(net-expected)<0.0001; el.classList.add(match?'match':'mismatch');
  el.textContent=match?`✓ 淨重與實際收貨重量一致：${expected} kg`:`⚠ 磅單淨重應為實際收貨重量 ${expected} kg`;
}

function updateCalculations(){
  $('receiptTotal').textContent=`${receiptTotal()==null?'—':receiptTotal().toLocaleString('zh-TW')} kg`;
  $('declaredKgHint').textContent=`換算：${declaredWeightKg()==null?'—':declaredWeightKg().toLocaleString('zh-TW')} kg`;
  $('scaleNet').textContent=fmt(scaleNet());
  refreshScaleCheck();
  evaluate();
}
function markGroupEdited(group){
  if(!group||!state[`${group}Confirmed`]) return;
  state[`${group}Confirmed`]=false; $(`${group}State`).textContent='資料已修改'; $(`${group}State`).className='state waiting';
  const button=$(group==='manifest'?'confirmManifest':'confirmReceipt'); button.classList.remove('confirmed'); button.textContent=group==='manifest'?'確認聯單正確':'確認收料單正確';
  $(group==='manifest'?'manifestDot':'receiptDot').classList.remove('done'); refreshScaleCheck(); evaluate();
}
function loadManifest(){
  setValues({manifestNo:'M-DEMO-001',manifestDate:'2026-09-08',vehicleNo:'ABC-1234',manifestMaterial:'E-DEMO',declaredWeight:'0.007',generatorWeighed:'yes',manifestNote:''});
  $('manifestState').textContent='待人工確認'; $('manifestState').className='state waiting'; toast('已載入範例聯單資料');
}
function loadReceipt(){
  setValues({customerName:'範例科技股份有限公司',customerNo:'DEMO-001',receiptNo:'R-DEMO-001',receiptTransportDate:'2026-09-08',item1No:'MAT-001',item1Name:'範例物料甲',item1Weight:'7',item2No:'MAT-002',item2Name:'範例物料乙',item2Weight:'4'});
  $('receiptState').textContent='待人工確認'; $('receiptState').className='state waiting'; toast('已載入範例收料單資料');
}
function validate(ids){ const missing=ids.filter(id=>$(id).required&&!$(id).value.trim()); if(missing.length){ $(missing[0]).focus(); toast('請先完成紅框必填欄位'); return false; } return true; }
function confirmGroup(group){
  const isManifest=group==='manifest', ids=isManifest?manifestIds:receiptIds;
  if(!validate(ids)) return;
  state[`${group}Confirmed`]=true;
  $(`${group}State`).textContent='已確認'; $(`${group}State`).className='state ready';
  const button=$(isManifest?'confirmManifest':'confirmReceipt'); button.classList.add('confirmed'); button.textContent=isManifest?'✓ 聯單已確認':'✓ 收料單已確認';
  $(isManifest?'manifestDot':'receiptDot').classList.add('done'); toast('資料已確認'); refreshScaleCheck(); evaluate();
}
function compare(id,match){ const el=$(id); el.textContent=match?'✓ 一致':'⚠ 不一致'; el.className=match?'match':'mismatch'; }
function hideScaleFlow(){ $('scalePrompt').classList.add('hidden'); $('scalePanel').classList.add('hidden'); $('scaleChoiceStatus').textContent=''; }
function offerScaleFlow(){ $('scalePrompt').classList.remove('hidden'); }
function evaluate(){
  const noManifest=$('noManifest').checked;
  const generatorWeighed=$('generatorWeighed').value;
  $('weightRelationGroup').classList.toggle('hidden',noManifest||generatorWeighed==='no');
  const ready=state.receiptConfirmed&&(noManifest||state.manifestConfirmed);
  if(noManifest&&state.receiptConfirmed){
    ['compareNo','compareDate','compareWeight'].forEach(id=>{ $(id).textContent='— 不適用'; $(id).className=''; });
  } else if(ready){
    const manifestNo=$('manifestNo').value.trim();
    $('compareNo').textContent=manifestNo?'✓ 聯單已辨識':'⚠ 無法辨識'; $('compareNo').className=manifestNo?'match':'';
    compare('compareDate',$('manifestDate').value===$('receiptTransportDate').value);
    compare('compareWeight',declaredWeightKg()===receiptTotal());
  } else ['compareNo','compareDate','compareWeight'].forEach(id=>{ $(id).textContent='⚠ 無法辨識'; $(id).className=''; });
  const alert=$('decisionAlert'), relation=document.querySelector('input[name="weightRelation"]:checked')?.value;
  alert.className='decision-alert';
  if(!ready){ hideScaleFlow(); $('decisionName').textContent='請先確認兩張單據'; $('decisionHeadline').textContent='尚未完成判定'; $('decisionInstructions').innerHTML=''; return; }
  const declared=declaredWeightKg(), actual=receiptTotal();
  $('resultDot').classList.add('done');
  if(noManifest){
    alert.classList.add('success'); $('decisionName').textContent='1張－勾1'; $('decisionHeadline').textContent='無聯單，開1張'; $('decisionInstructions').innerHTML=`<div class="instructions"><div class="instruction-block"><h4>收料單怎麼勾</h4><strong>第1張只勾「一」</strong><span>重量填實際收貨重量 ${actual??'待輸入'} kg</span></div><div class="instruction-block scale-guide"><h4>磅單重量怎麼登打</h4><strong>淨重以實際收貨重量 ${actual??'待輸入'} kg 為準</strong><span>輸入總重、空重及扣重，由系統自動計算淨重。</span></div></div>`;
  } else if(!generatorWeighed){
    hideScaleFlow(); $('decisionName').textContent='請確認事業端是否過磅'; $('decisionHeadline').textContent='請查看聯單上的過磅勾選'; $('decisionInstructions').innerHTML=''; return;
  } else if(generatorWeighed==='no'){
    alert.classList.add('success'); $('decisionName').textContent='1張－待確認12'; $('decisionHeadline').textContent='事業端未過磅，以我方實際過磅為準'; $('decisionInstructions').innerHTML=`<div class="instructions"><div class="instruction-block"><h4>收料單怎麼勾</h4><strong>同一張勾「一＋二」</strong><span>事業端未過磅，重量待我方實際過磅確認。</span></div><div class="instruction-block scale-guide"><h4>磅單重量怎麼登打</h4><strong>以我方實際過磅淨重為準</strong><span>輸入總重、空重及扣重，由系統計算我方實際淨重。</span></div></div>`;
  } else if(!relation){
    hideScaleFlow(); $('decisionName').textContent='請選擇重量狀況'; $('decisionHeadline').textContent='重量相等／不相等／目前無法確認'; $('decisionInstructions').innerHTML=''; return;
  } else if(relation==='different'||(declared!=null&&actual!=null&&declared!==actual)){
    alert.classList.add('danger'); $('decisionName').textContent='2張－分12'; $('decisionHeadline').textContent=`${actual} kg ≠ ${declared} kg，必須分2張`;
    $('decisionInstructions').innerHTML=`<div class="instructions"><div class="instruction-block"><h4>收料單怎麼勾</h4><strong>第1張只勾「一」：${actual} kg</strong><strong>第2張只勾「二」：${declared} kg</strong><span>不得將不同重量寫在同一張收料單。</span></div><div class="instruction-block scale-guide"><h4>磅單重量怎麼登打</h4><strong>磅單淨重登打 ${actual} kg，以第1張實收重量為準</strong><span>第2張的 ${declared} kg 是聯單申報重量，不得覆蓋磅單實收淨重。</span></div></div>`;
  } else if(relation==='unknown'){
    alert.classList.add('success'); $('decisionName').textContent='1張－待確認12'; $('decisionHeadline').textContent='開1張，勾「一＋二」'; $('decisionInstructions').innerHTML=`<div class="instructions"><div class="instruction-block"><h4>收料單怎麼勾</h4><strong>同一張勾「一＋二」</strong><span>收料單重量 ${actual??'待確認'} kg</span></div><div class="instruction-block scale-guide"><h4>磅單重量怎麼登打</h4><strong>回廠後依收料單重量 ${actual??'待確認'} kg 登打</strong><span>輸入總重、空重及扣重，使磅單淨重與收料單重量一致。</span></div></div>`;
  } else if(relation==='equal'){
    alert.classList.add('success'); $('decisionName').textContent='1張－勾12'; $('decisionHeadline').textContent='重量相等，開1張'; $('decisionInstructions').innerHTML=`<div class="instructions"><div class="instruction-block"><h4>收料單怎麼勾</h4><strong>同一張勾「一＋二」：${actual??'待輸入'} kg</strong></div><div class="instruction-block scale-guide"><h4>磅單重量怎麼登打</h4><strong>磅單淨重登打 ${actual??'待輸入'} kg</strong><span>輸入總重、空重及扣重，由系統確認淨重一致。</span></div></div>`;
  } else { hideScaleFlow(); $('decisionName').textContent='資料不足'; $('decisionHeadline').textContent='請補齊重量'; return; }
  offerScaleFlow();
}
function cleanOcrText(text){
  return text.normalize('NFKC').replace(/[|｜]/g,'I').replace(/\r/g,'').replace(/[ \t]+/g,' ').trim();
}
function afterLabel(lines,labels){
  const label=labels.map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  for(const line of lines){
    const match=line.match(new RegExp(`(?:${label})\\s*[:：]?\\s*(.+)$`,'i'));
    if(match?.[1]) return match[1].split(/(?:客戶編號|聯單編號|聯單號|日期|車號|備註)\s*[:：]/)[0].trim();
  }
  return null;
}
function firstCode(value){ return value?.match(/[A-Z0-9][A-Z0-9_-]{2,}/i)?.[0]||null; }
function firstDate(value){
  const m=value?.match(/(20\d{2})[\/.\-年]\s*(\d{1,2})[\/.\-月]\s*(\d{1,2})日?/);
  return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:null;
}
function applyRecognized(values,group){
  let count=0;
  Object.entries(values).forEach(([id,value])=>{ if(value!==null&&value!==undefined&&String(value).trim()&&$(id)){ $(id).value=String(value).trim(); count++; } });
  state[`${group}Confirmed`]=false;
  $(`${group}State`).textContent=count?`已辨識 ${count} 欄，請確認`:'無法可靠辨識，請人工輸入';
  $(`${group}State`).className='state waiting'; updateCalculations();
  return count;
}
function parseManifest(text){
  const lines=text.split('\n').map(v=>v.trim()).filter(Boolean), all=lines.join('\n');
  const no=afterLabel(lines,['聯單編號','聯單號','聯單號碼']);
  const date=afterLabel(lines,['載運日期','日期']);
  const vehicle=afterLabel(lines,['車號','車牌']);
  const material=afterLabel(lines,['物料編號','物料代碼','廢棄物代碼']);
  const weightLine=lines.find(v=>/(申報重量|重量)/.test(v));
  const weight=weightLine?.match(/(\d+(?:[,.]\d+)?)\s*(?:噸|公噸|TON|T\b)/i)||weightLine?.match(/(\d+(?:[,.]\d+)?)/);
  return {manifestNo:firstCode(no),manifestDate:firstDate(date||all),vehicleNo:firstCode(vehicle),manifestMaterial:firstCode(material),declaredWeight:weight?weight[1].replace(',',''):null};
}
function parseReceipt(text){
  const lines=text.split('\n').map(v=>v.trim()).filter(Boolean), all=lines.join('\n');
  const customer=afterLabel(lines,['客戶名稱','客戶']);
  const customerNo=afterLabel(lines,['客戶編號','客戶代號']);
  const receiptNo=afterLabel(lines,['收料單號','收料單編號']);
  const date=afterLabel(lines,['載運日期','單據日期','日期']);
  const items=[];
  for(const line of lines){
    const m=line.match(/(?:^|\s)([A-Z0-9]+(?:-[A-Z0-9]+){1,})\s+(.+?)\s+(\d+(?:[,.]\d+)?)\s*(?:kg|公斤)?\s*$/i);
    if(m&&!/(收料單|聯單)/.test(line)) items.push({no:m[1],name:m[2].trim(),weight:m[3].replace(',','')});
  }
  return {customerName:customer,customerNo:firstCode(customerNo),receiptNo:firstCode(receiptNo),receiptTransportDate:firstDate(date||all),item1No:items[0]?.no,item1Name:items[0]?.name,item1Weight:items[0]?.weight,item2No:items[1]?.no,item2Name:items[1]?.name,item2Weight:items[1]?.weight};
}
async function fileSelected(input,status,group){
  const file=input.files?.[0];
  if(!file){ $(status).textContent='尚未選擇照片'; return; }
  $(status).textContent='Gemini 正在辨識照片…';
  try{
    const imageBase64=await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]); reader.onerror=reject; reader.readAsDataURL(file); });
    const response=await fetch(OCR_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document_type:group,mime_type:file.type||'image/jpeg',image_base64:imageBase64})});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error||'辨識服務錯誤');
    const data=payload.data||{};
    const weightedItems=(data.items||[]).filter(item=>item?.net_weight_kg!==null&&item?.net_weight_kg!==''&&Number.isFinite(Number(item.net_weight_kg)));
    const values=group==='manifest'?{
      manifestNo:data.manifest_no,manifestDate:data.date,vehicleNo:data.vehicle_no,manifestMaterial:data.material_name,
      declaredWeight:Number.isFinite(Number(data.declared_weight_kg))?Number(data.declared_weight_kg)/1000:null,generatorWeighed:typeof data.generator_weighed==='boolean'?(data.generator_weighed?'yes':'no'):null,manifestNote:data.note
    }:{
      customerName:data.customer_name,customerNo:data.customer_no,receiptNo:data.receipt_no,receiptTransportDate:data.transport_date,
      item1No:weightedItems[0]?.material_no,item1Name:weightedItems[0]?.material_name,item1Weight:weightedItems[0]?.net_weight_kg,
      item2No:weightedItems[1]?.material_no,item2Name:weightedItems[1]?.material_name,item2Weight:weightedItems[1]?.net_weight_kg
    };
    if(group==='receipt'){
      if(typeof data.check_1==='boolean') $('check1').checked=data.check_1;
      if(typeof data.check_2==='boolean') $('check2').checked=data.check_2;
    }
    const count=applyRecognized(values,group);
    $(status).textContent=count?`辨識完成：已填入 ${count} 欄`:'無法可靠辨識，請人工輸入';
    toast(count?'辨識完成，請逐欄確認':'未辨識到可靠欄位');
  }catch(error){ console.error(error); $(status).textContent=error.message||'辨識失敗，請重拍或人工輸入'; toast('Gemini 照片辨識失敗'); }
  finally{ input.value=''; }
}
function generateSlip(){
  const noManifest=$('noManifest').checked;
  if(!state.receiptConfirmed||(!noManifest&&!state.manifestConfirmed)){ toast(noManifest?'請先確認收料單':'請先確認聯單與收料單'); $('confirmPanel').scrollIntoView({behavior:'smooth'}); return; }
  const net=scaleNet();
  if(net==null){ toast('請先輸入總重、空重與扣重'); $('scalePanel').scrollIntoView({behavior:'smooth'}); return; }
  $('slipCustomer').textContent=`${$('customerNo').value}－${$('customerName').value}`;
  $('slipManifest').textContent=$('manifestNo').value; $('slipVehicle').textContent=$('vehicleNo').value; $('slipReceipt').textContent=$('receiptNo').value;
  $('slipDate').textContent=($('manifestDate').value||$('receiptTransportDate').value).replaceAll('-','.');
  $('slipGross').textContent=fmt(number('grossWeight')); $('slipTare').textContent=fmt(number('tareWeight')); $('slipDeduction').textContent=fmt(number('deductionWeight')); $('slipNet').textContent=fmt(net);
  $('weighSlip').classList.add('visible'); $('scaleDot').classList.add('done'); $('weighSlip').scrollIntoView({behavior:'smooth'});
}
function productionText(){
  const actual=receiptTotal(),declared=declaredWeightKg(),result=$('decisionName').textContent;
  const second=result==='2張－分12'?`\n第2張：只勾「二」，填 ${declared} kg。`:'';
  const first=result==='2張－分12'||result==='1張－勾1'?`只勾「一」，填 ${actual} kg。`:'勾「一＋二」。';
  return `客戶：${$('customerName').value}\n收料單號：${$('receiptNo').value}\n聯單號：${$('manifestNo').value||'無'}\n實際收貨重量：${actual} kg\n聯單申報重量：${declared==null?'不適用':`${declared} kg`}\n判定結果：${result}\n\n第1張：${first}${second}\n磅單：總重 ${number('grossWeight')} kg、空重 ${number('tareWeight')} kg、扣重 ${number('deductionWeight')} kg、淨重 ${scaleNet()} kg；淨重以實際收貨重量 ${actual} kg 為準。`;
}

$('demoManifest').addEventListener('click',loadManifest); $('demoReceipt').addEventListener('click',loadReceipt);
['manifestCamera','manifestGallery'].forEach(id=>$(id).addEventListener('change',e=>fileSelected(e.target,'manifestFile','manifest')));
['receiptCamera','receiptGallery'].forEach(id=>$(id).addEventListener('change',e=>fileSelected(e.target,'receiptFile','receipt')));
$('confirmManifest').addEventListener('click',()=>confirmGroup('manifest')); $('confirmReceipt').addEventListener('click',()=>confirmGroup('receipt'));
document.querySelectorAll('input[name="weightRelation"]').forEach(input=>input.addEventListener('change',()=>{ hideScaleFlow(); evaluate(); })); $('noManifest').addEventListener('change',()=>{ hideScaleFlow(); evaluate(); }); $('generateSlip').addEventListener('click',generateSlip); $('closeSlip').addEventListener('click',()=>$('weighSlip').classList.remove('visible'));
$('startScaleTest').addEventListener('click',()=>{ $('scalePanel').classList.remove('hidden'); $('scaleChoiceStatus').textContent='已選擇進行磅單模擬測試'; $('scalePanel').scrollIntoView({behavior:'smooth'}); });
$('skipScaleTest').addEventListener('click',()=>{ $('scalePanel').classList.add('hidden'); $('scaleChoiceStatus').textContent='已選擇暫不進行磅單模擬'; });
$('printSlip').addEventListener('click',()=>window.print());
$('copyProduction').addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(productionText()); toast('已複製給生管'); }catch{ toast('瀏覽器未允許複製'); } });
document.querySelectorAll('input').forEach(input=>{ if(!['file','checkbox'].includes(input.type)) input.addEventListener('input',()=>{ updateCalculations(); markGroupEdited(input.dataset.group); }); });
document.querySelectorAll('input[data-group][type="checkbox"]').forEach(input=>input.addEventListener('change',()=>markGroupEdited(input.dataset.group)));
document.querySelectorAll('select[data-group]').forEach(input=>input.addEventListener('change',()=>{ updateCalculations(); markGroupEdited(input.dataset.group); }));
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  Promise.resolve(document.modelContext.registerTool({
    name:'load_sample_documents',title:'載入範例單據',description:'載入並確認內建的聯單與收料單範例，更新畫面上的交叉比對與固定規則判定。',
    inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input){ if(input&&Object.keys(input).length) throw new Error('此工具不接受輸入欄位'); loadManifest(); loadReceipt(); confirmGroup('manifest'); confirmGroup('receipt'); return {confirmed:true,result:$('decisionName').textContent,actual_weight_kg:receiptTotal(),declared_weight_ton:number('declaredWeight'),declared_weight_kg:declaredWeightKg()}; }
  },{signal:lifecycle.signal})).catch(()=>{});
}
updateCalculations();
