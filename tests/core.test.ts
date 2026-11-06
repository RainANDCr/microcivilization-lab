import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { expect } from './expect.ts';
import { createWorld, advance, applyCommand, stateHash, findPath, validateWorld, cloneWorld } from '../packages/sim-core/src/index.ts';
import { movementOrigins } from '../packages/renderer/src/motion.ts';

const config = { seed: 'rain-river', size: 64 as const, population: 24, name: '初生之地', preset: 'continent' as const };
it('applies deterministic rainfall and drought to daily food regeneration',()=>{
  const rain=createWorld({...config,population:0},'0.4.4');
  const tile=rain.tiles.find(tile=>tile.walkable)!;
  Object.assign(tile,{food:0,capacity:100,fertility:100});
  const index=rain.tiles.indexOf(tile),drought=cloneWorld(rain);
  rain.tick=239;drought.tick=479;
  const restored=cloneWorld(rain);
  advance(rain,1);advance(drought,1);advance(restored,1);
  expect(rain.tiles[index].food).toBe(7);
  expect(drought.tiles[index].food).toBe(2);
  expect(rain.events.at(-1)?.type).toBe('weather');
  expect(drought.events.at(-1)?.tick).toBe(480);
  expect(stateHash(rain)).toBe(stateHash(restored));
});
it('updates climate and accounts for a single flood loss at a storm boundary',()=>{
  const w=createWorld({...config,population:0});
  w.tick=4079;
  w.rules.growth=0;
  const coast=w.tiles.find(tile=>tile.biome==='shore')!;
  const before=w.tiles.reduce((sum,tile)=>sum+tile.food,0),temperature=coast.temperature;
  advance(w,1);
  expect(coast.moisture).toBe(100);
  expect(coast.temperature).not.toBe(temperature);
  expect(w.events.some(event=>event.type==='flood')).toBe(true);
  expect(w.tiles.reduce((sum,tile)=>sum+tile.food,0)).toBe(before-w.totals.floodLoss!);
  const loss=w.totals.floodLoss;
  expect(loss!>0).toBe(true);
  advance(w,24);
  expect(w.totals.floodLoss).toBe(loss);
  expect(validateWorld(w)).toBe(true);
});
it('keeps the 0.4.4 climate baseline identical',()=>{
  const w=createWorld({name:'legacy-climate-fixture',seed:'rain-river',size:64,population:24,preset:'continent'},'0.4.4');
  advance(w,5000);
  expect(stateHash(w)).toBe('dd4f6cf8');
});
it('keeps the 0.4.3 ecology history identical',()=>{
  const w=createWorld({name:'legacy-weather-fixture',seed:'rain-river',size:64,population:24,preset:'continent'},'0.4.3');
  advance(w,5000);
  expect(stateHash(w)).toBe('7291639c');
});
it('places a deterministic group through a logged command and rejects invalid placement atomically',()=>{
  const w=createWorld({...config,population:0}),copy=cloneWorld(w);
  const tile=w.tiles.findIndex(tile=>tile.walkable);
  const command={type:'placeResidents',tile,count:10} as const;
  applyCommand(w,command);
  applyCommand(copy,command);
  expect(w.agents.length).toBe(10);
  expect(w.agents.every(agent=>agent.y*64+agent.x===tile&&agent.food===0)).toBe(true);
  expect(w.commands.at(-1)?.tick).toBe(0);
  expect(validateWorld(w)).toBe(true);
  const hash=stateHash(w);
  expect(hash).toBe(stateHash(copy));
  expect(()=>applyCommand(w,{...command,tile:-1})).toThrow();
  expect(()=>applyCommand(w,{...command,count:101})).toThrow();
  expect(stateHash(w)).toBe(hash);
});
it('only animates living residents across adjacent cells in consecutive snapshots',()=>{
  const before=createWorld(config),after=cloneWorld(before);
  const first=before.agents[0],second=before.agents[1];
  first.x=3;first.y=3;
  second.x=8;second.y=8;
  Object.assign(after.agents[0],{x:4,y:3});
  Object.assign(after.agents[1],{x:10,y:8});
  after.tick=before.tick+1;
  const hash=stateHash(after),origins=movementOrigins(before,after);
  expect(origins.size).toBe(1);
  expect(origins.get(first.id)?.x).toBe(3);
  expect(stateHash(after)).toBe(hash);
  after.tick++;
  expect(movementOrigins(before,after).size).toBe(0);
});
it('takes a longer route when its terrain cost is lower',()=>{
  const w=createWorld(config);
  for(const tile of w.tiles){tile.walkable=true;tile.biome='grass';}
  w.tiles[66].biome='forest';
  const path=findPath(w,65,67);
  expect(path.length).toBe(4);
  expect(path.includes(66)).toBe(false);
  expect(path.at(-1)).toBe(67);
  expect(findPath(w,65,67,1).length).toBe(0);
  w.engine='0.4.1';
  expect(findPath(w,65,67).length).toBe(2);
});
it('preserves the 0.4.1 route and simulation history',()=>{
  const w=createWorld({name:'legacy-path-fixture',seed:'rain-river',size:64,population:24,preset:'continent'},'0.4.1');
  advance(w,5000);
  expect(stateHash(w)).toBe('669f9324');
});
describe('deterministic world', () => {
  it('produces identical state for same seed and different terrain for different seed', () => {
    expect(stateHash(createWorld(config))).toBe(stateHash(createWorld(config)));
    expect(stateHash(createWorld({...config,seed:'other'}))).not.toBe(stateHash(createWorld(config)));
  });
  it('keeps all terrain values and agents in bounds', () => {
    const w = createWorld(config);
    expect(w.tiles).toHaveLength(4096);
    for (const t of w.tiles) { expect(t.food).toBeGreaterThanOrEqual(0); expect(t.food).toBeLessThanOrEqual(t.capacity); }
    for (const a of w.agents) { expect(w.tiles[a.y * w.config.size + a.x].walkable).toBe(true); }
    expect(validateWorld(w)).toBe(true);
  });
  it('survives 10000 ticks reproducibly including snapshot restore', () => {
    const a = createWorld(config); const b = createWorld(config);
    advance(a, 5000); const restored = cloneWorld(a); advance(a,5000); advance(restored,5000); advance(b,10000);
    expect(stateHash(a)).toBe(stateHash(b)); expect(stateHash(restored)).toBe(stateHash(a)); expect(validateWorld(a)).toBe(true);
  });
  it('walks adjacent tiles, consumes real resources and explains choices', () => {
    const w = createWorld(config); const before = w.agents.map(a=>({x:a.x,y:a.y}));
    advance(w,1);
    w.agents.forEach((a,i)=>expect(Math.abs(a.x-before[i].x)+Math.abs(a.y-before[i].y)).toBeLessThanOrEqual(1));
    advance(w,240);
    expect(w.totals.harvested).toBeGreaterThan(0); expect(w.totals.consumed).toBeGreaterThan(0);
    expect(w.agents.some(a=>a.reason.length>0)).toBe(true);
    expect(w.agents.filter(a=>a.alive).length).toBeGreaterThan(0);
  });
  it('does not cross impassable terrain', () => {
    const w=createWorld(config); w.tiles.forEach(t=>{t.walkable=false;});
    expect(findPath(w,0,10)).toEqual([]);
  });
  it('rejects malformed settings and commands without mutating state', () => {
    expect(()=>createWorld({...config,size:0 as 64})).toThrow();
    const w=createWorld(config); const hash=stateHash(w);
    expect(()=>applyCommand(w,{type:'addFood',tile:-1,amount:30})).toThrow();
    expect(()=>applyCommand(w,{type:'setGrowth',value:Infinity})).toThrow();
    expect(stateHash(w)).toBe(hash);
  });
  it('records validated intervention and isolates clones', () => {
    const w=createWorld(config), branch=cloneWorld(w); applyCommand(branch,{type:'setGrowth',value:50});
    expect(w.rules.growth).toBe(100); expect(branch.rules.growth).toBe(50); expect(branch.commands).toHaveLength(1);
  });
  it('rejects corrupt snapshots including invalid entity references and capacities', () => {
    const w=createWorld(config); w.agents[0].x=-1; expect(()=>validateWorld(w)).toThrow();
    const b=createWorld(config); b.tiles[0].food=Infinity; expect(()=>validateWorld(b)).toThrow();
  });
  it('rejects missing resource ledger counters instead of accepting undefined totals',()=>{
    const w=createWorld(config);
    (w as unknown as {totals:object}).totals={};
    expect(()=>validateWorld(w)).toThrow();
  });
});
test('edits a clipped terrain brush and all resources without partially blocking occupied cells',()=>{
  const world=createWorld({name:'创造者',seed:'rain-river',size:64,population:10,preset:'continent'});
  const occupied=world.agents[0].y*64+world.agents[0].x;
  const before=stateHash(world);
  assert.throws(()=>applyCommand(world,{type:'paintTerrain',tile:occupied,biome:'ocean',radius:3}));
  assert.equal(stateHash(world),before);
  applyCommand(world,{type:'paintTerrain',tile:0,biome:'forest',radius:1});
  assert.ok([0,1,64,65].every(index=>world.tiles[index].biome==='forest'));
  applyCommand(world,{type:'setResources',tile:0,food:200,wood:50,stone:25});
  assert.deepEqual([world.tiles[0].food,world.tiles[0].wood,world.tiles[0].stone],[200,50,25]);
  assert.ok(validateWorld(world));
});

it('keeps the 0.4.5 world rules reproducible',()=>{
  const world=createWorld({name:'基准世界',seed:'benchmark-rain',size:64,population:24,preset:'continent'},'0.4.5');
  advance(world,10000);
  assert.equal(stateHash(world),'7a6fe519');
});
