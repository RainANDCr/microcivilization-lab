import {create} from 'zustand';
import type {World} from '../../../packages/protocol/src/index.ts';
import type {Layer} from '../../../packages/renderer/src/index.ts';
type Page='worlds'|'observe'|'chronicle'|'data'|'settings'|'experiments'|'mods';
interface Session {world:World|null;id:string|null;revision:number;page:Page;running:boolean;speed:number;busy:boolean;error:string;notice:string;layer:Layer;selected:number|null;dirty:boolean;set:(next:Partial<Omit<Session,'set'>>)=>void}
export const useSession=create<Session>(set=>({world:null,id:null,revision:0,page:'worlds',running:false,speed:1,busy:false,error:'',notice:'',layer:'terrain',selected:null,dirty:false,set:next=>set(next)}));
