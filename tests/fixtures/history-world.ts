import {createWorld,event} from '../../packages/sim-core/src/index.ts';
import {YEAR} from '../../packages/sim-core/src/demographics.ts';

export function historyWorld(engine:'0.3.1'|'0.4.0'='0.4.0',records=2000){
  const w=createWorld({name:'跨代历史测试',seed:'families',size:64,population:2,preset:'continent'},engine);
  w.tick=3*YEAR+2160;w.rng=1;const {x,y}=w.agents[0],center=y*64+x;
  w.agents.forEach(a=>Object.assign(a,{x,y,born:YEAR,initialAgeTicks:25*YEAR,family:200001,settlement:100001,hunger:0,food:6,parents:[]}));
  w.agents[0].parents=[3,4];
  for(let id=3;id<=records;id++)w.agents.push({...w.agents[0],id,name:`先人 ${id}`,born:0,initialAgeTicks:45*YEAR,parents:[],family:id===3?200001:null,settlement:null,alive:false,health:0,food:1,wood:1,path:[],target:center,known:[center]});
  w.settlements=[{id:100001,name:'家园',x,y,founded:YEAR,members:[1,2],food:50,wood:0,buildings:[{type:'housing',progress:24,cost:12}],knowledge:0,technology:[]}];
  w.families=[{id:200001,name:'家庭 1',settlement:100001,parents:[1,2],members:[1,2,3],founded:YEAR,lastBirth:YEAR}];
  event(w,'death','先人 3 的离世记录。',w.agents[2]);
  if(engine==='0.4.0'&&records>2000){
    w.deceased=w.agents.splice(2);w.deceased.forEach(a=>{a.known=[];a.path=[];a.target=null;});
  }
  return w;
}
