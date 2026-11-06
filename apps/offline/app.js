import {preferencesKey,readPreferences} from '/packages/content/src/preferences.ts';
import {BIOMES} from '/packages/content/src/index.ts';
import {stateHash,season,validateWorld,weatherAt} from '/packages/sim-core/src/index.ts';
import {parseArchive,serializeArchive} from '/packages/storage/src/archive.ts';
import {metricMaximum,metricsCsv,observationReport} from '/packages/sim-core/src/metrics.ts';
import * as storage from './storage.js';
import {renderSettlements,appendSettlementDetails,drawSettlements} from './settlement-ui.js';
const $=selector=>document.querySelector(selector);
let world=null,id=null,revision=0,dirty=false,running=false,busy=false,failed=false,selected=null,page='world',requestId=0,zoom=1,ox=0,oy=0,drag=null,terrain=null,worker;
const pending=new Map(),canvas=$('#map'),ctx=canvas.getContext('2d');
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
function setRunning(value){running=value;$('#play').textContent=value?'Ⅱ':'▶';$('#play').setAttribute('aria-label',value?'暂停模拟':'开始模拟');$('#run-status').textContent=value?'运行中':world?'已暂停':'等待世界';}
function error(e){setRunning(false);$('#error').textContent=e instanceof Error?e.message:String(e);$('#error').hidden=false;}
function connect(){
  worker=new Worker('/packages/sim-worker/src/worker.ts',{type:'module'});failed=false;
  worker.onmessage=event=>{const item=pending.get(event.data.id);if(!item)return;clearTimeout(item.timer);pending.delete(event.data.id);if(event.data.error)item.reject(new Error(event.data.error));else item.resolve(event.data.world);};
  worker.onerror=()=>{failed=true;setRunning(false);for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('模拟线程停止，当前快照保留。请导出备份后重新打开世界。'));}pending.clear();updateControls();};
}
connect();
function send(payload){return new Promise((resolve,reject)=>{const rid=++requestId,timer=setTimeout(()=>{pending.delete(rid);failed=true;worker.terminate();reject(new Error('模拟响应超时，已暂停。请导出备份后重新打开世界。'));},30000);pending.set(rid,{resolve,reject,timer});worker.postMessage({...payload,id:rid});});}
function updateControls(){for(const key of ['step','save','growth'])$('#'+key).disabled=!world||busy||failed;$('#play').disabled=!world||failed;$('#step').disabled||=running;$('#export').disabled=!world;$('#export-csv').disabled=!world;$('#create-submit').disabled=busy;$('#new-world').disabled=busy;$('#import').disabled=busy;$('#open-archive').disabled=busy;document.querySelectorAll('#inspector-content button').forEach(b=>b.disabled=busy||failed);}
async function perform(fn){if(busy)return;busy=true;$('#error').hidden=true;updateControls();try{await fn();}catch(e){error(e);}finally{busy=false;updateControls();}}
function canLeave(){return !dirty||confirm('当前世界有未保存变化。仍要切换世界吗？');}
const calendar=tick=>`第 ${Math.floor(tick/8640)+1} 年 · ${Math.floor(tick/24)%360+1} 日 · ${tick%24}:00`;
const fmt=n=>new Intl.NumberFormat('zh-CN').format(n);
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function showPage(next){page=next;for(const p of ['world','history','data'])$('#'+p+'-page').hidden=p!==next;document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===next));$('#page-name').textContent={world:'世界观察台',history:'世界编年史',data:'真实数据'}[next];if(next==='world')requestAnimationFrame(draw);if(next==='data')requestAnimationFrame(charts);if(next==='history')history();}
document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>showPage(button.dataset.page));
function render(){
  if(!world)return;
  const weather=weatherAt(world);
  $('#welcome').hidden=true;$('#world-name').textContent=world.config.name;$('#world-description').textContent=`种子 ${world.config.seed} · ${calendar(world.tick)} · ${season(world.tick)}季${weather?' · '+weather.name:''}${dirty?' · 有未保存变化':''}`;
  const agents=world.agents.filter(a=>a.alive);$('#population').textContent=fmt(agents.length);$('#food').textContent=fmt(world.tiles.reduce((s,t)=>s+t.food,0));$('#harvested').textContent=fmt(world.totals.harvested);$('#tick').textContent=fmt(world.tick);$('#calendar').textContent=calendar(world.tick);$('#map-size').textContent=`${world.config.size} × ${world.config.size}`;$('#resident-count').textContent=agents.length;$('#latest').textContent=world.events.at(-1)?.text??'暂无事件';$('#growth').value=world.rules.growth;
  const list=$('#residents');list.replaceChildren();
  for(const a of agents){const button=node('button',undefined,'resident');button.append(node('span',String(a.id).padStart(2,'0'),'avatar'));const info=node('span',a.name);info.append(node('small',a.action));button.append(info,node('span','›'));button.onclick=()=>{selected=a.y*world.config.size+a.x;inspect();draw();};list.append(button);}
  $('#hash').textContent=`状态校验值 ${stateHash(world)} · ${world.metrics.length} 个采样点`;
  renderSettlements(world,index=>{selected=index;inspect();draw();});makeTerrain();draw();inspect();if(page==='data')charts();if(page==='history')history();updateControls();
}
function makeTerrain(){if(!world)return;const size=world.config.size;terrain=document.createElement('canvas');terrain.width=size;terrain.height=size;const tc=terrain.getContext('2d'),image=tc.createImageData(size,size);world.tiles.forEach((t,i)=>{let c=BIOMES[t.biome].color;const layer=$('#layer').value;if(layer==='food'&&t.walkable){const v=t.capacity?t.food/t.capacity:0;c=(Math.floor(170-v*70)<<16)|(Math.floor(65+v*110)<<8)|70;}if(layer==='fertility'&&t.walkable)c=(Math.floor(160-t.fertility)<<16)|((60+t.fertility)<<8)|85;image.data.set([c>>16&255,c>>8&255,c&255,255],i*4);});tc.putImageData(image,0,0);}
function fit(){if(!world)return;const rect=canvas.getBoundingClientRect(),size=world.config.size;zoom=Math.min(rect.width/size,rect.height/size)*.9;ox=(rect.width-size*zoom)/2;oy=(rect.height-size*zoom)/2;draw();}
function draw(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#172522';ctx.fillRect(0,0,rect.width,rect.height);if(!world||!terrain)return;ctx.save();ctx.translate(ox,oy);ctx.scale(zoom,zoom);ctx.imageSmoothingEnabled=false;ctx.drawImage(terrain,0,0);drawSettlements(ctx,world,zoom);for(const a of world.agents)if(a.alive){ctx.fillStyle=a.action==='休息'?'#a3b4d9':'#ffe8ac';ctx.strokeStyle='#263a2d';ctx.lineWidth=.09;ctx.beginPath();ctx.arc(a.x+.5,a.y+.5,.3,0,Math.PI*2);ctx.fill();ctx.stroke();}if(selected!==null){ctx.strokeStyle='#ffe4a0';ctx.lineWidth=.18;ctx.strokeRect(selected%world.config.size,Math.floor(selected/world.config.size),1,1);}ctx.restore();}
new ResizeObserver(()=>{draw();if(page==='data')charts();}).observe($('.map-wrap'));
$('#fit').onclick=fit;canvas.ondblclick=fit;
canvas.onwheel=e=>{if(!world)return;e.preventDefault();const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,old=zoom;zoom=Math.min(40,Math.max(.5,zoom*(e.deltaY<0?1.15:.87)));ox=x-(x-ox)*zoom/old;oy=y-(y-oy)*zoom/old;draw();};
canvas.onpointerdown=e=>{canvas.focus();drag={x:e.clientX,y:e.clientY,ox,oy};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!drag||!world)return;ox=drag.ox+e.clientX-drag.x;oy=drag.oy+e.clientY-drag.y;draw();};
canvas.onpointerup=e=>{if(world&&drag&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5){const rect=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-rect.left-ox)/zoom),y=Math.floor((e.clientY-rect.top-oy)/zoom),n=world.config.size;if(x>=0&&x<n&&y>=0&&y<n){selected=y*n+x;inspect();draw();}}drag=null;};canvas.onpointercancel=()=>drag=null;
canvas.onkeydown=e=>{if(!world)return;const deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-world.config.size,ArrowDown:world.config.size};if(e.key in deltas){e.preventDefault();const n=world.config.size;selected=Math.max(0,Math.min(n*n-1,(selected??Math.floor(n*n/2))+deltas[e.key]));inspect();draw();}};
$('#layer').onchange=()=>{makeTerrain();draw();};
function inspect(){const panel=$('#inspector-content');if(!world||selected===null)return;const t=world.tiles[selected],n=world.config.size;panel.replaceChildren(node('span','TILE INSPECTOR','eyebrow'),node('h2',`${BIOMES[t.biome].name} (${selected%n}, ${Math.floor(selected/n)})`));const dl=node('dl');for(const [name,value]of [['海拔',t.elevation],['湿度',t.moisture+'%'],['土壤肥力',t.fertility+'%'],['食物',`${t.food} / ${t.capacity}`],['可通行',t.walkable?'是':'否']])dl.append(node('dt',name),node('dd',String(value)));panel.append(dl);appendSettlementDetails(panel,world,selected);if(t.walkable){const b=node('button','＋ 补充 30 单位食物','secondary wide');b.disabled=busy||failed;b.onclick=()=>perform(async()=>{world=await send({type:'command',command:{type:'addFood',tile:selected,amount:30}});dirty=true;render();});panel.append(b);
    if(world.engine==='0.4.3'||world.engine==='0.4.4'||(world.engine==='0.4.5'||world.engine==='0.4.6')){
      const place=node('button','投放居民','secondary wide');
      place.disabled=busy||failed;
      place.onclick=()=>{
        const input=prompt('投放人数（10–100）','10');
        if(input!==null)void perform(async()=>{world=await send({type:'command',command:{type:'placeResidents',tile:selected,count:Number(input)}});dirty=true;render();});
      };
      panel.append(place);
    }
  }const agents=world.agents.filter(a=>a.alive&&a.y*n+a.x===selected);for(const a of agents){const card=node('div',undefined,'agent-card');card.append(node('h3',`${a.name} · ${a.action}`));for(const [name,value]of [['饥饿',a.hunger],['精力',a.energy],['健康',a.health]]){const label=node('label',`${name} ${value}%`),meter=node('meter');meter.min=0;meter.max=100;meter.value=value;card.append(label,meter);}card.append(node('p',`背包食物 ${a.food}/12 · 采集经验 ${a.skill}`),node('blockquote',a.reason));panel.append(card);}if(!agents.length)panel.append(node('p','此刻没有居民停留。','muted'));}
