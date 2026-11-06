import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=['apps/offline/index.html','apps/offline/app.js','apps/offline/storage.js','apps/offline/style.css','packages/content/src/index.ts','packages/protocol/src/index.ts','packages/sim-core/src/index.ts','packages/sim-core/src/terrain.ts','packages/sim-core/src/agents.ts','packages/sim-core/src/pathfinding.ts','packages/sim-worker/src/worker.ts','packages/storage/src/archive.ts'];
files.push('packages/sim-core/src/metrics.ts');
files.push('packages/sim-core/src/settlements.ts','packages/sim-core/src/settlement-validation.ts');
files.push('apps/offline/settlement-ui.js');
files.push('packages/sim-core/src/demographics.ts','packages/sim-core/src/population.ts','packages/sim-core/src/family-validation.ts');
files.push('apps/offline/family-ui.js','packages/mod-sdk/src/index.ts','packages/content/src/industry.ts','packages/sim-core/src/society.ts','packages/content/src/preferences.ts');
for(const file of files){
  let source=await readFile(resolve(root,file),'utf8');
  if(file.endsWith('.ts'))source=stripTypeScriptTypes(source);
  if(/\.(ts|js)$/.test(file))source=source.replace(/\.ts(?=['"])/g,'.js');
  const relative=file.endsWith('index.html')?'index.html':file.replace(/\.ts$/,'.js');
  const target=resolve(root,'dist-offline',relative);await mkdir(dirname(target),{recursive:true});await writeFile(target,source,'utf8');
}
console.log(`Static core preview built: ${resolve(root,'dist-offline')} (${files.length} files). Serve this directory at a web origin root; do not open via file://. Browser E2E is still required.`);
