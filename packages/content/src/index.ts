import type {Biome} from '../../protocol/src/index.ts';
export const BIOMES:Record<Biome,{name:string;color:number}>={ocean:{name:'海洋',color:0x345658},shore:{name:'河岸',color:0xc1b783},grass:{name:'草原',color:0x7f9d66},forest:{name:'森林',color:0x3c7057},desert:{name:'荒漠',color:0xb9a36f},mountain:{name:'山地',color:0x777e72},snow:{name:'雪原',color:0xcbd3c4}};
export const PRESETS=[{id:'continent',name:'青屿大陆',subtitle:'温和气候 · 适合第一次观察',icon:'◒'},{id:'islands',name:'群岛回声',subtitle:'破碎海岸 · 隔离的生存路径',icon:'◌'},{id:'arid',name:'荒野之息',subtitle:'干燥土地 · 更严苛的资源环境',icon:'◓'}] as const;
