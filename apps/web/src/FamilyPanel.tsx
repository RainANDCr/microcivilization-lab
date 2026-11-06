import {useState} from 'react';
import type {World} from '../../../packages/protocol/src/index.ts';
import {populationSummary,ageYears,allPeople} from '../../../packages/sim-core/src/demographics.ts';
function MoveHousehold({world,id,home,disabled,onMove}:{world:World;id:number;home:number;disabled:boolean;onMove:(family:number,settlement:number)=>void}){
  const [target,setTarget]=useState('');
  return <form onSubmit={event=>{event.preventDefault();onMove(id,Number(target));}}>
    <label>迁移目的地<select value={target} required onChange={event=>setTarget(event.target.value)}>
      <option value="">选择聚落</option>
      {world.settlements.filter(camp=>camp.id!==home).map(camp=><option key={camp.id} value={camp.id}>{camp.name}</option>)}
    </select></label>
    <button className="secondary compact" disabled={disabled||!target}>开始迁移</button>
  </form>;
}
export function FamilyPanel({world,disabled,onMove}:{world:World;disabled:boolean;onMove:(family:number,settlement:number)=>void}){
  const summary=populationSummary(world),agents=new Map(allPeople(world).map(a=>[a.id,a]));
  return <section className="family-section"><h4>家庭与代际 · {summary?.families??'—'}</h4>
    {!summary?<p className="muted">旧世界保留原规则，未启用年龄与家庭模型。</p>:<>
      <div className="age-summary">{[['儿童 0–11 岁',summary.children],['青少年 12–17 岁',summary.youth],['成人 18–59 岁',summary.adults],['长者 60 岁起',summary.elders]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p className="muted">累计新增 {summary.births} 人 · 离世 {summary.deaths} 人</p>
      {world.families!.filter(f=>f.members.some(id=>agents.get(id)?.alive)).map(f=><article className="family-card" key={f.id}>
        <strong>{f.name}</strong><small>家庭伙伴：{f.parents.map(id=>agents.get(id)?.name).join('、')}</small>
        {(world.engine==='0.4.5'||world.engine==='0.4.6')&&<><small>家庭口粮 {f.food??0}/24{f.destination!==undefined&&' · 迁往 '+world.settlements.find(camp=>camp.id===f.destination)?.name}</small>
          {world.settlements.length>1&&<MoveHousehold world={world} id={f.id} home={f.settlement} disabled={disabled} onMove={onMove}/>}</>}
        {f.members.map(id=>{const a=agents.get(id)!;return <p key={id}>{a.name} · {ageYears(world,a)} 岁{a.alive?'':' · 已离世'}{a.parents!.length>0&&<small>父母：{a.parents!.map(id=>agents.get(id)?.name).join('、')}</small>}</p>;})}
      </article>)}
    </>}
  </section>;
}
