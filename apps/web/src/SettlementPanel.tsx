import {BUILDINGS,RECIPES} from '../../../packages/content/src/industry.ts';
import type {BuildingType,World,WorldCommand} from '../../../packages/protocol/src/index.ts';
import {settlementCulture} from '../../../packages/sim-core/src/society.ts';
import {isAdult} from '../../../packages/sim-core/src/demographics.ts';
import {settlementLevel} from '../../../packages/sim-core/src/settlements.ts';
export function SettlementPanel({world,selected,disabled,onSelect,onCommand}:{world:World;selected:number|null;disabled:boolean;onSelect:(index:number)=>void;onCommand:(command:WorldCommand)=>void}){
  return <section className="settlement-section"><h4>自发聚落 · {world.settlements.length}</h4>
    {!world.settlements.length&&<p className="muted">{world.engine==='0.1.0'?'旧世界保持原有规则；新世界启用营地系统。':'资源与协作条件满足后，居民会自主形成营地。'}</p>}
    {world.settlements.map(s=><article className="settlement-card" key={s.id}>
      <button onClick={()=>onSelect(s.y*world.config.size+s.x)}>{s.name} ↗ <small>{settlementLevel(s)}</small></button>
      <p>{s.members.length} 位成员 · 食物 {s.food}/200 · 木材 {s.wood}/200</p>
      {!s.buildings.length&&<small>住宅备料中：12 木材 + 24 工时。</small>}
      {s.buildings.map((b,index)=>{
        const {name,hours}=BUILDINGS[b.type as BuildingType];
        return <div key={index}><small>{name} · {b.progress===hours?'已建成':`${b.progress}/${hours} 工时`}{b.tile!==undefined&&<button onClick={()=>onSelect(b.tile!)}>定位 ↗</button>}</small><progress value={b.progress} max={hours} aria-label={`${name}建造进度 ${b.progress}/${hours}`}/></div>;
      })}
      {(world.engine==='0.4.5'||world.engine==='0.4.6')&&<details><summary>建造与生产</summary>
        <p>{settlementCulture(s)} · 研究 {s.knowledge}/12 · 已掌握 {s.technology.join('、')||'无'}</p>
        {s.caravan&&<button onClick={()=>onSelect(s.caravan!.tile)}>定位商队 · {s.caravan.cargo==='wood'?'去程 4 木材':s.caravan.cargo==='food'?'回程 8 食物':'退回 4 木材'} ↗</button>}
        {Object.entries(s.relations??{}).map(([id,value])=><p key={id}>与 {world.settlements.find(camp=>camp.id===Number(id))?.name} 的往来关系 {value}/100</p>)}
        {world.agents.filter(a=>a.settlement===s.id&&isAdult(world,a)).map(a=><label key={a.id}>{a.name}的职业
          <select value={a.occupation??''} disabled={disabled} onChange={e=>{
            const occupation=e.target.value;
            if(occupation==='forager'||occupation==='builder'||occupation==='artisan')onCommand({type:'setOccupation',agent:a.id,occupation});
          }}><option value="" disabled>通才</option><option value="forager">采集者</option><option value="builder">建造者</option><option value="artisan">工匠</option></select>
        </label>)}
        <p>先选中距聚落 4 格内的空地，再选择建筑。</p>
        {(['field','well','road','workshop'] as const).map(building=><button className="secondary compact" key={building} disabled={disabled||selected===null} onClick={()=>onCommand({type:'build',settlement:s.id,tile:selected!,building})}>建造{BUILDINGS[building].name}（{BUILDINGS[building].cost} 木材）</button>)}
        <p>农具 {s.tools??0} · 构件 {s.supplies??0}</p>
        {(s.buildings.some(b=>b.type==='workshop'&&b.progress===BUILDINGS.workshop.hours))&&(world.engine==='0.4.6'?(['tools','supplies','reinforcedTools','prefab'] as const):(['tools','supplies'] as const)).map(recipe=><button className="secondary compact" key={recipe} disabled={disabled} onClick={()=>onCommand({type:'queueProduction',settlement:s.id,recipe})}>加工{RECIPES[recipe].name}（{RECIPES[recipe].wood} 木材）</button>)}
        {s.production?.map((job,index)=><p key={index}>{index+1}. {RECIPES[job.recipe].name} · {job.progress}/{RECIPES[job.recipe].hours} 工时</p>)}
      </details>}
    </article>)}
  </section>;
}
