import assert from 'node:assert/strict';
import {createWorld,advance,stateHash,validateWorld} from '../packages/sim-core/src/index.ts';
import {parseArchive,serializeArchive} from '../packages/storage/src/archive.ts';
import {allPeople,populationSummary,YEAR} from '../packages/sim-core/src/demographics.ts';

const years=Number(process.env.MC_ECOLOGY_YEARS??5);
assert.ok(Number.isInteger(years)&&years>=1&&years<=20,'MC_ECOLOGY_YEARS 必须是 1–20 的整数');
for(const preset of ['continent','islands','arid'] as const){
  for(const seed of ['rain-river','atlas']){
    const world=createWorld({name:'生态与承载力专项',seed,preset,size:64,population:32});
    function food(){
      return world.tiles.reduce((sum,tile)=>sum+tile.food,0)+allPeople(world).reduce((sum,agent)=>sum+agent.food,0)+
        world.settlements.reduce((sum,camp)=>sum+camp.food+(camp.caravan?.cargo==='food'?8:0),0)+
        world.families!.reduce((sum,family)=>sum+(family.food??0),0);
    }
    const initial=food();
    const survivors=[];
    for(let year=1;year<=years;year++){
      advance(world,YEAR);
      validateWorld(world);
      assert.equal(food(),initial+world.totals.regrown-world.totals.consumed-(world.totals.floodLoss??0),preset+' '+seed+' '+year);
      survivors.push(world.agents.filter(agent=>agent.alive).length);
    }
    const resumed=parseArchive(serializeArchive(world));
    advance(world,240);advance(resumed,240);
    assert.equal(stateHash(resumed),stateHash(world));
    const population=populationSummary(world)!;
    console.log(JSON.stringify({preset,seed,survivors,births:population.births,deaths:population.deaths,
      camps:world.settlements.length,floodLoss:world.totals.floodLoss,hash:stateHash(world)}));
  }
}
