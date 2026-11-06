import {validateWorld} from '/packages/sim-core/src/index.ts';
let opening;
function open(){return opening??=new Promise((resolve,reject)=>{const request=indexedDB.open('mc-core-preview',1);request.onupgradeneeded=()=>request.result.createObjectStore('worlds',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('请关闭其他预览标签页后重试。'));});}
export async function list(){const db=await open();return new Promise((resolve,reject)=>{const req=db.transaction('worlds').objectStore('worlds').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function save(id,world,revision){validateWorld(world);const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('worlds','readwrite'),store=tx.objectStore('worlds');let conflict=false;const req=store.get(id);req.onsuccess=()=>{if((req.result?.revision??0)!==revision){conflict=true;tx.abort();return;}store.put({id,world,revision:revision+1,updated:Date.now()});};tx.oncomplete=()=>resolve(revision+1);tx.onabort=()=>reject(new Error(conflict?'存档冲突：其他标签页已更新。请导出当前世界备份，再重新打开存档。':'保存失败，原存档未被覆盖。'));tx.onerror=()=>reject(tx.error);});}
export async function remove(id,expectedRevision){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('worlds','readwrite'),store=tx.objectStore('worlds');
    let conflict=false;
    const request=store.get(id);
    request.onsuccess=()=>{
      if(!request.result||request.result.revision!==expectedRevision){conflict=true;tx.abort();return;}
      store.delete(id);
    };
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(new Error(conflict?'存档冲突，请刷新档案后再删除。':'删除失败，原存档仍保留。'));
  });
}
