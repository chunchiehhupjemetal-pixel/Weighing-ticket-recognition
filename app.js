const $ = (id) => document.getElementById(id);
const state = { manifestConfirmed:false, receiptConfirmed:false };
const manifestIds = ['manifestNo','manifestDate','vehicleNo','manifestMaterial','declaredWeight','manifestNote'];
const receiptIds = ['customerName','customerNo','receiptNo','receiptManifestNo','receiptTransportDate','item1No','item1Name','item1Weight','item2No','item2Name','item2Weight'];

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
  setValues({manifestNo:'M-DEMO-001',manifestDate:'2026-09-08',vehicleNo:'ABC-1234',manifestMaterial:'E-DEMO',declaredWeight:'0.007',manifestNote:''});
  $('manifestState').textContent='待人工確認'; $('manifestState').className='state waiting'; toast('已載入範例聯單資料');
}
function loadReceipt(){
  setValues({customerName:'範例科技股份有限公司',customerNo:'DEMO-001',receiptNo:'R-DEMO-001',receiptManifestNo:'M-DEMO-001',receiptTransportDate:'2026-09-08',item1No:'MAT-001',item1Name:'範例物料甲',item1Weight:'7',item2No:'MAT-002',item2Name:'範例物料乙',item2Weight:'4'});
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
function evaluate(){
  const noManifest=$('noManifest').checked;
  const ready=state.receiptConfirmed&&(noManifest||state.manifestConfirmed);
  if(noManifest&&state.receiptConfirmed){
    ['compareNo','compareDate','compareWeight'].forEach(id=>{ $(id).textContent='— 不適用'; $(id).className=''; });
  } else if(ready){
    compare('compareNo',$('manifestNo').value.trim()===$('receiptManifestNo').value.trim());
    compare('compareDate',$('manifestDate').value===$('receiptTransportDate').value);
    compare('compareWeight',declaredWeightKg()===receiptTotal());
  } else ['compareNo','compareDate','compareWeight'].forEach(id=>{ $(id).textContent='⚠ 無法辨識'; $(id).className=''; });
  const alert=$('decisionAlert'), unknown=$('weightUnknown').checked;
  alert.className='decision-alert';
  if(!ready){ $('decisionName').textContent='請先確認兩張單據'; $('decisionHeadline').textContent='尚未完成判定'; $('decisionInstructions').innerHTML=''; return; }
  const declared=declaredWeightKg(), actual=receiptTotal();
  $('resultDot').classList.add('done');
  if(noManifest){
    alert.classList.add('success'); $('decisionName').textContent='1張－勾1'; $('decisionHeadline').textContent='無聯單，開1張'; $('decisionInstructions').innerHTML=`<div class="instructions"><div class="instruction-block"><h4>收料單怎麼勾</h4><strong>第1張只勾「一」</strong><span>重量填實際收貨重量 ${actual??'待輸入'} kg</span></div><div class="instruction-block scale-guide"><h4>磅單重量怎麼登打</h4><strong>淨重以實際收貨重量 ${actual??'待輸入'} kg 為準</strong><span>輸入總重、空重及扣重，由系統自動計算淨重。</span></div></div>`;
  } else if(declared!=null&&actual!=null&&declared!==actual){
    alert.classList.add('danger'); $('decisionName').textContent='2張－分12'; $('decisionHeadline').textContent=`${actual} kg ≠ ${declared} kg，必須分2張`;
    $('decisionInstructions').innerHTML=`<div class="instructions"><div class="instruction-block"><h4>收料單怎麼勾</h4><strong>第1張只勾「一」：${actual} kg</strong><strong>第2張只勾「二」：${declared} kg</strong><span>不得將不同重量寫在同一張收料單。</span></div><div class="instruction-block scale-guide"><h4>磅單重量怎麼登打</h4><strong>磅單淨重登打 ${actual} kg，以第1張實收重量為準</strong><span>第2張的 ${declared} kg 是聯單申報重量，不得覆蓋磅單實收淨重。</span></div></div>`;
  } else if(unknown){
    alert.classList.add('success'); $('decisionName').textContent='1張－待確認12'; $('decisionHeadline').textContent='開1張，勾「一＋二」'; $('decisionInstructions').innerHTML=`<div class="instructions"><div class="instruction-block"><h4>收料單怎麼勾</h4><strong>同一張勾「一＋二」</strong><span>收料單重量 ${actual??'待確認'} kg</span></div><div class="instruction-block scale-guide"><h4>磅單重量怎麼登打</h4><strong>回廠後依收料單重量 ${actual??'待確認'} kg 登打</strong><span>輸入總重、空重及扣重，使磅單淨重與收料單重量一致。</span></div></div>`;
  } else if(declared!=null&&actual!=null){
    alert.classList.add('success'); $('decisionName').textContent='1張－勾12'; $('decisionHeadline').textContent='重量一致，開1張'; $('decisionInstructions').innerHTML=`<div class="instructions"><div class="instruction-block"><h4>收料單怎麼勾</h4><strong>同一張勾「一＋二」：${actual} kg</strong></div><div class="instruction-block scale-guide"><h4>磅單重量怎麼登打</h4><strong>磅單淨重登打 ${actual} kg</strong><span>輸入總重、空重及扣重，由系統確認淨重一致。</span></div></div>`;
  } else { $('decisionName').textContent='資料不足'; $('decisionHeadline').textContent='請補齊重量'; }
}
function fileSelected(input,status){ const file=input.files?.[0]; $(status).textContent=file?`已選擇：${file.name}`:'尚未選擇照片'; if(file) toast('測試版已收到照片，請用範例資料模擬辨識'); }
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
['manifestCamera','manifestGallery'].forEach(id=>$(id).addEventListener('change',e=>fileSelected(e.target,'manifestFile')));
['receiptCamera','receiptGallery'].forEach(id=>$(id).addEventListener('change',e=>fileSelected(e.target,'receiptFile')));
$('confirmManifest').addEventListener('click',()=>confirmGroup('manifest')); $('confirmReceipt').addEventListener('click',()=>confirmGroup('receipt'));
$('weightUnknown').addEventListener('change',evaluate); $('noManifest').addEventListener('change',evaluate); $('generateSlip').addEventListener('click',generateSlip); $('closeSlip').addEventListener('click',()=>$('weighSlip').classList.remove('visible'));
$('printSlip').addEventListener('click',()=>window.print());
$('copyProduction').addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(productionText()); toast('已複製給生管'); }catch{ toast('瀏覽器未允許複製'); } });
document.querySelectorAll('input').forEach(input=>{ if(!['file','checkbox'].includes(input.type)) input.addEventListener('input',()=>{ updateCalculations(); markGroupEdited(input.dataset.group); }); });
document.querySelectorAll('input[data-group][type="checkbox"]').forEach(input=>input.addEventListener('change',()=>markGroupEdited(input.dataset.group)));
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
