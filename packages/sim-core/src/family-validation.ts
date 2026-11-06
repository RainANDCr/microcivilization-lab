import type {World} from '../../protocol/src/index.ts';
import {YEAR,allPeople,RECORD_LIMIT} from './demographics.ts';
const integer=(n:unknown,min:number,max:number)=>Number.isSafeInteger(n)&&Number(n)>=min&&Number(n)<=max;
export function validateFamilies(w:World,entityIds:Set<number>):void {
  if(w.version===1){
    if(w.families!==undefined||w.agents.some(a=>a.family!==undefined||a.initialAgeTicks!==undefined||a.parents!==undefined))throw new Error('旧引擎存档不能混入新的人口字段。');
    return;
  }
  const limit=w.version===3?RECORD_LIMIT:2000;
  if(!Array.isArray(w.families)||w.families.length>limit)throw new Error('家庭数据缺失或超出上限。');
  const people=allPeople(w),agents=new Map(people.map(a=>[a.id,a])),camps=new Set(w.settlements.map(s=>s.id)),families=new Set<number>(),assigned=new Set<number>();
  for(const a of people){
    if(!integer(a.initialAgeTicks,0,100*YEAR)||(a.family!==null&&!integer(a.family,1,1e7))||!Array.isArray(a.parents)||![0,2].includes(a.parents.length)||new Set(a.parents).size!==a.parents.length)throw new Error('年龄或父母字段无效。');
    for(const id of a.parents){const parent=agents.get(id);if(!parent||parent.id===a.id||parent.born>=a.born||(parent.initialAgeTicks??0)+a.born-parent.born<18*YEAR)throw new Error('父母引用或代际时间顺序无效。');}
  }
  for(const f of w.families){
    if(!f||!integer(f.id,1,1e7)||entityIds.has(f.id)||families.has(f.id)||typeof f.name!=='string'||f.name.length>80||!camps.has(f.settlement)||!integer(f.founded,0,w.tick)||!integer(f.lastBirth,f.founded,w.tick)||!Array.isArray(f.parents)||f.parents.length!==2||new Set(f.parents).size!==2||!Array.isArray(f.members)||f.members.length>limit||!f.parents.every(id=>f.members.includes(id)))throw new Error('家庭结构、住房关联或时间记录无效。');
    if((f.food!==undefined&&((w.engine!=='0.4.5'&&w.engine!=='0.4.6')||!integer(f.food,0,24)))||
      (f.destination!==undefined&&((w.engine!=='0.4.5'&&w.engine!=='0.4.6')||!camps.has(f.destination)||f.destination===f.settlement)))throw new Error('家庭库存或迁移目的地无效。');
    families.add(f.id);
    for(const id of f.members){const a=agents.get(id);if(!a||assigned.has(id)||a.family!==f.id)throw new Error('家庭成员重复或关联不一致。');assigned.add(id);}
  }
  for(const a of people)if(a.family!==null&&(!families.has(a.family!)||!assigned.has(a.id)))throw new Error('居民引用了不存在的家庭。');
  for(const id of families)entityIds.add(id);
}
