import type {BuildingType,Recipe} from '../../protocol/src/index.ts';

export const BUILDINGS:Record<BuildingType,{name:string;cost:number;hours:number}>={
  housing:{name:'住宅',cost:12,hours:24},
  field:{name:'农田',cost:8,hours:12},
  well:{name:'水井',cost:14,hours:18},
  road:{name:'道路',cost:4,hours:6},
  workshop:{name:'工坊',cost:20,hours:24},
};
export const RECIPES:Record<Recipe,{name:string;wood:number;hours:number;stock:'tools'|'supplies';amount:number}>={
  tools:{name:'木制农具',wood:4,hours:8,stock:'tools',amount:1},
  supplies:{name:'建筑构件',wood:6,hours:12,stock:'supplies',amount:2},
  reinforcedTools:{name:'成套农具',wood:10,hours:18,stock:'tools',amount:3},
  prefab:{name:'预制构件',wood:12,hours:20,stock:'supplies',amount:5},
};
