import type {Metric,World} from '../../protocol/src/index.ts';
import {YEAR} from './demographics.ts';

export function observationReport(world:World):string[] {
  const year=Math.floor(world.tick/YEAR);
  const end=year*YEAR;
  const start=end-YEAR;
  const first=world.metrics.find(row=>row.tick===start);
  const last=world.metrics.find(row=>row.tick===end);
  const report=[
    first&&last&&year>0
      ? `第 ${year} 年（${start} → ${end} Tick）人口 ${first.population} → ${last.population}，聚落 ${first.settlements} → ${last.settlements}，地表食物 ${first.food} → ${last.food}。本年采集 ${last.harvested-first.harvested}，消费 ${last.consumed-first.consumed}。`
      : '暂无完整年度采样。'
  ];
  const ground=world.tiles.reduce((sum,tile)=>sum+tile.food,0);
  report.push(`截至 ${world.tick} Tick，地表食物 ${ground}，累计自然再生 ${world.totals.regrown}，再生倍率 ${world.rules.growth}%。`);
  if(world.totals.floodLoss!==undefined)report.push('洪水累计冲失 '+world.totals.floodLoss+' 单位地表食物。');
  if(!world.settlements.length)report.push('暂无聚落。');
  for(const camp of world.settlements){
    const homes=camp.buildings.filter(building=>building.type==='housing'&&building.progress===24).length;
    report.push(`${camp.name}有 ${camp.members.length} 位成员、${homes} 栋已完工住宅，库存食物 ${camp.food}、木材 ${camp.wood}。已记录技术：${camp.technology.join('、')||'无'}。`);
  }
  const spread=world.events.filter(event=>event.type==='technology').at(-1);
  report.push(spread?`最近的技术事件（${spread.tick} Tick） ${spread.text}`:'暂无已记录技术传播事件。');
  return report;
}
export function metricMaximum(rows:Metric[],field:'population'|'food'):number {
  return rows.reduce((maximum,row)=>Math.max(maximum,row[field]),1);
}
export function metricsCsv(world:World):string {
  const fields=['tick','population','food','settlements','harvested','consumed','families','children','births','deaths'] as const;
  return fields.join(',')+'\n'+world.metrics.map(row=>fields.map(field=>row[field]??'').join(',')).join('\n');
}
