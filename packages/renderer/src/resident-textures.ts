import {Texture} from 'pixi.js';

export function residentTextures(){
  return ['idle','walk-a','walk-b','work','sleep'].map(pose=>{
    const canvas=document.createElement('canvas');
    canvas.width=9;canvas.height=9;
    const context=canvas.getContext('2d')!;
    function pixel(color:string,x:number,y:number,w:number,h:number){
      context.fillStyle=color;context.fillRect(x,y,w,h);
    }
    if(pose==='sleep'){
      pixel('#332d39',1,5,7,3);pixel('#a6bcdd',3,5,5,2);pixel('#ffe4b2',1,5,2,2);pixel('#fff0c9',7,2,1,1);
    }else{
      pixel('#392d2d',2,2,5,6);pixel('#f1bc91',3,1,3,3);pixel('#604634',3,1,3,1);
      pixel('#fff1c4',3,4,3,2);pixel('#4d3e49',3,6,3,1);
      pixel('#6a5360',pose==='walk-a'?2:3,7,1,1);pixel('#6a5360',pose==='walk-b'?6:5,7,1,1);
      if(pose==='work'){pixel('#9c7256',6,3,1,4);pixel('#e4c68c',6,3,2,1);}
    }
    const texture=Texture.from(canvas);
    texture.source.scaleMode='nearest';
    return texture;
  });
}
