/// <reference lib="webworker" />
import {advance,applyCommand,createWorld,validateWorld,cloneWorld} from '../../sim-core/src/index.ts';
import {ADVANCE_TILE_FIELDS,type CompactAdvance,type Request,type Response,type World} from '../../protocol/src/index.ts';
let world:World|null=null;
let queue=Promise.resolve();
self.onmessage=({data}:MessageEvent<Request>)=>{
  queue=queue.then(()=>handle(data));
};
async function handle(req:Request){
  const from={events:world?.events.length??0,metrics:world?.metrics.length??0,deceased:world?.deceased?.length??0};
  try {
    if(!req||!Number.isSafeInteger(req.id))throw new Error('Worker 请求格式无效。');
    if(req.type==='init')world=createWorld(req.config);
    else if(req.type==='load'){validateWorld(req.world);world=cloneWorld(req.world);}
    else if(!world)throw new Error('请先创建或加载世界。');
    else if(req.type==='advance'){
      if(!Number.isInteger(req.ticks)||req.ticks<0||req.ticks>100000)throw new Error('推进步数必须是 0–100000 的整数。');
      let remaining=req.ticks;
      while(remaining>0){
        const deadline=performance.now()+8;
        let steps=0;
        do{advance(world,1);remaining--;steps++;}while(remaining>0&&steps<128&&performance.now()<deadline);
        if(remaining>0)await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    else if(req.type==='command')applyCommand(world,req.command);
    else throw new Error('不支持的 Worker 请求。');
    if(req.type==='advance'&&req.compact){
      const {tiles,commands,...snapshot}=world;
      void commands;
      snapshot.events=snapshot.events.slice(from.events);
      snapshot.metrics=snapshot.metrics.slice(from.metrics);
      if(snapshot.deceased)snapshot.deceased=snapshot.deceased.slice(from.deceased);
      const values=new Uint16Array(tiles.length*ADVANCE_TILE_FIELDS.length);
      for(let index=0;index<tiles.length;index++)for(let field=0;field<ADVANCE_TILE_FIELDS.length;field++){
        values[index*ADVANCE_TILE_FIELDS.length+field]=tiles[index][ADVANCE_TILE_FIELDS[field]];
      }
      self.postMessage({id:req.id,patch:{world:snapshot,tiles:values,from}} satisfies CompactAdvance,[values.buffer]);
      return;
    }
    self.postMessage({id:req.id,world} satisfies Response);
  }catch(error){self.postMessage({id:req?.id??-1,error:error instanceof Error?error.message:String(error)} satisfies Response);}
}
