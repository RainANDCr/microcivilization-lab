import {useState} from 'react';
import {BIOMES} from '../../../packages/content/src/index.ts';
import type {Biome,World,WorldCommand} from '../../../packages/protocol/src/index.ts';

export function CreatorTools({world,index,disabled,command}:{world:World;index:number;disabled:boolean;command:(value:WorldCommand)=>void}){
  const tile=world.tiles[index],size=world.config.size;
  const [biome,setBiome]=useState<Biome>(tile.biome);
  const [radius,setRadius]=useState(0);
  const [food,setFood]=useState(tile.food);
  const [wood,setWood]=useState(tile.wood);
  const [stone,setStone]=useState(tile.stone);
  const x=index%size,y=Math.floor(index/size);
  const left=Math.max(0,x-radius),right=Math.min(size-1,x+radius);
  const top=Math.max(0,y-radius),bottom=Math.min(size-1,y+radius);
  const width=right-left+1;
  const cells=Array.from({length:width*(bottom-top+1)},(_,i)=>world.tiles[(top+Math.floor(i/width))*size+left+i%width]);
  return <details className="creator-tools"><summary>创造者工具</summary>
    <form onSubmit={e=>{e.preventDefault();command({type:'paintTerrain',tile:index,biome,radius});}}>
      <label>地形画笔<select value={biome} onChange={e=>setBiome(e.target.value as Biome)}>
        {Object.entries(BIOMES).map(([id,entry])=><option value={id} key={id}>{entry.name}</option>)}
      </select></label>
      <label>画笔半径<select value={radius} onChange={e=>setRadius(Number(e.target.value))}>
        {[0,1,2,3].map(r=><option key={r} value={r}>{2*r+1} × {2*r+1}</option>)}
      </select></label>
      <div className="brush-preview">
        {['当前地形','落笔后'].map((label,column)=><figure key={label}><figcaption>{label}</figcaption>
          <div role="img" aria-label={`${label} · ${width} × ${bottom-top+1} 格`} style={{gridTemplateColumns:`repeat(${width}, 1fr)`}}>
            {cells.map((cell,i)=><span key={i} title={BIOMES[column?biome:cell.biome].name} style={{background:`#${BIOMES[column?biome:cell.biome].color.toString(16).padStart(6,'0')}`}}/>)}
          </div>
        </figure>)}
      </div>
      <button className="secondary" disabled={disabled}>绘制地形</button>
    </form>
    <form onSubmit={e=>{e.preventDefault();command({type:'setResources',tile:index,food,wood,stone});}}>
      <label>食物<input type="number" required min={0} max={1000} value={food} onChange={e=>setFood(e.target.valueAsNumber)}/></label>
      <label>木材<input type="number" required min={0} max={1000} value={wood} onChange={e=>setWood(e.target.valueAsNumber)}/></label>
      <label>石材<input type="number" required min={0} max={1000} value={stone} onChange={e=>setStone(e.target.valueAsNumber)}/></label>
      <button className="secondary" disabled={disabled}>应用资源数量</button>
    </form>
  </details>;
}
