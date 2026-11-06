import {it} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,advance,applyCommand,cloneWorld,stateHash,validateWorld,findPath} from '../packages/sim-core/src/index.ts';
import {updatePopulation,useHouseholdFood} from '../packages/sim-core/src/population.ts';
import {populationSummary,YEAR} from '../packages/sim-core/src/demographics.ts';
import {parseArchive,serializeArchive} from '../packages/storage/src/archive.ts';
import {metricsCsv} from '../packages/sim-core/src/metrics.ts';
const config={name:'代际测试',seed:'families',size:64 as const,population:2,preset:'continent' as const};
function household(){
  const w=createWorld(config,'0.3.0');w.tick=2160;w.rng=1;
  const center={x:w.agents[0].x,y:w.agents[0].y};
  w.agents.forEach(a=>{a.x=center.x;a.y=center.y;a.family=200001;a.settlement=100001;a.initialAgeTicks=25*YEAR;a.parents=[];a.hunger=0;a.food=6;a.health=100;});
  w.settlements=[{id:100001,name:'家园',...center,founded:0,members:[1,2],food:50,wood:0,buildings:[{type:'housing',progress:24,cost:12}],knowledge:0,technology:[]}];
  w.families=[{id:200001,name:'家庭 1',settlement:100001,parents:[1,2],members:[1,2],founded:0,lastBirth:0}];
  return w;
}
function caringHousehold(){
  const w=household();updatePopulation(w);w.engine='0.3.1';w.tick=2172;
  w.settlements[0].food=0;w.agents[0].food=6;w.agents[1].food=2;
  const child=w.agents[2];child.food=0;child.hunger=99;child.health=1;
  return w;
}
const totalFood=(w:ReturnType<typeof household>)=>w.tiles.reduce((n,t)=>n+t.food,0)+w.agents.reduce((n,a)=>n+a.food,0)+w.settlements.reduce((n,s)=>n+s.food,0);
it('preserves the released 0.3.0 family simulation exactly',()=>{
  const w=createWorld({name:'legacy-family-fixture',seed:'rain-river',size:64,population:24,preset:'continent'},'0.3.0');advance(w,10000);
  assert.equal(stateHash(w),'657875a5');
});
it('feeds a starving child from an adjacent parent without creating food',()=>{
  const w=caringHousehold(),before=totalFood(w),consumed=w.totals.consumed;
  advance(w,1);
  assert.equal(w.agents[2].alive,true);assert.equal(w.agents[2].health,2);
  assert.equal(w.agents[0].food,4);assert.equal(w.agents[0].action,'照料家人');
  assert.equal(w.totals.consumed-consumed,2);assert.equal(totalFood(w),before-2);
  assert.equal(validateWorld(w),true);
});
it('can claim nearby parental food before starvation even when the child updates first',()=>{
  const w=caringHousehold(),child=w.agents[2],parent=w.agents[0];w.agents.reverse();
  advance(w,1);assert.equal(child.alive,true);assert.ok(child.hunger<100);assert.ok(parent.food>=2);
  assert.equal(validateWorld(w),true);
});
it('walks actual paths to deliver food instead of transferring it remotely',()=>{
  const w=caringHousehold(),a=w.agents[0],child=w.agents[2],s=w.settlements[0],size=w.config.size,center=s.y*size+s.x;
  for(let dx=0;dx<=3;dx++)Object.assign(w.tiles[center+dx],{walkable:true,food:0,biome:'grass'});
  a.x=s.x+3;a.path=[];a.target=null;child.hunger=50;child.health=100;
  const before=totalFood(w);advance(w,1);
  assert.equal(a.x,s.x+2);assert.equal(a.action,'送餐');assert.equal(a.food,6);assert.equal(child.food,0);
  advance(w,1);assert.equal(a.food,4);assert.ok(child.hunger<30);
  assert.equal(totalFood(w),before-2);assert.equal(validateWorld(w),true);
});
it('does not feed children from dead parents or take their last two food units',()=>{
  for(const dead of [false,true]){
    const w=caringHousehold(),a=w.agents[0];
    w.tiles.forEach(t=>{t.food=0;});
    if(dead){a.alive=false;a.settlement=null;w.settlements[0].members=[2,3];}else a.food=2;
    const consumed=w.totals.consumed;advance(w,1);
    assert.equal(w.agents[2].alive,false);assert.equal(w.totals.consumed,consumed);
    assert.equal(validateWorld(w),true);
  }
});
it('roundtrips active family food delivery and continues deterministically',()=>{
  const w=caringHousehold();advance(w,1);const restored=parseArchive(serializeArchive(w));
  advance(w,240);advance(restored,240);assert.equal(stateHash(w),stateHash(restored));
  assert.equal(restored.engine,'0.3.1');
});
it('keeps 0.2.0 results and serialized fields exactly unchanged',()=>{
  const w=createWorld({name:'legacy-camp-fixture',seed:'legacy-camp-rain',size:64,population:24,preset:'continent'},'0.2.0');advance(w,1000);
  assert.equal(stateHash(w),'c9da8256');assert.equal(w.version,1);assert.equal('families' in w,false);
  assert.equal('initialAgeTicks' in w.agents[0],false);
});
it('creates a versioned family only for adults sharing completed housing',()=>{
  const w=household();w.families=[];w.agents.forEach(a=>a.family=null);w.tick=24;
  updatePopulation(w);assert.equal(w.version,2);assert.equal(w.families?.length,1);
  assert.deepEqual(w.families![0].parents,[1,2]);assert.equal(w.agents[0].family,w.families![0].id);assert.equal(validateWorld(w),true);
});
it('does not create a household before housing is actually complete',()=>{
  const w=household();w.families=[];w.agents.forEach(a=>a.family=null);w.settlements[0].buildings[0].progress=23;
  updatePopulation(w);assert.equal(w.families.length,0);
});
it('funds a newborn from the warehouse and transmits real parental experience',()=>{
  const w=household();w.agents[0].skill=400;w.agents[1].skill=200;
  const before=w.agents.reduce((n,a)=>n+a.food,0)+w.settlements[0].food;
  updatePopulation(w);assert.equal(w.agents.length,3);
  const child=w.agents[2];assert.deepEqual(child.parents,[1,2]);assert.equal(child.family,200001);assert.equal(child.skill,75);assert.equal(child.initialAgeTicks,0);
  assert.equal(w.settlements[0].food,42);assert.equal(child.food,2);assert.equal(w.totals.consumed,6);
  assert.equal(w.agents.reduce((n,a)=>n+a.food,0)+w.settlements[0].food,before-6);
  assert.ok(w.events.some(e=>e.type==='population'));assert.equal(validateWorld(w),true);
});
it('blocks births without food, complete housing, living parents or cooldown',()=>{
  for(const kind of ['food','housing','parent','cooldown']){
    const w=household();
    if(kind==='food')w.settlements[0].food=0;
    if(kind==='housing')w.settlements[0].buildings=[];
    if(kind==='parent'){w.agents[0].alive=false;w.agents[0].settlement=null;w.settlements[0].members=[2];}
    if(kind==='cooldown')w.families![0].lastBirth=w.tick;
    const food=w.settlements[0].food;updatePopulation(w);
    assert.equal(w.agents.length,2,kind);assert.equal(w.settlements[0].food,food,kind);
  }
});
it('keeps children out of production work and derives age structure from live agents',()=>{
  const w=createWorld({...config,population:1},'0.3.0');const a=w.agents[0];a.initialAgeTicks=0;a.food=10;a.hunger=0;
  advance(w,24);assert.equal(a.skill,0);assert.equal(w.totals.harvested,0);
  assert.equal(populationSummary(w)?.children,1);assert.equal(populationSummary(w)?.adults,0);
});
it('preserves lineage and deterministic continuation through archives',()=>{
  const w=household();updatePopulation(w);const restored=parseArchive(serializeArchive(w));
  advance(w,120);advance(restored,120);assert.equal(stateHash(w),stateHash(restored));
  restored.families![0].members.push(99999);assert.throws(()=>validateWorld(restored));
  const broken=cloneWorld(w);broken.agents[2].parents=[99999];assert.throws(()=>validateWorld(broken));
});
it('records ageing deaths without erasing family history or shared inventory',()=>{
  const w=household();w.agents[0].initialAgeTicks=80*YEAR;w.agents[0].health=1;const food=w.settlements[0].food;
  updatePopulation(w);assert.equal(w.agents[0].alive,false);assert.equal(w.agents[0].family,200001);
  assert.ok(w.families![0].members.includes(1));assert.equal(w.settlements[0].food,food);assert.equal(validateWorld(w),true);
});
it('lets an adult child form a new household while retaining their parents',()=>{
  const w=household();updatePopulation(w);const grown=w.agents[2];w.tick=grown.born+18*YEAR;
  const newcomer={...cloneWorld(w).agents[1],id:4,name:'成人 4',family:null,parents:[],initialAgeTicks:20*YEAR};
  w.agents.push(newcomer);w.settlements[0].members.push(4);w.settlements[0].buildings.push({type:'housing',progress:24,cost:12});
  updatePopulation(w);assert.equal(w.families!.length,2);assert.deepEqual(grown.parents,[1,2]);
  assert.notEqual(grown.family,200001);assert.ok(!w.families![0].members.includes(grown.id));assert.equal(validateWorld(w),true);
});
it('uses real warehouse supplies to feed a hungry child before starvation',()=>{
  const w=household();updatePopulation(w);const child=w.agents[2];child.health=1;child.hunger=100;child.food=0;
  const food=w.settlements[0].food;advance(w,1);assert.equal(child.alive,true);assert.equal(child.health,2);assert.equal(w.settlements[0].food,food-2);
});
it('samples and exports family population history without inventing legacy values',()=>{
  const w=household();updatePopulation(w);advance(w,24);
  assert.equal(w.metrics.at(-1)?.families,1);assert.equal(w.metrics.at(-1)?.children,1);
  const csv=metricsCsv(w);assert.match(csv.split('\n')[0],/families,children,births,deaths$/);assert.ok(csv.split('\n').at(-1)?.endsWith(',1,1,1,0'));
  const old=createWorld(config,'0.2.0');assert.ok(metricsCsv(old).split('\n')[1].endsWith(',,,,'));
});
it('returns adults toward their completed home at night rather than wandering indefinitely',()=>{
  const w=household();w.tick=18;const a=w.agents[0],s=w.settlements[0],size=w.config.size,center=s.y*size+s.x;
  const target=w.tiles.findIndex((t,i)=>t.walkable&&Math.abs(i%size-s.x)+Math.abs(Math.floor(i/size)-s.y)>=2&&Math.abs(i%size-s.x)+Math.abs(Math.floor(i/size)-s.y)<=3&&findPath(w,i,center,256).length>0);
  assert.ok(target>=0);a.x=target%size;a.y=Math.floor(target/size);a.known.push(target);
  const distance=Math.abs(a.x-s.x)+Math.abs(a.y-s.y);advance(w,1);
  assert.equal(Math.abs(a.x-s.x)+Math.abs(a.y-s.y),distance-1);assert.equal(a.action,'回家');
});
it('rests at home throughout the night and resumes production in daylight',()=>{
  const w=household();w.tick=18;const a=w.agents[0];a.energy=80;
  advance(w,11);assert.equal(a.x,w.settlements[0].x);assert.equal(a.y,w.settlements[0].y);
  assert.equal(a.action,'休息');assert.equal(a.energy,100);assert.equal(a.skill,0);assert.deepEqual(a.path,[]);
  advance(w,1);assert.notEqual(a.action,'休息');assert.ok(a.skill>0);
});
it('keeps eating ahead of night rest and forages when home has no food',()=>{
  const w=household();w.tick=18;const a=w.agents[0];a.hunger=99;a.food=2;a.health=1;
  advance(w,1);assert.equal(a.action,'进食');assert.equal(a.alive,true);
  a.food=0;a.hunger=40;w.settlements[0].food=0;
  w.tiles[a.y*w.config.size+a.x].food=10;advance(w,1);
  assert.equal(a.action,'采集');assert.equal(a.food,3);
});
it('grows a naturally formed population with food and spare housing',()=>{
  const w=createWorld({name:'人口回归',seed:'rain-river',size:64,population:24,preset:'continent'});
  advance(w,17280);
  assert.ok(w.agents.some(a=>a.born>0),'natural families should have newborns within two years');
  assert.ok(w.agents.filter(a=>a.alive).length>24);assert.equal(validateWorld(w),true);
  const restored=parseArchive(serializeArchive(w));advance(w,240);advance(restored,240);
  assert.equal(stateHash(w),stateHash(restored));
});
it('moves a household on foot into spare housing and carries its conserved stock',()=>{
  const w=household();
  w.engine='0.4.5';w.version=3;w.deceased=[];w.totals.floodLoss=0;w.tick=30;
  const [a,b]=w.agents,home=w.settlements[0],family=w.families![0];
  family.lastBirth=0;
  for(let x=10;x<=15;x++)Object.assign(w.tiles[10*64+x],{biome:'grass',walkable:true,food:0});
  for(const resident of w.agents)Object.assign(resident,{x:10,y:10,food:10});
  Object.assign(home,{x:10,y:10});
  const next={id:100002,name:'新居',x:15,y:10,founded:0,members:[],food:0,wood:0,buildings:[{type:'housing',progress:24,cost:12}],knowledge:0,technology:[]};
  w.settlements.push(next);
  useHouseholdFood(w,a);
  assert.equal(a.food,8);
  assert.equal(family.food,2);
  b.food=0;b.hunger=30;
  assert.equal(useHouseholdFood(w,b),2);
  assert.equal(b.food,2);
  assert.equal(family.food,0);
  b.food=10;b.hunger=0;
  useHouseholdFood(w,b);
  applyCommand(w,{type:'migrateFamily',family:family.id,settlement:next.id});
  assert.equal(family.settlement,home.id);
  const restored=parseArchive(serializeArchive(w));
  advance(w,18);advance(restored,18);
  assert.equal(family.settlement,next.id);
  assert.deepEqual(next.members,[a.id,b.id]);
  assert.equal(family.food,2);
  assert.equal(family.destination,undefined);
  assert.equal(stateHash(restored),stateHash(w));
  assert.ok(validateWorld(w));
});
it('splits an overcrowded camp through an actual family relocation',()=>{
  const world=household();
  world.engine='0.4.6';world.version=3;world.deceased=[];world.totals.floodLoss=0;world.tick=720;
  const origin=world.settlements[0],family=world.families![0];
  origin.x=10;origin.y=10;origin.food=2;origin.buildings=[];
  world.agents.forEach(agent=>{agent.x=10;agent.y=10;});
  const extra={...world.agents[0],id:3,family:null};
  world.agents.push(extra);origin.members.push(3);
  for(let x=10;x<=15;x++)Object.assign(world.tiles[640+x],{walkable:true,biome:'grass'});
  const destination={id:100002,name:'余粮聚落',x:15,y:10,founded:0,members:[],food:50,wood:0,buildings:[{type:'housing',progress:24,cost:12}],knowledge:0,technology:[]};
  world.settlements.push(destination);
  updatePopulation(world);
  assert.equal(family.destination,destination.id);
  assert.ok(world.events.some(event=>event.type==='split'));
  advance(world,24);
  assert.equal(family.settlement,destination.id);
  assert.deepEqual(origin.members,[3]);
  assert.ok(validateWorld(world));
});
