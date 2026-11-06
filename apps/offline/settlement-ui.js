import {BUILDINGS,RECIPES} from '../../packages/content/src/industry.ts';
import {settlementLevel} from '/packages/sim-core/src/settlements.ts';
import {renderFamilies} from './family-ui.js';
function element(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function details(s){
  const card=element('div',undefined,'settlement-card');
  card.append(element('strong',`${s.name} · ${settlementLevel(s)}`));
  card.append(element('p',`${s.members.length} 位成员 · 食物 ${s.food}/200 · 木材 ${s.wood}/200`));
  if(!s.buildings.length)card.append(element('small','住宅需要 12 木材和 24 工时，居民会自主备料。'));
  for(const job of s.production??[])card.append(element('small',`${RECIPES[job.recipe].name} · ${job.progress}/${RECIPES[job.recipe].hours} 工时`));
  for(const b of s.buildings){
    const {name,hours}=BUILDINGS[b.type];
    card.append(element('small',`${name} · ${b.progress===hours?'已建成':`${b.progress}/${hours} 工时`}`));
    const progress=element('progress');progress.max=hours;progress.value=b.progress;progress.setAttribute('aria-label',`${name}建造进度 ${b.progress}/${hours}`);card.append(progress);
  }
  return card;
}
export function renderSettlements(world,onSelect){
  renderFamilies(world);
  const list=document.getElementById('settlements');
  document.getElementById('settlement-count').textContent=world.settlements.length;
  document.getElementById('engine-label').textContent=`ENGINE ${world.engine} / 核心预览`;
  list.replaceChildren();
  if(!world.settlements.length){list.append(element('p',world.engine==='0.1.0'?'旧世界保持 0.1.0 规则。新世界将启用营地协作。':'满足资源、沿岸环境和协作条件后，采集者会自主建立营地。','muted'));return;}
  for(const s of world.settlements){
    const card=details(s),button=element('button','定位营地 ↗','locate-camp');
    button.onclick=()=>onSelect(s.y*world.config.size+s.x);card.append(button);list.append(card);
  }
}
export function appendSettlementDetails(panel,world,index){
  for(const s of world.settlements)if(s.y*world.config.size+s.x===index)panel.append(details(s));
}
export function drawSettlements(ctx,world,zoom){
  ctx.save();
  for(const s of world.settlements){
    ctx.fillStyle=s.members.length?'#d9b779':'#9b9381';ctx.strokeStyle='#283323';ctx.lineWidth=.13;
    ctx.fillRect(s.x-.15,s.y-.15,1.3,1.3);ctx.strokeRect(s.x-.15,s.y-.15,1.3,1.3);
    if(s.buildings.some(b=>b.progress===24)){ctx.beginPath();ctx.moveTo(s.x-.3,s.y-.15);ctx.lineTo(s.x+.5,s.y-.85);ctx.lineTo(s.x+1.3,s.y-.15);ctx.closePath();ctx.fill();ctx.stroke();}
    if(zoom>=8){ctx.font='1.2px sans-serif';ctx.fillStyle='#fff2c5';ctx.fillText(s.name,s.x+1.5,s.y+.8);}
  }
  ctx.restore();
}
