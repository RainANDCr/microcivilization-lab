import Dexie,{type EntityTable} from 'dexie';
import {advance,applyCommand,cloneWorld,stateHash,validateWorld,type World} from '../../sim-core/src/index.ts';

export type Checkpoint={id:string;worldId:string;tick:number;hash:string};
export type ForkSource={worldId:string;checkpointId:string;tick:number;hash:string};
type Entry=Checkpoint&{world:World;created:number};
const db=new Dexie('microcivilization-history') as Dexie&{checkpoints:EntityTable<Entry,'id'>};
db.version(1).stores({checkpoints:'id,worldId'});
const metadata=({id,worldId,tick,hash}:Entry):Checkpoint=>({id,worldId,tick,hash});

export async function saveHistoryCheckpoint(worldId:string,world:World){
  validateWorld(world);
  const hash=stateHash(world);
  const id=worldId+':'+world.tick+':'+hash;
  return db.transaction('rw',db.checkpoints,async()=>{
    const old=await db.checkpoints.get(id);
    if(old)return metadata(old);
    const entries=await db.checkpoints.where('worldId').equals(worldId).toArray();
    const entry={id,worldId,tick:world.tick,hash,world,created:Math.max(Date.now(),...entries.map(e=>e.created+1))};
    await db.checkpoints.add(entry);
    const expired=entries.sort((a,b)=>b.created-a.created).slice(7);
    await db.checkpoints.bulkDelete(expired.map(item=>item.id));
    return metadata(entry);
  });
}
export async function listHistoryCheckpoints(worldId:string){
  const entries=await db.checkpoints.where('worldId').equals(worldId).sortBy('created');
  return entries.reverse().map(metadata);
}
export async function loadHistoryCheckpoint(worldId:string,id:string){
  const entry=await db.checkpoints.get(id);
  if(!entry||entry.worldId!==worldId)throw new Error('找不到此检查点。');
  validateWorld(entry.world);
  if(stateHash(entry.world)!==entry.hash)throw new Error('检查点校验失败。');
  return entry.world;
}
export async function deleteHistory(worldId:string){
  await db.checkpoints.where('worldId').equals(worldId).delete();
}
export function buildHistoryReplay(start:World,head:World){
  if(start.engine!==head.engine||start.tick>head.tick||head.tick-start.tick>8640||start.commands.length>head.commands.length||
    start.commands.some((item,index)=>JSON.stringify(item)!==JSON.stringify(head.commands[index])))throw new Error('检查点无法回放到当前世界，支持的跨度为一年。');
  const commands=head.commands.slice(start.commands.length);
  const seek=(tick:number)=>{
    if(!Number.isInteger(tick)||tick<start.tick||tick>head.tick)throw new Error('回放时刻超出范围。');
    const world=cloneWorld(start);
    const to=(target:number)=>{
      while(world.tick<target)advance(world,Math.min(target-world.tick,240));
    };
    for(const entry of commands){
      if(entry.tick>tick)break;
      to(entry.tick);
      applyCommand(world,entry.command);
    }
    to(tick);
    return world;
  };
  if(stateHash(seek(head.tick))!==stateHash(head))throw new Error('回放校验失败。');
  return (tick:number)=>tick===start.tick&&tick!==head.tick?cloneWorld(start):seek(tick);
}

export async function exportHistory(worldId:string,head:World){
  validateWorld(head);
  const entries=await db.checkpoints.where('worldId').equals(worldId).sortBy('created');
  const checkpoints=entries.filter(entry=>entry.tick<=head.tick).map(({world,hash})=>({world,hash}));
  const text=JSON.stringify({format:'mchistory',version:1,head,hash:stateHash(head),checkpoints});
  if(new TextEncoder().encode(text).length>150*1024*1024)throw new Error('历史包不能超过 150 MiB。');
  return text;
}
export function parseHistory(text:string):{head:World;checkpoints:World[]}{
  const archive=JSON.parse(text);
  if(!archive||archive.format!=='mchistory'||archive.version!==1||!Array.isArray(archive.checkpoints)||archive.checkpoints.length>8||
    !validateWorld(archive.head)||stateHash(archive.head)!==archive.hash)throw new Error('历史包版本或主世界校验无效。');
  const head:World=archive.head;
  const checkpoints=archive.checkpoints.map((entry:unknown)=>{
    if(!entry||typeof entry!=='object'||!('world' in entry)||!('hash' in entry)||!validateWorld(entry.world))throw new Error('历史检查点无效。');
    const world=entry.world;
    if(stateHash(world)!==entry.hash||world.engine!==head.engine||world.config.seed!==head.config.seed||
      world.config.size!==head.config.size||world.config.preset!==head.config.preset||world.tick>head.tick)throw new Error('历史检查点与主世界不匹配。');
    return world;
  });
  return {head,checkpoints};
}
