import {MiniMap} from './MiniMap';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Maximize2,Map as MapIcon} from 'lucide-react';
import {renderFrame,WorldRenderer,type Layer} from '../../../packages/renderer/src/index.ts';
import type {World} from '../../../packages/protocol/src/index.ts';
import {BIOMES} from '../../../packages/content/src/index.ts';
export function MapView({world,layer,selected,onSelect,reducedMotion}:{world:World;layer:Layer;selected:number|null;onSelect:(i:number)=>void;reducedMotion:boolean}) {
  const frame=useMemo(()=>renderFrame(world),[world]);
  const host=useRef<HTMLDivElement>(null),renderer=useRef<WorldRenderer|null>(null),latest=useRef({frame,layer,selected,onSelect,reducedMotion});latest.current={frame,layer,selected,onSelect,reducedMotion};
  const [error,setError]=useState(''),[ready,setReady]=useState(false);
  useEffect(()=>{
    const r=new WorldRenderer(host.current!,i=>latest.current.onSelect(i));renderer.current=r;let live=true;
    r.init().then(()=>{if(live){r.update(latest.current.frame,latest.current.layer,latest.current.reducedMotion);r.setSelected(latest.current.selected);setReady(true);}}).catch(e=>{if(live)setError(String(e));});
    return()=>{live=false;r.destroy();};
  },[]);
  useEffect(()=>{if(ready)renderer.current?.update(frame,layer,reducedMotion);},[frame,layer,reducedMotion,ready]);
  useEffect(()=>{if(ready)renderer.current?.setSelected(selected);},[selected,ready]);
  return <div className="map-shell"><div className="map-host" ref={host} role="img" aria-label={`${world.config.name} 世界地图，${world.agents.filter(a=>a.alive).length} 位居民`}/>{error&&<div className="map-error"><h3>地图渲染不可用</h3><p>{error}</p><p>请使用支持 WebGL 的浏览器。你仍可保存或导出世界。</p></div>}<div className="map-coordinate"><MapIcon size={13}/>{world.config.size} × {world.config.size}<span>·</span>种子 {world.config.seed}</div><button className="fit-button icon-button" title="显示完整地图" onClick={()=>renderer.current?.fit()}><Maximize2 size={17}/></button><MiniMap tiles={world.tiles} size={world.config.size} selected={selected} onLocate={index=>{onSelect(index);if(ready)renderer.current?.centerOn(index);}}/><div className="map-legend">{Object.entries(BIOMES).slice(0,6).map(([key,b])=><span key={key}><i style={{background:`#${b.color.toString(16).padStart(6,'0')}`}}/>{b.name}</span>)}</div><div className="map-hint">滚轮缩放 · 拖动平移 · 单击观察地块</div></div>;
}
