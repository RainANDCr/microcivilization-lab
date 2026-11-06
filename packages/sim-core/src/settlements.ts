import type {World,Agent,Settlement,WorldCommand} from '../../protocol/src/index.ts';
import {BUILDINGS,RECIPES} from '../../content/src/industry.ts';
import {event} from './index.ts';
import {findPath} from './pathfinding.ts';
import {isAdult,isChild,nextEntityId} from './demographics.ts';

const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const completedHouses=(s:Settlement)=>s.buildings.filter(b=>b.type==='housing'&&b.progress===24).length;
const housingDemand=(w:World,s:Settlement)=>s.members.length+(w.version!==1&&s.members.filter(id=>{const a=w.agents.find(a=>a.id===id);return !!a&&a.alive&&isAdult(w,a);}).length>=2?1:0);

export function settlementLevel(s:Settlement):string {
  return s.members.length>=6&&completedHouses(s)>=2&&s.food>=s.members.length*2?'村落':'营地';
}

function record(w:World,s:Settlement,type:string,text:string,actor?:Agent):void {
  event(w,type,text,actor);
  const entry=w.events.at(-1)!;
  entry.x=s.x;entry.y=s.y;entry.entities=[s.id,...(actor?[actor.id]:[])];
}

export function requestIndustry(w:World,command:Extract<WorldCommand,{type:'build'|'queueProduction'}>):void{
  const camp=w.settlements.find(s=>s.id===command.settlement);
  if(!camp?.members.length)throw new Error('请选择有人居住的聚落。');
  if(command.type==='queueProduction'){
    if(!camp.buildings.some(b=>b.type==='workshop'&&b.progress===BUILDINGS.workshop.hours))throw new Error('生产需要完工工坊。');
    if((camp.production?.length??0)>=8)throw new Error('生产队列最多 8 项。');
    const recipe=RECIPES[command.recipe];
    if(camp.wood<recipe.wood)throw new Error('木材不足，无法为配方预留材料。');
    camp.wood-=recipe.wood;
    (camp.production??=[]).push({recipe:command.recipe,progress:0});
    record(w,camp,'production',`${camp.name} 预留 ${recipe.wood} 木材，加入配方：${recipe.name}。`);
    return;
  }
  const x=command.tile%w.config.size,y=Math.floor(command.tile/w.config.size);
  if(!w.tiles[command.tile].walkable||distance(camp,{x,y})>4||w.settlements.some(s=>s.y*w.config.size+s.x===command.tile||s.buildings.some(b=>b.tile===command.tile)))throw new Error('建筑需要距聚落 4 格内且未占用的可通行地块。');
  const definition=BUILDINGS[command.building];
  if(camp.buildings.length>=500)throw new Error('聚落建筑记录已满。');
  const fromSupplies=Math.min(camp.supplies??0,Math.floor(definition.cost/2));
  if(camp.wood<definition.cost-fromSupplies)throw new Error('聚落材料不足。');
  camp.wood-=definition.cost-fromSupplies;
  if(fromSupplies)camp.supplies!-=fromSupplies;
  camp.buildings.push({type:command.building,tile:command.tile,cost:definition.cost,progress:0});
  record(w,camp,'construction',`${camp.name} 开始建造${definition.name}，还需 ${definition.hours} 工时。`);
}
function richCoast(w:World,a:Agent):boolean {
  const size=w.config.size;
  if(w.tiles[a.y*size+a.x].fertility<35)return false;
  let coastal=false,food=0;
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    const x=a.x+dx,y=a.y+dy;
    if(x<0||y<0||x>=size||y>=size)continue;
    const tile=w.tiles[y*size+x];
    if(tile.biome==='ocean')coastal=true;
    if(Math.abs(dx)+Math.abs(dy)<=3&&tile.walkable)food+=tile.food;
  }
  return coastal&&food>=100;
}

