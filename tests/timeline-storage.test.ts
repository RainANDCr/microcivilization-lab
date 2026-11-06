import 'fake-indexeddb/auto';
import {it} from 'node:test';
import assert from 'node:assert/strict';
import {advance,applyCommand,cloneWorld,createWorld,stateHash} from '../packages/sim-core/src/index.ts';
import {buildHistoryReplay,deleteHistory,exportHistory,parseHistory,listHistoryCheckpoints,loadHistoryCheckpoint,saveHistoryCheckpoint} from '../packages/storage/src/history.ts';

const world=()=>createWorld({seed:'timeline',name:'时间轴',size:64,population:10,preset:'continent'});

it('replays same-tick interventions in order and preserves the source snapshot',()=>{
  const start=world(),head=cloneWorld(start);
  applyCommand(head,{type:'setGrowth',value:25});
  advance(head,12);
  applyCommand(head,{type:'setGrowth',value:50});
  applyCommand(head,{type:'setGrowth',value:75});
  const middle=cloneWorld(head);
  advance(head,12);
  const seek=buildHistoryReplay(start,head);
  assert.equal(stateHash(seek(0)),stateHash(start));
  assert.equal(stateHash(seek(12)),stateHash(middle));
  assert.equal(stateHash(seek(24)),stateHash(head));
  assert.equal(start.commands.length,0);
  assert.throws(()=>seek(25));
  head.rng++;
  assert.throws(()=>buildHistoryReplay(start,head),/校验/);
});

it('persists immutable checkpoints, deduplicates and limits retention per world',async()=>{
  const start=world(),checkpoint=await saveHistoryCheckpoint('history-world',start);
  assert.deepEqual(await saveHistoryCheckpoint('history-world',start),checkpoint);
  advance(start,1);
  assert.equal((await loadHistoryCheckpoint('history-world',checkpoint.id)).tick,0);
  await assert.rejects(loadHistoryCheckpoint('other-world',checkpoint.id));
  for(let i=0;i<8;i++){await saveHistoryCheckpoint('history-world',start);advance(start,1);}
  assert.equal((await listHistoryCheckpoints('history-world')).length,8);
  await assert.rejects(loadHistoryCheckpoint('history-world',checkpoint.id));
  await deleteHistory('history-world');
  assert.equal((await listHistoryCheckpoints('history-world')).length,0);
});
it('exports a portable bundle with ordered checkpoints and rejects tampered content',async()=>{
  const start=world(),head=cloneWorld(start);
  await saveHistoryCheckpoint('portable',start);
  advance(head,24);
  const text=await exportHistory('portable',head);
  const restored=parseHistory(text);
  assert.equal(stateHash(restored.head),stateHash(head));
  assert.deepEqual(restored.checkpoints.map(stateHash),[stateHash(start)]);
  const corrupted=JSON.parse(text);
  corrupted.checkpoints[0].world.tiles[0].temperature++;
  assert.throws(()=>parseHistory(JSON.stringify(corrupted)),/不匹配/);
  await deleteHistory('portable');
});