async function step(ticks=1){await perform(async()=>{world=await send({type:'advance',ticks});dirty=true;render();});}
$('#play').onclick=()=>{setRunning(!running);updateControls();};$('#step').onclick=()=>step();
setInterval(()=>{if(running&&!busy&&!failed)void step(Number($('#speed').value));},200);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&world&&!failed&&!e.target.matches('input,select,button,textarea')&&!document.querySelector('dialog[open]')){e.preventDefault();setRunning(!running);updateControls();}});
const createDialog=$('#create-dialog');const openCreate=()=>{setRunning(false);updateControls();createDialog.showModal();};$('#new-world').onclick=openCreate;$('#first-world').onclick=openCreate;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(!busy)$('#'+b.dataset.close).close();});
createDialog.oncancel=e=>{if(busy)e.preventDefault();};
$('#create-form').onsubmit=e=>{e.preventDefault();if(!canLeave())return;void perform(async()=>{if(failed){worker.terminate();connect();}const data=new FormData(e.target);const config={name:data.get('name'),seed:data.get('seed'),preset:data.get('preset'),size:Number(data.get('size')),population:Number(data.get('population'))};world=await send({type:'init',config});id=crypto.randomUUID();revision=0;dirty=true;selected=null;createDialog.close();showPage('world');render();fit();toast('世界已诞生。点击 ▶ 开始模拟。');});};
async function refreshArchives(){const records=(await storage.list()).sort((a,b)=>b.updated-a.updated);$('#save-count').textContent=records.length;return records;}
$('#save').onclick=()=>{setRunning(false);void perform(async()=>{revision=await storage.save(id,world,revision);dirty=false;render();await refreshArchives();toast('已保存到当前浏览器。');});};
async function renderArchiveList(){const records=await refreshArchives(),list=$('#archive-list');list.replaceChildren();if(!records.length)list.append(node('p','还没有存档。创建世界后点击“保存”。','muted'));for(const saved of records){const row=node('div',undefined,'archive-row'),info=node('div');info.append(node('strong',saved.world.config.name),node('small',calendar(saved.world.tick)));const open=node('button','打开 ↗','secondary');open.onclick=()=>{if(!canLeave())return;void perform(async()=>{validateWorld(saved.world);if(failed){worker.terminate();connect();}world=await send({type:'load',world:saved.world});id=saved.id;revision=saved.revision;dirty=false;selected=null;$('#archive-dialog').close();showPage('world');render();fit();});};const del=node('button','删除');del.onclick=()=>{if(confirm(`删除“${saved.world.config.name}”？无法撤销。`))void perform(async()=>{try{await storage.remove(saved.id,saved.revision);}catch(error){$('#archive-dialog').close();throw error;}if(id===saved.id){id=crypto.randomUUID();revision=0;dirty=true;}row.remove();await refreshArchives();});};const rename=node('button','重命名'),copy=node('button','复制');
    const edit=duplicate=>{
      const oldName=saved.world.config.name;
      const name=prompt(duplicate?'副本名称':'新的世界名称',duplicate?oldName.slice(0,77)+' 副本':oldName);
      if(name===null)return;
      void perform(async()=>{
        const snapshot={...saved.world,config:{...saved.world.config,name:name.trim()}};
        try {
          await storage.save(duplicate?crypto.randomUUID():saved.id,snapshot,duplicate?0:saved.revision);
        } catch(error) {
          $('#archive-dialog').close();
          throw error;
        }
        await renderArchiveList();
      });
    };
    rename.onclick=()=>edit(false);copy.onclick=()=>edit(true);
    row.append(info,open,rename,copy,del);list.append(row);
  }
}
$('#open-archive').onclick=()=>{setRunning(false);void perform(async()=>{await renderArchiveList();$('#archive-dialog').showModal();});};
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export').onclick=()=>{try{download(world.config.name.replace(/[\\/:*?"<>|]/g,'_')+'.mcworld',serializeArchive(world));}catch(e){error(e);}};
$('#import').onclick=()=>{setRunning(false);$('#file').click();};
$('#file').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f||!canLeave())return;void perform(async()=>{if(f.size>50*1024*1024)throw new Error('归档不能超过 50 MiB。');const imported=parseArchive(await f.text());if(failed){worker.terminate();connect();}world=await send({type:'load',world:imported});id=crypto.randomUUID();revision=0;dirty=true;selected=null;showPage('world');render();fit();toast('导入成功。原有存档未被覆盖。');});};
$('#growth').onchange=()=>perform(async()=>{world=await send({type:'command',command:{type:'setGrowth',value:Number($('#growth').value)}});dirty=true;render();});
function history(){const list=$('#events');list.replaceChildren();if(!world){list.append(node('p','先创建世界，历史才会开始。','muted'));return;}const filter=$('#event-filter').value;for(const e of [...world.events].reverse().filter(e=>filter==='all'||e.type===filter)){const article=node('article');article.append(node('small',calendar(e.tick)+' · '+e.type),node('p',e.text));if(e.x!==undefined){const b=node('button','定位事件 ↗');b.onclick=()=>{selected=e.y*world.config.size+e.x;showPage('world');inspect();draw();};article.append(b);}list.append(article);}}
$('#event-filter').onchange=history;
function charts(){if(!world)return;$('#report').replaceChildren(...observationReport(world).map(line=>node('p',line)));for(const [key,field,color]of [['population-chart','population','#bdd29e'],['food-chart','food','#d9bb80']]){const c=$('#'+key),rect=c.getBoundingClientRect();if(!rect.width)return;c.width=rect.width*2;c.height=420;const g=c.getContext('2d');g.scale(2,2);const width=rect.width,rows=world.metrics,values=rows.map(m=>m[field]),max=metricMaximum(rows,field),labelColor=getComputedStyle(document.documentElement).getPropertyValue('--muted');g.font='10px sans-serif';g.fillStyle=labelColor;g.strokeStyle=labelColor+'40';for(let i=0;i<4;i++){const y=20+i*48;g.beginPath();g.moveTo(50,y);g.lineTo(width-12,y);g.stroke();g.fillText(fmt(Math.round(max*(1-i/3))),0,y+3);}g.strokeStyle=color;g.lineWidth=2;g.beginPath();values.forEach((v,i)=>{const x=50+i/Math.max(1,values.length-1)*(width-65),y=164-v/max*144;if(i===0)g.moveTo(x,y);else g.lineTo(x,y);});g.stroke();g.fillStyle=color;values.forEach((v,i)=>{if(values.length>30&&i!==values.length-1)return;g.beginPath();g.arc(50+i/Math.max(1,values.length-1)*(width-65),164-v/max*144,2,0,Math.PI*2);g.fill();});g.fillStyle=labelColor;g.fillText('第 0 天',50,197);g.fillText(`第 ${Math.floor(world.tick/24)} 天`,Math.max(90,width-65),197);}}
$('#export-csv').onclick=()=>download('world-metrics.csv',metricsCsv(world),'text/csv;charset=utf-8');
const preferences=readPreferences(localStorage);
function applyPreferences(){
  document.documentElement.dataset.theme=preferences.theme;
  document.documentElement.dataset.reduced=String(preferences.reduced);
  try{localStorage.setItem(preferencesKey,JSON.stringify(preferences));}catch{/* Preview can continue without persistence. */}
}
applyPreferences();
$('#theme').onclick=()=>{
  preferences.theme=preferences.theme==='dark'?'light':preferences.theme==='light'?'dusk':'dark';
  applyPreferences();
  if(page==='data')charts();
};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
void refreshArchives().catch(error);
