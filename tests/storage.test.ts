import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import { createWorld, stateHash } from '../packages/sim-core/src/index';
import { clearRecovery, latestRecovery, saveRecovery, saveWorld, loadWorld, listWorlds, deleteWorld, parseArchive } from '../packages/storage/src/index';
it('roundtrips state and prevents stale tab overwrite',async()=>{
  const w=createWorld({seed:'store',name:'存档',size:64,population:10,preset:'continent'});
  const rev=await saveWorld('test-world',w,0); expect(rev).toBe(1);
  const loaded=await loadWorld('test-world'); expect(stateHash(loaded.world)).toBe(stateHash(w));
  await expect(saveWorld('test-world',w,0)).rejects.toThrow('冲突');
  await expect(deleteWorld('test-world',0)).rejects.toThrow('冲突');
  expect((await listWorlds()).some(x=>x.id==='test-world')).toBe(true);
  await deleteWorld('test-world',rev);
});
it('rejects bad archives and accepts supported world snapshots',()=>{
  expect(()=>parseArchive('{')).toThrow(); expect(()=>parseArchive('{"version":999}')).toThrow();
  const w=createWorld({seed:'archive',name:'存档',size:64,population:10,preset:'continent'});
  expect(stateHash(parseArchive(JSON.stringify({format:'mcworld',version:1,world:w})))).toBe(stateHash(w));
});
it('preserves a newer recovery draft when an older preview is dismissed',async()=>{
  const world=createWorld({seed:'draft',name:'草稿',size:64,population:0,preset:'continent'});
  await saveRecovery('tab-a',world);
  const before=(await latestRecovery())!;
  await clearRecovery('tab-a',before.updated-1);
  expect(stateHash((await latestRecovery())!.world)).toBe(stateHash(world));
  await clearRecovery('tab-a',before.updated);
  expect(await latestRecovery()).toBeUndefined();
});
