import type { World, WorldConfig, WorldCommand, Agent, Tile } from '../../protocol/src/index.ts';
import {modRules,validateModLock} from '../../mod-sdk/src/index.ts';
import {BIOMES} from '../../content/src/index.ts';
import { generateTerrain } from './terrain.ts';
import {advanceCaravans,updateSociety} from './society.ts';
import { updateAgent } from './agents.ts';
import {BUILDINGS,RECIPES} from "../../content/src/industry.ts";
import {requestIndustry,updateSettlements} from './settlements.ts';
import {validateSettlements} from './settlement-validation.ts';
import {requestMigration,updatePopulation} from './population.ts';
import {validateFamilies} from './family-validation.ts';
import {isAdult,populationSummary,YEAR,allPeople,RECORD_LIMIT,nextEntityId} from './demographics.ts';
export { findPath } from './pathfinding.ts';
export type { World, WorldConfig, WorldCommand, Agent, Tile };

export function hashText(text: string): number {
  let value = 2166136261;
  for (let i=0;i<text.length;i++) value = Math.imul(value ^ text.charCodeAt(i),16777619);
  return value >>> 0;
}
export function random(world: {rng: number}): number {
  let x = world.rng || 1; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  world.rng = x >>> 0; return world.rng / 4294967296;
}
export function assertConfig(config: WorldConfig): void {
  if (!config || ![64,128,256].includes(config.size) || !Number.isInteger(config.population) || config.population<0 || config.population>100 || typeof config.seed!=='string' || config.seed.length<1 || config.seed.length>128 || typeof config.name!=='string' || config.name.trim().length<1 || config.name.length>80 || !['continent','islands','arid'].includes(config.preset)) throw new Error('世界参数无效：地图 64/128/256，人口 0–100，名称和种子不能为空。');
}
export function createWorld(config: WorldConfig,engine:World['engine']='0.4.6'): World {
  assertConfig(config);
  if(!['0.1.0','0.2.0','0.3.0','0.3.1','0.4.0','0.4.1','0.4.2','0.4.3','0.4.4','0.4.5','0.4.6'].includes(engine))throw new Error('不支持这个引擎版本。');
  const w: World = {version:['0.4.0','0.4.1','0.4.2','0.4.3','0.4.4','0.4.5','0.4.6'].includes(engine)?3:['0.3.0','0.3.1'].includes(engine)?2:1,engine,config:{...config},tick:0,rng:hashText(config.seed)||1,tiles:[],agents:[],settlements:[],events:[],metrics:[],rules:{growth:100},totals:{harvested:0,consumed:0,regrown:0},commands:[]};
  if(config.modLock!==undefined){
    if((engine!=='0.4.5'&&engine!=='0.4.6'))throw new Error('此引擎版本不支持模组。');
    w.config.modLock=validateModLock(config.modLock);
    w.rules.growth=modRules(w.config.modLock).initialGrowth??100;
  }
  w.tiles=generateTerrain(config);
  if(w.config.modLock){
    const modifiers=modRules(w.config.modLock);
    if(engine==='0.4.5'&&(modifiers.foodCapacityPercent!==undefined||modifiers.floodLossPercent!==undefined))throw new Error('此模组需要 0.4.6 引擎。');
    for(const tile of w.tiles){
      tile.fertility=Math.min(100,Math.floor(tile.fertility*(modifiers.biomeFertility?.[tile.biome]??100)/100));
      if(modifiers.foodCapacityPercent!==undefined){
        tile.capacity=Math.floor(tile.capacity*modifiers.foodCapacityPercent/100);
        tile.food=Math.floor(tile.capacity*.75);
      }
    }
  }
  const land=w.tiles.map((t,i)=>t.walkable&&t.capacity>10?i:-1).filter(i=>i>=0);
  if(config.population && !land.length) throw new Error('没有适合居民落脚的陆地，请更换种子。');
  for(let i=0;i<config.population;i++) {
    const at=land[Math.floor(random(w)*land.length)];
    w.agents.push({id:i+1,name:`旅人 ${String(i+1).padStart(2,'0')}`,x:at%config.size,y:Math.floor(at/config.size),born:0,hunger:20+Math.floor(random(w)*20),energy:80,health:100,food:3,wood:0,skill:0,alive:true,action:'观察',reason:'观察附近的环境，寻找可采集的土地。',path:[],target:null,known:[at],settlement:null});
  }
  if(w.version!==1){w.families=[];for(const a of w.agents){a.initialAgeTicks=(18+Math.floor(random(w)*28))*YEAR;a.family=null;a.parents=[];}}
  if(w.version===3)w.deceased=[];
  if((w.engine==='0.4.5'||w.engine==='0.4.6'))w.totals.floodLoss=0;
  event(w,'genesis',`世界诞生，${config.population} 位旅人踏上这片土地。`);
  sample(w); return w;
}
export function event(w:World,type:string,text:string,a?:Agent):void {
  w.events.push({id:w.events.length+1,tick:w.tick,type,text,entities:a?[a.id]:[],...(a?{x:a.x,y:a.y}:{})});
}
export function season(tick:number): string { return ['春','夏','秋','冬'][Math.floor(tick/(24*90))%4]; }
const WEATHER_PERIOD=24*10;
export function weatherAt(w:World,tick=w.tick):{name:string;growthPercent:number}|null {
  if(w.engine!=='0.4.4'&&(w.engine!=='0.4.5'&&w.engine!=='0.4.6'))return null;
  const roll=hashText(`${w.config.seed}:weather:${Math.floor(tick/WEATHER_PERIOD)}`)%100;
  if((w.engine==='0.4.5'||w.engine==='0.4.6')&&roll<8)return {name:'暴雨',growthPercent:150};
  if(roll<25)return {name:'降雨',growthPercent:150};
  if(roll<50)return {name:season(tick)==='冬'?'寒潮':'干旱',growthPercent:50};
  return {name:'平稳',growthPercent:100};
}
function updateClimate(w:World,weather:NonNullable<ReturnType<typeof weatherAt>>){
  const seasonIndex=Math.floor(w.tick/2160)%4;
  const size=w.config.size,storm=weather.name==='暴雨';
  const floodDay=storm&&w.tick%WEATHER_PERIOD===0;
  const moveToward=(value:number,target:number,step:number)=>value+Math.max(-step,Math.min(step,Math.max(0,Math.min(100,target))-value));
  const modifiers=w.config.modLock?modRules(w.config.modLock):undefined;
  const factors=modifiers?.biomeFertility;
  let flooded=0,loss=0,first=-1;
  for(let index=0;index<w.tiles.length;index++){
    const tile=w.tiles[index];
    const latitude=Math.abs(Math.floor(index/size)/size-.5);
    const temperature=Math.floor(85-latitude*80-tile.elevation*.25)+[0,12,-4,-18][seasonIndex]-(weather.name==='寒潮'?12:0);
    tile.temperature=moveToward(tile.temperature,temperature,3);
    const moisture=tile.biome==='ocean'?100
      :(tile.biome==='forest'?65:tile.biome==='desert'?22:48)-(w.config.preset==='arid'?12:0)+(weather.growthPercent-100)*.4;
    const inundated=storm&&tile.walkable&&tile.biome==='shore';
    tile.moisture=inundated?100:moveToward(tile.moisture,Math.floor(moisture),4);
    if(tile.walkable)tile.fertility=moveToward(tile.fertility,Math.max(5,Math.floor((tile.moisture*65+tile.temperature*35)*(factors?.[tile.biome]??100)/10000)),1);
    if(floodDay&&inundated){
      if(first<0)first=index;
      flooded++;
      const washedAway=Math.floor(tile.food*(modifiers?.floodLossPercent??25)/100);
      tile.food-=washedAway;
      loss+=washedAway;
    }
  }
  if(first>=0){
    w.totals.floodLoss=(w.totals.floodLoss??0)+loss;
    event(w,'flood',`暴雨引发沿岸洪水，淹及 ${flooded} 格，冲失 ${loss} 单位地表食物。`);
    Object.assign(w.events.at(-1)!,{x:first%size,y:Math.floor(first/size)});
  }
}
export function sample(w:World):void {
  w.metrics.push({tick:w.tick,population:w.agents.filter(a=>a.alive).length,food:w.tiles.reduce((s,t)=>s+t.food,0),settlements:w.settlements.length,harvested:w.totals.harvested,consumed:w.totals.consumed});
  const summary=populationSummary(w);if(summary)Object.assign(w.metrics.at(-1)!,{families:summary.families,children:summary.children,births:summary.births,deaths:summary.deaths});
}
export function advance(w:World,ticks:number):void {
  if(!Number.isInteger(ticks)||ticks<0||ticks>100000) throw new Error('推进步数必须是 0–100000 的整数。');
  for(let step=0;step<ticks;step++) {
    w.tick++;
    if(w.engine==='0.4.6')advanceCaravans(w);
    for(const a of w.agents) if(a.alive) updateAgent(w,a);
    if(w.tick%24===0) {
      const factor=[100,120,80,25][Math.floor(w.tick/2160)%4];
      const weather=weatherAt(w);
      if(weather&&w.tick%WEATHER_PERIOD===0){
        event(w,'weather',`${weather.name}期开始。本期自然食物再生为季节基准的 ${weather.growthPercent}%。`);
      }
      if((w.engine==='0.4.5'||w.engine==='0.4.6')&&weather)updateClimate(w,weather);
      for(const t of w.tiles) {
        const growth=Math.floor(t.fertility*factor*w.rules.growth*(weather?.growthPercent??100)/20000000);
        const n=Math.min(t.capacity-t.food,growth); t.food+=n; w.totals.regrown+=n;
      }
      updateSettlements(w);updatePopulation(w);updateSociety(w);sample(w);
    }
    if(w.tick%2160===0) event(w,'season',`${season(w.tick)}季开始，植物再生速度随季节改变。`);
  }
}
export function applyCommand(w:World,command:WorldCommand):void {
  if(!command||typeof command!=='object') throw new Error('无效命令。');
  if(command.type==='setGrowth') {
    if(!Number.isInteger(command.value)||command.value<0||command.value>300) throw new Error('再生比例必须在 0–300%。');
    w.rules.growth=command.value; event(w,'intervention',`创造者将资源再生比例设为 ${command.value}%。`);
  } else if(command.type==='addFood') {
    if(!Number.isInteger(command.tile)||command.tile<0||command.tile>=w.tiles.length||!Number.isInteger(command.amount)||command.amount<1||command.amount>1000) throw new Error('地块或资源数量无效。');
    const tile=w.tiles[command.tile]; if(!tile.walkable) throw new Error('不能向不可通行地块投放食物。');
    const n=Math.min(command.amount,tile.capacity-tile.food); tile.food+=n;
    event(w,'intervention',`创造者在 (${command.tile%w.config.size}, ${Math.floor(command.tile/w.config.size)}) 补充了 ${n} 单位食物。`);
  } else if(command.type==='placeResidents') {
    if(!validPlacement(w,command))throw new Error('仅支持在可通行地块投放 10–100 位居民。');
    const {tile,count}=command;
    if(w.agents.length+count>2000||allPeople(w).length+count>RECORD_LIMIT)throw new Error('居民或历史记录容量不足。');
    if(w.commands.length>=100000||w.events.length>=100000)throw new Error('命令或事件记录容量不足。');
    const x=tile%w.config.size,y=Math.floor(tile/w.config.size),entities:number[]=[];
    for(let i=0;i<count;i++){
      const id=nextEntityId(w,1);
      w.agents.push({id,name:`旅人 ${id}`,x,y,born:w.tick,initialAgeTicks:20*YEAR,hunger:20,energy:80,health:100,food:0,wood:0,skill:0,alive:true,action:'观察',reason:'刚抵达世界，开始寻找食物。',path:[],target:null,known:[tile],settlement:null,family:null,parents:[]});
      entities.push(id);
    }
    w.events.push({id:w.events.length+1,tick:w.tick,type:'intervention',text:`创造者在 (${x}, ${y}) 投放了 ${count} 位居民。`,entities,x,y});
  } else if(command.type==='setOccupation'){
    if(!validOccupation(w,command))throw new Error('职业参数无效。');
    const a=w.agents.find(agent=>agent.id===command.agent);
    if(!a||!a.alive||!isAdult(w,a)||a.settlement===null)throw new Error('只有已加入聚落的成年人可以分工。');
    a.occupation=command.occupation;
    event(w,'intervention',`${a.name} 转任${{forager:'采集者',builder:'建造者',artisan:'工匠'}[a.occupation]}。`,a);
  } else if(command.type==='build'||command.type==='queueProduction'){
    if(!validIndustry(w,command))throw new Error('建筑或生产命令无效。');
    requestIndustry(w,command);
  } else if(command.type==='migrateFamily'){
    if((w.engine!=='0.4.5'&&w.engine!=='0.4.6')||!integer(command.family,1,1e7)||!integer(command.settlement,1,1e7))throw new Error('家庭迁移参数无效。');
    requestMigration(w,command.family,command.settlement);
  } else if(command.type==='setResources'||command.type==='paintTerrain'){
    if(!validEdit(w,command))throw new Error('地形画笔或资源参数无效。');
    const size=w.config.size,x=command.tile%size,y=Math.floor(command.tile/size);
    const tile=w.tiles[command.tile];
    if(command.type==='setResources'){
      const {food,wood,stone}=command;
      event(w,'intervention',`创造者在 (${x}, ${y}) 编辑资源：食物 ${tile.food} → ${food}，木材 ${tile.wood} → ${wood}，石材 ${tile.stone} → ${stone}。`);
      Object.assign(tile,{food,wood,stone,capacity:Math.max(tile.capacity,food)});
    }else{
      const {radius,biome}=command;
      const walkable=biome!=='ocean'&&biome!=='mountain';
      const indices=new Set<number>();
      for(let row=Math.max(0,y-radius);row<=Math.min(size-1,y+radius);row++){
        for(let column=Math.max(0,x-radius);column<=Math.min(size-1,x+radius);column++)indices.add(row*size+column);
      }
      if(!walkable){
        if(allPeople(w).some(a=>indices.has(a.y*size+a.x))||w.settlements.some(s=>(indices.has(s.y*size+s.x)||(s.caravan&&indices.has(s.caravan.tile))||s.buildings.some(b=>b.tile!==undefined&&indices.has(b.tile)))))throw new Error('画笔覆盖居民、历史居民或聚落，不能改为不可通行地形。');
        for(const a of w.agents){
          if((a.target!==null&&indices.has(a.target))||a.path.some(i=>indices.has(i))){a.path=[];a.target=null;}
        }
      }
      const elevation={ocean:25,shore:39,grass:52,forest:58,desert:52,mountain:90,snow:76}[biome];
      for(const index of indices){
        const edited=w.tiles[index];
        Object.assign(edited,{biome,walkable,elevation});
        if(walkable&&edited.capacity===0){edited.fertility=30;edited.capacity=42;}
        if(!walkable)edited.fertility=0;
      }
      event(w,'intervention',`创造者在 (${x}, ${y}) 将 ${indices.size} 格改为${BIOMES[biome].name}。`);
    }
  } else throw new Error('未知命令。');
  w.commands.push({tick:w.tick,command:structuredClone(command)});
}
export function stateHash(w:World):string { return hashText(JSON.stringify(w)).toString(16).padStart(8,'0'); }
export function cloneWorld(w:World):World { return structuredClone(w); }
function integer(n:unknown,min:number,max:number):boolean { return Number.isSafeInteger(n)&&Number(n)>=min&&Number(n)<=max; }
function validOccupation(w:World,command:Extract<WorldCommand,{type:'setOccupation'}>):boolean{
  return (w.engine==='0.4.5'||w.engine==='0.4.6')&&integer(command.agent,1,1e7)&&['forager','builder','artisan'].includes(command.occupation);
}
function validIndustry(w:World,command:Extract<WorldCommand,{type:'build'|'queueProduction'}>):boolean{
  return (w.engine==='0.4.5'||w.engine==='0.4.6')&&integer(command.settlement,1,1e7)&&(command.type==='build'
    ?integer(command.tile,0,w.tiles.length-1)&&(command.building as string)!=='housing'&&Object.hasOwn(BUILDINGS,command.building)
    :Object.hasOwn(RECIPES,command.recipe)&&(w.engine==='0.4.6'||command.recipe==='tools'||command.recipe==='supplies'));
}
function validEdit(w:World,command:Extract<WorldCommand,{type:'setResources'|'paintTerrain'}>):boolean {
  return (w.engine==='0.4.5'||w.engine==='0.4.6')&&integer(command.tile,0,w.tiles.length-1)&&(command.type==='paintTerrain'
    ?Object.hasOwn(BIOMES,command.biome)&&integer(command.radius,0,3)
    :[command.food,command.wood,command.stone].every(value=>integer(value,0,1000)));
}
function validPlacement(w:World,command:Extract<WorldCommand,{type:'placeResidents'}>,historic=false):boolean {
  return (w.engine==='0.4.3'||w.engine==='0.4.4'||(w.engine==='0.4.5'||w.engine==='0.4.6'))&&integer(command.tile,0,w.tiles.length-1)&&(historic&&(w.engine==='0.4.5'||w.engine==='0.4.6')||w.tiles[command.tile].walkable)&&integer(command.count,10,100);
}
export function validateWorld(input:unknown): input is World {
  if(!input||typeof input!=='object') throw new Error('世界数据缺失。');
  const w=input as World;
  const version=['0.4.0','0.4.1','0.4.2','0.4.3','0.4.4','0.4.5','0.4.6'].includes(w.engine)?3:['0.3.0','0.3.1'].includes(w.engine)?2:1;
  if(w.version!==version||!['0.1.0','0.2.0','0.3.0','0.3.1','0.4.0','0.4.1','0.4.2','0.4.3','0.4.4','0.4.5','0.4.6'].includes(w.engine)) throw new Error('不支持的存档或引擎版本，请保留原文件。');
  assertConfig(w.config); const size=w.config.size,n=size*size;
  if(w.config.modLock!==undefined){
    if((w.engine!=='0.4.5'&&w.engine!=='0.4.6'))throw new Error('此引擎版本不支持模组。');
    const lock=validateModLock(w.config.modLock);
    const modifiers=modRules(lock);
    if(w.engine==='0.4.5'&&(modifiers.foodCapacityPercent!==undefined||modifiers.floodLossPercent!==undefined))throw new Error('此模组需要 0.4.6 引擎。');
    if(JSON.stringify(lock)!==JSON.stringify(w.config.modLock))throw new Error('模组版本锁顺序或字段无效。');
  }
  if(!integer(w.tick,0,1e10)||!integer(w.rng,0,0xffffffff)||!w.rules||!integer(w.rules.growth,0,300)||!w.totals||![w.totals.harvested,w.totals.consumed,w.totals.regrown].every(v=>integer(v,0,Number.MAX_SAFE_INTEGER))) throw new Error('无效的时钟、随机状态或规则。');
  if((w.engine==='0.4.5'||w.engine==='0.4.6')?!integer(w.totals.floodLoss,0,Number.MAX_SAFE_INTEGER):w.totals.floodLoss!==undefined)throw new Error('洪水损失账目无效。');
  if(!Array.isArray(w.tiles)||w.tiles.length!==n||!Array.isArray(w.agents)||w.agents.length>2000||!Array.isArray(w.settlements)||w.settlements.length>2000||!Array.isArray(w.events)||w.events.length>100000||!Array.isArray(w.metrics)||w.metrics.length>500000||!Array.isArray(w.commands)||w.commands.length>100000) throw new Error('世界数据结构或大小无效。');
  if(w.version===3?(!Array.isArray(w.deceased)||w.agents.length+w.deceased.length>RECORD_LIMIT):w.deceased!==undefined)throw new Error('历史居民记录缺失、超出上限或混入旧引擎。');
  for(const t of w.tiles) if(!t||!['ocean','shore','grass','forest','desert','mountain','snow'].includes(t.biome)||typeof t.walkable!=='boolean'||![t.elevation,t.moisture,t.temperature,t.fertility].every(v=>integer(v,0,100))||!integer(t.capacity,0,1000)||!integer(t.food,0,t.capacity)||!integer(t.wood,0,1000)||!integer(t.stone,0,1000)) throw new Error('地形资源超出边界。');
  const ids=new Set<number>();
  for(const a of allPeople(w)) {
    if(!a||!integer(a.id,1,1e7)||ids.has(a.id)||!integer(a.x,0,size-1)||!integer(a.y,0,size-1)||!w.tiles[a.y*size+a.x].walkable||typeof a.name!=='string'||a.name.length>80||typeof a.reason!=='string'||a.reason.length>2000||typeof a.action!=='string'||a.action.length>80||typeof a.alive!=='boolean'||![a.hunger,a.energy,a.health].every(v=>integer(v,0,100))||!integer(a.born,0,w.tick)||!integer(a.food,0,12)||!integer(a.wood,0,12)||!integer(a.skill,0,Number.MAX_SAFE_INTEGER)||(a.settlement!==null&&!integer(a.settlement,1,1e7))||!Array.isArray(a.path)||a.path.length>n||!Array.isArray(a.known)||a.known.length>n||!a.known.every(v=>integer(v,0,n-1))||(a.target!==null&&!integer(a.target,0,n-1))) throw new Error('居民数据或实体引用无效。');
    if(a.occupation!==undefined&&((w.engine!=='0.4.5'&&w.engine!=='0.4.6')||!['forager','builder','artisan'].includes(a.occupation)))throw new Error('居民职业无效。');
    if(a.workSite!==undefined&&(w.engine!=='0.4.6'||!a.alive||a.settlement===null||!integer(a.workSite,0,n-1)))throw new Error('居民待恢复的工地无效。');
    if(a.forageGoal!==undefined&&((w.engine!=='0.4.5'&&w.engine!=='0.4.6')||!a.alive||!integer(a.forageGoal,0,n-1)))throw new Error('居民待恢复的采集目标无效。');
    let prev=a.y*size+a.x;
    for(const p of a.path) { if(!integer(p,0,n-1)||!w.tiles[p].walkable||Math.abs(p%size-prev%size)+Math.abs(Math.floor(p/size)-Math.floor(prev/size))!==1) throw new Error('居民路径无效。');prev=p; }
    ids.add(a.id);
  }
  if(w.deceased?.some(a=>a.alive||a.settlement!==null||a.path.length||a.known.length||a.target!==null))throw new Error('历史居民必须已离世、离开营地并清理路径缓存。');
  validateSettlements(w,ids);validateFamilies(w,ids);
  for(let i=0;i<w.events.length;i++) {const e=w.events[i];if(!e||e.id!==i+1||!integer(e.tick,0,w.tick)||typeof e.text!=='string'||e.text.length>4000||typeof e.type!=='string'||!Array.isArray(e.entities)||!e.entities.every(id=>ids.has(id))||((e.x===undefined)!==(e.y===undefined))||(e.x!==undefined&&!integer(e.x,0,size-1))||(e.y!==undefined&&!integer(e.y,0,size-1)))throw new Error('事件记录无效。');}
  for(const m of w.metrics) if(!m||!integer(m.tick,0,w.tick)||![m.population,m.food,m.settlements,m.harvested,m.consumed].every(v=>integer(v,0,Number.MAX_SAFE_INTEGER)))throw new Error('统计记录无效。');
  for(const c of w.commands){
    if(!c||!integer(c.tick,0,w.tick)||!c.command)throw new Error('命令记录无效。');
    const command=c.command;
    const valid=command.type==='setGrowth'?integer(command.value,0,300)
      :command.type==='addFood'?integer(command.tile,0,n-1)&&integer(command.amount,1,1000)
      :command.type==='placeResidents'?validPlacement(w,command,true)
      :command.type==='setOccupation'?validOccupation(w,command)
      :command.type==='build'||command.type==='queueProduction'?validIndustry(w,command)
      :command.type==='migrateFamily'?(w.engine==='0.4.5'||w.engine==='0.4.6')&&integer(command.family,1,1e7)&&integer(command.settlement,1,1e7)
      :(command.type==='paintTerrain'||command.type==='setResources')&&validEdit(w,command);
    if(!valid)throw new Error('命令记录无效。');
  }
  return true;
}
