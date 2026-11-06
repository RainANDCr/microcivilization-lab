import {useMemo,useState} from 'react';
import {BUILDINGS,RECIPES} from '../../../packages/content/src/industry.ts';
import type {World} from '../../../packages/protocol/src/index.ts';

export function WorldTopics({world}:{world:World}){
  const [topic,setTopic]=useState('economy');
  const events=useMemo(()=>{
    const result={economy:0,technology:0,ecology:0};
    for(const entry of world.events){
      if(entry.type==='trade'||entry.type==='production')result.economy++;
      if(entry.type==='technology')result.technology++;
      if(entry.type==='weather'||entry.type==='flood')result.ecology++;
    }
    return result;
  },[world.events]);
  return <section className="surface topic-report"><h2>专题统计</h2>
    <label>观察专题<select value={topic} onChange={e=>setTopic(e.target.value)}>
      <option value="economy">经济与供需</option><option value="technology">技术传播</option><option value="ecology">生态</option>
    </select></label>
    {topic==='economy'&&<>
      <p>累计采集 {world.totals.harvested} · 累计消耗 {world.totals.consumed} · 贸易和生产事件 {events.economy} 条</p>
      <div className="scroll-table"><table><thead><tr><th>聚落</th><th>库存食物</th><th>两日口粮目标</th><th>口粮缺口</th><th>可用木材</th><th>已预留木材</th><th>待建工时</th><th>待加工</th><th>在途货物</th></tr></thead>
        <tbody>{world.settlements.map(camp=>{
          const target=Math.min(200,camp.members.length*4);
          const reserved=camp.production?.reduce((sum,job)=>sum+RECIPES[job.recipe].wood,0)??0;
          const construction=camp.buildings.reduce((sum,building)=>sum+BUILDINGS[building.type as keyof typeof BUILDINGS].hours-building.progress,0);
          return <tr key={camp.id}><th scope="row">{camp.name}</th><td>{camp.food}</td><td>{target}</td><td>{Math.max(0,target-camp.food)}</td><td>{camp.wood}</td><td>{reserved}</td><td>{construction}</td><td>{camp.production?.length??0}</td><td>{camp.caravan?camp.caravan.cargo==='food'?'8 食物':'4 木材':'—'}</td></tr>;
        })}</tbody>
      </table></div>
      {!world.settlements.length&&<p>暂无聚落供需数据。</p>}
    </>}
    {topic==='technology'&&<>
      <p>研发及传播事件 {events.technology} 条</p>
      <ul>{world.settlements.map(camp=><li key={camp.id}>{camp.name} · {camp.technology.join('、')||'尚无技术'} · 研究进度 {camp.knowledge}</li>)}</ul>
    </>}
    {topic==='ecology'&&<>
      <p>天气与洪水事件 {events.ecology} 条 · 累计自然再生 {world.totals.regrown} · 洪水冲失 {world.totals.floodLoss??0}</p>
      {(()=>{
        const ground=world.tiles.filter(tile=>tile.walkable);
        if(!ground.length)return <p>暂无可通行地块。</p>;
        const mean=(field:'temperature'|'moisture'|'fertility')=>Math.round(ground.reduce((sum,tile)=>sum+tile[field],0)/ground.length);
        return <p>陆地平均温度 {mean('temperature')} · 平均湿度 {mean('moisture')}% · 平均肥力 {mean('fertility')}%</p>;
      })()}
    </>}
  </section>;
}
