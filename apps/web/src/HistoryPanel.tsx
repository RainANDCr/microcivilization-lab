import {useEffect,useRef,useState} from 'react';
import {exportHistory,listHistoryCheckpoints,loadHistoryCheckpoint,saveHistoryCheckpoint,type Checkpoint,type ForkSource} from '../../../packages/storage/src/history.ts';
import {stateHash,type World} from '../../../packages/sim-core/src/index.ts';
import {MapView} from './MapView';

export function HistoryPanel({worldId,world,busy,reducedMotion,onFork,download}:{worldId:string;world:World;busy:boolean;reducedMotion:boolean;onFork:(world:World,source:ForkSource)=>void;download:(name:string,text:string)=>void}){
  const worker=useRef<Worker|null>(null);
  const [checkpoints,setCheckpoints]=useState<Checkpoint[]>([]);
  const [checkpoint,setCheckpoint]=useState<Checkpoint|null>(null);
  const [preview,setPreview]=useState<World|null>(null);
  const [tick,setTick]=useState(0);
  const [status,setStatus]=useState('');
  const [working,setWorking]=useState(false);
  useEffect(()=>{
    let active=true;
    void listHistoryCheckpoints(worldId).then(items=>{if(active)setCheckpoints(items);}).catch(error=>{if(active)setStatus(String(error));});
    return ()=>{active=false;worker.current?.terminate();};
  },[worldId]);
  async function run(action:()=>Promise<void>){
    setWorking(true);setStatus('');
    try{await action();}catch(error){setStatus(error instanceof Error?error.message:String(error));}
    finally{setWorking(false);}
  }
  const disabled=busy||working;
  return <section className="surface history-controls">
    <h2>历史检查点与回放</h2>
    <p>每个世界保留最近 8 个检查点，可逐 Tick 查看距检查点一年内的历史。</p>
    <button className="secondary" disabled={disabled} onClick={()=>void run(async()=>{
      await saveHistoryCheckpoint(worldId,world);
      setCheckpoints(await listHistoryCheckpoints(worldId));
      setStatus('检查点已保存');
    })}>保存历史检查点</button>
    <button className="secondary" disabled={disabled} onClick={()=>void run(async()=>{
      download('world.mchistory',await exportHistory(worldId,world));
      setStatus('历史包已导出');
    })}>导出历史包</button>
    <label>历史检查点<select aria-label="历史检查点" disabled={disabled} value={checkpoint?.id??''} onChange={e=>{
      const item=checkpoints.find(entry=>entry.id===e.target.value)??null;
      setCheckpoint(item);setTick(item?.tick??0);setPreview(null);
    }}><option value="">选择检查点</option>{checkpoints.map(item=><option key={item.id} value={item.id}>Tick {item.tick} · {item.hash}</option>)}</select></label>
    {checkpoint&&<form onSubmit={e=>{
      e.preventDefault();
      void run(async()=>{
        const start=await loadHistoryCheckpoint(worldId,checkpoint.id);
        if(tick===start.tick){setPreview(start);return;}
        const job=new Worker(new URL('./history.worker.ts',import.meta.url),{type:'module'});
        worker.current=job;
        try{
          const result=await new Promise<World>((resolve,reject)=>{
            job.onmessage=({data})=>data.world?resolve(data.world):reject(new Error(data.error));
            job.onerror=()=>reject(new Error('回放进程异常结束。'));
            job.postMessage({start,head:world,tick});
          });
          setPreview(result);
        }finally{job.terminate();worker.current=null;}
      });
    }}>
      <label>回放时刻<input type="number" value={tick} min={checkpoint.tick} max={world.tick} onChange={e=>{setTick(e.target.valueAsNumber);setPreview(null);}} required/></label>
      <label>时间轴<input type="range" min={checkpoint.tick} max={world.tick} value={tick||checkpoint.tick} onChange={e=>{setTick(e.target.valueAsNumber);setPreview(null);}}/></label>
      <button type="submit" className="secondary" disabled={disabled}>查看历史时刻</button>
    </form>}
    {preview&&checkpoint&&<>
      <p>历史预览 · Tick {preview.tick} · {stateHash(preview)}</p>
      <MapView key={checkpoint.id} world={preview} reducedMotion={reducedMotion} layer="terrain" selected={null} onSelect={()=>{}}/>
      <button className="secondary" disabled={disabled} onClick={()=>onFork(preview,{worldId,checkpointId:checkpoint.id,tick:preview.tick,hash:stateHash(preview)})}>从此时刻分叉</button>
    </>}
    {status&&<p role="status">{status}</p>}
  </section>;
}
