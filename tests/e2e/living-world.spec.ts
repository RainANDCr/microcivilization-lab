import {test,expect} from '@playwright/test';
import {historyWorld} from '../fixtures/history-world.ts';
import {updatePopulation} from '../../packages/sim-core/src/population.ts';
import {serializeArchive} from '../../packages/storage/src/archive.ts';
import {createWorld,advance} from '../../packages/sim-core/src/index.ts';

test('shows weather after the Worker crosses a weather boundary',async({page})=>{
  const world=createWorld({name:'天气测试',seed:'rain-river',size:64,population:0,preset:'continent'});
  advance(world,239);
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'weather.mcworld',mimeType:'application/json',buffer:Buffer.from(serializeArchive(world))});
  await expect(page.locator('.world-toolbar p')).toContainText('平稳');
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('降雨');
  await page.getByRole('button',{name:'编年史',exact:true}).click();
  await page.getByLabel('事件筛选').selectOption('weather');
  await expect(page.locator('.timeline article')).toHaveCount(1);
  await expect(page.locator('.timeline article')).toContainText('150%');
});

test('shows archived family names and restores World v3 with real history',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const w=historyWorld();updatePopulation(w);await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'history.mcworld',mimeType:'application/json',buffer:Buffer.from(serializeArchive(w))});
  await expect(page.locator('.family-section')).toContainText('先人 3');
  await expect(page.locator('.family-section')).toContainText('先人 4');
  await expect(page.locator('.family-section')).toContainText('新生 2001');
  await expect(page.locator('.family-section')).toContainText('离世 1998 人');
  await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.locator('.save-state')).toContainText('已保存');
  await page.reload();await page.getByRole('button',{name:'打开 跨代历史测试'}).click();
  await expect(page.locator('.family-section')).toContainText('先人 3');expect(errors).toEqual([]);
});
test('creates, steps, saves and restores a real world',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:/创造新世界/}).click();
  await page.getByLabel('世界名称').fill('E2E 世界');await page.getByRole('button',{name:'让世界诞生'}).click();
  await expect(page.locator('.world-toolbar h1')).toContainText('E2E 世界');
  await expect(page.locator('.map-host canvas')).toBeVisible();
  const minimap=page.getByRole('button',{name:'小地图定位'});
  const bounds=await minimap.boundingBox();
  expect(bounds).toBeTruthy();
  await minimap.click({position:{x:bounds!.width*16.5/64,y:bounds!.height*16.5/64}});
  await expect(page.locator('.inspector h2')).toContainText('(16, 16)');
  await minimap.press('ArrowRight');
  await expect(page.locator('.inspector h2')).toContainText('(17, 16)');
  const main=page.locator('.map-host canvas'),mainBounds=await main.boundingBox();
  await main.click({position:{x:mainBounds!.width/2,y:mainBounds!.height/2}});
  await expect(page.locator('.inspector h2')).toContainText('(17, 16)');
  const terrain=await main.screenshot();
  await page.getByLabel('地图图层').selectOption('food');
  await expect.poll(async()=>terrain.equals(await main.screenshot())).toBe(false);
  await page.getByLabel('地图图层').selectOption('terrain');
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('.save-state')).toContainText('已保存');
  await page.reload();await page.getByRole('button',{name:'打开 E2E 世界'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await expect(page.locator('.resident-row')).toHaveCount(24);expect(errors).toEqual([]);
  await page.getByRole('button',{name:'世界档案',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept('更名世界'));
  await page.getByRole('button',{name:'重命名 E2E 世界',exact:true}).click();
  await expect(page.getByRole('button',{name:'打开 更名世界',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'打开 E2E 世界',exact:true})).toHaveCount(0);
  page.once('dialog',dialog=>dialog.accept('独立副本'));
  await page.getByRole('button',{name:'复制 更名世界',exact:true}).click();
  await page.getByRole('button',{name:'打开 独立副本',exact:true}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('2:00');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('.save-state')).toContainText('已保存');
  await page.getByRole('button',{name:'世界档案',exact:true}).click();
  await page.getByRole('button',{name:'打开 更名世界',exact:true}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await page.getByRole('button',{name:'数据中心',exact:true}).click();
  await expect(page.locator('.surface.report')).toContainText('暂无完整年度采样');
  await expect(page.locator('.surface.report')).toContainText('截至 1 Tick');
  await page.getByRole('button',{name:'世界观察台',exact:true}).click();
  const mapBounds=await minimap.boundingBox();
  await minimap.click({position:{x:mapBounds!.width*16.5/64,y:mapBounds!.height*16.5/64}});
  page.once('dialog',dialog=>dialog.accept('10'));
  await page.getByRole('button',{name:'投放居民',exact:true}).click();
  await expect(page.locator('.resident-row')).toHaveCount(34);
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('.save-state')).toContainText('已保存');
  await page.reload();
  await page.getByRole('button',{name:'打开 更名世界',exact:true}).click();
  await expect(page.locator('.resident-row')).toHaveCount(34);
});
test('runs paired seeds from the lab and exports per-seed results',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'平行实验室'}).click();
  await page.getByLabel('模拟天数').fill('2');
  await page.getByRole('button',{name:'开始对照实验'}).click();
  await expect(page.getByRole('status')).toHaveText('实验完成 · 100%');
  await expect(page.getByRole('heading',{name:'已完成 2 / 2 对'})).toBeVisible();
  await expect(page.getByLabel('B 组地表食物地图')).toBeVisible();
  const exported=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出逐种子结果'}).click();
  expect((await exported).suggestedFilename()).toBe('experiment.csv');
});

