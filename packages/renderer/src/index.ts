import {residentTextures} from './resident-textures.ts';
import {movementOrigins} from './motion.ts';
import {Application,Container,Graphics,Sprite,Texture} from 'pixi.js';
import type {World} from '../../protocol/src/index.ts';
import {BIOMES} from '../../content/src/index.ts';
export type Layer='terrain'|'food'|'fertility'|'relations';
export function renderFrame(world:World){
  const {tick,tiles}=world;
  return {
    tick,tiles,config:{size:world.config.size},
    agents:world.agents.map(({id,x,y,alive,action,occupation})=>({id,x,y,alive,action,occupation})),
    settlements:world.settlements.map(({id,x,y,members,relations,caravan})=>({id,x,y,occupied:members.length>0,relations,caravan})),
  };
}
type RenderFrame=ReturnType<typeof renderFrame>;
const CHUNK_SIZE=32;
type TerrainChunk={sprite:Sprite;context:CanvasRenderingContext2D;pixels:ImageData};

function tileColor(tile:World['tiles'][number],layer:Layer):number {
  if(layer==='food'&&tile.walkable){
    const fraction=tile.capacity?tile.food/tile.capacity:0;
    return (Math.floor(170-fraction*70)<<16)|(Math.floor(65+fraction*110)<<8)|70;
  }
  if(layer==='fertility'&&tile.walkable)return (Math.floor(160-tile.fertility)<<16)|((60+tile.fertility)<<8)|85;
  return BIOMES[tile.biome].color;
}
export class WorldRenderer {
  private app=new Application();private scene=new Container();private terrain=new Container();private chunks:TerrainChunk[]=[];private camps=new Graphics();private agents=new Container();private people=new Map<number,Sprite>();private poses:Texture[]=[];
  private frame=0;private selection=new Graphics();
  private world:Pick<RenderFrame,'tick'|'config'|'agents'>|null=null;private size=64;private zoom=1;private ox=0;private oy=0;private drag:{x:number;y:number;ox:number;oy:number}|null=null;private observer:ResizeObserver|null=null;private disposed=false;private selected:number|null=null;
  private host:HTMLElement;private select:(index:number)=>void;
  constructor(host:HTMLElement,select:(index:number)=>void){this.host=host;this.select=select;}
  async init(){
    await this.app.init({background:0x172522,antialias:false,resolution:Math.min(devicePixelRatio,2),autoDensity:true,resizeTo:this.host,preference:'webgl'});
    if(this.disposed){this.app.destroy(true);return;}
    this.host.appendChild(this.app.canvas);this.app.stage.addChild(this.scene);this.scene.addChild(this.terrain,this.camps,this.agents,this.selection);
    this.app.canvas.addEventListener('wheel',this.wheel,{passive:false});this.app.canvas.addEventListener('pointerdown',this.down);this.app.canvas.addEventListener('pointermove',this.move);this.app.canvas.addEventListener('pointerup',this.up);this.app.canvas.addEventListener('pointercancel',this.cancel);
    this.observer=new ResizeObserver(()=>{this.app.resize();this.transform();});this.observer.observe(this.host);this.fit();
  }
  private wheel=(e:WheelEvent)=>{e.preventDefault();const rect=this.app.canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const old=this.zoom;this.zoom=Math.max(.5,Math.min(30,this.zoom*(e.deltaY<0?1.15:.87)));this.ox=x-(x-this.ox)*this.zoom/old;this.oy=y-(y-this.oy)*this.zoom/old;this.transform();};
  private down=(e:PointerEvent)=>{this.drag={x:e.clientX,y:e.clientY,ox:this.ox,oy:this.oy};this.app.canvas.setPointerCapture(e.pointerId);};
  private move=(e:PointerEvent)=>{if(!this.drag)return;this.ox=this.drag.ox+e.clientX-this.drag.x;this.oy=this.drag.oy+e.clientY-this.drag.y;this.transform();};
  private cancel=()=>{this.drag=null;};
  private up=(e:PointerEvent)=>{if(this.drag&&Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)<5){const rect=this.app.canvas.getBoundingClientRect();const x=Math.floor((e.clientX-rect.left-this.ox)/this.zoom),y=Math.floor((e.clientY-rect.top-this.oy)/this.zoom);if(x>=0&&x<this.size&&y>=0&&y<this.size)this.select(y*this.size+x);}this.drag=null;};
  private transform(){this.scene.position.set(this.ox,this.oy);this.scene.scale.set(this.zoom);}
  fit(){this.zoom=Math.min(this.host.clientWidth/this.size,this.host.clientHeight/this.size)*.88;this.ox=(this.host.clientWidth-this.size*this.zoom)/2;this.oy=(this.host.clientHeight-this.size*this.zoom)/2;this.transform();}
  centerOn(index:number){
    this.ox=this.host.clientWidth/2-(index%this.size+.5)*this.zoom;
    this.oy=this.host.clientHeight/2-(Math.floor(index/this.size)+.5)*this.zoom;
    this.transform();
  }
  setSelected(index:number|null){this.selected=index;this.drawSelection();}
  private drawSelection(){this.selection.clear();if(this.selected!==null)this.selection.rect(this.selected%this.size,Math.floor(this.selected/this.size),1,1).stroke({color:0xf7e0a3,width:.17});}
  private clearTerrain(){
    for(const child of this.terrain.removeChildren())child.destroy({texture:true,textureSource:true});
    this.chunks=[];
  }
  private createTerrain(){
    this.clearTerrain();
    for(let y=0;y<this.size;y+=CHUNK_SIZE)for(let x=0;x<this.size;x+=CHUNK_SIZE){
      const canvas=document.createElement('canvas');
      canvas.width=Math.min(CHUNK_SIZE,this.size-x);
      canvas.height=Math.min(CHUNK_SIZE,this.size-y);
      const context=canvas.getContext('2d')!;
      const sprite=new Sprite(Texture.from(canvas));
      sprite.texture.source.scaleMode='nearest';
      sprite.position.set(x,y);
      this.terrain.addChild(sprite);
      this.chunks.push({sprite,context,pixels:context.createImageData(canvas.width,canvas.height)});
    }
  }
  private drawTerrain(w:RenderFrame,layer:Layer){
    for(const {sprite,context,pixels} of this.chunks){
      const {data,width,height}=pixels;
      let changed=false;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const tile=w.tiles[(sprite.y+y)*this.size+sprite.x+x];
        const color=tileColor(tile,layer),offset=(y*width+x)*4;
        const r=color>>16&255,g=color>>8&255,b=color&255;
        if(data[offset]===r&&data[offset+1]===g&&data[offset+2]===b&&data[offset+3]===255)continue;
        data[offset]=r;data[offset+1]=g;data[offset+2]=b;data[offset+3]=255;
        changed=true;
      }
      if(changed){
        context.putImageData(pixels,0,0);
        sprite.texture.source.update();
      }
    }
  }
  update(w:RenderFrame,layer:Layer,reducedMotion=false){
    const resize=this.size!==w.config.size||!this.world;
    cancelAnimationFrame(this.frame);
    const origins=movementOrigins(reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches?null:this.world,w);
    this.world={tick:w.tick,config:w.config,agents:w.agents};
    this.size=w.config.size;
    if(resize)this.createTerrain();
    this.drawTerrain(w,layer);
    this.camps.clear();
    if(layer==='relations'){
      const settlements=new Map(w.settlements.map(camp=>[camp.id,camp]));
      for(const camp of w.settlements){
        for(const [id,strength] of Object.entries(camp.relations??{})){
          const other=settlements.get(Number(id));
          if(!other||camp.id>=other.id)continue;
          this.camps.moveTo(camp.x+.5,camp.y+.5).lineTo(other.x+.5,other.y+.5).stroke({color:0xe3c477,width:.3,alpha:.3+strength/150});
        }
      }
    }
    for(const camp of w.settlements){
      if(!camp.caravan)continue;
      const x=camp.caravan.tile%this.size,y=Math.floor(camp.caravan.tile/this.size);
      this.camps.circle(x+.5,y+.5,.38).fill({color:camp.caravan.cargo==='food'?0x9edd99:0xeab763}).stroke({color:0x2b1e11,width:.1});
    }
    for(const camp of w.settlements)this.camps.rect(camp.x-.1,camp.y-.1,1.2,1.2).fill({color:camp.occupied?0xd9b779:0x9b9381}).stroke({color:0x283323,width:.12});
    if(!this.poses.length)this.poses=residentTextures();
    const alive=new Set(w.agents.filter(agent=>agent.alive).map(agent=>agent.id));
    for(const [id,sprite] of this.people){
      if(!alive.has(id)){sprite.destroy();this.people.delete(id);}
    }
    const draw=(fraction:number)=>{
      for(const agent of w.agents){
        if(!agent.alive)continue;
        const origin=origins.get(agent.id)??agent;
        const x=origin.x+(agent.x-origin.x)*fraction;
        const y=origin.y+(agent.y-origin.y)*fraction;
        const pose=agent.action==='休息'?4:origins.has(agent.id)?1+Math.floor(fraction*4)%2:
          ['建造','加工','采集','采集木材'].includes(agent.action)?3:0;
        let sprite=this.people.get(agent.id);
        if(!sprite){
          sprite=new Sprite(this.poses[pose]);sprite.anchor.set(.5);this.agents.addChild(sprite);this.people.set(agent.id,sprite);
        }
        sprite.texture=this.poses[pose];sprite.position.set(x+.5,y+.5);
        sprite.scale.set((agent.x<origin.x?-1:1)*.1,.1);
        sprite.tint=agent.occupation==='builder'?0xf0c887:agent.occupation==='artisan'?0xc6b0f1:0xffffff;
      }
    };
    if(origins.size){
      const started=performance.now();
      const animate=(now:number)=>{
        const fraction=Math.max(0,Math.min(1,(now-started)/180));
        draw(fraction);
        if(fraction<1)this.frame=requestAnimationFrame(animate);
      };
      draw(0);
      this.frame=requestAnimationFrame(animate);
    }else draw(1);
    this.drawSelection();if(resize)this.fit();
  }
  destroy(){cancelAnimationFrame(this.frame);this.disposed=true;this.observer?.disconnect();if(this.app.renderer){this.app.canvas.removeEventListener('wheel',this.wheel);this.app.canvas.removeEventListener('pointerdown',this.down);this.app.canvas.removeEventListener('pointermove',this.move);this.app.canvas.removeEventListener('pointerup',this.up);this.app.canvas.removeEventListener('pointercancel',this.cancel);this.clearTerrain();this.app.destroy(true,{children:true});for(const pose of this.poses)pose.destroy(true);}}
}
