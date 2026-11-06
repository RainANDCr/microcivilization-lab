import {chromium,expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';

test('loads the installed offline shell and opens a saved world without a network',async({page,context})=>{
  await page.goto('/');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('button',{name:'创造新世界'}).click();
  await page.getByLabel('世界名称').fill('离线存档');
  await page.getByRole('button',{name:'让世界诞生'}).click();
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('.save-state')).toContainText('已保存');
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button',{name:'打开 离线存档'}).click();
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await expect(page.locator('.map-host canvas')).toBeVisible();
});


test('the manifest is installable in a regular browser profile',async({baseURL})=>{
  const context=await chromium.launchPersistentContext('',{executablePath:process.env.MC_CHROMIUM_PATH,headless:true});
  try{
    const page=await context.newPage();
    await page.goto(baseURL!);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    const cdp=await context.newCDPSession(page);
    await expect.poll(async()=>(await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  }finally{await context.close();}
});

for(const failure of ['QuotaExceededError','UnknownError','AbortError'])test(`failed ${failure} writes preserve the saved world and allow export and retry`,async({page})=>{
  await page.addInitScript(()=>{
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){
      const failure=sessionStorage.getItem('write-failure');
      if(failure&&['worlds','recovery'].includes(this.name)){
        if(failure==='AbortError'){
          const transaction=this.transaction;
          const request=put.apply(this,args);
          queueMicrotask(()=>transaction.abort());
          return request;
        }
        throw new DOMException('测试写入失败',failure);
      }
      return put.apply(this,args);
    };
  });
  await page.goto('/');
  await page.getByRole('button',{name:'创造新世界'}).click();
  await page.getByLabel('世界名称').fill('故障存档');
  await page.getByRole('button',{name:'让世界诞生'}).click();
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('.save-state')).toContainText('已保存');
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await page.evaluate(value=>sessionStorage.setItem('write-failure',value),failure);
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('请导出 .mcworld');
  await expect(page.locator('.save-state')).toContainText('未保存变化');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByRole('alert')).toContainText('自动草稿保存失败');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出',exact:true}).click();
  const archive=JSON.parse(await readFile((await (await download).path())!,'utf8'));
  expect(archive.world.tick).toBe(1);
  // The committed snapshot must survive both manual-save and draft failures.
  const tick=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{
    const open=indexedDB.open('microcivilization-worlds');
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const db=open.result;const request=db.transaction('worlds').objectStore('worlds').getAll();request.onsuccess=()=>{resolve(request.result[0].world.tick);db.close();};request.onerror=()=>reject(request.error);};
  }));
  expect(tick).toBe(0);
  await page.evaluate(()=>sessionStorage.removeItem('write-failure'));
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('.save-state')).toContainText('已保存');
  await page.reload();
  await page.getByRole('button',{name:'打开 故障存档'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
});

test('interrupted update keeps the old offline shell, then updates and rolls back without losing saves',async({page,context})=>{
  test.setTimeout(60000);
  const root=resolve('dist');
  const original=await readFile(resolve(root,'sw.js'),'utf8');
  let version='original',interrupted=false;
  const server=createServer(async(request,response)=>{
    const path=resolve(root,'.'+new URL(request.url!,'http://localhost').pathname.replace(/\/$/,'/index.html'));
    if(!path.startsWith(root+sep)){response.writeHead(403).end();return;}
    if(interrupted&&path.endsWith('icon-512.png')){response.writeHead(503).end();return;}
    try{
      const body=path===resolve(root,'sw.js')&&version!=='original'
        ?original.replace(/const cacheName=prefix\+[^;]+;/,`const cacheName=prefix+${JSON.stringify(version)};`)
        :await readFile(path);
      const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
      response.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':'no-store'}).end(body);
    }catch{response.writeHead(404).end();}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const address=server.address() as {port:number};
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    await page.getByRole('button',{name:'创造新世界'}).click();
    await page.getByLabel('世界名称').fill('升级保留');
    await page.getByRole('button',{name:'让世界诞生'}).click();
    await page.getByRole('button',{name:'保存',exact:true}).click();
    await expect(page.locator('.save-state')).toContainText('已保存');
    const previous=await page.evaluate(()=>caches.keys());
    version='update-test';interrupted=true;
    const update=()=>page.evaluate(async()=>{
      const registration=(await navigator.serviceWorker.getRegistration())!;
      const found=new Promise<string>(resolve=>registration.addEventListener('updatefound',()=>{
        const worker=registration.installing!;
        worker.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='redundant')resolve(worker.state);});
      },{once:true}));
      await registration.update();
      return found;
    });
    expect(await update()).toBe('redundant');
    expect(await page.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>!!r?.waiting))).toBe(false);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button',{name:'打开 升级保留'}).click();
    await expect(page.locator('.map-host canvas')).toBeVisible();
    await context.setOffline(false);
    interrupted=false;
    expect(await update()).toBe('installed');
    await page.goto('about:blank');
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await expect.poll(()=>page.evaluate(()=>caches.keys())).toEqual([expect.stringContaining('update-test')]);
    version='original';
    expect(await update()).toBe('installed');
    // Closing all controlled clients allows the rollback worker to activate naturally.
    await page.goto('about:blank');
    const verify=await context.newPage();
    await verify.goto(`http://127.0.0.1:${address.port}/`);
    await expect.poll(()=>verify.evaluate(()=>caches.keys())).toEqual(previous);
    await context.setOffline(true);
    await verify.reload();
    await verify.getByRole('button',{name:'打开 升级保留'}).click();
    await verify.getByRole('button',{name:'单步推进'}).click();
    await expect(verify.locator('.world-toolbar p')).toContainText('1:00');
  }finally{await context.setOffline(false);await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
