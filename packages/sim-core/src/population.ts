import type {World,Agent,Settlement,Family} from '../../protocol/src/index.ts';
import {event,random} from './index.ts';
import {ageTicks,isAdult,nextEntityId,YEAR,allPeople,RECORD_LIMIT} from './demographics.ts';
import {findPath} from './pathfinding.ts';
import {leaveSettlement,moveTo} from './settlements.ts';

const near=(a:Agent,s:Settlement)=>Math.abs(a.x-s.x)+Math.abs(a.y-s.y)<=2;
const housingCapacity=(s:Settlement)=>s.buildings.filter(b=>b.type==='housing'&&b.progress===24).length*4;
export function useHouseholdFood(w:World,a:Agent):number{
  if((w.engine!=='0.4.5'&&w.engine!=='0.4.6')||a.family==null)return 0;
  const family=w.families!.find(f=>f.id===a.family);
  const home=w.settlements.find(s=>s.id===family?.settlement);
  const arrival=family?.destination===undefined?undefined:w.settlements.find(s=>s.id===family.destination);
  if(!family||!home||!near(a,home)&&!(arrival&&near(a,arrival)))return 0;
  if(a.food===0&&a.hunger>=30){
    const amount=Math.min(2,family.food??0);
    if(amount){family.food!-=amount;a.food+=amount;}
    return amount;
  }
  if(isAdult(w,a)&&a.food>=10&&(family.food??0)<24){
    const amount=Math.min(a.food-8,24-(family.food??0));
    family.food=(family.food??0)+amount;
    a.food-=amount;
  }
  return 0;
}
export function requestMigration(w:World,familyId:number,settlementId:number):void{
  const family=w.families?.find(f=>f.id===familyId);
  const destination=w.settlements.find(s=>s.id===settlementId);
  const living=w.agents.filter(a=>a.alive&&a.family===familyId);
  if(!family||!destination||destination.id===family.settlement||!living.length||housingCapacity(destination)<destination.members.length+living.length)throw new Error('目标聚落必须有足够空置住房。');
  const size=w.config.size,to=destination.y*size+destination.x;
  const origin=w.settlements.find(s=>s.id===family.settlement)!;
  const provisions=living.map(a=>{
    if(near(a,destination))return 0;
    const route=findPath(w,a.y*size+a.x,to,4096);
    if(!route.length||route.length>96)throw new Error('家庭迁移要求每位成员有 96 格以内的可达步行路线。');
    const need=Math.max(0,Math.ceil((route.length+a.hunger-20)/18)+2-a.food);
    if(need>0&&!near(a,origin))throw new Error('口粮不足的成员需要先返回家庭营地。');
    return need;
  });
  const total=provisions.reduce((sum,amount)=>sum+amount,0);
  if(total>(family.food??0)+origin.food)throw new Error('家庭与营地缺少足够的迁移口粮。');
  const stored=Math.min(total,family.food??0);
  if(stored)family.food!-=stored;
  origin.food-=total-stored;
  living.forEach((a,index)=>{a.food+=provisions[index];});
  family.destination=settlementId;
  record(w,family,destination,`${family.name} 开始迁往 ${destination.name}。`,living[0]);
}
export function travelWithHousehold(w:World,a:Agent):boolean{
  if((w.engine!=='0.4.5'&&w.engine!=='0.4.6')||a.family==null)return false;
  const target=w.families!.find(f=>f.id===a.family)?.destination;
  const camp=w.settlements.find(s=>s.id===target);
  if(!camp||a.food===0&&a.hunger>=25)return false;
  if(near(a,camp)){
    a.path=[];a.target=null;a.action='等待家人';a.reason=`已抵达 ${camp.name}，等待其他成员与可用住房。`;
    return true;
  }
  if(!moveTo(w,a,camp.y*w.config.size+camp.x,`沿路迁往 ${camp.name}，与家庭成员汇合。`))return false;
  a.action='家庭迁移';return true;
}
function related(a:Agent,b:Agent):boolean {
  return !!a.parents?.includes(b.id)||!!b.parents?.includes(a.id)||!!a.parents?.some(id=>b.parents?.includes(id));
}
function householdCandidate(w:World,a:Agent):boolean {
  if(!a.alive||!isAdult(w,a))return false;
  const f=w.families!.find(f=>f.id===a.family);
  return !f||f.destination===undefined&&!f.parents.includes(a.id);
}
function assign(w:World,a:Agent,f:Family):void {
  const old=w.families!.find(f=>f.id===a.family);
  if(old)old.members=old.members.filter(id=>id!==a.id);
  a.family=f.id;
}
function record(w:World,f:Family,s:Settlement,text:string,actor:Agent):void {
  event(w,'population',text,actor);
  const entry=w.events.at(-1)!;entry.x=s.x;entry.y=s.y;entry.entities=[f.id,actor.id];
}
export function updatePopulation(w:World):void {
  if(w.version===1)return;
  for(const a of w.agents){
    if(!a.alive||ageTicks(w,a)<80*YEAR)continue;
    a.health=Math.max(0,a.health-1);
    if(a.health===0){a.alive=false;a.path=[];a.target=null;a.action='逝去';a.reason='高龄健康耗尽。';leaveSettlement(w,a);event(w,'death',`${a.name} 在高龄时离世，家庭关系与记录保留。`,a);}
  }
  if(w.version===3){
    for(const a of w.agents)if(!a.alive){delete a.forageGoal;a.path=[];a.target=null;a.known=[];w.deceased!.push(a);}
    w.agents=w.agents.filter(a=>a.alive);
  }
  const people=new Map(allPeople(w).map(a=>[a.id,a]));
  if((w.engine==='0.4.5'||w.engine==='0.4.6'))for(const family of w.families!){
    if(family.destination===undefined)continue;
    const camp=w.settlements.find(s=>s.id===family.destination)!;
    const members=family.members.map(id=>people.get(id)!).filter(a=>a.alive);
    const incoming=members.filter(a=>a.settlement!==camp.id);
    if(!members.length){delete family.destination;continue;}
    if(camp.members.length+incoming.length>housingCapacity(camp)||members.some(a=>!near(a,camp)))continue;
    for(const member of incoming){
      leaveSettlement(w,member);
      member.settlement=camp.id;member.path=[];member.target=null;delete member.forageGoal;camp.members.push(member.id);
    }
    family.settlement=camp.id;delete family.destination;
    record(w,family,camp,`${family.name} 全体在世成员抵达 ${camp.name}，家庭库存随迁。`,members[0]);
  }
  if(w.engine==='0.4.6'&&w.tick>0&&w.tick%720===0){
    for(const origin of w.settlements){
      if(origin.members.length<=housingCapacity(origin)+2||origin.food>=origin.members.length*2)continue;
      const family=w.families!.find(item=>item.settlement===origin.id&&item.destination===undefined&&item.members.filter(id=>people.get(id)?.alive).length>=2);
      if(!family)continue;
      for(const destination of w.settlements){
        if(destination.id===origin.id||destination.food<destination.members.length*4+8)continue;
        try{requestMigration(w,family.id,destination.id);}catch{continue;}
        event(w,'split',`${family.name} 因 ${origin.name} 的住房和口粮压力，决定迁往 ${destination.name}。`);
        Object.assign(w.events.at(-1)!,{x:origin.x,y:origin.y,entities:[origin.id,destination.id,family.id]});
        break;
      }
    }
  }
  for(const s of w.settlements){
    if(housingCapacity(s)<s.members.length)continue;
    const candidates=s.members.map(id=>w.agents.find(a=>a.id===id)!).filter(a=>householdCandidate(w,a)&&near(a,s));
    while(candidates.length>=2){
      const a=candidates.shift()!,at=candidates.findIndex(b=>!related(a,b));
      if(at<0)continue;
      const b=candidates.splice(at,1)[0];
      const f:Family={id:nextEntityId(w,200001),name:`家庭 ${w.families!.length+1}`,settlement:s.id,parents:[a.id,b.id],members:[a.id,b.id],founded:w.tick,lastBirth:w.tick};
      assign(w,a,f);assign(w,b,f);w.families!.push(f);
      record(w,f,s,`${a.name} 与 ${b.name} 在 ${s.name} 建立 ${f.name}，共用营地补给。`,a);
    }
  }
  for(const f of w.families!){
    if(w.agents.length>=2000||(w.version===3&&w.agents.length+w.deceased!.length>=RECORD_LIMIT)||w.tick-f.lastBirth<2160)continue;
    const s=w.settlements.find(s=>s.id===f.settlement);
    if(f.destination!==undefined)continue;
    const parents=f.parents.map(id=>people.get(id)!);
    if(!s||parents.some(a=>!a.alive||!isAdult(w,a)||a.family!==f.id||a.settlement!==s.id||a.health<60||!near(a,s)))continue;
    if(housingCapacity(s)<=s.members.length||s.food<s.members.length*2+8||random(w)>=1/180)continue;
    const id=nextEntityId(w,1),position=s.y*w.config.size+s.x;
    const child:Agent={id,name:`新生 ${id}`,x:s.x,y:s.y,born:w.tick,hunger:20,energy:80,health:100,food:2,wood:0,skill:Math.floor(parents.reduce((n,a)=>n+a.skill,0)/parents.length/4),alive:true,action:'成长',reason:'使用营地补给，在家庭照料下成长；未到劳动年龄。',path:[],target:null,known:[position],settlement:s.id,initialAgeTicks:0,family:f.id,parents:[...f.parents]};
    s.food-=8;w.totals.consumed+=6;f.lastBirth=w.tick;f.members.push(id);s.members.push(id);w.agents.push(child);
    record(w,f,s,`${f.name} 迎来 ${child.name}；仓库支出 8 食物，其中 2 转入新成员背包、6 用于照料。`,child);
  }
}
