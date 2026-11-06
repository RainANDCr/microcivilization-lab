import { validateWorld } from '../../sim-core/src/index.ts';
import type { World } from '../../protocol/src/index.ts';
export function parseArchive(text:string):World {
  if(text.length>50*1024*1024)throw new Error('存档不能超过 50 MiB。');
  const archive: unknown=JSON.parse(text);
  if(!archive||typeof archive!=='object'||!('format' in archive)||archive.format!=='mcworld'||!('version' in archive)||archive.version!==1||!('world' in archive))throw new Error('不是受支持的 .mcworld 归档。');
  if(!validateWorld(archive.world))throw new Error('世界数据无效。');
  return archive.world;
}
export function serializeArchive(world:World):string {validateWorld(world);return JSON.stringify({format:'mcworld',version:1,world});}
