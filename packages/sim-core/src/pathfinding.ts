import {BUILDINGS} from '../../content/src/industry.ts';
import type {Biome,World} from '../../protocol/src/index.ts';
const terrainCost:Record<Biome,number>={grass:1,shore:2,desert:3,forest:4,snow:4,ocean:4,mountain:4};
export function neighbors(index:number,size:number):number[] {
  const x=index%size,y=Math.floor(index/size),result:number[]=[];
  if(x>0)result.push(index-1);if(x<size-1)result.push(index+1);if(y>0)result.push(index-size);if(y<size-1)result.push(index+size);return result;
}
export function findPath(w:World,start:number,end:number,budget=4096):number[] {
  if(!w.tiles[start]?.walkable||!w.tiles[end]?.walkable||start===end)return [];
  if((w.engine==='0.4.2'||w.engine==='0.4.3'||w.engine==='0.4.4'||(w.engine==='0.4.5'||w.engine==='0.4.6')))return weightedPath(w,start,end,budget);
  // Saved engines use the original BFS and its tie-breaking.
  const queue=[start],previous=new Map<number,number>([[start,-1]]);let head=0;
  while(head<queue.length&&head<budget) {
    const current=queue[head++];
    for(const next of neighbors(current,w.config.size))if(w.tiles[next].walkable&&!previous.has(next)) {
      previous.set(next,current);queue.push(next);
      if(next===end){const path:number[]=[];let at=end;while(at!==start){path.push(at);at=previous.get(at)!;}return path.reverse();}
    }
  }
  return [];
}

function weightedPath(w:World,start:number,end:number,budget:number):number[] {
  const size=w.config.size;
  const distance=(index:number)=>Math.abs(index%size-end%size)+Math.abs(Math.floor(index/size)-Math.floor(end/size));
  const roadSites=new Set<number>();
  if((w.engine==='0.4.5'||w.engine==='0.4.6'))for(const camp of w.settlements)for(const building of camp.buildings){
    if(building.type==='road'&&building.progress===BUILDINGS.road.hours&&building.tile!==undefined)roadSites.add(building.tile);
  }
  const costs=new Map<number,number>([[start,0]]);
  const previous=new Map<number,number>();
  // Integer priorities and a consistent heuristic let us visit the buckets in ascending order.
  const frontier:number[][]=[];
  frontier[distance(start)]=[start];
  let expanded=0;
  for(let priority=distance(start);priority<frontier.length&&expanded<budget;){
    const current=frontier[priority]?.pop();
    if(current===undefined){priority++;continue;}
    const cost=costs.get(current)!;
    if(cost+distance(current)!==priority)continue;
    expanded++;
    if(current===end){
      const path:number[]=[];
      for(let index=end;index!==start;index=previous.get(index)!)path.push(index);
      return path.reverse();
    }
    for(const next of neighbors(current,size)){
      const tile=w.tiles[next];
      if(!tile.walkable)continue;
      const nextCost=cost+(roadSites.has(next)?1:terrainCost[tile.biome]);
      if(nextCost>=(costs.get(next)??Infinity))continue;
      costs.set(next,nextCost);
      previous.set(next,current);
      const score=nextCost+distance(next);
      (frontier[score]??=[]).push(next);
    }
  }
  return [];
}
