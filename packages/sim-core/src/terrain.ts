import type { Tile, WorldConfig } from '../../protocol/src/index.ts';
import { hashText } from './index.ts';
function noise(x:number,y:number,scale:number,seed:number):number {
  const px=x/scale,py=y/scale,ix=Math.floor(px),iy=Math.floor(py);
  const smooth=(v:number)=>v*v*(3-2*v);const fx=smooth(px-ix),fy=smooth(py-iy);
  const h=(a:number,b:number)=>{let v=Math.imul(a+seed,374761393)^Math.imul(b,668265263);v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967296;};
  const top=h(ix,iy)*(1-fx)+h(ix+1,iy)*fx,bottom=h(ix,iy+1)*(1-fx)+h(ix+1,iy+1)*fx;
  return top*(1-fy)+bottom*fy;
}
export function generateTerrain(config:WorldConfig):Tile[] {
  const seed=hashText(config.seed),n=config.size,tiles:Tile[]=[];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
    const edge=Math.max(Math.abs(x/n-.5),Math.abs(y/n-.5))*2;
    const base=noise(x,y,n/(config.preset==='islands'?6:3),seed)*.7+noise(x,y,8,seed+1)*.3;
    const elevation=Math.max(0,Math.min(100,Math.floor((base+.18-edge*.25)*100)));
    const moisture=Math.floor(noise(x,y,16,seed+13)*100*(config.preset==='arid'?.4:1));
    const temperature=Math.floor(Math.max(0,Math.min(100,85-Math.abs(y/n-.5)*80-elevation*.25)));
    const biome=elevation<37?'ocean':elevation<41?'shore':elevation>80?'mountain':temperature<12?'snow':moisture<22?'desert':moisture>53?'forest':'grass';
    const walkable=!['ocean','mountain'].includes(biome),fertility=walkable?Math.max(5,Math.floor(moisture*.65+temperature*.35)):0,capacity=walkable?Math.floor(fertility*1.4):0;
    tiles.push({elevation,moisture,temperature,fertility,biome,walkable,capacity,food:Math.floor(capacity*.75),wood:biome==='forest'?60:biome==='grass'?10:0,stone:biome==='mountain'?80:5});
  }
  return tiles;
}
