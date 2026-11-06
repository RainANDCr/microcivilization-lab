import {it} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,stateHash,advance} from '../packages/sim-core/src/index.ts';
import {parseArchive,serializeArchive} from '../packages/storage/src/archive.ts';
import {metricMaximum,observationReport} from '../packages/sim-core/src/metrics.ts';
import {allPeople,YEAR} from '../packages/sim-core/src/demographics.ts';
it('reports a complete year from sampled data without mutating the world',()=>{
  const w=createWorld({seed:'report',name:'报告世界',size:64,population:0,preset:'continent'});
  assert.match(observationReport(w).join('\n'),/暂无完整年度/);
  advance(w,YEAR);
  const before=stateHash(w),report=observationReport(w).join('\n');
  assert.match(report,/第 1 年/);
  assert.match(report,/0 → 8640 Tick/);
  assert.match(report,/暂无已记录技术/);
  assert.equal(stateHash(w),before);
});
it('roundtrips a running world and rejects unknown or damaged archives',()=>{
  const w=createWorld({name:'归档测试',seed:'archive',size:64,population:12,preset:'continent'});advance(w,120);
  assert.equal(stateHash(parseArchive(serializeArchive(w))),stateHash(w));
  assert.throws(()=>parseArchive('{'));
  assert.throws(()=>parseArchive(JSON.stringify({format:'mcworld',version:100,world:w})));
  const broken=structuredClone(w);broken.agents[0].food=-1;
  assert.throws(()=>parseArchive(JSON.stringify({format:'mcworld',version:1,world:broken})));
});
it('accounts for every food unit through ecology, harvesting and consumption',()=>{
  const w=createWorld({name:'守恒测试',seed:'ledger',size:64,population:24,preset:'continent'});
  const total=()=>w.tiles.reduce((s,t)=>s+t.food,0)+allPeople(w).reduce((s,a)=>s+a.food,0)+w.settlements.reduce((s,camp)=>s+camp.food,0)+(w.families?.reduce((s,f)=>s+(f.food??0),0)??0);
  const initial=total();advance(w,1000);
  assert.equal(total(),initial+w.totals.regrown-w.totals.consumed-(w.totals.floodLoss??0));
});
it('rejects half-specified event coordinates before the UI can try locating them',()=>{
  const w=createWorld({name:'坐标验证',seed:'location',size:64,population:12,preset:'continent'});
  w.events[0].x=0;
  assert.throws(()=>serializeArchive(w));
  delete w.events[0].x;w.events[0].y=0;
  assert.throws(()=>serializeArchive(w));
});
it('calculates chart bounds for 150000 samples without expanding function arguments',()=>{
  const rows=Array.from({length:150000},(_,i)=>({tick:i*24,population:i,food:i*2,settlements:0,harvested:0,consumed:0}));
  assert.equal(metricMaximum(rows,'population'),149999);
  assert.equal(metricMaximum(rows,'food'),299998);
  assert.equal(metricMaximum([],'food'),1);
});
