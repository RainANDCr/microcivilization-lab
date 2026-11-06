import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createWorld,advance,validateWorld,stateHash} from '../packages/sim-core/src/index.ts';
import {YEAR,populationSummary,allPeople} from '../packages/sim-core/src/demographics.ts';

const results=[];
for(const engine of ['0.3.0','0.3.1','0.4.0'] as const){
  const w=createWorld({name:'儿童供粮对照',seed:'rain-river',size:64,population:24,preset:'continent'},engine);
  const food=()=>w.tiles.reduce((n,t)=>n+t.food,0)+allPeople(w).reduce((n,a)=>n+a.food,0)+w.settlements.reduce((n,s)=>n+s.food,0);
  const initial=food();
  for(let year=1;year<=10;year++){
    advance(w,YEAR);validateWorld(w);
    assert.equal(food(),initial+w.totals.regrown-w.totals.consumed);
    console.log(JSON.stringify({engine,year,population:w.agents.filter(a=>a.alive).length}));
  }
  const people=allPeople(w),childDeaths=w.events.filter(e=>{
    if(e.type!=='death')return false;
    const a=people.find(a=>a.id===e.entities[0])!;
    return a.initialAgeTicks!+e.tick-a.born<12*YEAR;
  }).length;
  results.push({engine,years:10,population:w.agents.filter(a=>a.alive).length,...populationSummary(w),childDeaths,food:food(),hash:stateHash(w)});
}
for(const field of ['population','births','deaths','childDeaths','food'] as const)assert.equal(results[2][field],results[1][field],`archival must preserve ${field} before the old historical cap`);
writeFileSync('docs/CHILDCARE_RESULTS.json',JSON.stringify({runtime:process.version,results},null,2)+'\n');
console.log(JSON.stringify(results));
