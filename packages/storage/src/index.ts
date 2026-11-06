import Dexie, {type EntityTable} from 'dexie';
import type {World} from '../../protocol/src/index.ts';
import {validateWorld} from '../../sim-core/src/index.ts';
export {parseArchive,serializeArchive} from './archive.ts';
import {deleteHistory,type ForkSource} from "./history.ts";
export interface SavedWorld {id:string;name:string;seed:string;tick:number;population:number;revision:number;updated:number;world:World;source?:ForkSource}
export interface RecoveryDraft {id:string;updated:number;world:World}
const db=new Dexie('microcivilization-worlds') as Dexie & {worlds:EntityTable<SavedWorld,'id'>;recovery:EntityTable<RecoveryDraft,'id'>};
db.version(1).stores({worlds:'id,updated,name'});
db.version(2).stores({recovery:'id,updated'});
export async function saveRecovery(id:string,world:World){
  await db.recovery.put({id,updated:Date.now(),world});
}
export async function latestRecovery(){
  const draft=await db.recovery.orderBy('updated').last();
  if(draft)validateWorld(draft.world);
  return draft;
}
export async function clearRecovery(id:string,updated?:number){
  await db.transaction('rw',db.recovery,async()=>{
    const draft=await db.recovery.get(id);
    if(draft&&(updated===undefined||updated===draft.updated))await db.recovery.delete(id);
  });
}
export async function saveWorld(id:string,world:World,expectedRevision:number,source?:ForkSource):Promise<number> {
  validateWorld(world);
  return db.transaction('rw',db.worlds,async()=>{
    const old=await db.worlds.get(id);
    if((old?.revision??0)!==expectedRevision)throw new Error('存档冲突：另一个标签页已保存更新。请另存为新世界，避免覆盖。');
    const revision=expectedRevision+1;
    const origin=old?.source??source;
    await db.worlds.put({...(origin?{source:origin}:{}),id,name:world.config.name,seed:world.config.seed,tick:world.tick,population:world.agents.filter(a=>a.alive).length,revision,updated:Date.now(),world:structuredClone(world)});
    return revision;
  });
}
export async function loadWorld(id:string):Promise<SavedWorld> {const saved=await db.worlds.get(id);if(!saved)throw new Error('找不到这个存档。');validateWorld(saved.world);return saved;}
export async function listWorlds():Promise<Omit<SavedWorld,'world'>[]> {return(await db.worlds.orderBy('updated').reverse().toArray()).map(({world:_world,...meta})=>meta);}
export async function deleteWorld(id:string,expectedRevision:number):Promise<void> {
  await db.transaction('rw',db.worlds,async()=>{
    const saved=await db.worlds.get(id);
    if(!saved||saved.revision!==expectedRevision)throw new Error('存档冲突，请刷新档案后再删除。');
    await db.worlds.delete(id);
  });
  await deleteHistory(id).catch(()=>undefined);
}