test('replays an earlier tick and keeps its branch source in the archive',async({page})=>{
  const world=createWorld({name:'分叉测试',seed:'rain-river',size:64,population:0,preset:'continent'});
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'branch.mcworld',mimeType:'application/json',buffer:Buffer.from(serializeArchive(world))});
  await expect(page.getByRole('button',{name:'单步推进'})).toBeEnabled();
  await page.getByRole('button',{name:'单步推进'}).click();
  await page.getByRole('button',{name:'单步推进'}).click();
  await page.getByRole('button',{name:'编年史',exact:true}).click();
  await page.getByLabel('历史检查点').selectOption({index:1});
  await page.getByLabel('回放时刻').fill('1');
  await page.getByRole('button',{name:'查看历史时刻'}).click();
  await expect(page.getByText(/历史预览 · Tick 1/)).toBeVisible();
  page.once('dialog',dialog=>void dialog.accept());
  await page.getByRole('button',{name:'从此时刻分叉'}).click();
  await expect(page.locator('.world-toolbar h1')).toContainText('分叉测试 · Tick 1');
  await page.getByRole('button',{name:'世界档案',exact:true}).click();
  await expect(page.getByText(/源世界 .* Tick 1/)).toBeVisible();
});

test('loads a declared mod and applies its locked rule to a new world',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'模组中心'}).click();
  await page.getByLabel('加载模组清单').setInputFiles({name:'growth.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({schemaVersion:1,id:'dry-season',version:'1.0.0',name:'旱季',rules:{initialGrowth:25}}))});
  await page.getByRole('button',{name:'锁定模组并创建世界'}).click();
  await page.getByRole('button',{name:'让世界诞生'}).click();
  await page.getByRole('button',{name:'偏好设置',exact:true}).click();
  await expect(page.getByLabel('生态再生倍率')).toHaveValue('25');
});
test('renders and steps a 256 squared world with 100 residents',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Heap measurement uses Chrome DevTools.');
  const duration=Number(process.env.MC_STRESS_MS??60000);
  test.setTimeout(duration+40000);
  const world=createWorld({name:'大地图验收',seed:'benchmark-rain',size:256,population:100,preset:'continent'});
  await page.goto('/');
  const started=Date.now();
  await page.locator('input[type=file]').setInputFiles({name:'large.mcworld',mimeType:'application/json',buffer:Buffer.from(serializeArchive(world))});
  await expect(page.locator('.map-host canvas')).toBeVisible({timeout:10000});
  const renderMs=Date.now()-started;
  const stepStarted=Date.now();
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  const stepMs=Date.now()-stepStarted;
  await page.getByLabel('地图图层').selectOption('fertility');
  await expect(page.locator('.map-error')).toHaveCount(0);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const heapBefore=(await cdp.send('Runtime.getHeapUsage')).usedSize;
  await page.getByRole('button',{name:'24×',exact:true}).click();
  await page.getByRole('button',{name:'开始模拟'}).click();
  const heapSamples:number[]=[];
  const samples:Promise<void>[]=[];
  const sampler=setInterval(()=>{
    samples.push(cdp.send('HeapProfiler.collectGarbage').then(()=>cdp.send('Runtime.getHeapUsage')).then(result=>{heapSamples.push(result.usedSize);}));
  },60000);
  const frameStats=await page.evaluate(duration=>new Promise<{fps:number;p95FrameMs:number}>(resolve=>{
    const frames:number[]=[];
    requestAnimationFrame(start=>{
      let previous=start;
      function collect(now:number){
        frames.push(now-previous);
        previous=now;
        if(now-start<duration){requestAnimationFrame(collect);return;}
        const count=frames.length;
        frames.sort((a,b)=>a-b);
        resolve({fps:Math.round(count*1000/(now-start)),p95FrameMs:Math.round(frames[Math.floor((count-1)*.95)])});
      }
      requestAnimationFrame(collect);
    });
  }),duration).finally(()=>clearInterval(sampler));
  await Promise.all(samples);
  await page.getByRole('button',{name:'暂停模拟'}).click();
  await cdp.send('HeapProfiler.collectGarbage');
  const heapAfter=(await cdp.send('Runtime.getHeapUsage')).usedSize;
  expect(frameStats.fps).toBeGreaterThan(0);
  expect(Number((await page.locator('.stat').last().locator('strong').innerText()).replace(/[^0-9]/g,''))).toBeGreaterThan(1);
  console.log({size:256,population:100,renderMs,stepMs,...frameStats,heapBefore,heapSamples,heapAfter});
});
test('edits three resources and orders a building in the real observation UI',async({page})=>{
  const world=createWorld({name:'创造者验收',seed:'rain-river',size:64,population:1,preset:'continent'});
  const agent=world.agents[0];
  const tile=10*64+11;
  for(const index of [tile-1,tile])Object.assign(world.tiles[index],{biome:'grass',walkable:true});
  Object.assign(agent,{x:10,y:10,settlement:100001});
  world.settlements=[{id:100001,name:'工坊营地',x:10,y:10,founded:0,members:[agent.id],food:0,wood:100,buildings:[],knowledge:0,technology:[]}];
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'creator.mcworld',mimeType:'application/json',buffer:Buffer.from(serializeArchive(world))});
  await page.getByRole('button',{name:/工坊营地 ↗/}).click();
  await page.locator('.mini-map').press('ArrowRight');
  await page.getByText('创造者工具',{exact:true}).click();
  await page.getByLabel('地形画笔').selectOption('forest');
  await page.getByRole('button',{name:'绘制地形'}).click();
  await expect(page.locator('.inspector h2')).toContainText('森林');
  await page.getByLabel('食物',{exact:true}).fill('77');
  await page.getByLabel('木材',{exact:true}).fill('88');
  await page.getByLabel('石材',{exact:true}).fill('99');
  await page.getByRole('button',{name:'应用资源数量'}).click();
  await expect(page.locator('.tile-values')).toContainText('77 /');
  await page.getByText('建造与生产',{exact:true}).click();
  await page.getByRole('button',{name:/建造工坊/}).click();
  await expect(page.getByLabel(/工坊建造进度/)).toHaveAttribute('value','0');
});
test('exports a history package and imports its checkpoints into an independent archive',async({page})=>{
  const world=createWorld({name:'跨设备历史',seed:'rain-river',size:64,population:0,preset:'continent'});
  await page.goto('/');
  const file=page.locator('input[type=file]');
  await file.setInputFiles({name:'source.mcworld',mimeType:'application/json',buffer:Buffer.from(serializeArchive(world))});
  await expect(page.getByRole('button',{name:'单步推进'})).toBeEnabled();
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await page.getByRole('button',{name:'编年史',exact:true}).click();
  const exported=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出历史包'}).click();
  const history=await exported;
  expect(history.suggestedFilename()).toBe('world.mchistory');
  const path=await history.path();
  expect(path).toBeTruthy();
  page.once('dialog',dialog=>void dialog.accept());
  await file.setInputFiles({name:history.suggestedFilename(),mimeType:'application/json',buffer:await import('node:fs/promises').then(fs=>fs.readFile(path!))});
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await expect(page.locator('.save-state')).toContainText('已保存');
  await page.getByRole('button',{name:'编年史',exact:true}).click();
  const checkpoints=page.locator('select[aria-label="历史检查点"]:enabled');
  await expect(checkpoints.locator('option')).toHaveText(['选择检查点',/^Tick 0 · /]);
});

