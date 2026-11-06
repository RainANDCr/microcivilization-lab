import type {Settlement,World} from '../../protocol/src/index.ts';
import {event} from './index.ts';
import {findPath} from './pathfinding.ts';

const technologies=[
  {id:'耕作',practice:'field',hours:12},
  {id:'灌溉',practice:'well',hours:18,requires:'耕作'},
  {id:'木工',practice:'workshop',hours:24},
  {id:'路网',practice:'road',hours:6,requires:'木工'},
] as const;

function record(w:World,camp:Settlement,type:string,text:string,related?:Settlement){
  event(w,type,text);
  Object.assign(w.events.at(-1)!,{x:camp.x,y:camp.y,entities:[camp.id,...(related?[related.id]:[])]});
}
function study(w:World,camp:Settlement){
  const available=technologies.filter(tech=>(tech.id!=='路网'||w.engine==='0.4.6')&&!camp.technology.includes(tech.id)&&camp.buildings.some(b=>b.type===tech.practice&&b.progress===tech.hours)&&
    (!('requires' in tech)||camp.technology.includes(tech.requires)));
  if(!available.length)return;
  camp.knowledge=Math.min(1e9,camp.knowledge+1);
  if(camp.knowledge<12)return;
  camp.knowledge-=12;
  const learned=available[0].id;
  camp.technology.push(learned);
  record(w,camp,'technology',`${camp.name} 通过 12 天实践积累，掌握「${learned}」。`);
}
function exchange(w:World,buyer:Settlement,seller:Settlement){
  if(buyer.food>192||buyer.food>=buyer.members.length*2||buyer.wood<8||seller.food<seller.members.length*4+8||seller.wood>=16)return;
  const size=w.config.size;
  if(Math.abs(buyer.x-seller.x)+Math.abs(buyer.y-seller.y)>(w.engine==='0.4.6'&&buyer.technology.includes('路网')?36:24)||
    !findPath(w,buyer.y*size+buyer.x,seller.y*size+seller.x,4096).length)return;
  if(w.engine==='0.4.6'){
    if(buyer.caravan)return;
    buyer.wood-=4;
    buyer.caravan={destination:seller.id,tile:buyer.y*size+buyer.x,cargo:'wood'};
    record(w,buyer,'trade',`${buyer.name} 派出商队，携带 4 木材前往 ${seller.name}。`,seller);
    return;
  }
  buyer.wood-=4;seller.wood+=4;
  buyer.food+=8;seller.food-=8;
  completeExchange(w,buyer,seller);
}
function completeExchange(w:World,buyer:Settlement,seller:Settlement){
  (buyer.relations??={})[seller.id]=Math.min(100,(buyer.relations[seller.id]??0)+5);
  (seller.relations??={})[buyer.id]=buyer.relations[seller.id];
  record(w,buyer,'trade',`${buyer.name} 向 ${seller.name} 交付 4 木材，换取 8 食物；往来关系 ${buyer.relations[seller.id]}。`,seller);
  for(const [from,to] of [[seller,buyer],[buyer,seller]] as const){
    const shared=technologies.find(tech=>(tech.id!=='路网'||w.engine==='0.4.6')&&from.technology.includes(tech.id)&&!to.technology.includes(tech.id)&&
      (!('requires' in tech)||to.technology.includes(tech.requires)));
    if(shared&&buyer.relations[seller.id]>=15){
      to.technology.push(shared.id);
      record(w,to,'technology',`${to.name} 通过贸易从 ${from.name} 学会「${shared.id}」。`,from);
    }
  }
}
export function advanceCaravans(w:World){
  const size=w.config.size;
  for(const buyer of w.settlements){
    const caravan=buyer.caravan;
    if(!caravan)continue;
    const seller=w.settlements.find(camp=>camp.id===caravan.destination)!;
    const target=caravan.cargo==='wood'?seller:buyer;
    const destination=target.y*size+target.x;
    if(caravan.tile!==destination){
      const next=findPath(w,caravan.tile,destination,4096)[0];
      if(next!==undefined)caravan.tile=next;
      continue;
    }
    if(caravan.cargo==='wood'){
      if(!seller.members.length||seller.wood>196||seller.food<seller.members.length*4+8){
        caravan.cargo='returnWood';
        record(w,seller,'trade',`${seller.name} 供需已改变，商队携原货返回。`,buyer);
      }else{
        seller.wood+=4;seller.food-=8;caravan.cargo='food';
      }
      continue;
    }
    if(caravan.cargo==='food'){
      if(buyer.food>192)continue;
      buyer.food+=8;
      completeExchange(w,buyer,seller);
    }else{
      if(buyer.wood>196)continue;
      buyer.wood+=4;
    }
    delete buyer.caravan;
  }
}
export function updateSociety(w:World){
  if((w.engine!=='0.4.5'&&w.engine!=='0.4.6'))return;
  const camps=w.settlements.filter(s=>s.members.length>0);
  for(const camp of camps)study(w,camp);
  if(w.tick%168!==0)return;
  for(const buyer of camps)for(const seller of camps)if(buyer!==seller)exchange(w,buyer,seller);
}
export function settlementCulture(s:Settlement):string{
  if(s.technology.includes('路网')&&Object.values(s.relations??{}).some(value=>value>=30))return '商路工艺';
  if(s.technology.includes('灌溉')&&s.technology.includes('木工'))return '水利与工艺并重';
  if(s.technology.includes('灌溉'))return '水利农耕';
  if(s.technology.includes('木工'))return '木作工艺';
  if(s.technology.includes('耕作'))return '定居耕作';
  if(Object.values(s.relations??{}).some(value=>value>=15))return '商路交流';
  return '采集传统';
}
