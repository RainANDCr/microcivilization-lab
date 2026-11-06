import {advance,createWorld} from '../packages/sim-core/src/index.ts';
import {strict as assert} from 'node:assert';
import test from 'node:test';
import {lockMods,modRules,parseModManifest,validateModLock} from '../packages/mod-sdk/src/index.ts';

const base={schemaVersion:1,id:'fertile-forests',version:'1.0.0',name:'沃野森林',rules:{biomeFertility:{forest:160}}};
const drought={schemaVersion:1,id:'dry-season',version:'1.0.0',name:'旱季',dependencies:{'fertile-forests':'1.0.0'},rules:{initialGrowth:40}};
const parse=(value:unknown)=>parseModManifest(JSON.stringify(value));

test('locks canonical content and checks exact dependency versions',()=>{
  const a=parse(base),b=parse(drought);
  const lock=lockMods([b,a]);
  assert.deepEqual(lock,lockMods([a,b]));
  assert.deepEqual(validateModLock(JSON.parse(JSON.stringify(lock))),lock);
  assert.deepEqual(modRules(lock),{initialGrowth:40,biomeFertility:{forest:160}});
  assert.throws(()=>lockMods([b]),/fertile-forests.*1\.0\.0/);
  assert.throws(()=>lockMods([b,parse({...base,version:'1.0.1'})]),/fertile-forests.*1\.0\.0/);
  assert.throws(()=>lockMods([a,a]),/fertile-forests/);
  assert.throws(()=>lockMods([b,parse({...base,dependencies:{'dry-season':'1.0.0'}})]),/循环/);
});

test('rejects executable fields, unbounded effects, conflicting rules and edited lock contents',()=>{
  assert.throws(()=>parse({...base,script:'alert(1)'}));
  assert.throws(()=>parse({...base,rules:{initialGrowth:301}}));
  assert.throws(()=>parse({...base,rules:{biomeFertility:{unknown:100}}}));
  assert.throws(()=>lockMods([parse(base),parse({...base,id:'another-forest'})]),/forest/);
  const lock=lockMods([parse(base)]);
  lock.manifests[0].rules.biomeFertility!.forest=161;
  assert.throws(()=>validateModLock(lock),/校验/);
});
test('the new locked rules modify capacity and preserve food during floods when set to zero',()=>{
  const config={name:'防汛',seed:'rain-river',size:64,preset:'continent',population:0} as const;
  const lock=lockMods([parse({...base,rules:{foodCapacityPercent:150,floodLossPercent:0}})]);
  const original=createWorld(config);
  const modified=createWorld({...config,modLock:lock});
  const tile=original.tiles.findIndex(tile=>tile.biome==='shore');
  assert.equal(modified.tiles[tile].capacity,Math.floor(original.tiles[tile].capacity*1.5));
  advance(original,4080);advance(modified,4080);
  assert.ok(original.totals.floodLoss!>0);
  assert.equal(modified.totals.floodLoss,0);
  assert.throws(()=>createWorld({...config,modLock:lock},'0.4.5'),/0.4.6/);
});
