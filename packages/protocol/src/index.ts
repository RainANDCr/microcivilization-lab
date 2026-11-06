export type Biome = 'ocean' | 'shore' | 'grass' | 'forest' | 'desert' | 'mountain' | 'snow';
import type {ModLock} from "../../mod-sdk/src/index.ts";
export interface WorldConfig { name: string; seed: string; size: 64 | 128 | 256; population: number; preset: 'continent' | 'islands' | 'arid'; modLock?:ModLock }
export interface Tile { elevation: number; moisture: number; temperature: number; fertility: number; biome: Biome; walkable: boolean; food: number; capacity: number; wood: number; stone: number }
export type Occupation='forager'|'builder'|'artisan';
export interface Agent { id: number; name: string; x: number; y: number; born: number; hunger: number; energy: number; health: number; food: number; wood: number; skill: number; alive: boolean; action: string; reason: string; path: number[]; target: number | null; known: number[]; settlement: number | null; forageGoal?:number; workSite?:number; occupation?:Occupation; initialAgeTicks?:number; family?:number|null; parents?:number[] }
export interface Family { id:number; name:string; settlement:number; parents:number[]; members:number[]; founded:number; lastBirth:number; food?:number; destination?:number }
export type BuildingType='housing'|'field'|'well'|'road'|'workshop';
export type Recipe='tools'|'supplies'|'reinforcedTools'|'prefab';
export interface Settlement { id: number; name: string; x: number; y: number; founded: number; members: number[]; food: number; wood: number; buildings: {type: string; progress: number; cost: number; tile?:number}[]; production?:{recipe:Recipe;progress:number}[]; tools?:number; supplies?:number; relations?:Record<number,number>; caravan?:{destination:number;tile:number;cargo:'wood'|'food'|'returnWood'}; knowledge: number; technology: string[] }
export interface WorldEvent { id: number; tick: number; type: string; text: string; x?: number; y?: number; entities: number[] }
export interface Metric { tick: number; population: number; food: number; settlements: number; harvested: number; consumed: number; families?:number; children?:number; births?:number; deaths?:number }
export type WorldCommand = { type: 'addFood'; tile: number; amount: number } | { type: 'setGrowth'; value: number } | {type:'placeResidents';tile:number;count:number} | {type:'paintTerrain';tile:number;biome:Biome;radius:number} | {type:'setResources';tile:number;food:number;wood:number;stone:number} | {type:'migrateFamily';family:number;settlement:number}
  | {type:'build';settlement:number;tile:number;building:Exclude<BuildingType,'housing'>}
  | {type:'queueProduction';settlement:number;recipe:Recipe} | {type:'setOccupation';agent:number;occupation:Occupation};
export interface World {
  version: 1 | 2 | 3; engine: '0.1.0' | '0.2.0' | '0.3.0' | '0.3.1' | '0.4.0' | '0.4.1' | '0.4.2' | '0.4.3' | '0.4.4' | '0.4.5' | '0.4.6'; config: WorldConfig; tick: number; rng: number;
  tiles: Tile[]; agents: Agent[]; settlements: Settlement[]; events: WorldEvent[]; metrics: Metric[];
  rules: {growth: number}; totals: {harvested: number; consumed: number; regrown: number; floodLoss?:number};
  commands: {tick: number; command: WorldCommand}[];
  families?:Family[];
  deceased?:Agent[];
}
export type Request = { id: number; type: 'init'; config: WorldConfig } | {id: number; type: 'load'; world: World} | {id: number; type: 'advance'; ticks: number; compact?:boolean} | {id: number; type: 'command'; command: WorldCommand};
export type Response = {id: number; world: World; error?: never} | {id: number; error: string; world?: never};

// Fields the engine can change during advance, in wire order.
export const ADVANCE_TILE_FIELDS=['moisture','temperature','fertility','food','wood'] as const;
export type CompactAdvance={id:number;patch:{world:Omit<World,'tiles'|'commands'>;tiles:Uint16Array;from:{events:number;metrics:number;deceased:number}};error?:never;world?:never};
