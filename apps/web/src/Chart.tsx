import {useEffect,useRef} from 'react';
import * as echarts from 'echarts';
import type {Metric} from '../../../packages/protocol/src/index.ts';
export function Chart({metrics,field,color='#b7ca8d'}:{metrics:Metric[];field:'population'|'food';color?:string}){
  const host=useRef<HTMLDivElement>(null);
  const stride=Math.max(1,Math.ceil(metrics.length/1200));
  const plotted=stride===1?metrics:metrics.filter((_,index)=>index%stride===0||index===metrics.length-1);
  useEffect(()=>{const chart=echarts.init(host.current!);chart.setOption({animation:false,grid:{top:20,right:18,bottom:35,left:55},tooltip:{trigger:'axis'},xAxis:{type:'category',data:plotted.map(m=>`${Math.floor(m.tick/24)} 天`),axisLabel:{color:'#89988f'},axisLine:{lineStyle:{color:'#334139'}}},yAxis:{type:'value',min:0,axisLabel:{color:'#89988f'},splitLine:{lineStyle:{color:'#25342d'}}},series:[{type:'line',data:plotted.map(m=>m[field]),showSymbol:false,lineStyle:{color,width:2},areaStyle:{color,opacity:.08}}]});const resize=new ResizeObserver(()=>chart.resize());resize.observe(host.current!);return()=>{resize.disconnect();chart.dispose();};},[plotted,field,color]);
  return <div className="chart" ref={host} role="img" aria-label={`${field==='population'?'人口':'地表食物'}历史曲线，${plotted.length} 个显示采样点，共 ${metrics.length} 点`}/>;
}
