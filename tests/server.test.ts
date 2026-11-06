import {it} from 'node:test';
import assert from 'node:assert/strict';
import {resolvePublicPath} from '../scripts/public-path.mjs';
it('exposes preview and simulation assets only, never private workspace files',()=>{
  assert.equal(resolvePublicPath('/'), 'apps/offline/index.html');
  assert.equal(resolvePublicPath('/packages/sim-core/src/index.ts'),'packages/sim-core/src/index.ts');
  assert.equal(resolvePublicPath('/packages/sim-worker/src/worker.ts'),'packages/sim-worker/src/worker.ts');
  assert.equal(resolvePublicPath('/packages/mod-sdk/src/index.ts'),'packages/mod-sdk/src/index.ts');
  for(const path of ['/package.json','/.npm-cache/_logs/file','/../package.json','/packages/sim-core/src/../../../../package.json','/packages/sim-core/src/evil.json','/%2e%2e/package.json','/apps/offline/../web/src/App.tsx','/apps/offline/file.html?bad']) assert.equal(resolvePublicPath(path),null,path);
});