export function updateSettlements(w:World):void {
  if(w.engine==='0.1.0')return;
  const size=w.config.size;
  for(const a of w.agents){
    if(!a.alive||!isAdult(w,a)||a.settlement!==null||a.food<4||a.skill<2||a.health<50)continue;
    const nearby=w.settlements.find(s=>s.members.length>0&&s.members.length<24&&distance(a,s)<=5&&(distance(a,s)===0||findPath(w,a.y*size+a.x,s.y*size+s.x,256).length>0));
    if(nearby){
      nearby.members.push(a.id);a.settlement=nearby.id;
      record(w,nearby,'settlement',`${a.name} 加入 ${nearby.name}，共同储备资源。`,a);
      continue;
    }
    if(!richCoast(w,a)||w.settlements.some(s=>distance(a,s)<10))continue;
    const partners=w.agents.filter(b=>b.alive&&isAdult(w,b)&&b.settlement===null&&b.food>=4&&b.skill>=2&&b.health>=50&&distance(a,b)<=5&&(distance(a,b)===0||findPath(w,b.y*size+b.x,a.y*size+a.x,256).length>0));
    if(partners.length<3)continue;
    const s:Settlement={id:nextEntityId(w,100001),name:`青岸营地 ${w.settlements.length+1}`,x:a.x,y:a.y,founded:w.tick,members:partners.map(b=>b.id),food:0,wood:0,buildings:[],knowledge:0,technology:[]};
    w.settlements.push(s);for(const b of partners)b.settlement=s.id;
    record(w,s,'settlement',`${partners.length} 位采集者在沿岸资源丰富的土地建立 ${s.name}。`,a);
  }
  for(const s of w.settlements){
    if(w.engine==='0.4.6'&&!s.members.length&&w.tick%720===0){
      const finished=s.buildings.filter(building=>building.progress===BUILDINGS[building.type as keyof typeof BUILDINGS].hours);
      if(finished.length){
        for(const building of finished)building.progress--;
        record(w,s,'construction',`${s.name} 无人维护，${finished.length} 座设施需要修复才能重新投入使用。`);
      }
    }
    const needsHousing=housingDemand(w,s)>completedHouses(s)*4;
    if(needsHousing&&!s.buildings.some(b=>b.type==='housing'&&b.progress<24)&&s.wood>=12){
      s.wood-=12;s.buildings.push({type:'housing',progress:0,cost:12});
      record(w,s,'construction',`${s.name} 预留 12 单位木材，开始建造住宅；仍需 24 工时。`);
    }
    if((w.engine==='0.4.5'||w.engine==='0.4.6')&&s.members.length&&w.rules.growth>0){
      const water=s.buildings.some(b=>b.type==='well'&&b.progress===BUILDINGS.well.hours);
      for(const field of s.buildings){
        if(field.type!=='field'||field.progress!==BUILDINGS.field.hours)continue;
        const tile=w.tiles[field.tile!];
        const tools=(s.tools??0)>0;
        const harvest=Math.min(200-s.food,Math.floor((tile.fertility+(water?25:0)+(tools?15:0)+(s.technology.includes('耕作')?10:0)+(water&&s.technology.includes('灌溉')?15:0))*w.rules.growth/1600));
        if(harvest<=0)continue;
        if(tools&&w.tick%240===0)s.tools!--;
        s.food+=harvest;w.totals.regrown+=harvest;
      }
    }
  }
}

export function moveTo(w:World,a:Agent,target:number,reason:string):boolean {
  const size=w.config.size,at=a.y*size+a.x;
  if(at===target)return false;
  if(a.target!==target||!a.path.length){a.path=findPath(w,at,target,2048);a.target=target;}
  const next=a.path.shift();
  if(next===undefined||!w.tiles[next].walkable){a.path=[];a.target=null;return false;}
  a.x=next%size;a.y=Math.floor(next/size);
  if(!a.known.includes(next))a.known.push(next);
  a.action='搬运';a.reason=reason;return true;
}

export function returnHome(w:World,a:Agent):boolean {
  if(w.version===1||a.settlement===null||(w.tick%24>=6&&w.tick%24<18))return false;
  const s=w.settlements.find(s=>s.id===a.settlement);
  if(!s||completedHouses(s)===0||(a.food===0&&a.hunger>=30&&s.food===0))return false;
  if(distance(a,s)>1){
    if(!moveTo(w,a,s.y*w.config.size+s.x,`夜间返回 ${s.name} 的住宅休息。`))return false;
    a.action='回家';return true;
  }
  a.path=[];a.target=null;a.energy=Math.min(100,a.energy+(hasShelter(w,a)?13:9));
  a.action='休息';a.reason=`夜间留在 ${s.name} 休息，白天再恢复生产。`;return true;
}

export function careForFamily(w:World,a:Agent):boolean {
  if((w.engine!=='0.3.1'&&w.version!==3)||a.family==null)return false;
  const child=isChild(w,a)?a:w.agents.filter(c=>c.alive&&isChild(w,c)&&c.family===a.family&&c.parents!.includes(a.id)&&c.food===0&&c.hunger>=30).sort((p,q)=>q.hunger-p.hunger||p.id-q.id)[0];
  if(!child||child.food>0||child.hunger<30)return false;
  const parent=child===a?w.agents.find(p=>p.alive&&isAdult(w,p)&&p.family===a.family&&child.parents!.includes(p.id)&&p.food>2&&distance(p,child)<=1):a;
  if(!parent||!parent.alive||!isAdult(w,parent)||parent.food<=2)return false;
  if(distance(parent,child)>1){
    if(!moveTo(w,parent,child.y*w.config.size+child.x,`携带实际口粮，前往照料饥饿的 ${child.name}。`))return false;
    parent.action='送餐';return true;
  }
  const amount=Math.min(2,parent.food-2);parent.food-=amount;child.food+=amount;
  parent.path=[];parent.target=null;parent.action='照料家人';parent.reason=`保留自身至少 2 食物，向身边的 ${child.name} 交付 ${amount} 食物。`;
  return true;
}

