import {it} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createWorld,stateHash,advance} from '../packages/sim-core/src/index.ts';
it('builds a static core preview whose JavaScript engine matches the source',async()=>{
  execFileSync(process.execPath,['scripts/build-offline.mjs'],{encoding:'utf8'});
  const builtPath=new URL('../dist-offline/packages/sim-core/src/index.js',import.meta.url).href;
  const built=await import(builtPath);
  const config={name:'静态构建验证',seed:'build-test',size:64 as const,population:24,preset:'continent' as const};
  const a=createWorld(config),b=built.createWorld(config);advance(a,240);built.advance(b,240);assert.equal(stateHash(a),built.stateHash(b));
  const html=await readFile('dist-offline/index.html','utf8');assert.ok(html.includes('/apps/offline/app.js'));
  const app=await readFile('dist-offline/apps/offline/app.js','utf8');assert.ok(app.includes('/packages/sim-worker/src/worker.js'));assert.ok(!app.includes('/packages/sim-core/src/index.ts'));
});
