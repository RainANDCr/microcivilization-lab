import {BUILDINGS,RECIPES} from '../../content/src/industry.ts';
import type {World} from '../../protocol/src/index.ts';
const integer=(n:unknown,min:number,max:number)=>Number.isSafeInteger(n)&&Number(n)>=min&&Number(n)<=max;
export function validateSettlements(w:World,entityIds:Set<number>):void {
  if(w.engine==='0.1.0'&&w.settlements.length)throw new Error('旧引擎不支持聚落数据，请保留原始存档。');
  const campIds=new Set<number>(),assigned=new Set<number>(),agents=new Map(w.agents.map(a=>[a.id,a]));
  const sites=new Set(w.settlements.filter(Boolean).map(s=>s.y*w.config.size+s.x));
  for(const s of w.settlements){
    if(!s||!integer(s.id,1,1e7)||entityIds.has(s.id)||campIds.has(s.id)||typeof s.name!=='string'||s.name.length>80||!integer(s.x,0,w.config.size-1)||!integer(s.y,0,w.config.size-1)||!w.tiles[s.y*w.config.size+s.x].walkable||!integer(s.founded,0,w.tick)||!integer(s.food,0,200)||!integer(s.wood,0,200)||!integer(s.knowledge,0,1e9)||!Array.isArray(s.technology)||s.technology.length>100||!s.technology.every(t=>typeof t==='string'&&t.length<=100)||!Array.isArray(s.members)||!Array.isArray(s.buildings)||s.buildings.length>500)throw new Error('营地数据、库存或建筑无效。');
    campIds.add(s.id);
    for(const id of s.members){const a=agents.get(id);if(!a||!a.alive||a.settlement!==s.id||assigned.has(id))throw new Error('营地成员关联无效或重复。');assigned.add(id);}
    const industry=(w.engine==='0.4.5'||w.engine==='0.4.6');
    for(const b of s.buildings){
      if(!b||!Object.hasOwn(BUILDINGS,b.type))throw new Error('建筑类型无效。');
      const definition=BUILDINGS[b.type as keyof typeof BUILDINGS];
      if(b.cost!==definition.cost||!integer(b.progress,0,definition.hours))throw new Error('建筑材料或工时无效。');
      if(b.type==='housing'){if(b.tile!==undefined)throw new Error('住宅应使用聚落中心位置。');}
      else{
        const tile=b.tile!;
        if(!industry||!integer(tile,0,w.tiles.length-1)||!w.tiles[tile].walkable||sites.has(tile)||
          Math.abs(tile%w.config.size-s.x)+Math.abs(Math.floor(tile/w.config.size)-s.y)>4)throw new Error('建筑地块无效。');
        sites.add(tile);
      }
    }
    if([s.tools,s.supplies].some(value=>value!==undefined&&(!industry||!integer(value,0,200))))throw new Error('工坊库存无效。');
    if(s.caravan!==undefined){
      const caravan=s.caravan;
      if(w.engine!=='0.4.6'||!caravan||!integer(caravan.tile,0,w.tiles.length-1)||!w.tiles[caravan.tile].walkable||
        !['wood','food','returnWood'].includes(caravan.cargo)||caravan.destination===s.id||!w.settlements.some(camp=>camp?.id===caravan.destination))throw new Error('商队位置、货物或目的地无效。');
    }
    if(s.relations!==undefined&&(!industry||!s.relations||typeof s.relations!=='object'||Array.isArray(s.relations)||
      Object.entries(s.relations).some(([id,value])=>!integer(Number(id),1,1e7)||String(Number(id))!==id||Number(id)===s.id||
        !integer(value,1,100)||w.settlements.find(camp=>camp?.id===Number(id))?.relations?.[s.id]!==value)))throw new Error('聚落往来关系无效。');
    if(s.production!==undefined&&(!industry||!Array.isArray(s.production)||s.production.length>8||
      !s.buildings.some(b=>b.type==='workshop'&&(w.engine==='0.4.6'||b.progress===BUILDINGS.workshop.hours))||
      s.production.some(job=>!job||!Object.hasOwn(RECIPES,job.recipe)||(w.engine!=='0.4.6'&&job.recipe!=='tools'&&job.recipe!=='supplies')||!integer(job.progress,0,RECIPES[job.recipe].hours-1))))throw new Error('工坊生产队列无效。');
  }
  for(const a of w.agents)if(a.settlement!==null&&(!campIds.has(a.settlement)||!assigned.has(a.id)))throw new Error('居民引用了不存在的营地。');
  for(const id of campIds)entityIds.add(id);
}
