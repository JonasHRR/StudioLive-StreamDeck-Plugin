/* Local property inspector. No remote scripts, fonts or requests. */
'use strict';
let socket, context, actionId, actionSettings={}, isLevel=false, mixerRequest, mixerTimer, mixerSequence=0;
const mixerSession=Date.now().toString(36)+Math.random().toString(36).slice(2);
const namesRequest=`${mixerSession}-names`;
let targetNames={};
const $=id=>document.getElementById(id);
const editable=['target','channel','mix','mode','name','autoName','operation','db','duration','floor','colorMode','customColor'];
const targets={line:['Input · Main',64],additionalinput:['Additional inputs',4],main:['Main bus',1],sub:['Subgroup',4],aux:['Mix bus',16],fxbus:['FX bus',4],fxreturn:['FX return',4],group:['Mute group',8],auxsend:['Input → Aux send',64],fxsend:['Input → FX send',64]};
// One UI category, with the existing stored targets retained for compatibility.
const additionalInputs=[{kind:'auxinput',channel:1,label:'A1'},{kind:'auxinput',channel:2,label:'A2'},{kind:'tape',channel:1,label:'Tape'},{kind:'talkback',channel:1,label:'Talkback'}];
function send(event,payload) {if(socket?.readyState===WebSocket.OPEN) socket.send(JSON.stringify({event,action:actionId,context,payload}));}
function requestMixer(operation,ip) {
  clearTimeout(mixerTimer);
  mixerRequest={id:`${mixerSession}-${++mixerSequence}`,operation};
  $('save').disabled=true; $('ip').disabled=true;
  $('message').textContent=operation==='save'?'Saving mixer IP …':'Loading mixer IP …';
  send('sendToPlugin',{type:'mixerSettings',operation,requestId:mixerRequest.id,...(ip===undefined?{}:{ip})});
  mixerTimer=setTimeout(()=>{mixerRequest=undefined;$('save').disabled=false;$('ip').disabled=false;$('message').textContent='No confirmation received. Reopen the settings or try saving again.';},8000);
}
function fill(id,entries,selected) {$(id).innerHTML=''; for(const [value,label] of entries) $(id).add(new Option(label,value)); $(id).value=selected;}
function numbers(count,prefix,kind) {
  if(kind==='additionalinput')return additionalInputs.map((input,i)=>{const name=targetNames[input.kind]?.[input.channel-1];return [i+1,`${input.label}${name?` · ${name}`:''}`];});
  return Array.from({length:count},(_,i)=>{const name=targetNames[kind]?.[i];return [i+1,`${prefix} ${i+1}${name?` · ${name}`:''}`];});
}
function renderNumbers(channel,mix) {
  const type=$('target').value,kind=type.endsWith('send')?'line':type,count=targets[type]?.[1] ?? 64;
  fill('channel',numbers(count,type==='group'?'Group':'No.',kind),channel);
  fill('mix',numbers(type==='fxsend'?4:16,type==='fxsend'?'FX':'Aux',type==='fxsend'?'fxbus':'aux'),mix);
}
function render() {
  const inputIndex=additionalInputs.findIndex(input=>input.kind===actionSettings.target && input.channel===Number(actionSettings.channel ?? 1));
  const type=inputIndex>=0?'additionalinput':actionSettings.target ?? 'line';
  fill('target',Object.entries(targets).filter(([key])=>!isLevel || !['group','auxsend','fxsend'].includes(key)).map(([key,value])=>[key,value[0]]),type);
  renderNumbers(inputIndex>=0?inputIndex+1:actionSettings.channel ?? 1,actionSettings.mix ?? 1);
  $('sendRow').hidden=!type.endsWith('send');
  $('mode').value=actionSettings.mode ?? 'toggle'; $('name').value=actionSettings.name ?? '';
  $('autoName').checked=actionSettings.autoName!==false;
  $('colorMode').value=actionSettings.colorMode==='custom'?'custom':'auto';
  $('customColor').value=typeof actionSettings.customColor==='string' && /^#[0-9a-f]{6}$/i.test(actionSettings.customColor)?actionSettings.customColor:(isLevel?'#174e89':'#06685c');
  $('operation').value=actionSettings.operation ?? 'stop'; $('db').value=actionSettings.db ?? 0; $('duration').value=actionSettings.duration ?? 0;
  $('floor').checked=$('operation').value==='set' && Number(actionSettings.db)===-84;
  $('heading').textContent=isLevel?'StudioLive · Level / Fade':'StudioLive · Mute';
  $('muteFields').hidden=isLevel; $('levelFields').hidden=!isLevel;
  for(const id of editable) $(id).disabled=false; levelFields(); colorFields();
}
function colorFields() {$('colorRow').hidden=$('colorMode').value!=='custom';$('customColor').disabled=$('colorMode').value!=='custom';}
function levelFields() {
  const operation=$('operation').value;
  $('levelValues').hidden=operation==='stop';
  $('floorRow').hidden=operation!=='set';
  $('toggleHelp').hidden=operation!=='toggle';
  $('dbLabel').hidden=operation==='toggle'; $('db').hidden=operation==='toggle';
  $('db').disabled=operation==='stop' || operation==='toggle' || (operation==='set' && $('floor').checked);
  $('dbLabel').textContent=operation==='step'?'Change (≈ dB, e.g. +1 or −1)':'Target level (≈ dB)';
  $('db').min=operation==='step'?-12:-60; $('db').max=operation==='step'?12:10;
}
function saveAction() {
  const input=$('target').value==='additionalinput'?additionalInputs[Number($('channel').value)-1]:undefined;
  const type=input?.kind ?? $('target').value;
  actionSettings={...actionSettings,channel:input?.channel ?? Number($('channel').value),mode:$('mode').value,name:$('name').value};
  // Keep unchanged legacy fields absent for a simple, lossless upgrade.
  if(type!=='line' || actionSettings.target!==undefined) actionSettings.target=type;
  if(String($('target').value).endsWith('send')) actionSettings.mix=Number($('mix').value);
  if(!$('autoName').checked || actionSettings.autoName!==undefined) actionSettings.autoName=$('autoName').checked;
  if($('colorMode').value!=='auto' || actionSettings.colorMode!==undefined)actionSettings.colorMode=$('colorMode').value;
  if($('colorMode').value==='custom' && /^#[0-9a-f]{6}$/i.test($('customColor').value))actionSettings.customColor=$('customColor').value;
  if(isLevel) Object.assign(actionSettings,{operation:$('operation').value,db:$('operation').value==='toggle'?0:$('operation').value==='set' && $('floor').checked?-84:Number($('db').value),duration:Number($('duration').value)});
  send('setSettings',actionSettings);
}
window.connectElgatoStreamDeckSocket=function(port,uuid,registerEvent,info,actionInfo) {
  // PI commands must use this connection's registration context, not actionInfo.context.
  const action=JSON.parse(actionInfo); context=uuid; actionId=action.action; isLevel=action.action==='de.local.studiolive-mutes.level';
  actionSettings=action.payload.settings || {}; render();
  socket=new WebSocket(`ws://127.0.0.1:${port}`);
  socket.onopen=()=>{socket.send(JSON.stringify({event:registerEvent,uuid})); requestMixer('load'); send('getSettings'); send('sendToPlugin',{type:'targetNames',requestId:namesRequest}); $('connection').textContent='Button settings are saved automatically.';};
  socket.onmessage=event=>{
    const data=JSON.parse(event.data);
    if(data.event==='didReceiveSettings') {actionSettings=data.payload.settings || {}; render();}
    if(data.event==='sendToPropertyInspector' && data.payload?.type==='targetNames' && data.payload.requestId===namesRequest){
      targetNames={};
      for(const [kind,count] of Object.entries({...targets,auxinput:['',2],tape:['',1],talkback:['',1]})){
        const names=data.payload.names?.[kind];
        if(Array.isArray(names))targetNames[kind]=names.slice(0,count[1]).map(name=>typeof name==='string'?name.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,128):'');
      }
      // Update only the labels: do not reset an in-progress edit in other fields.
      renderNumbers($('channel').value,$('mix').value);
    }
    if(data.event==='sendToPropertyInspector' && data.payload?.type==='mixerSettings' && mixerRequest && data.payload.requestId===mixerRequest.id) {
      const operation=mixerRequest.operation; clearTimeout(mixerTimer); mixerRequest=undefined;
      $('ip').disabled=false; $('save').disabled=false;
      if(data.payload.ok) { $('ip').value=data.payload.settings?.ip ?? ''; $('message').textContent=operation==='save'?'Mixer IP saved on this computer.':'Mixer IP loaded. Enter and save an address if needed.'; }
      else $('message').textContent=data.payload.message ?? 'Could not save mixer IP. Try again.';
    }
  };
  socket.onclose=()=>{clearTimeout(mixerTimer);mixerRequest=undefined;$('connection').textContent='Disconnected from Stream Deck. Reopen the settings.'; for(const id of [...editable,'ip','save']) $(id).disabled=true;};
  socket.onerror=()=>{$('message').textContent='Could not connect to Stream Deck.';};
};
for(const id of ['channel','mix','mode','name','autoName','db','customColor']) $(id).onchange=saveAction;
$('colorMode').onchange=()=>{colorFields();saveAction();};
$('floor').onchange=()=>{if($('floor').checked)$('db').value=-84;else if(Number($('db').value)===-84)$('db').value=0;levelFields();saveAction();};
$('duration').onchange=()=>{levelFields(); saveAction();};
$('target').onchange=()=>{actionSettings={...actionSettings,target:$('target').value==='additionalinput'?'auxinput':$('target').value,channel:1,mix:1}; render(); saveAction();};
$('operation').onchange=()=>{if($('operation').value==='step') $('db').value=1; else if(['set','toggle'].includes($('operation').value)) $('db').value=0; if($('operation').value==='toggle' && Number($('duration').value)===0)$('duration').value=3; $('floor').checked=false; levelFields(); saveAction();};
$('save').onclick=()=>{
  const ip=$('ip').value.trim(), parts=ip.split('.');
  if(parts.length!==4 || parts.some(p=>!/^(0|[1-9]\d{0,2})$/.test(p) || Number(p)>255) || Number(parts[0])===0 || Number(parts[0])>=224) {$('message').textContent='Enter a valid IPv4 unicast address.'; return;}
  if(ip===window.STUDIOLIVE_DEFAULT_IP) {$('message').textContent='Enter the actual mixer IP, not the example address.';return;}
  requestMixer('save',ip);
};
