/// <reference lib="webworker" />
import {buildHistoryReplay} from '../../../packages/storage/src/history.ts';
import type {World} from '../../../packages/protocol/src/index.ts';

self.onmessage=({data:{start,head,tick}}:MessageEvent<{start:World;head:World;tick:number}>)=>{
  try{self.postMessage({world:buildHistoryReplay(start,head)(tick)});}
  catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
