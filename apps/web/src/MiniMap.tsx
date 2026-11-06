import {useEffect,useRef} from 'react';
import {BIOMES} from '../../../packages/content/src/index.ts';
import type {World} from '../../../packages/protocol/src/index.ts';

export function MiniMap({tiles,size,selected,onLocate}:{
  tiles:World['tiles'];size:number;selected:number|null;onLocate:(index:number)=>void;
}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const previous=useRef<typeof tiles|null>(null);
  useEffect(()=>{
    const last=previous.current;
    previous.current=tiles;
    if(last?.length===tiles.length&&tiles.every((tile,index)=>tile.biome===last[index].biome))return;
    const context=canvas.current?.getContext('2d');
    if(!context)return;
    const pixels=context.createImageData(size,size);
    tiles.forEach((tile,index)=>{
      const color=BIOMES[tile.biome].color;
      const offset=index*4;
      pixels.data[offset]=color>>16&255;pixels.data[offset+1]=color>>8&255;
      pixels.data[offset+2]=color&255;pixels.data[offset+3]=255;
    });
    context.putImageData(pixels,0,0);
  },[tiles,size]);
  const current=selected??Math.floor(size/2)*(size+1);
  const clamp=(value:number)=>Math.max(0,Math.min(size-1,value));
  return <button type="button" className="mini-map" aria-label="小地图定位" title="点击或使用方向键定位"
    onClick={event=>{
      if(event.detail===0){onLocate(current);return;}
      const bounds=event.currentTarget.getBoundingClientRect();
      const x=clamp(Math.floor((event.clientX-bounds.left)*size/bounds.width));
      const y=clamp(Math.floor((event.clientY-bounds.top)*size/bounds.height));
      onLocate(y*size+x);
    }}
    onKeyDown={event=>{
      const moves:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      const move=moves[event.key];
      if(!move)return;
      event.preventDefault();
      const x=clamp(current%size+move[0]),y=clamp(Math.floor(current/size)+move[1]);
      onLocate(y*size+x);
    }}>
    <canvas ref={canvas} width={size} height={size} aria-hidden="true"/>
    {selected!==null&&<span aria-hidden="true" style={{
      left:`${(selected%size+.5)/size*100}%`,top:`${(Math.floor(selected/size)+.5)/size*100}%`
    }}/>}
  </button>;
}
