import type {World,Agent} from '../../protocol/src/index.ts';
export const YEAR=8640;
// shortcut: history remains in full snapshots; use paged storage before raising this record budget.
export const RECORD_LIMIT=20000;
export function allPeople(w:World):Agent[] {return w.deceased?.length?[...w.agents,...w.deceased]:w.agents;}
export function ageTicks(w:World,a:Agent):number {return(a.initialAgeTicks??18*YEAR)+w.tick-a.born;}
export function ageYears(w:World,a:Agent):number|null {return w.version!==1?Math.floor(ageTicks(w,a)/YEAR):null;}
export function isAdult(w:World,a:Agent):boolean {return w.version===1||ageTicks(w,a)>=18*YEAR;}
export function isChild(w:World,a:Agent):boolean {return w.version!==1&&ageTicks(w,a)<12*YEAR;}
export function populationSummary(w:World):{children:number;youth:number;adults:number;elders:number;families:number;births:number;deaths:number}|null {
  if(w.version===1)return null;
  const summary={children:0,youth:0,adults:0,elders:0,families:0,births:0,deaths:0};
  const alive=new Set<number>();
  for(const a of allPeople(w)){
    if(a.born>0&&a.parents?.length===2)summary.births++;
    if(!a.alive){summary.deaths++;continue;}
    alive.add(a.id);
    const age=ageTicks(w,a)/YEAR;
    if(age<12)summary.children++;else if(age<18)summary.youth++;else if(age<60)summary.adults++;else summary.elders++;
  }
  summary.families=w.families!.filter(f=>f.members.some(id=>alive.has(id))).length;
  return summary;
}
export function nextEntityId(w:World,start:number):number {
  const used=new Set([...allPeople(w).map(a=>a.id),...w.settlements.map(s=>s.id),...(w.families??[]).map(f=>f.id)]);
  let id=start;while(used.has(id))id++;return id;
}
