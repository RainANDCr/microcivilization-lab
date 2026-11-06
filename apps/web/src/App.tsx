import {BranchTree} from './BranchTree';
import {WorldTopics} from './WorldTopics';
import {ChronicleEvents} from './ChronicleEvents';
import {preferencesKey,readPreferences,type Theme} from '../../../packages/content/src/preferences.ts';
import {CreatorTools} from './CreatorTools';
import {HistoryPanel} from './HistoryPanel';
import {ModsPanel} from './ModsPanel';
import {deleteHistory,parseHistory,saveHistoryCheckpoint,type ForkSource} from '../../../packages/storage/src/history.ts';
import {ExperimentsPanel} from './ExperimentsPanel';
import {useEffect,useRef,useState} from 'react';
import {Globe2,Orbit,Plus,ArrowUpRight,Play,Pause,SkipForward,Save,Download,Upload,Users,Leaf,Activity,BookOpen,ChartNoAxesCombined,Settings2,FlaskConical,Layers3,ChevronRight,Sun,Trash2,Copy,Check,X,Compass,Mountain,Clock3} from 'lucide-react';
import {Simulation} from './controller';
import {useSession} from './store';
import {MapView} from './MapView';
import {Chart} from './Chart';
import {SettlementPanel} from './SettlementPanel';
import {FamilyPanel} from './FamilyPanel';
import {metricsCsv,observationReport} from '../../../packages/sim-core/src/metrics.ts';
import {BIOMES,PRESETS} from '../../../packages/content/src/index.ts';
import {season,stateHash,weatherAt} from '../../../packages/sim-core/src/index.ts';
import {saveRecovery,latestRecovery,clearRecovery,type RecoveryDraft,saveWorld,loadWorld,listWorlds,deleteWorld,parseArchive,serializeArchive,type SavedWorld} from '../../../packages/storage/src/index.ts';
import type {WorldConfig,World,WorldCommand} from '../../../packages/protocol/src/index.ts';
type Meta=Omit<SavedWorld,'world'>;
const format=(n:number)=>new Intl.NumberFormat('zh-CN').format(n);
function time(tick:number){return `第 ${Math.floor(tick/8640)+1} 年 · ${Math.floor(tick/24)%360+1} 日 · ${tick%24}:00`;}
function download(name:string,text:string,type='application/json') {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function App(){
  const s=useSession(),sim=useRef<Simulation|null>(null),busy=useRef(false),file=useRef<HTMLInputElement>(null);
  const [worlds,setWorlds]=useState<Meta[]>([]),[creating,setCreating]=useState(false);
  const [draft,setDraft]=useState<RecoveryDraft>();
  const draftId=useRef(crypto.randomUUID());
  const [modLock,setModLock]=useState<WorldConfig['modLock']>();
  const [preferences,setPreferences]=useState(()=>readPreferences(localStorage));
  const {theme,reduced,sound}=preferences;
  const audio=useRef<AudioContext|null>(null);
  function setSound(enabled:boolean){
    if(enabled){
      try{audio.current??=new AudioContext();void audio.current.resume().catch(()=>undefined);}catch{/* Audio is optional on unsupported devices. */}
    }
    setPreferences(value=>({...value,sound:enabled}));
  }
  const refresh=()=>listWorlds().then(setWorlds).catch(e=>useSession.getState().set({error:String(e)}));
  useEffect(()=>{
    sim.current=new Simulation();
    void refresh();
    let active=true;
    void latestRecovery().then(value=>{if(active)setDraft(value);}).catch(()=>undefined);
    return()=>{active=false;sim.current?.close();};
  },[]);
  useEffect(()=>{
    const saved=new WeakSet<World>();
    let writing=false;
    const checkpoint=()=>{
      const {dirty,world}=useSession.getState();
      if(writing||!dirty||!world||saved.has(world))return;
      saved.add(world);
      writing=true;
      void saveRecovery(draftId.current,world).catch(()=>{
        saved.delete(world);
        useSession.getState().set({error:'自动草稿保存失败。请尝试手动保存或导出 .mcworld 备份；当前模拟仍保留在页面中。'});
      }).finally(()=>{writing=false;});
    };
    const timer=setInterval(checkpoint,15000);
    const hidden=()=>{if(document.hidden)checkpoint();};
    document.addEventListener('visibilitychange',hidden);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    document.documentElement.dataset.reduced=String(reduced);
    try{localStorage.setItem(preferencesKey,JSON.stringify(preferences));}catch{/* Keep the current preferences for this visit. */}
  },[preferences,theme,reduced]);
  useEffect(()=>{
    if(!sound)return;
    function unlock(){
      try{audio.current??=new AudioContext();void audio.current.resume().catch(()=>undefined);}catch{/* Audio is unavailable. */}
    }
    window.addEventListener('pointerdown',unlock,{once:true});
    window.addEventListener('keydown',unlock,{once:true});
    return ()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);};
  },[sound]);
  const lastEvent=useRef('');
  useEffect(()=>{
    const state=useSession.getState(),entry=state.world?.events.at(-1);
    const key=state.id+':'+entry?.id;
    if(key===lastEvent.current)return;
    lastEvent.current=key;
    if(!sound||!entry||!['flood','construction','trade','technology'].includes(entry.type))return;
    const context=audio.current;
    if(context?.state!=='running')return;
    const tone=context.createOscillator(),gain=context.createGain();
    tone.frequency.value=entry.type==='flood'?220:523.25;
    gain.gain.setValueAtTime(.06,context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.22);
    tone.connect(gain);gain.connect(context.destination);
    tone.start();tone.stop(context.currentTime+.23);
    tone.onended=()=>{tone.disconnect();gain.disconnect();};
  },[sound,s.id,s.world]);
  const error=(e:unknown)=>s.set({running:false,error:e instanceof Error?e.message:String(e)});
  async function task(action:()=>Promise<void>){if(busy.current)return;busy.current=true;s.set({busy:true,error:''});try{await action();}catch(e){error(e);}finally{busy.current=false;s.set({busy:false});}}
  async function install(world:World,id:string=crypto.randomUUID(),revision=0,recordCheckpoint=true){const loaded=await sim.current!.send({type:'load',world});s.set({world:loaded,id,revision,running:false,page:'observe',selected:null,dirty:revision===0,notice:revision?'已恢复存档':'新世界尚未保存'});if(recordCheckpoint)await saveHistoryCheckpoint(id,loaded).catch(()=>undefined);}
  async function create(config:WorldConfig){if(s.dirty&&!confirm('当前世界有未保存变化。仍要创建新世界吗？'))return;await task(async()=>{s.set({running:false});const world=await sim.current!.send({type:'init',config});await install(world);setCreating(false);setModLock(undefined);});}
  async function persist(asNew=false){await task(async()=>{const current=useSession.getState();if(!current.world)return;const id=asNew?crypto.randomUUID():current.id??crypto.randomUUID();let revision:number;try{revision=await saveWorld(id,current.world,asNew?0:current.revision);}catch(e){throw new Error(`${e instanceof Error?e.message:String(e)} 请导出 .mcworld 备份；当前模拟尚未保存。`);}current.set({id,revision,dirty:false,notice:'已保存到此浏览器'});await clearRecovery(draftId.current).catch(()=>undefined);await saveHistoryCheckpoint(id,current.world).catch(()=>undefined);await refresh();});}
  async function fork(world:World,source:ForkSource){
    if(useSession.getState().dirty&&!confirm('当前世界有未保存变化。仍要切换到历史分支吗？'))return;
    await task(async()=>{
      const id=crypto.randomUUID();
      const branch={...world,config:{...world.config,name:world.config.name.slice(0,65)+' · Tick '+world.tick}};
      const revision=await saveWorld(id,branch,0,source);
      await install(branch,id,revision);
      await refresh();
    });
  }
  async function recover(){
    if(!draft)return;
    if(useSession.getState().dirty&&!confirm('恢复草稿将切换当前观察世界。继续吗？'))return;
    await task(async()=>{
      const id=crypto.randomUUID();
      const revision=await saveWorld(id,draft.world,0);
      await install(draft.world,id,revision);
      await clearRecovery(draft.id,draft.updated);
      setDraft(undefined);
      await refresh();
    });
  }
  async function editArchive(saved:Meta, copy:boolean) {
    const name=prompt(copy?'副本名称':'新的世界名称',copy?saved.name.slice(0,77)+' 副本':saved.name);
    if(name===null)return;
    await task(async()=>{
      const source=await loadWorld(saved.id);
      if(!copy&&source.revision!==saved.revision)throw new Error('存档冲突，请刷新档案后重试。');
      const snapshot={...source.world,config:{...source.world.config,name:name.trim()}};
      await saveWorld(copy?crypto.randomUUID():source.id,snapshot,copy?0:source.revision);
      await refresh();
    });
  }
  async function open(id:string){if(s.dirty&&!confirm('当前世界有未保存的变化。仍要打开其他存档吗？'))return;await task(async()=>{s.set({running:false});const saved=await loadWorld(id);await install(saved.world,id,saved.revision);});}
  async function step(ticks=1){await task(async()=>{const world=await sim.current!.send({type:'advance',ticks});s.set({world,dirty:true});});}
  async function command(command:WorldCommand){await task(async()=>{const world=await sim.current!.send({type:'command',command});s.set({world,dirty:true});});}
  useEffect(()=>{if(!s.running)return;const timer=setInterval(()=>{if(!busy.current&&!document.hidden)void step(useSession.getState().speed);},200);return()=>clearInterval(timer);},[s.running]);
  useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(useSession.getState().dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.target as HTMLElement).matches('input,select,textarea,button')||creating)return;if(e.code==='Space'&&useSession.getState().world){e.preventDefault();useSession.getState().set({running:!useSession.getState().running});}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[creating]);
  async function importFile(f:File){await task(async()=>{
    const history=f.name.toLowerCase().endsWith('.mchistory');
    if(f.size>(history?150:50)*1024*1024)throw new Error('文件超过导入大小限制。');
    if(s.dirty&&!confirm('导入将切换当前世界，未保存变化会丢失。继续吗？'))return;
    const text=await f.text();
    if(!history){await install(parseArchive(text));return;}
    const {head,checkpoints}=parseHistory(text);
    const id=crypto.randomUUID();
    let revision:number;
    try{
      for(const checkpoint of checkpoints)await saveHistoryCheckpoint(id,checkpoint);
      revision=await saveWorld(id,head,0);
    }catch(error){
      await deleteHistory(id).catch(()=>undefined);
      throw error;
    }
    await install(head,id,revision,false);
    await refresh();
  });}
  const w=s.world,alive=w?.agents.filter(a=>a.alive)??[],selected=w&&s.selected!==null?w.tiles[s.selected]:null,localAgents=s.selected!==null?alive.filter(a=>a.y*w!.config.size+a.x===s.selected):[];
  const weather=w?weatherAt(w):null;
  const nav=[{id:'worlds',label:'世界档案',icon:Globe2},{id:'observe',label:'世界观察台',icon:Compass},{id:'chronicle',label:'编年史',icon:BookOpen},{id:'data',label:'数据中心',icon:ChartNoAxesCombined},{id:'settings',label:'偏好设置',icon:Settings2},{id:'experiments',label:'平行实验室',icon:FlaskConical},{id:'mods',label:'模组中心',icon:Layers3}] as const;
  return <div className="app"><a className="skip-link" href="#workspace" tabIndex={0}>跳到主内容</a><aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();s.set({page:'worlds'});}}><span className="brand-symbol"><Orbit size={27}/></span><span>MicroCivilization<small>微观文明实验场</small></span></a><div className="nav-caption">WORKSPACE / 实验工作台</div><nav aria-label="实验工作台">{nav.map(n=><button key={n.id} aria-current={s.page===n.id?'page':undefined} className={`nav-item ${s.page===n.id?'active':''}`} disabled={!w&&['observe','chronicle','data'].includes(n.id)} onClick={()=>s.set({page:n.id,...(['experiments','mods'].includes(n.id)?{running:false}:{})})}><n.icon size={19}/>{n.label}{s.page===n.id&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="local-tag"><i/>本地运行 · 无需账号</div><p>每一个世界，<br/>都有自己的答案。</p><span className="version">ENGINE {w?.engine??'0.4.6'} · 开发预览</span></div></aside>
    <div className="workspace" id="workspace" tabIndex={-1}><header className="topbar"><div className="breadcrumb">实验工作台<ChevronRight size={13}/><strong>{nav.find(n=>n.id===s.page)?.label}</strong></div><div className="top-actions"><span className="status-dot"/>核心模拟独立运行<button className="icon-button" title="切换深浅主题" onClick={()=>setPreferences(value=>({...value,theme:theme==='dark'?'light':'dark'}))}><Sun size={17}/></button></div></header>
      {s.error&&<div className="alert" role="alert"><span>{s.error}</span><button className="icon-button" aria-label="关闭错误" onClick={()=>s.set({error:''})}><X size={15}/></button></div>}
      {s.page==='worlds'?<main className="lobby"><div className="page-eyebrow"><span/>A SMALL WORLD. AN UNWRITTEN HISTORY.</div><div className="hero"><div><h1>在方寸之间，<br/><em>见证文明。</em></h1><p>从一粒种子，到一片有人生活的土地。<br/>设定初始条件，让世界自己给出答案。</p><div className="hero-actions"><button className="primary" onClick={()=>setCreating(true)}><Plus size={17}/>创造新世界<ArrowUpRight size={16}/></button><button className="secondary" onClick={()=>file.current?.click()}><Upload size={16}/>导入世界</button></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="planet"><div className="land land-one"/><div className="land land-two"/><div className="land land-three"/><div className="planet-grid"/></div><span className="art-label top">SEED → LIFE → HISTORY</span><span className="art-label bottom">一切从这里开始 <span>↗</span></span><span className="tiny-star star-one">✦</span><span className="tiny-star star-two">+</span></div></div>
        <div className="principles"><div><Compass size={19}/><span>自主生存<small>需求驱动的寻路、采集与休息</small></span></div><div><Orbit size={19}/><span>可重复的世界<small>种子与状态决定每一次演化</small></span></div><div><Save size={19}/><span>世界由你保管<small>本地存档与可携带备份</small></span></div></div>
        {draft&&<section className="surface" aria-labelledby="recovery-title"><h2 id="recovery-title">可恢复的模拟草稿</h2><p>{draft.world.config.name} · Tick {draft.world.tick}</p><button className="secondary" disabled={s.busy} onClick={()=>void recover()}>恢复为独立档案</button></section>}
        <div className="section-heading"><div><h2>我的世界 <span>{worlds.length.toString().padStart(2,'0')}</span></h2><p>那些等待你再次观察的世界。</p></div><button className="text-button" onClick={()=>void refresh()}>刷新档案 ↻</button></div>
        <BranchTree worlds={worlds} onOpen={id=>void open(id)}/>
      {worlds.length?<div className="world-grid">{worlds.map((saved,i)=><article className="world-card" key={saved.id}><button className={`world-cover cover-${i%3}`} aria-label={`打开 ${saved.name}`} onClick={()=>void open(saved.id)}><Globe2 size={70} strokeWidth={.6}/><span>{saved.seed}</span><ArrowUpRight size={20}/></button><div className="world-card-body"><span className="card-eyebrow">{saved.population?'LIVING WORLD':'WORLD ARCHIVE'}</span><h3>{saved.name}</h3>{saved.source&&<small>源世界 {saved.source.worldId.slice(0,8)} · Tick {saved.source.tick} · {saved.source.hash}</small>}<p><Clock3 size={13}/>{time(saved.tick)}</p><div className="card-footer"><span><Users size={13}/>{saved.population} 位居民</span><button className="text-button" aria-label={`重命名 ${saved.name}`} onClick={()=>void editArchive(saved,false)}>重命名</button><button className="text-button" aria-label={`复制 ${saved.name}`} onClick={()=>void editArchive(saved,true)}>复制</button><button className="icon-button" aria-label={`删除 ${saved.name}`} onClick={()=>{if(confirm(`删除“${saved.name}”？此操作无法撤销。建议先导出备份。`))void task(async()=>{await deleteWorld(saved.id,saved.revision);await refresh();if(s.id===saved.id)s.set({id:null,revision:0,dirty:true});});}}><Trash2 size={14}/></button></div></div></article>)}<button className="new-card" onClick={()=>setCreating(true)}><span><Plus size={24}/></span><strong>另一种可能</strong><small>创造一个全新的世界</small></button></div>:<div className="empty-world"><div className="empty-orbit"><Globe2 size={30}/></div><div><h3>第一部历史，尚未落笔。</h3><p>创建一个世界，或导入你的 .mcworld 备份。</p></div><button className="text-button" onClick={()=>setCreating(true)}>开始创造 <ArrowUpRight size={16}/></button></div>}
        <div className="development-note"><span>正在生长</span><p>当前世界由生态、家庭、聚落与贸易共同演化。可在编年史回看历史，也可在平行实验室比较不同规则。</p><ArrowUpRight size={17}/></div><footer className="lobby-footer">CREATE A WORLD. WITNESS ITS HISTORY.<span>没有预设结局，只有规则与可能。</span></footer>
      </main>:w&&s.page==='observe'?<main className="observatory"><div className="world-toolbar"><div><span className="page-eyebrow">LIVE OBSERVATORY</span><h1>{w.config.name}<span className="live-label">{s.running?'运行中':'已暂停'}</span></h1><p>{time(w.tick)} · {season(w.tick)}季{weather&&' · '+weather.name}</p></div><div className="toolbar-buttons"><button className="secondary compact" disabled={s.busy} onClick={()=>void persist()}><Save size={15}/>保存</button><button className="secondary compact" onClick={()=>download(`${w.config.name.replace(/[\\/:*?"<>|]/g,'_')}.mcworld`,serializeArchive(w))}><Download size={15}/>导出</button></div></div><div className="stat-strip"><Stat label="存活居民" value={alive.length} icon={<Users size={17}/>}/><Stat label="地表食物" value={w.tiles.reduce((n,t)=>n+t.food,0)} icon={<Leaf size={17}/>}/><Stat label="累计采集" value={w.totals.harvested} icon={<Activity size={17}/>}/><Stat label="模拟时刻" value={w.tick} unit="Tick" icon={<Clock3 size={17}/>}/></div><div className="observation-grid"><section className="map-panel"><div className="panel-heading"><span><span className="status-dot"/>世界视图</span><select aria-label="地图图层" value={s.layer} onChange={e=>s.set({layer:e.target.value as typeof s.layer})}><option value="terrain">自然地形</option><option value="food">食物分布</option><option value="fertility">土壤肥力</option><option value="relations">聚落关系与商队</option></select></div><MapView key={s.id} world={w} reducedMotion={reduced} layer={s.layer} selected={s.selected} onSelect={i=>s.set({selected:i})}/><div className="simulation-controls"><div><button className="play-button" disabled={s.busy} aria-label={s.running?'暂停模拟':'开始模拟'} onClick={()=>s.set({running:!s.running})}>{s.running?<Pause size={17}/>:<Play size={17}/>}</button><button className="icon-button" disabled={s.running||s.busy} title="推进 1 Tick" aria-label="单步推进" onClick={()=>void step()}><SkipForward size={19}/></button><span className="control-divider"/>{[1,4,12,24].map(n=><button key={n} className={`speed ${s.speed===n?'chosen':''}`} onClick={()=>s.set({speed:n})}>{n}×</button>)}</div><span className="save-state">{s.dirty?'● 未保存变化':<><Check size={13}/>已保存</>}{s.busy&&' · 处理中'}</span></div></section><aside className="inspector"><div className="panel-heading"><span>观察笔记</span><Compass size={15}/></div>{selected?<><span className="card-eyebrow">TILE INSPECTOR</span><h2>{BIOMES[selected.biome].name}<small>({s.selected!%w.config.size}, {Math.floor(s.selected!/w.config.size)})</small></h2><dl className="tile-values"><dt>海拔</dt><dd>{selected.elevation}</dd><dt>温度</dt><dd>{selected.temperature}</dd><dt>湿度</dt><dd>{selected.moisture}%</dd><dt>肥力</dt><dd>{selected.fertility}%</dd><dt>食物</dt><dd>{selected.food} / {selected.capacity}</dd><dt>木材</dt><dd>{selected.wood}</dd><dt>石材</dt><dd>{selected.stone}</dd><dt>可通行</dt><dd>{selected.walkable?'是':'否'}</dd></dl>{selected.walkable&&<button className="secondary wide" disabled={s.busy} onClick={()=>void command({type:'addFood',tile:s.selected!,amount:30})}><Plus size={14}/>补充食物 · 30</button>}{selected.walkable&&(w.engine==='0.4.3'||w.engine==='0.4.4'||(w.engine==='0.4.5'||w.engine==='0.4.6'))&&<button className="secondary wide" disabled={s.busy} onClick={()=>{const input=prompt('投放人数（10–100）','10');if(input!==null)void command({type:'placeResidents',tile:s.selected!,count:Number(input)});}}>投放居民</button>}{(w.engine==='0.4.5'||w.engine==='0.4.6')&&<CreatorTools key={s.selected} world={w} index={s.selected!} disabled={s.busy||s.running} command={value=>void command(value)}/>}<h4>地块上的居民 · {localAgents.length}</h4>{!localAgents.length&&<p className="muted">此刻没有居民停留。</p>}{localAgents.map(a=><AgentCard key={a.id} agent={a}/>)}</>:<div className="inspect-empty"><Compass size={35} strokeWidth={1}/><h3>靠近一点，观察生活。</h3><p>单击地图查看地块，或从下方选择一位居民。</p></div>}<FamilyPanel world={w} disabled={s.busy||s.running} onMove={(family,settlement)=>void command({type:'migrateFamily',family,settlement})}/><SettlementPanel world={w} selected={s.selected} disabled={s.busy||s.running} onCommand={value=>void command(value)} onSelect={index=>s.set({selected:index})}/><h4 className="resident-heading">居民名录 <span>{alive.length}</span></h4><div className="resident-list">{alive.slice(0,100).map(a=><button className="resident-row" key={a.id} onClick={()=>s.set({selected:a.y*w.config.size+a.x})}><span className="person-mark">{a.id.toString().padStart(2,'0')}</span><span>{a.name}<small>{a.action}</small></span><ChevronRight size={13}/></button>)}</div></aside></div><div className="recent-events"><span className="card-eyebrow">LATEST FIELD NOTE</span><p>{w.events.at(-1)?.text}</p><button className="text-button" onClick={()=>s.set({page:'chronicle'})}>查看编年史 <ChevronRight size={14}/></button></div></main>:w&&s.page==='chronicle'?<main className="content-page"><div className="page-eyebrow">CHRONICLE / 世界编年史</div><h1>世界留下的痕迹。</h1><p className="page-description">每一条记录，都来自这个世界真实发生的事件。</p><HistoryPanel key={s.id} worldId={s.id!} world={w} busy={s.busy||s.running} reducedMotion={reduced} onFork={(world,source)=>void fork(world,source)} download={download}/><ChronicleEvents key={s.id} events={w.events} time={time} onLocate={(x,y)=>s.set({selected:y*w.config.size+x,page:'observe'})}/></main>:w&&s.page==='data'?<main className="content-page"><div className="page-eyebrow">WORLD ANALYTICS</div><h1>让变化，有迹可循。</h1><p className="page-description">按日采样的真实模拟数据；资源曲线统计地表库存，不包含居民背包。</p><div className="chart-grid"><section className="surface"><h3>人口轨迹 <Users size={17}/></h3><Chart metrics={w.metrics} field="population"/></section><section className="surface"><h3>自然食物储量 <Leaf size={17}/></h3><Chart metrics={w.metrics} field="food" color="#d6bc83"/></section></div><WorldTopics world={w}/><div className="surface report"><h2>本地观察报告</h2>{observationReport(w).map((line,index)=><p key={index}>{line}</p>)}<button className="secondary" onClick={()=>download('world-metrics.csv',metricsCsv(w),'text/csv;charset=utf-8')}><Download size={15}/>导出统计 CSV</button></div></main>:s.page==='mods'?<ModsPanel onCreate={lock=>{setModLock(lock);setCreating(true);}}/>:s.page==='experiments'?<ExperimentsPanel download={download}/>:s.page==='settings'?<main className="content-page settings"><div className="page-eyebrow">PREFERENCES</div><h1>你的观察方式。</h1><section className="surface"><h3>界面与动态</h3><label>主题<select aria-label="主题" value={theme} onChange={e=>setPreferences(value=>({...value,theme:e.target.value as Theme}))}><option value="dark">深色 · Deep Observatory</option><option value="light">浅色 · Natural Atlas</option><option value="dusk">暮色 · Twilight Atlas</option></select></label><label>减少动态效果<input type="checkbox" checked={reduced} onChange={e=>setPreferences(value=>({...value,reduced:e.target.checked}))}/></label><label>事件音效<input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/></label></section>{w&&<section className="surface"><h3>世界规则</h3><p>修改会记录为创造者干预事件。</p><label>生态再生倍率<select disabled={s.busy} value={w.rules.growth} onChange={e=>void command({type:'setGrowth',value:Number(e.target.value)})}>{[0,25,50,100,150,200,300].map(n=><option key={n} value={n}>{n}%</option>)}</select></label><button className="secondary" disabled={s.busy} onClick={()=>void persist(true)}><Copy size={15}/>另存为独立世界</button><small className="muted">复制当前快照。要从更早的时刻分叉，请打开编年史。</small></section>}<section className="surface"><h3>关于这个实验场</h3><p>模拟引擎 {w?.engine??'0.4.6'} · 世界结构 v{w?.version??3} · 每 Tick 为世界 1 小时。</p><p>世界保存在当前浏览器。清除网站数据会移除存档；请定期导出 .mcworld 备份。</p>{w&&<code>当前状态校验值：{stateHash(w)}</code>}</section></main>:null}
    </div><input ref={file} type="file" accept=".mcworld,.mchistory,.json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f);e.target.value='';}}/>{creating&&<CreateDialog busy={s.busy} onClose={()=>{setCreating(false);setModLock(undefined);}} onCreate={config=>void create(modLock?{...config,modLock}:config)}/>}</div>;
}
function Stat({label,value,unit,icon}:{label:string;value:number;unit?:string;icon:React.ReactNode}){return <div className="stat"><span>{icon}{label}</span><strong>{format(value)}<small>{unit}</small></strong></div>;}
function AgentCard({agent:a}:{agent:World['agents'][number]}){return <div className="agent-card"><h3>{a.name}<span>{a.action}</span></h3><label>饥饿 <span>{a.hunger}%</span></label><meter min={0} max={100} value={a.hunger}/><label>精力 <span>{a.energy}%</span></label><meter min={0} max={100} value={a.energy}/><p>背包 {a.food}/12 · 采集经验 {a.skill}</p><blockquote>{a.reason}</blockquote></div>;}
function CreateDialog({busy,onClose,onCreate}:{busy:boolean;onClose:()=>void;onCreate:(c:WorldConfig)=>void}){
  const [name,setName]=useState('初生之地'),[seed,setSeed]=useState('rain-river'),[size,setSize]=useState<WorldConfig['size']>(64),[population,setPopulation]=useState(24),[preset,setPreset]=useState<WorldConfig['preset']>('continent');
  const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="create-dialog" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="create-title"><form onSubmit={e=>{e.preventDefault();onCreate({name,seed,size,population,preset});}}><div className="dialog-heading"><span className="page-eyebrow">WORLD GENESIS / 创世档案</span><button type="button" className="icon-button" disabled={busy} aria-label="关闭创建窗口" onClick={onClose}><X size={19}/></button></div><h2 id="create-title">一段历史的起点。</h2><p>世界会遵循规则，自行寻找它的道路。</p><div className="preset-options">{PRESETS.map(p=><button type="button" key={p.id} className={preset===p.id?'selected':''} onClick={()=>setPreset(p.id)} aria-pressed={preset===p.id}><Mountain size={23}/><strong>{p.name}</strong><small>{p.subtitle}</small>{preset===p.id&&<Check size={15}/>}</button>)}</div><label>世界名称<input autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label>世界种子<input required maxLength={128} value={seed} onChange={e=>setSeed(e.target.value)}/><small>同一个种子和配置，将得到相同的初始世界。</small></label><div className="form-row"><label>地图大小<select value={size} onChange={e=>setSize(Number(e.target.value) as WorldConfig['size'])}><option value={64}>64 × 64 · 推荐</option><option value={128}>128 × 128</option><option value={256}>256 × 256 · 实验档</option></select></label><label>初始居民<input type="number" min={0} max={100} required value={population} onChange={e=>setPopulation(Number(e.target.value))}/></label></div><div className="dialog-footer"><span><Leaf size={14}/>本地生成，不上传数据</span><button className="primary" disabled={busy} type="submit">{busy?'正在生成世界…':'让世界诞生'}<ArrowUpRight size={17}/></button></div></form></dialog>;
}
