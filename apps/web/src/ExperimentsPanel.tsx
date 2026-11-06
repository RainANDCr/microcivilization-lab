import {useEffect,useRef,useState} from 'react';
import {experimentCsv,parseExperimentSeeds,summarizeExperiment,type Endpoint,type ExperimentConfig,type ExperimentPair,type ExperimentUpdate} from './experiment';

function EndpointMap({frame,size,group,selected,onSelect}:{frame:Endpoint['frames'][number];size:number;group:string;selected:number;onSelect:(index:number)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const context=canvas.current?.getContext('2d');
    if(!context)return;
    const image=context.createImageData(size,size);
    frame.food.forEach((food,index)=>{
      const offset=index*4,level=Math.min(255,food*3);
      image.data[offset]=25;image.data[offset+1]=48+Math.floor(level*.75);image.data[offset+2]=65;image.data[offset+3]=255;
    });
    context.putImageData(image,0,0);
    context.strokeStyle='#fff';context.strokeRect(selected%size,Math.floor(selected/size),1,1);
  },[frame,selected,size]);
  return <figure><figcaption>{group} 组 · Tick {frame.tick} · 所选格食物 {frame.food[selected]}</figcaption>
    <canvas ref={canvas} width={size} height={size} tabIndex={0} aria-label={group+' 组地表食物地图'}
      onPointerMove={e=>{
        const bounds=e.currentTarget.getBoundingClientRect();
        const coordinate=(value:number)=>Math.max(0,Math.min(size-1,Math.floor(value*size)));
        onSelect(coordinate((e.clientY-bounds.top)/bounds.height)*size+coordinate((e.clientX-bounds.left)/bounds.width));
      }}
      onKeyDown={e=>{
        const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-size,ArrowDown:size}[e.key];
        if(delta===undefined)return;
        e.preventDefault();onSelect(Math.min(size*size-1,Math.max(0,selected+delta)));
      }}/>
  </figure>;
}

export function ExperimentsPanel({download}:{download:(name:string,text:string,type:string)=>void}){
  const worker=useRef<Worker|null>(null);
  const [seeds,setSeeds]=useState('rain-river\natlas');
  const [days,setDays]=useState(30);
  const [growthA,setA]=useState(100);
  const [growthB,setB]=useState(50);
  const [populationB,setPopulationB]=useState(24);
  const [presetB,setPresetB]=useState<ExperimentConfig['preset']>('continent');
  const [selectedSeed,setSelectedSeed]=useState('');
  const [coordinate,setCoordinate]=useState(0);
  const [frameIndex,setFrameIndex]=useState<number|null>(null);
  const [pairs,setPairs]=useState<ExperimentPair[]>([]);
  const [config,setConfig]=useState<ExperimentConfig|null>(null);
  const [progress,setProgress]=useState(0);
  const [running,setRunning]=useState(false);
  const [status,setStatus]=useState('');
  useEffect(()=>()=>worker.current?.terminate(),[]);

  function stop(message:string){
    worker.current?.terminate();
    worker.current=null;
    setRunning(false);
    setStatus(message);
  }

  function start(){
    try{
      const next:ExperimentConfig={seeds:parseExperimentSeeds(seeds),days,growthA,growthB,population:24,populationB,size:64,preset:'continent',presetB};
      const job=new Worker(new URL('./experiment.worker.ts',import.meta.url),{type:'module'});
      worker.current=job;
      setConfig(next);
      setPairs([]);
      setSelectedSeed('');
      setFrameIndex(null);
      setProgress(0);
      setRunning(true);
      setStatus('正在运行');
      job.onmessage=({data}:MessageEvent<ExperimentUpdate>)=>{
        if(worker.current!==job)return;
        if(data.type==='pair')setPairs(previous=>[...previous,data.pair]);
        if(data.type==='progress')setProgress(data.completed/data.total);
        if(data.type==='done')stop('实验完成');
        if(data.type==='error')stop(data.message);
      };
      job.onerror=()=>stop('实验进程异常结束');
      job.postMessage(next);
    }catch(error){stop(error instanceof Error?error.message:String(error));}
  }

  const selectedPair=pairs.find(pair=>pair.seed===selectedSeed)??pairs[0];
  const frame=frameIndex??Math.max(0,(selectedPair?.a.frames.length??1)-1);
  return <main className="content-page"><h1>平行实验室</h1>
    <p className="page-description">每个种子各运行两次。A 组以 64 × 64 大陆、24 名初始居民为基线。可调整两组再生倍率，以及 B 组地形预设和初始人口。</p>
    <form className="surface settings" onSubmit={event=>{event.preventDefault();start();}}>
      <fieldset disabled={running}>
        <label>世界种子（每行一个）<textarea rows={4} value={seeds} onChange={e=>setSeeds(e.target.value)}/></label>
        <label>模拟天数<input type="number" required min={1} max={3600} value={days} onChange={e=>setDays(e.target.valueAsNumber)}/></label>
        <label>A 组再生倍率（%）<input type="number" required min={0} max={300} value={growthA} onChange={e=>setA(e.target.valueAsNumber)}/></label>
        <label>B 组再生倍率（%）<input type="number" required min={0} max={300} value={growthB} onChange={e=>setB(e.target.valueAsNumber)}/></label>
        <label>B 组初始人口<input type="number" min={0} max={100} required value={populationB} onChange={e=>setPopulationB(e.target.valueAsNumber)}/></label>
        <label>B 组地形<select value={presetB} onChange={e=>setPresetB(e.target.value as ExperimentConfig['preset'])}><option value="continent">大陆</option><option value="islands">群岛</option><option value="arid">干旱</option></select></label>
        <button className="primary" type="submit">开始对照实验</button>
      </fieldset>
      {running&&<button className="secondary" type="button" onClick={()=>stop('实验已取消，保留已完成的结果')}>取消实验</button>}
      {status&&<p role="status">{status} · {Math.round(progress*100)}%</p>}
    </form>
    {pairs.length>0&&config&&<section className="surface"><h2>已完成 {pairs.length} / {config.seeds.length} 对</h2>
      <table><thead><tr><th>指标均值</th><th>A 组</th><th>B 组</th><th>B − A</th></tr></thead>
        <tbody>{summarizeExperiment(pairs).map(metric=><tr key={metric.key}><th scope="row">{metric.label}</th><td>{metric.a.toFixed(2)}</td><td>{metric.b.toFixed(2)}</td><td>{metric.delta.toFixed(2)}</td></tr>)}</tbody>
      </table>
      {selectedPair&&<><label>地图对照种子<select value={selectedPair.seed} onChange={e=>setSelectedSeed(e.target.value)}>
        {pairs.map(pair=><option key={pair.seed}>{pair.seed}</option>)}</select></label>
        <label>同步实验时间轴<input type="range" min={0} max={selectedPair.a.frames.length-1} value={frame} onChange={e=>setFrameIndex(e.target.valueAsNumber)}/></label>
        <div className="experiment-maps">
          <EndpointMap frame={selectedPair.a.frames[frame]} size={config.size} group="A" selected={coordinate} onSelect={setCoordinate}/>
          <EndpointMap frame={selectedPair.b.frames[frame]} size={config.size} group="B" selected={coordinate} onSelect={setCoordinate}/>
        </div></>}
      <button className="secondary" onClick={()=>download('experiment.csv',experimentCsv(config,pairs),'text/csv;charset=utf-8')}>导出逐种子结果</button>
    </section>}
  </main>;
}
