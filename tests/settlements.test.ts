import {it} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,advance,applyCommand,stateHash,validateWorld,cloneWorld} from '../packages/sim-core/src/index.ts';
import {advanceCaravans,settlementCulture,updateSociety} from '../packages/sim-core/src/society.ts';
import {cooperate,updateSettlements} from '../packages/sim-core/src/settlements.ts';
import {serializeArchive,parseArchive} from '../packages/storage/src/archive.ts';
const config={name:'村落试验',seed:'rain-river',size:64 as const,population:80,preset:'continent' as const};
it('delivers surplus to a depleted camp before resting or unloading wood',()=>{
  const w=createWorld({...config,population:1}),a=w.agents[0];
  w.tick=18;
  a.settlement=100001;a.food=8;a.wood=3;a.hunger=0;
  const camp={id:100001,name:'缺粮营地',x:a.x,y:a.y,founded:0,members:[a.id],food:0,wood:0,buildings:[{type:'housing',progress:24,cost:12}],knowledge:0,technology:[]};
  w.settlements=[camp];
  advance(w,1);
  assert.equal(camp.food,2);
  assert.equal(a.food,6);
  assert.equal(a.wood,3);
  assert.equal(w.totals.consumed,0);
});
it('keeps the legacy engine result exactly unchanged',()=>{
  const w=createWorld({name:'legacy-fixture',seed:'legacy-rain',size:64,population:24,preset:'continent'},'0.1.0');advance(w,1000);
  assert.equal(stateHash(w),'9d585bb7');assert.equal(w.settlements.length,0);
});
it('forms camps from actual foragers without player intervention',()=>{
  const w=createWorld(config,'0.2.0');advance(w,720);
  assert.equal(w.engine,'0.2.0');assert.ok(w.settlements.length>0);
  assert.ok(w.events.some(e=>e.type==='settlement'));
  assert.ok(w.settlements.every(s=>s.members.length>=3));assert.equal(validateWorld(w),true);
});
it('requires a cooperating group instead of promoting by elapsed time',()=>{
  const w=createWorld({...config,population:1});advance(w,720);assert.equal(w.settlements.length,0);
});
it('reserves real construction materials before any housing project can start',()=>{
  const w=createWorld({...config,population:3});const a=w.agents[0];
  w.agents.forEach(agent=>{agent.x=a.x;agent.y=a.y;agent.settlement=100001;});
  w.settlements=[{id:100001,name:'材料测试营地',x:a.x,y:a.y,founded:0,members:w.agents.map(a=>a.id),food:0,wood:0,buildings:[],knowledge:0,technology:[]}];
  updateSettlements(w);assert.equal(w.settlements[0].buildings.length,0);
  w.settlements[0].wood=12;updateSettlements(w);
  assert.equal(w.settlements[0].wood,0);assert.equal(w.settlements[0].buildings.length,1);
  assert.equal(w.settlements[0].buildings[0].progress,0);
  assert.equal(w.settlements[0].buildings[0].cost,12);
});
it('conserves shared food and accounts for wood stored in buildings',()=>{
  const w=createWorld(config);
  const food=()=>w.tiles.reduce((n,t)=>n+t.food,0)+w.agents.reduce((n,a)=>n+a.food,0)+w.settlements.reduce((n,s)=>n+s.food,0)+(w.families?.reduce((n,f)=>n+(f.food??0),0)??0)+w.settlements.reduce((n,s)=>n+(s.caravan?.cargo==='food'?8:0),0);
  const wood=()=>w.tiles.reduce((n,t)=>n+t.wood,0)+w.agents.reduce((n,a)=>n+a.wood,0)+w.settlements.reduce((n,s)=>n+s.wood+s.buildings.reduce((m,b)=>m+b.cost,0)+(s.caravan&&s.caravan.cargo!=='food'?4:0),0);
  const initialFood=food(),initialWood=wood();advance(w,3000);
  assert.equal(food(),initialFood+w.totals.regrown-w.totals.consumed-(w.totals.floodLoss??0));assert.equal(wood(),initialWood);
  assert.ok(w.settlements.some(s=>s.buildings.some(b=>b.progress===24)));
  assert.equal(validateWorld(w),true);
});
it('retains settlement links across archives and independent snapshots',()=>{
  const w=createWorld(config);advance(w,720);assert.ok(w.settlements.length>0);
  const restored=parseArchive(serializeArchive(w)),copy=cloneWorld(w);
  advance(w,120);advance(restored,120);assert.equal(stateHash(restored),stateHash(w));
  copy.settlements[0].wood=0;assert.notEqual(stateHash(copy),stateHash(w));
  restored.settlements[0].members.push(99999);assert.throws(()=>validateWorld(restored));
});
it('built housing improves recovery only for a resident near their camp',()=>{
  const sheltered=createWorld({...config,population:1}),bare=cloneWorld(sheltered),a=sheltered.agents[0];
  for(const w of [sheltered,bare]){w.agents[0].hunger=0;w.agents[0].food=3;w.agents[0].energy=10;}
  a.settlement=100001;
  sheltered.settlements=[{id:100001,name:'住所测试',x:a.x,y:a.y,founded:0,members:[a.id],food:0,wood:0,buildings:[{type:'housing',progress:24,cost:12}],knowledge:0,technology:[]}];
  advance(sheltered,1);advance(bare,1);assert.equal(sheltered.agents[0].energy,22);assert.equal(bare.agents[0].energy,18);
});
it('removes a deceased resident from the camp without erasing stored resources',()=>{
  const w=createWorld({...config,population:1},'0.2.0'),a=w.agents[0];a.settlement=100001;a.food=0;a.health=1;a.hunger=100;
  w.settlements=[{id:100001,name:'遗留仓库',x:a.x,y:a.y,founded:0,members:[a.id],food:10,wood:5,buildings:[],knowledge:0,technology:[]}];
  advance(w,1);assert.equal(a.alive,false);assert.equal(a.settlement,null);assert.deepEqual(w.settlements[0].members,[]);
  assert.equal(w.settlements[0].food,10);assert.equal(w.settlements[0].wood,5);assert.equal(validateWorld(w),true);
});
it('resumes a recorded foraging goal after night rest and clears it if terrain is blocked',()=>{
  const w=createWorld({...config,population:1});
  const a=w.agents[0];
  Object.assign(a,{x:10,y:10,hunger:0,food:3,settlement:100001,forageGoal:652});
  for(const tile of [650,651,652])Object.assign(w.tiles[tile],{walkable:true,biome:'grass',food:10,capacity:20});
  w.settlements=[{id:100001,name:'居民营地',x:10,y:10,founded:0,members:[a.id],food:0,wood:0,buildings:[{type:'housing',progress:24,cost:12}],knowledge:0,technology:[]}];
  w.tick=18;
  advance(w,1);
  assert.equal(a.action,'休息');
  assert.equal(a.forageGoal,652);
  w.tick=29;
  advance(w,1);
  assert.equal(a.action,'恢复寻食');
  assert.equal(a.path.at(-1),652);
  w.tiles[652].food=0;
  advance(w,1);
  assert.notEqual(a.forageGoal,652);
  assert.ok(validateWorld(w));
});
it('builds four working facilities and completes workshop recipes in FIFO order',()=>{
  const w=createWorld({...config,population:1}),a=w.agents[0];
  Object.assign(a,{x:10,y:10,settlement:100001,food:6,hunger:0});
  for(let x=10;x<=14;x++)Object.assign(w.tiles[640+x],{walkable:true,biome:'forest',fertility:60,food:0});
  const camp:typeof w.settlements[number]={id:100001,name:'工坊营地',x:10,y:10,founded:0,members:[a.id],food:8,wood:100,buildings:[{type:'housing',progress:24,cost:12}],knowledge:0,technology:[]};
  w.settlements=[camp];
  applyCommand(w,{type:'setOccupation',agent:a.id,occupation:'builder'});
  for(const [building,x] of [['field',11],['well',12],['road',13],['workshop',14]] as const){
    applyCommand(w,{type:'build',settlement:camp.id,tile:640+x,building});
    a.x=x;
    const hours={field:6,well:9,road:3,workshop:12}[building];
    for(let hour=0;hour<hours;hour++){assert.ok(cooperate(w,a));assert.equal(a.action,'建造');}
  }
  assert.equal(camp.wood,54);
  assert.deepEqual(camp.buildings.map(b=>b.progress),[24,12,18,6,24]);
  assert.throws(()=>applyCommand(w,{type:'paintTerrain',tile:653,biome:'ocean',radius:0}));
  updateSettlements(w);
  assert.ok(camp.food>8);
  assert.equal(w.totals.regrown,camp.food-8);
  applyCommand(w,{type:'setOccupation',agent:a.id,occupation:'artisan'});
  applyCommand(w,{type:'queueProduction',settlement:camp.id,recipe:'tools'});
  applyCommand(w,{type:'queueProduction',settlement:camp.id,recipe:'supplies'});
  for(let hour=0;hour<4;hour++)assert.ok(cooperate(w,a));
  assert.equal(camp.tools,1);
  assert.equal(camp.production?.[0].recipe,'supplies');
  for(let hour=0;hour<6;hour++)assert.ok(cooperate(w,a));
  assert.equal(camp.supplies,2);
  assert.equal(camp.wood,44);
  assert.ok(validateWorld(parseArchive(serializeArchive(w))));
});

