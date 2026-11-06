import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createWorld,advance,validateWorld,stateHash,cloneWorld} from '../packages/sim-core/src/index.ts';
import {YEAR,populationSummary,ageYears} from '../packages/sim-core/src/demographics.ts';
import {parseArchive,serializeArchive} from '../packages/storage/src/archive.ts';

const results=[];
for(const seed of ['rain-river']){
  const w=createWorld({name:'长期人口验证',seed,size:64,population:24,preset:'continent'},'0.3.0');
  const food=()=>w.tiles.reduce((n,t)=>n+t.food,0)+w.agents.reduce((n,a)=>n+a.food,0)+w.settlements.reduce((n,s)=>n+s.food,0);
  const wood=()=>w.tiles.reduce((n,t)=>n+t.wood,0)+w.agents.reduce((n,a)=>n+a.wood,0)+w.settlements.reduce((n,s)=>n+s.wood+s.buildings.reduce((n,b)=>n+b.cost,0),0);
  const initialFood=food(),initialWood=wood(),samples=[];
  let adultDescendants=0;
  for(let year=1;year<=100;year++){
    advance(w,YEAR);validateWorld(w);
    assert.equal(food(),initialFood+w.totals.regrown-w.totals.consumed,`${seed}: food ledger at year ${year}`);
    assert.equal(wood(),initialWood,`${seed}: wood ledger at year ${year}`);
    adultDescendants=Math.max(adultDescendants,w.agents.filter(a=>a.alive&&a.born>0&&ageYears(w,a)!>=18).length);
    if(year===50){
      const restored=parseArchive(serializeArchive(w)),expected=cloneWorld(w);
      advance(restored,240);advance(expected,240);assert.equal(stateHash(restored),stateHash(expected));
    }
    if(year%10===0){
      const sample={year,population:w.agents.filter(a=>a.alive).length,...populationSummary(w),food:food(),regrown:w.totals.regrown};
      samples.push(sample);console.log(JSON.stringify({seed,...sample}));
    }
  }
  results.push({seed,engine:w.engine,years:100,adultDescendants,secondGenerationBirths:w.agents.filter(a=>a.parents?.some(id=>w.agents.find(p=>p.id===id)!.born>0)).length,hash:stateHash(w),samples});
}
writeFileSync('docs/POPULATION_RESULTS.json',JSON.stringify({runtime:process.version,results},null,2)+'\n');
