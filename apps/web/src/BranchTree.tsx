import type {SavedWorld} from '../../../packages/storage/src/index.ts';

type Archive=Omit<SavedWorld,'world'>;

export function BranchTree({worlds,onOpen}:{worlds:Archive[];onOpen:(id:string)=>void}){
  const byId=new Map(worlds.map(world=>[world.id,world]));
  const children=new Map<string,Archive[]>();
  for(const world of worlds){
    if(!world.source)continue;
    const parent=world.source.worldId;
    const entries=children.get(parent)??[];
    entries.push(world);children.set(parent,entries);
  }
  if(!children.size)return null;
  const roots=[...children.keys()].filter(id=>!byId.get(id)?.source);
  function render(id:string,visited:Set<string>){
    const world=byId.get(id);
    const next=visited.has(id)?[]:children.get(id)??[];
    const lineage=new Set(visited).add(id);
    return <li key={id}>
      {world?<button className="text-button" onClick={()=>onOpen(id)}>{world.name}</button>:<span>源档案 {id.slice(0,8)}</span>}
      {world?.source&&<small> · 从 Tick {world.source.tick} 分叉</small>}
      {!!next.length&&<ul>{next.map(branch=>render(branch.id,lineage))}</ul>}
    </li>;
  }
  return <details className="surface branch-tree"><summary>历史分支关系</summary><ul>{roots.map(id=>render(id,new Set()))}</ul></details>;
}
