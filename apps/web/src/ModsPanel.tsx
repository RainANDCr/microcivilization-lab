import {useState} from 'react';
import {lockMods,parseModManifest,type ModLock,type ModManifest} from '../../../packages/mod-sdk/src/index.ts';

export function ModsPanel({onCreate}:{onCreate:(lock:ModLock)=>void}){
  const [manifests,setManifests]=useState<ModManifest[]>([]);
  const [error,setError]=useState('');
  async function load(files:File[]){
    try{
      if(files.some(file=>file.size>65536))throw new Error('每个清单最多 64 KiB。');
      const added=await Promise.all(files.map(async file=>parseModManifest(await file.text())));
      setManifests(previous=>[...previous,...added]);
      setError('');
    }catch(error){setError(error instanceof Error?error.message:String(error));}
  }
  return <main className="content-page"><h1>模组中心</h1>
    <p>加载 JSON 声明清单，为新世界锁定确切版本与依赖。支持初始再生倍率、地形肥力倍率、地块食物容量和洪水冲失比例。</p>
    <section className="surface">
      <label>加载模组清单<input type="file" accept=".json,application/json" multiple onChange={e=>{
        const files=Array.from(e.target.files??[]);
        e.target.value='';
        void load(files);
      }}/></label>
      <ul>{manifests.map((mod,index)=><li key={index}>{mod.name} · {mod.id}@{mod.version}{' '}
        <button className="secondary compact" onClick={()=>setManifests(current=>current.filter((_,i)=>i!==index))}>移除</button>
      </li>)}</ul>
      <button className="primary" disabled={!manifests.length} onClick={()=>{
        try{onCreate(lockMods(manifests));setError('');}catch(error){setError(error instanceof Error?error.message:String(error));}
      }}>锁定模组并创建世界</button>
      {error&&<p role="alert">{error}</p>}
    </section>
  </main>;
}
