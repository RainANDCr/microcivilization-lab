import type {Agent,World} from '../../protocol/src/index.ts';
import {event,random} from './index.ts';
import {neighbors,findPath} from './pathfinding.ts';
import {cooperate,hasShelter,leaveSettlement,claimEmergencyFood,returnHome,careForFamily,replenishCamp} from './settlements.ts';
import {travelWithHousehold,useHouseholdFood} from './population.ts';
import {isChild} from './demographics.ts';
export function updateAgent(w:World,a:Agent):void {
  const size=w.config.size,at=a.y*size+a.x;
  a.hunger=Math.min(100,a.hunger+1);a.energy=Math.max(0,a.energy-1);
  const emergencyFood=useHouseholdFood(w,a)||claimEmergencyFood(w,a);
  const familyFood=isChild(w,a)&&careForFamily(w,a);
  if(a.hunger>=100&&(w.version===1||a.food===0))a.health=Math.max(0,a.health-2);
  if(a.health===0){a.alive=false;delete a.forageGoal;a.path=[];a.action='逝去';a.reason='长期缺乏食物，健康耗尽。';leaveSettlement(w,a);event(w,'death',`${a.name} 因食物不足离开了世界。`,a);return;}
  if(a.food>0&&a.hunger>=30){const n=Math.min(a.food,2);a.food-=n;a.hunger=Math.max(0,a.hunger-n*18);a.health=Math.min(100,a.health+1);w.totals.consumed+=n;a.action='进食';a.reason=`饥饿达到阈值，消耗背包 ${n} 单位食物。${emergencyFood?((w.engine==='0.4.5'||w.engine==='0.4.6')?'获得紧急口粮。':'由营地仓库提供紧急补给。'):''}${familyFood?'由身边的父母提供实际口粮。':''}`;return;}
  if(a.energy<15||(a.action==='休息'&&a.energy<85)){const sheltered=hasShelter(w,a);a.energy=Math.min(100,a.energy+(sheltered?13:9));a.action='休息';a.reason=sheltered?'在营地住宅附近休息，恢复更多精力。':'精力不足，休息收益优先于继续采集。';return;}
  if(isChild(w,a)){if(travelWithHousehold(w,a))return;a.energy=Math.min(100,a.energy+2);a.action='成长';a.reason='未到劳动年龄，在家庭与营地照料下成长，不执行生产任务。';return;}
  if((w.engine==='0.4.5'||w.engine==='0.4.6')){
    const camp=a.settlement===null?undefined:w.settlements.find(s=>s.id===a.settlement);
    const night=w.tick%24<6||w.tick%24>=18;
    const foodPressure=camp?Math.max(0,camp.members.length-camp.food):0;
    const tasks=[
      {score:a.family==null?0:120,run:careForFamily},
      {score:camp&&a.food>=8&&foodPressure>0?95+Math.min(20,foodPressure):0,run:replenishCamp},
      {score:a.family==null?0:119,run:travelWithHousehold},
      {score:night&&camp?75+Math.floor((100-a.energy)/5):0,run:returnHome},
      {score:camp?55:0,run:cooperate},
    ].sort((left,right)=>right.score-left.score);
    for(const task of tasks){
      if(task.score>0&&task.run(w,a))return;
    }
    if(a.forageGoal!==undefined){
      const goal=a.forageGoal;
      if(a.food>=10||!w.tiles[goal].walkable||w.tiles[goal].food===0){delete a.forageGoal;a.path=[];a.target=null;}
      else if(at!==goal&&(a.target!==goal||!a.path.length)){
        const resumed=findPath(w,at,goal,256);
        if(resumed.length){a.path=resumed;a.target=goal;a.action='恢复寻食';a.reason='优先任务结束，沿可通行路线继续前往已选食物地块。';return;}
        delete a.forageGoal;a.path=[];a.target=null;
      }
    }
  }else{
    if(careForFamily(w,a))return;
    if(replenishCamp(w,a))return;
    if(returnHome(w,a))return;
    if(cooperate(w,a))return;
  }
  if(w.tiles[at].food>0&&a.food<10){const n=Math.min(3+Math.floor(a.skill/400)+(a.occupation==='forager'?1:0),w.tiles[at].food,12-a.food);w.tiles[at].food-=n;a.food+=n;a.skill++;w.totals.harvested+=n;a.action='采集';a.reason=`此地食物可达且背包有余量，采集 ${n} 单位（容量 12）。`;a.path=[];a.target=null;if(a.forageGoal===at)delete a.forageGoal;return;}
  if(a.path.length){if(a.target!==null&&w.tiles[a.target].food===0){a.path=[];a.target=null;}else{const next=a.path.shift()!;if(w.tiles[next].walkable){a.x=next%size;a.y=Math.floor(next/size);if(!a.known.includes(next))a.known.push(next);a.action='移动';return;}a.path=[];}}
  const options:number[]=[],known=new Set(a.known);
  if(a.food<10)for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const x=a.x+dx,y=a.y+dy;if(x<0||y<0||x>=size||y>=size)continue;const p=y*size+x;if(w.tiles[p].walkable&&!known.has(p)){a.known.push(p);known.add(p);}if(w.tiles[p].walkable&&w.tiles[p].food>3&&p!==at)options.push(p);}
  options.sort((p,q)=>{const score=(v:number)=>Math.min(w.tiles[v].food,12-a.food)*4-(Math.abs(v%size-a.x)+Math.abs(Math.floor(v/size)-a.y));return score(q)-score(p)||p-q;});
  if(a.food<10)for(const target of options.slice(0,8)){const path=findPath(w,at,target,256);if(path.length){a.path=path;a.target=target;if((w.engine==='0.4.5'||w.engine==='0.4.6'))a.forageGoal=target;a.action='寻食';a.reason=`综合可采数量与步行距离，选择 (${target%size}, ${Math.floor(target/size)})；路径 ${path.length} 格。`;return;}}
  const steps=neighbors(at,size).filter(p=>w.tiles[p].walkable);
  if(steps.length){const next=steps[Math.floor(random(w)*steps.length)];a.path=[next];a.target=null;a.action=a.food>=10?'探索':'搜索';a.reason=a.food>=10?'背包充足，探索相邻可通行区域。':'附近没有可达食物，探索相邻区域后重新评估。';}
  else{a.action='等待';a.reason='当前位置无可通行邻地，等待生态恢复。';}
}
