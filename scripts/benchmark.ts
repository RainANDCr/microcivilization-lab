import {performance} from 'node:perf_hooks';
import {createWorld,advance,stateHash,validateWorld} from '../packages/sim-core/src/index.ts';
const results=[];
for(const [size,population,ticks]of [[64,24,10000],[128,100,1000],[256,100,240]] as const){
  const start=performance.now();const w=createWorld({name:'基准世界',seed:'benchmark-rain',size,population,preset:'continent'});const generated=performance.now();advance(w,ticks);const simulated=performance.now();validateWorld(w);
  results.push({size,population,ticks,generationMs:Math.round(generated-start),simulationMs:Math.round(simulated-generated),ticksPerSecond:Math.round(ticks/(simulated-generated)*1000),survivors:w.agents.filter(a=>a.alive).length,hash:stateHash(w)});
}
console.log(JSON.stringify({engine:'0.4.6',runtime:process.version,results},null,2));