test('migrates old preferences and persists the third theme',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('mc-theme','light');localStorage.setItem('mc-reduced','true');});
  await page.goto('/');
  await page.getByRole('button',{name:'偏好设置',exact:true}).click();
  await expect(page.getByLabel('主题',{exact:true})).toHaveValue('light');
  await expect(page.getByLabel('减少动态效果')).toBeChecked();
  await page.getByLabel('主题',{exact:true}).selectOption('dusk');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dusk');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dusk');
});
test('pauses in a hidden tab and restores an independent recovery draft',async({page})=>{
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button',{name:'创造新世界'}).click();
  await page.getByLabel('世界名称').fill('恢复草稿测试');
  await page.getByRole('button',{name:'让世界诞生'}).click();
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button',{name:'开始模拟'}).click();
  await page.clock.runFor(800);
  await expect.poll(()=>page.evaluate(()=>new Promise<number>(resolve=>{
    const request=indexedDB.open('microcivilization-worlds');
    request.onsuccess=()=>{
      const db=request.result;
      const result=db.transaction('recovery','readonly').objectStore('recovery').count();
      result.onsuccess=()=>{db.close();resolve(result.result);};
    };
  }))).toBe(1);
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await page.reload();
  await page.getByRole('button',{name:'恢复为独立档案'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await expect(page.locator('.save-state')).toContainText('已保存');
});

test('recovers a stopped worker from the last confirmed tick',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker{
      constructor(url:string|URL,options?:WorkerOptions){
        super(url,options);
        if(!String(url).includes('sim-worker'))return;
        window.addEventListener('stop-simulation-test',()=>this.dispatchEvent(new ErrorEvent('error',{cancelable:true})),{once:true});
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button',{name:'创造新世界'}).click();
  await page.getByRole('button',{name:'让世界诞生'}).click();
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  await page.evaluate(()=>window.dispatchEvent(new Event('stop-simulation-test')));
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('2:00');
});
test('keyboard skips to content and reaches the settings navigation',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('link',{name:'跳到主内容'})).toBeAttached();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'跳到主内容'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#workspace')).toBeFocused();
  const nav=page.getByRole('navigation',{name:'实验工作台'});
  await expect(nav.getByRole('button',{name:'世界档案'})).toHaveAttribute('aria-current','page');
  await nav.getByRole('button',{name:'偏好设置'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'你的观察方式。'})).toBeVisible();
  await expect(nav.getByRole('button',{name:'偏好设置'})).toHaveAttribute('aria-current','page');
});
for(const ordered of [true,false])test(`preserves the full archive hash through compact frames with ${ordered?'generated':'imported'} field order`,async({page})=>{
  const world=createWorld({name:'快照校验',seed:'rain-river',size:64,population:4,preset:'continent'});
  if(!ordered)world.tiles=world.tiles.map(tile=>Object.fromEntries(Object.entries(tile).reverse()) as typeof tile);
  const expected=structuredClone(world);
  advance(expected,1);
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'order.mcworld',mimeType:'application/json',buffer:Buffer.from(serializeArchive(world))});
  await page.getByRole('button',{name:'单步推进'}).click();
  await expect(page.locator('.world-toolbar p')).toContainText('1:00');
  const exported=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出',exact:true}).click();
  const path=await (await exported).path();
  const text=await import('node:fs/promises').then(fs=>fs.readFile(path!,'utf8'));
  expect(JSON.stringify(JSON.parse(text).world)).toBe(JSON.stringify(expected));
});
