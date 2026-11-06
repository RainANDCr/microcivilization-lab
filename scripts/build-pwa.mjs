import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const directory=new URL('../dist/',import.meta.url);
const files=(await readdir(directory,{recursive:true,withFileTypes:true}))
  .filter(entry=>entry.isFile())
  .map(entry=>join(entry.parentPath,entry.name).replaceAll('\\','/'))
  .filter(path=>!path.endsWith('/sw.js'))
  .sort();
const root=fileURLToPath(directory);
const digest=createHash('sha256');
const resources=[];
for(const file of files){
  const url=relative(root,file).replaceAll('\\','/');
  resources.push('./'+url);
  digest.update(url).update(await readFile(file));
}
const version=digest.digest('hex').slice(0,16);
await writeFile(new URL('sw.js',directory),`
const prefix='microcivilization:'+self.registration.scope+':';
const cacheName=prefix+${JSON.stringify(version)};
const resources=${JSON.stringify(resources)};
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(resources)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(prefix)&&key!==cacheName).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin||!url.href.startsWith(self.registration.scope))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(async()=>await caches.open(cacheName).then(cache=>cache.match('./index.html',{ignoreVary:true}))??Response.error()));
    return;
  }
  event.respondWith(caches.open(cacheName).then(async cache=>await cache.match(event.request,{ignoreVary:true})??fetch(event.request)));
});
`);
console.log('Offline shell cached on first visit: '+resources.length+' files');