it('uses reachable routes to exchange conserved goods and spread practiced technology',()=>{
  const w=createWorld({...config,population:2},'0.4.5');
  const [a,b]=w.agents;
  for(let x=10;x<=21;x++)Object.assign(w.tiles[640+x],{walkable:true,biome:'grass'});
  Object.assign(a,{x:10,y:10,settlement:100001});
  Object.assign(b,{x:20,y:10,settlement:100002});
  const buyer:typeof w.settlements[number]={id:100001,name:'采购聚落',x:10,y:10,founded:0,members:[a.id],food:0,wood:30,buildings:[],knowledge:0,technology:[]};
  const seller:typeof buyer={id:100002,name:'农耕聚落',x:20,y:10,founded:0,members:[b.id],food:60,wood:0,buildings:[{type:'field',progress:12,cost:8,tile:661}],knowledge:0,technology:[]};
  w.settlements=[buyer,seller];
  for(let day=1;day<=12;day++){w.tick=day*24;updateSociety(w);}
  assert.deepEqual(seller.technology,['耕作']);
  assert.equal(settlementCulture(seller),'定居耕作');
  assert.equal(buyer.food+seller.food,60);
  assert.equal(buyer.wood+seller.wood,30);
  for(const tick of [336,504]){
    seller.food+=buyer.food;buyer.food=0;
    w.tick=tick;updateSociety(w);
  }
  assert.equal(buyer.relations?.[seller.id],15);
  assert.equal(seller.relations?.[buyer.id],15);
  assert.ok(buyer.technology.includes('耕作'));
  assert.ok(w.events.some(e=>e.type==='trade'));
  assert.ok(validateWorld(w));
});
it('persists in-transit cargo and resumes delivery when a blocked road reopens',()=>{
  const w=createWorld({...config,population:2});
  const [a,b]=w.agents;
  for(const tile of w.tiles)tile.walkable=false;
  for(let x=10;x<=16;x++)Object.assign(w.tiles[640+x],{walkable:true,biome:'grass'});
  Object.assign(a,{x:10,y:10,settlement:100001});
  Object.assign(b,{x:16,y:10,settlement:100002});
  const buyer:typeof w.settlements[number]={id:100001,name:'买方',x:10,y:10,founded:0,members:[a.id],food:0,wood:30,buildings:[],knowledge:0,technology:[]};
  const seller:typeof buyer={id:100002,name:'卖方',x:16,y:10,founded:0,members:[b.id],food:60,wood:0,buildings:[],knowledge:0,technology:[]};
  w.settlements=[buyer,seller];w.tick=168;
  updateSociety(w);
  assert.equal(buyer.wood,26);
  assert.equal(seller.wood,0);
  advanceCaravans(w);
  assert.equal(buyer.caravan?.tile,651);
  applyCommand(w,{type:'paintTerrain',tile:652,biome:'ocean',radius:0});
  advanceCaravans(w);
  assert.equal(buyer.caravan?.tile,651);
  const restored=parseArchive(serializeArchive(w));
  for(const world of [w,restored]){
    applyCommand(world,{type:'paintTerrain',tile:652,biome:'grass',radius:0});
    for(let step=0;step<16;step++)advanceCaravans(world);
  }
  assert.equal(stateHash(w),stateHash(restored));
  assert.equal(buyer.caravan,undefined);
  assert.equal(buyer.food+seller.food,60);
  assert.equal(buyer.wood+seller.wood,30);
  assert.equal(buyer.relations?.[seller.id],5);
});
it('resumes the assigned construction site and repairs a decayed abandoned facility',()=>{
  const w=createWorld({...config,population:1}),resident=w.agents[0];
  Object.assign(resident,{x:10,y:10,settlement:100001,food:6,hunger:0,occupation:'builder'});
  for(let x=10;x<=13;x++)Object.assign(w.tiles[640+x],{walkable:true,biome:'grass'});
  const camp:typeof w.settlements[number]={id:100001,name:'工地',x:10,y:10,founded:0,members:[resident.id],food:20,wood:40,buildings:[],knowledge:0,technology:[]};
  w.settlements=[camp];
  applyCommand(w,{type:'build',settlement:camp.id,tile:653,building:'road'});
  assert.ok(cooperate(w,resident));
  assert.equal(resident.workSite,653);
  applyCommand(w,{type:'build',settlement:camp.id,tile:651,building:'field'});
  resident.path=[];resident.target=null;
  assert.ok(cooperate(w,resident));
  assert.equal(resident.workSite,653);
  resident.x=13;resident.path=[];resident.target=null;
  for(let hour=0;hour<3;hour++)assert.ok(cooperate(w,resident));
  assert.equal(camp.buildings[0].progress,6);
  camp.members=[];resident.settlement=null;delete resident.workSite;
  w.tick=720;
  updateSettlements(w);
  assert.equal(camp.buildings[0].progress,5);
  assert.ok(w.events.some(event=>event.text.includes('无人维护')));
  camp.members=[resident.id];resident.settlement=camp.id;
  assert.ok(cooperate(w,resident));
  assert.equal(camp.buildings[0].progress,6);
  assert.ok(validateWorld(w));
});
it('executes construction and workshop work in parallel with a specialized forager',()=>{
  const world=createWorld({...config,population:4});
  const [builder,artisan,forager,carrier]=world.agents;
  world.tick=6;
  for(const resident of world.agents)Object.assign(resident,{settlement:100001,initialAgeTicks:24*8640,food:6,hunger:0});
  Object.assign(builder,{x:11,y:10,occupation:'builder'});
  Object.assign(artisan,{x:12,y:10,occupation:'artisan'});
  Object.assign(forager,{x:13,y:10,occupation:'forager'});
  Object.assign(carrier,{x:10,y:10,wood:6});
  for(let x=10;x<=13;x++)Object.assign(world.tiles[640+x],{walkable:true,biome:'grass',food:20,capacity:24});
  const camp:typeof world.settlements[number]={id:100001,name:'分工营地',x:10,y:10,founded:0,members:[builder.id,artisan.id,forager.id,carrier.id],
    food:20,wood:50,buildings:[{type:'housing',progress:24,cost:12},{type:'workshop',progress:24,cost:20,tile:652}],knowledge:0,technology:[]};
  world.settlements=[camp];
  applyCommand(world,{type:'build',settlement:camp.id,tile:651,building:'road'});
  applyCommand(world,{type:'queueProduction',settlement:camp.id,recipe:'tools'});
  advance(world,4);
  assert.equal(camp.buildings[2].progress,6);
  assert.equal(camp.tools,1);
  assert.equal(camp.wood,48);
  assert.equal(carrier.wood,0);
  assert.ok(world.totals.harvested>=4);
  assert.ok(validateWorld(world));
});