export function replenishCamp(w:World,a:Agent):boolean {
  if((w.engine!=='0.4.1'&&w.engine!=='0.4.2'&&w.engine!=='0.4.3'&&w.engine!=='0.4.4'&&(w.engine!=='0.4.5'&&w.engine!=='0.4.6'))||a.settlement===null||a.food<8)return false;
  const camp=w.settlements.find(s=>s.id===a.settlement);
  if(!camp||camp.food>=Math.min(200,camp.members.length))return false;
  if(distance(a,camp)>1){
    return moveTo(w,a,camp.y*w.config.size+camp.x,`${camp.name} 储粮不足，正在运送背包余粮。`);
  }
  const amount=Math.min(a.food-6,200-camp.food);
  a.food-=amount;
  camp.food+=amount;
  a.path=[];
  a.target=null;
  a.action='共享食物';
  a.reason=`向缺粮营地交付 ${amount} 单位食物，自留至少 6 单位。`;
  return true;
}

function atCampSite(w:World,a:Agent,tile:number){return a.y*w.config.size+a.x===tile;}

export function cooperate(w:World,a:Agent):boolean {
  if(w.engine==='0.1.0'||a.settlement===null)return false;
  const s=w.settlements.find(s=>s.id===a.settlement);
  if(!s)return false;
  const near=distance(a,s)<=1,center=s.y*w.config.size+s.x;
  if(near&&a.food<=2&&s.food>0){
    const amount=Math.min(4-a.food,s.food);s.food-=amount;a.food+=amount;
    a.action='领取补给';a.reason=`从 ${s.name} 的共享仓库领取 ${amount} 单位食物。`;return true;
  }
  if(a.food<6)return false;
  if(a.wood>0){
    if(!near)return moveTo(w,a,center,`背包携带 ${a.wood} 单位木材，沿可通行路线送回 ${s.name}。`);
    const amount=Math.min(a.wood,200-s.wood);
    if(amount<=0)return false;
    a.wood-=amount;s.wood+=amount;a.path=[];a.target=null;
    a.action='入库';a.reason=`向共享仓库交付 ${amount} 单位木材（容量 200）。`;return true;
  }
  const foodTarget=Math.min(200,s.members.length*4);
  if(a.food>=10&&s.food<foodTarget){
    if(!near)return moveTo(w,a,center,`食物储备充足，为 ${s.name} 搬运共享补给。`);
    const amount=Math.min(a.food-6,foodTarget-s.food);a.food-=amount;s.food+=amount;
    a.action='共享食物';a.reason=`保留自身口粮，向营地贡献 ${amount} 单位食物。`;return true;
  }
  const assignedSite=a.workSite;
  const projects=s.buildings.filter(b=>b.progress<BUILDINGS[b.type as keyof typeof BUILDINGS].hours);
  let project:Settlement['buildings'][number]|undefined=projects[0];
  if(w.engine==='0.4.6'&&projects.length){
    const reserved=projects.find(b=>(b.tile??center)===a.workSite);
    const distanceTo=(tile:number)=>Math.abs(a.x-tile%w.config.size)+Math.abs(a.y-Math.floor(tile/w.config.size));
    const assignments=new Map<number,number>();
    for(const worker of w.agents){
      if(worker.id===a.id||worker.settlement!==s.id||worker.workSite===undefined)continue;
      assignments.set(worker.workSite,(assignments.get(worker.workSite)??0)+1);
    }
    const score=(tile:number)=>distanceTo(tile)+(assignments.get(tile)??0)*4;
    const viable=projects.sort((left,right)=>score(left.tile??center)-score(right.tile??center));
    project=[...(reserved?[reserved]:[]),...viable].find(b=>{
      const site=b.tile??center;
      return atCampSite(w,a,site)||(b.tile===undefined&&near)||findPath(w,a.y*w.config.size+a.x,site,2048).length>0;
    });
    if(project&&a.occupation!=='forager'&&a.occupation!=='artisan')a.workSite=project.tile??center;
    else delete a.workSite;
  }else if(w.engine==='0.4.6')delete a.workSite;
  if(project&&a.occupation!=='forager'&&a.occupation!=='artisan'){
    const definition=BUILDINGS[project.type as keyof typeof BUILDINGS];
    const site=project.tile??center;
    if(project.tile===undefined?!near:a.x!==site%w.config.size||a.y!==Math.floor(site/w.config.size))return moveTo(w,a,site,project.type==='housing'?`返回 ${s.name} 参与住宅建造。`:`前往 ${s.name} 的${definition.name}工地。`);
    project.progress=Math.min(definition.hours,project.progress+(a.occupation==='builder'?2:1));a.action='建造';a.reason=`材料已预留，投入 1 工时：${project.progress}/${definition.hours}。`;
    if(project.progress===definition.hours)record(w,s,'construction',project.type==='housing'?`${s.name} 完成住宅，可为 4 名成员在营地休息时提供额外精力恢复。`:`${s.name} 完成${definition.name}。`,a);
    return true;
  }
  const job=s.production?.[0];
  const output=job?RECIPES[job.recipe].stock:undefined;
  const workshops=job?s.buildings.filter(b=>b.type==='workshop'&&b.progress===BUILDINGS.workshop.hours):[];
  const workshop=w.engine==='0.4.6'?(workshops.find(b=>b.tile===assignedSite)??workshops[0]):workshops[0];
  if((w.engine==='0.4.5'||w.engine==='0.4.6')&&a.occupation!=='forager'&&a.occupation!=='builder'&&job&&workshop&&output&&(s[output]??0)<=(job.recipe==='tools'||job.recipe==='supplies'?199:200-RECIPES[job.recipe].amount)){
    const site=workshop.tile!;
    if(w.engine==='0.4.6')a.workSite=site;
    if(atCampSite(w,a,site)){
      const recipe=RECIPES[job.recipe];
      job.progress=Math.min(recipe.hours,job.progress+(a.occupation==='artisan'||s.technology.includes('木工')?2:1));a.action='加工';a.reason=`${recipe.name}：${job.progress}/${recipe.hours} 工时。`;
      if(job.progress===recipe.hours){
        s[output]=Math.min(200,(s[output]??0)+recipe.amount);
        s.production!.shift();record(w,s,'production',`${s.name} 完成配方：${recipe.name}。`,a);
      }
      return true;
    }
    if(moveTo(w,a,site,`前往 ${s.name} 工坊加工预留材料。`))return true;
  }
  const woodTarget=(w.engine==='0.4.5'||w.engine==='0.4.6')&&completedHouses(s)>0?24:housingDemand(w,s)>completedHouses(s)*4?12:0;
  if(s.wood>=woodTarget)return false;
  const at=a.y*w.config.size+a.x,tile=w.tiles[at];
  if(tile.wood>0){
    const amount=Math.min(3,tile.wood,12-a.wood);tile.wood-=amount;a.wood+=amount;a.path=[];a.target=null;
    a.action='采集木材';a.reason=`${(w.engine==='0.4.5'||w.engine==='0.4.6')?'聚落':'住宅'}需要木材，从地块实际采集 ${amount} 单位，木材背包容量 12。`;return true;
  }
  if(w.engine==='0.4.6'&&assignedSite!==undefined&&w.tiles[assignedSite].wood>0&&moveTo(w,a,assignedSite,`继续前往已选木材地块，为 ${s.name} 备料。`)){
    a.workSite=assignedSite;
    return true;
  }
  const candidates=a.known.filter(p=>w.tiles[p].wood>0).sort((p,q)=>{
    const dist=(v:number)=>Math.abs(v%w.config.size-a.x)+Math.abs(Math.floor(v/w.config.size)-a.y);
    return dist(p)-dist(q)||p-q;
  });
  for(const target of candidates.slice(0,6))if(moveTo(w,a,target,`在已知区域寻找木材，为 ${s.name} 备料。`)){
    if(w.engine==='0.4.6')a.workSite=target;
    return true;
  }
  return false;
}

export function hasShelter(w:World,a:Agent):boolean {
  if(w.engine==='0.1.0'||a.settlement===null)return false;
  const s=w.settlements.find(s=>s.id===a.settlement);
  return !!s&&distance(a,s)<=2&&s.members.indexOf(a.id)>=0&&s.members.indexOf(a.id)<completedHouses(s)*4;
}

export function leaveSettlement(w:World,a:Agent):void {
  if(a.settlement===null)return;
  const s=w.settlements.find(s=>s.id===a.settlement);
  if(s){s.members=s.members.filter(id=>id!==a.id);if(!s.members.length)record(w,s,'settlement',`${s.name} 已无人居住，建筑与仓库仍留在原处。`);}
  a.settlement=null;
  delete a.workSite;
}

export function claimEmergencyFood(w:World,a:Agent):number {
  if(w.version===1||a.food>0||a.hunger<30||a.settlement===null)return 0;
  const s=w.settlements.find(s=>s.id===a.settlement);
  if(!s||distance(a,s)>2)return 0;
  const amount=Math.min(2,s.food);s.food-=amount;a.food+=amount;return amount;
}
