import type {World} from '../../protocol/src/index.ts';

type MotionFrame={tick:number;config:Pick<World['config'],'size'>;agents:Pick<World['agents'][number],'id'|'x'|'y'|'alive'>[]};
export function movementOrigins(previous:MotionFrame|null,next:MotionFrame){
  const origins=new Map<number,{x:number;y:number}>();
  if(!previous||next.tick!==previous.tick+1||next.config.size!==previous.config.size)return origins;
  const residents=new Map(previous.agents.filter(agent=>agent.alive).map(agent=>[agent.id,agent]));
  for(const agent of next.agents){
    const origin=residents.get(agent.id);
    if(agent.alive&&origin&&Math.abs(agent.x-origin.x)+Math.abs(agent.y-origin.y)===1)origins.set(agent.id,origin);
  }
  return origins;
}
