import type {Biome} from '../../protocol/src/index.ts';

type Rules={initialGrowth?:number;foodCapacityPercent?:number;floodLossPercent?:number;biomeFertility?:Partial<Record<Biome,number>>};
export type ModManifest={schemaVersion:1;id:string;version:string;name:string;dependencies?:Record<string,string>;rules:Rules};
export type ModLock={schemaVersion:1;manifests:ModManifest[];checksum:string};

const idPattern=/^[a-z][a-z0-9-]{0,63}$/;
const versionPattern=/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
const biomes=['ocean','shore','grass','forest','desert','mountain','snow'];
function record(value:unknown,keys?:string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw new Error('模组清单字段必须是对象。');
  const object=value as Record<string,unknown>;
  if(keys&&Object.keys(object).some(key=>!keys.includes(key)))throw new Error('模组清单包含不支持的字段。');
  return object;
}
function checkedNumber(value:unknown,min:number,max:number){
  if(typeof value!=='number'||!Number.isInteger(value)||value<min||value>max)throw new Error('模组规则数值超出范围。');
  return value;
}
function manifest(value:unknown):ModManifest{
  const {schemaVersion,id,version,name,dependencies,rules}=record(value,['schemaVersion','id','version','name','dependencies','rules']);
  if(schemaVersion!==1||typeof id!=='string'||!idPattern.test(id)||typeof version!=='string'||!versionPattern.test(version)||typeof name!=='string'||!name.trim()||name.length>80)throw new Error('模组名称、标识或版本无效。');
  const result:ModManifest={schemaVersion,id,version,name,rules:{}};
  if(dependencies!==undefined){
    const entries=Object.entries(record(dependencies)).sort();
    if(entries.length>16)throw new Error('模组依赖最多 16 项。');
    result.dependencies=Object.fromEntries(entries.map(([key,dep])=>{
      if(!idPattern.test(key)||typeof dep!=='string'||!versionPattern.test(dep))throw new Error('模组依赖必须指定精确版本。');
      return [key,dep];
    }));
  }
  const {initialGrowth,biomeFertility,foodCapacityPercent,floodLossPercent}=record(rules,['initialGrowth','biomeFertility','foodCapacityPercent','floodLossPercent']);
  if(initialGrowth!==undefined)result.rules.initialGrowth=checkedNumber(initialGrowth,0,300);
  if(biomeFertility!==undefined)result.rules.biomeFertility=Object.fromEntries(Object.entries(record(biomeFertility,biomes)).sort().map(([key,factor])=>[key,checkedNumber(factor,0,200)]));
  if(foodCapacityPercent!==undefined)result.rules.foodCapacityPercent=checkedNumber(foodCapacityPercent,50,200);
  if(floodLossPercent!==undefined)result.rules.floodLossPercent=checkedNumber(floodLossPercent,0,100);
  return result;
}

export function parseModManifest(json:string):ModManifest{
  if(json.length>16384)throw new Error('模组清单最多 16384 个字符。');
  return manifest(JSON.parse(json));
}
export function modRules(lock:ModLock):Rules{
  const result:Rules={};
  for(const {rules} of lock.manifests){
    if(rules.initialGrowth!==undefined){
      if(result.initialGrowth!==undefined)throw new Error('多个模组修改了生态再生倍率。');
      result.initialGrowth=rules.initialGrowth;
    }
    for(const key of ['foodCapacityPercent','floodLossPercent'] as const){
      if(rules[key]===undefined)continue;
      if(result[key]!==undefined)throw new Error('多个模组重复修改 '+key+'。');
      result[key]=rules[key];
    }
    for(const [key,factor] of Object.entries(rules.biomeFertility??{})){
      const biome=key as Biome;
      result.biomeFertility??={};
      if(result.biomeFertility[biome]!==undefined)throw new Error('多个模组修改了 '+biome+' 的肥力。');
      result.biomeFertility[biome]=factor;
    }
  }
  return result;
}
export function lockMods(values:readonly ModManifest[]):ModLock{
  if(values.length>16)throw new Error('每个世界最多启用 16 个模组。');
  const manifests=values.map(manifest).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const byId=new Map(manifests.map(mod=>[mod.id,mod]));
  if(byId.size!==manifests.length)throw new Error('模组标识重复：'+manifests.find((mod,index)=>mod.id===manifests[index-1]?.id)!.id);
  const path=new Set<string>(),checked=new Set<string>();
  function visit(mod:ModManifest){
    if(path.has(mod.id))throw new Error('模组依赖存在循环。');
    if(checked.has(mod.id))return;
    path.add(mod.id);
    for(const [id,version] of Object.entries(mod.dependencies??{})){
      const dependency=byId.get(id);
      if(dependency?.version!==version)throw new Error('缺少模组依赖 '+id+' '+version);
      visit(dependency);
    }
    path.delete(mod.id);
    checked.add(mod.id);
  }
  manifests.forEach(visit);
  const json=JSON.stringify(manifests);
  let hash=2166136261;
  for(let index=0;index<json.length;index++)hash=Math.imul(hash^json.charCodeAt(index),16777619);
  const lock:ModLock={schemaVersion:1,manifests,checksum:(hash>>>0).toString(16).padStart(8,'0')};
  modRules(lock);
  return lock;
}
export function validateModLock(value:unknown):ModLock{
  const {schemaVersion,manifests,checksum}=record(value,['schemaVersion','manifests','checksum']);
  if(schemaVersion!==1||!Array.isArray(manifests))throw new Error('模组版本锁格式无效。');
  const lock=lockMods(manifests);
  if(lock.checksum!==checksum)throw new Error('模组版本锁校验失败。');
  return lock;
}
