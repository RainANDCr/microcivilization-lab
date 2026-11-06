import {ADVANCE_TILE_FIELDS,type CompactAdvance,type World,type WorldCommand,type WorldConfig,type Response,type Request} from '../../../packages/protocol/src/index.ts';
type Payload = {type:'init';config:WorldConfig}|{type:'load';world:World}|{type:'advance';ticks:number}|{type:'command';command:WorldCommand};
export class Simulation {
  private worker:Worker|null=null;
  private closed=false;
  private next=0;
  private current:World|null=null;
  private canonicalTiles=false;
  private pending=new Map<number,{resolve:(w:World)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  private connect(){
    const worker=new Worker(new URL('../../../packages/sim-worker/src/worker.ts',import.meta.url),{type:'module'});
    this.worker=worker;
    worker.onmessage=(e:MessageEvent<Response|CompactAdvance>)=>{
      if(this.worker!==worker)return;
      const {id,error,world}=e.data;
      const pending=this.pending.get(id);
      if(!pending)return;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      if(error){pending.reject(new Error(error));return;}
      if(world){
        this.current=world;
        this.canonicalTiles=world.tiles.every(tile=>Object.keys(tile).join(',')==='elevation,moisture,temperature,fertility,biome,walkable,capacity,food,wood,stone');
        pending.resolve(world);
        return;
      }
      if('patch' in e.data&&this.current){
        const previous=this.current;
        const {patch}=e.data;
        const width=ADVANCE_TILE_FIELDS.length;
        if(patch.tiles.length===previous.tiles.length*width&&patch.from.events===previous.events.length&&
          patch.from.metrics===previous.metrics.length&&patch.from.deceased===(previous.deceased?.length??0)){
          const values=patch.tiles;
          let changed=false;
          const tiles=previous.tiles.map((tile,index)=>{
            const start=index*width;
            const moisture=values[start],temperature=values[start+1],fertility=values[start+2],food=values[start+3],wood=values[start+4];
            if(tile.moisture===moisture&&tile.temperature===temperature&&tile.fertility===fertility&&tile.food===food&&tile.wood===wood)return tile;
            changed=true;
            if(this.canonicalTiles)return {elevation:tile.elevation,moisture,temperature,fertility,biome:tile.biome,walkable:tile.walkable,capacity:tile.capacity,food,wood,stone:tile.stone};
            // Imported archives may use a different property order, which their state hash preserves.
            const next={...tile};
            for(let field=0;field<width;field++)next[ADVANCE_TILE_FIELDS[field]]=values[start+field];
            return next;
          });
          const append=<T,>(base:T[],added:T[])=>added.length?base.concat(added):base;
          this.current={...previous,...patch.world,tiles:changed?tiles:previous.tiles,events:append(previous.events,patch.world.events),metrics:append(previous.metrics,patch.world.metrics)};
          if(patch.world.deceased)this.current.deceased=append(previous.deceased??[],patch.world.deceased);
          pending.resolve(this.current);
          return;
        }
      }
      const failure=new Error('模拟快照校验失败，已保留上一个确认状态。');
      pending.reject(failure);
      this.disconnect(failure);
    };
    worker.onerror=event=>{
      event.preventDefault();
      if(this.worker===worker)this.disconnect(new Error('模拟线程已停止。再次操作将从上一个确认状态恢复。'));
    };
    worker.onmessageerror=()=>{
      if(this.worker===worker)this.disconnect(new Error('模拟数据传输失败。再次操作将恢复上一个确认状态。'));
    };
  }
  private disconnect(error:Error){
    this.worker?.terminate();
    this.worker=null;
    for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(error);}
    this.pending.clear();
  }
  async send(payload:Payload):Promise<World>{
    if(this.closed)throw new Error('模拟已关闭。');
    if(!this.worker){
      const confirmed=this.current;
      this.connect();
      if(confirmed&&payload.type!=='load'&&payload.type!=='init')await this.request({type:'load',world:confirmed});
    }
    return this.request(payload);
  }
  private request(payload:Payload):Promise<World>{
    return new Promise((resolve,reject)=>{
      const id=++this.next;
      const timer=setTimeout(()=>this.disconnect(new Error('模拟响应超时。再次操作将从上一个确认状态恢复。')),30000);
      this.pending.set(id,{resolve,reject,timer});
      try{this.worker!.postMessage({...payload,id,...(payload.type==='advance'&&this.current?{compact:true}:{})} as Request);}
      catch(error){this.disconnect(error instanceof Error?error:new Error(String(error)));}
    });
  }
  close(){this.closed=true;this.disconnect(new Error('模拟已关闭。'));}
}
