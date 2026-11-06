import {it} from 'node:test';
import assert from 'node:assert/strict';
import {ADVANCE_TILE_FIELDS,type CompactAdvance} from '../packages/protocol/src/index.ts';
import {Worker} from 'node:worker_threads';
import {createWorld,stateHash,advance} from '../packages/sim-core/src/index.ts';
it('runs the real worker protocol, rejects errors and preserves deterministic state',async()=>{
  const worker=new Worker(new URL('./fixtures/worker-host.mjs',import.meta.url));
  const send=(message:object)=>new Promise<{id:number;world?:ReturnType<typeof createWorld>;error?:string;patch?:CompactAdvance['patch']}>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Worker test timed out')),5000);worker.once('message',message=>{clearTimeout(timer);resolve(message);});worker.once('error',reject);worker.postMessage(message);});
  try{
    const empty=await send({id:1,type:'advance',ticks:1});assert.match(empty.error!,/创建/);
    const config={name:'线程验证',seed:'worker',size:64 as const,population:12,preset:'continent' as const};
    const initial=await send({id:2,type:'init',config});assert.equal(initial.id,2);assert.equal(stateHash(initial.world!),stateHash(createWorld(config)));
    const advanced=await send({id:3,type:'advance',ticks:240});const expected=createWorld(config);advance(expected,240);assert.equal(stateHash(advanced.world!),stateHash(expected));
    const invalid=await send({id:4,type:'command',command:{type:'setGrowth',value:-1}});assert.ok(invalid.error);
    const snapshot=await send({id:5,type:'advance',ticks:0});assert.equal(stateHash(snapshot.world!),stateHash(expected));
    const compact=await send({id:8,type:'advance',ticks:24,compact:true});
    assert.ok(compact.patch);
    const {world,tiles}=compact.patch;
    const previous=advanced.world!;
    const decoded={...previous,...world,events:[...previous.events,...world.events],metrics:[...previous.metrics,...world.metrics],deceased:[...previous.deceased!,...world.deceased!],tiles:previous.tiles.map((tile,index)=>{
      const restored={...tile};
      ADVANCE_TILE_FIELDS.forEach((field,offset)=>{restored[field]=tiles[index*ADVANCE_TILE_FIELDS.length+offset];});
      return restored;
    })};
    advance(expected,24);
    assert.equal(stateHash(decoded),stateHash(expected));
    const corrupt=await send({id:6,type:'load',world:{version:100}});assert.ok(corrupt.error);
    const retained=await send({id:7,type:'advance',ticks:0});assert.equal(stateHash(retained.world!),stateHash(expected));
  }finally{await worker.terminate();}
});
