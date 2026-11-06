import {useMemo,useState} from 'react';
import type {WorldEvent} from '../../../packages/protocol/src/index.ts';

export function ChronicleEvents({events,time,onLocate}:{events:WorldEvent[];time:(tick:number)=>string;onLocate:(x:number,y:number)=>void}){
  const [category,setCategory]=useState('all'),[query,setQuery]=useState(''),[before,setBefore]=useState(''),[page,setPage]=useState(0);
  const indexed=useMemo(()=>{
    const byType=new Map<string,WorldEvent[]>();
    for(const event of events){
      const list=byType.get(event.type);
      if(list)list.push(event);else byType.set(event.type,[event]);
    }
    return byType;
  },[events]);
  const needle=query.trim().toLocaleLowerCase();
  const matches=(category==='all'?events:indexed.get(category)??[]).filter(event=>
    (!before||event.tick<=Number(before))&&(!needle||event.text.toLocaleLowerCase().includes(needle)));
  const pages=Math.max(1,Math.ceil(matches.length/40)),current=Math.min(page,pages-1);
  const end=matches.length-current*40;
  const labels:Record<string,string>={genesis:'世界诞生',weather:'天气',flood:'洪水',season:'季节更替',death:'居民离去',
    intervention:'创造者干预',settlement:'聚落协作',construction:'建设与衰退',population:'家庭与人口',production:'工坊生产',
    trade:'贸易',technology:'技术',split:'聚落分流'};
  return <section>
    <div className="section-heading"><h2>匹配事件 · {matches.length} 条</h2>
      <select aria-label="事件筛选" value={category} onChange={e=>{setCategory(e.target.value);setPage(0);}}>
        <option value="all">全部事件</option>{Object.entries(labels).map(([type,label])=><option key={type} value={type}>{label}</option>)}
      </select>
    </div>
    <label>搜索事件<input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>{' '}
    <label>截至 Tick<input type="number" min={0} value={before} onChange={e=>{setBefore(e.target.value);setPage(0);}}/></label>
    <div className="timeline">{matches.slice(Math.max(0,end-40),end).reverse().map(event=><article key={event.id}>
      <span className="timeline-dot"/><small>{time(event.tick)} · {event.type}</small><h3>{event.text}</h3>
      {event.x!==undefined&&event.y!==undefined&&<button className="text-button" onClick={()=>onLocate(event.x!,event.y!)}>定位事件 ↗</button>}
    </article>)}</div>
    {pages>1&&<div><button className="secondary" disabled={current===0} onClick={()=>setPage(current-1)}>上一页</button>{' '}
      {current+1} / {pages}{' '}<button className="secondary" disabled={current===pages-1} onClick={()=>setPage(current+1)}>下一页</button></div>}
  </section>;
}
