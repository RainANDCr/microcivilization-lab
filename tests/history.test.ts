import {it} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,advance,validateWorld,stateHash,cloneWorld} from '../packages/sim-core/src/index.ts';
import {updatePopulation} from '../packages/sim-core/src/population.ts';
import {populationSummary} from '../packages/sim-core/src/demographics.ts';
import {serializeArchive,parseArchive} from '../packages/storage/src/archive.ts';

import {historyWorld} from './fixtures/history-world.ts';
const everyone=(w:ReturnType<typeof historyWorld>)=>[...w.agents,...(w.deceased??[])];
const food=(w:ReturnType<typeof historyWorld>)=>w.tiles.reduce((n,t)=>n+t.food,0)+everyone(w).reduce((n,a)=>n+a.food,0)+w.settlements.reduce((n,s)=>n+s.food,0);
const wood=(w:ReturnType<typeof historyWorld>)=>w.tiles.reduce((n,t)=>n+t.wood,0)+everyone(w).reduce((n,a)=>n+a.wood,0)+w.settlements.reduce((n,s)=>n+s.wood+s.buildings.reduce((n,b)=>n+b.cost,0),0);

it('preserves the 0.3.1 childcare result including actual child deaths',()=>{
  const w=createWorld({name:'legacy-care-fixture',seed:'rain-river',size:64,population:24,preset:'continent'},'0.3.1');advance(w,50000);
  assert.equal(stateHash(w),'64e4dd01');assert.equal('deceased' in w,false);
});
it('keeps births possible beyond 2000 historical people without recycling ancestors or resources',()=>{
  const w=historyWorld(),before=food(w),initialWood=wood(w),deathEvent=cloneWorld(w).events.at(-1);
  updatePopulation(w);
  assert.equal(w.agents.length,3);assert.equal(w.deceased?.length,1998);
  const child=w.agents.at(-1)!;assert.equal(child.id,2001);assert.deepEqual(child.parents,[1,2]);
  const ancestor=w.deceased!.find(a=>a.id===3)!;
  assert.equal(ancestor.name,'先人 3');assert.equal(ancestor.family,200001);assert.equal(ancestor.food,1);assert.equal(ancestor.wood,1);
  assert.deepEqual(ancestor.known,[]);assert.deepEqual(ancestor.path,[]);assert.equal(ancestor.target,null);
  assert.deepEqual(w.events.find(e=>e.id===deathEvent!.id),deathEvent);
  assert.deepEqual(w.agents[0].parents,[3,4]);assert.ok(w.families![0].members.includes(3));
  assert.equal(food(w),before-6);assert.equal(wood(w),initialWood);
  assert.equal(populationSummary(w)?.deaths,1998);assert.equal(populationSummary(w)?.births,2);assert.equal(validateWorld(w),true);
});
it('retains the historical cap and serialized fields for older worlds',()=>{
  const w=historyWorld('0.3.1');updatePopulation(w);
  assert.equal(w.agents.length,2000);assert.equal('deceased' in w,false);assert.equal(w.settlements[0].food,50);
  assert.equal(validateWorld(w),true);
});
it('restores archived grandparents and continues deterministically across a save',()=>{
  const w=historyWorld();updatePopulation(w);const restored=parseArchive(serializeArchive(w));
  advance(w,240);advance(restored,240);assert.equal(stateHash(restored),stateHash(w));
  assert.equal(restored.deceased?.find(a=>a.id===3)?.name,'先人 3');assert.equal(restored.version,3);
});
it('retains a deceased founding parent without attempting births from their archived record',()=>{
  const w=historyWorld(),parent=w.agents[0];parent.alive=false;parent.health=0;parent.settlement=null;w.settlements[0].members=[2];
  updatePopulation(w);
  assert.equal(w.agents.length,1);assert.equal(w.deceased?.length,1999);
  assert.ok(w.families![0].members.includes(parent.id));assert.equal(w.settlements[0].food,50);
  assert.equal(validateWorld(w),true);
});
it('rejects live or duplicated historical people and broken lineage references',()=>{
  const w=historyWorld();updatePopulation(w);
  for(const kind of ['alive','duplicate','lineage','cache','missing']){
    const broken=cloneWorld(w);
    if(kind==='alive')broken.deceased![0].alive=true;
    if(kind==='duplicate')broken.deceased![0].id=1;
    if(kind==='lineage')broken.deceased=broken.deceased!.filter(a=>a.id!==4);
    if(kind==='cache')broken.deceased![0].known=[0];
    if(kind==='missing')delete broken.deceased;
    assert.throws(()=>serializeArchive(broken),kind);
  }
  const old=historyWorld('0.3.1');old.deceased=[];assert.throws(()=>serializeArchive(old));
});
it('rejects total history beyond 20000 even with otherwise valid unique records',()=>{
  const w=historyWorld();updatePopulation(w);const template=w.deceased![1];
  for(let id=2002;id<=20001;id++)w.deceased!.push({...template,id,family:null});
  assert.throws(()=>serializeArchive(w));
});
it('still limits living people to 2000 and total retained records to 20000',()=>{
  for(const living of [false,true]){
    const w=historyWorld('0.4.0',living?2000:20000);
    if(living)w.agents.slice(2).forEach(a=>{a.alive=true;a.health=100;});
    assert.equal(validateWorld(w),true);
    updatePopulation(w);
    assert.equal(everyone(w).length,living?2000:20000);assert.equal(w.settlements[0].food,50);
    assert.equal(validateWorld(w),true);
  }
});
it('archives a deceased resident in a default world without erasing the death count',()=>{
  const w=createWorld({name:'默认归档测试',seed:'families',size:64,population:1,preset:'continent'});
  const a=w.agents[0];a.hunger=99;a.health=1;a.food=0;w.tiles.forEach(t=>{t.food=0;});w.rules.growth=0;
  advance(w,24);assert.equal(w.agents.length,0);assert.equal(w.deceased?.[0].id,a.id);
  assert.equal(populationSummary(w)?.deaths,1);assert.equal(parseArchive(serializeArchive(w)).deceased?.length,1);
});
