import {advance, applyCommand, createWorld, stateHash, type WorldConfig} from '../../../packages/sim-core/src/index.ts';

export interface ExperimentConfig extends Pick<WorldConfig, 'size' | 'preset' | 'population'> {
  seeds: readonly string[];
  days: number;
  growthA: number;
  growthB: number;
  populationB?:number;
  presetB?:WorldConfig['preset'];
}

export const experimentMetrics = [
  ['population', '存活居民'],
  ['food', '地表食物'],
  ['settlements', '聚落'],
  ['births', '累计出生'],
  ['deaths', '累计死亡'],
  ['harvested', '累计采集'],
] as const;
type MetricKey = typeof experimentMetrics[number][0];
export type Endpoint = Record<MetricKey, number> & {tick: number; hash: string; engine: string; frames:{tick:number;food:Uint16Array}[]};
export type ExperimentPair = {seed: string; a: Endpoint; b: Endpoint};
export type ExperimentUpdate =
  | {type: 'progress'; completed: number; total: number}
  | {type: 'pair'; pair: ExperimentPair}
  | {type: 'done'}
  | {type: 'error'; message: string};

export function parseExperimentSeeds(value: string) {
  const seeds = [...new Set(value.split(/\r?\n/).map(seed => seed.trim()).filter(Boolean))];
  if (!seeds.length || seeds.length > 20 || seeds.some(seed => seed.length > 128)) {
    throw new Error('请输入 1–20 个不同的种子，每行一个，每个种子最多 128 个字符。');
  }
  return seeds;
}

export function runExperiment(config: ExperimentConfig, onUpdate?: (update: ExperimentUpdate) => void) {
  const {seeds, size, preset, population, days, growthA, growthB} = config;
  if (!Number.isInteger(days) || days < 1 || days > 3600) throw new Error('模拟时长须为 1–3600 天。');
  const total = seeds.length * 2 * days;
  let completed = 0;
  function runGroup(seed:string,growth:number,population:number,preset:WorldConfig['preset']): Endpoint {
    const world = createWorld({name: '对照实验', seed, size, population, preset});
    if (growth !== world.rules.growth) applyCommand(world, {type: 'setGrowth', value: growth});
    const frames:Endpoint['frames']=[];
    const snapshot=()=>frames.push({tick:world.tick,food:Uint16Array.from(world.tiles,tile=>tile.food)});
    snapshot();
    const interval=Math.ceil(days/12);
    for(let day=0;day<days;){
      const chunk=Math.min(30,days-day,interval-day%interval);
      advance(world, chunk * 24);
      day+=chunk;
      if(day%interval===0||day===days)snapshot();
      completed += chunk;
      onUpdate?.({type: 'progress', completed, total});
    }
    const {tick, population: alive, food, settlements, births = 0, deaths = 0, harvested} = world.metrics.at(-1)!;
    return {tick, population: alive, food, settlements, births, deaths, harvested, hash: stateHash(world), engine: world.engine,frames};
  }
  return seeds.map(seed => {
    const pair = {seed, a:runGroup(seed,growthA,population,preset),b:runGroup(seed,growthB,config.populationB??population,config.presetB??preset)};
    onUpdate?.({type: 'pair', pair});
    return pair;
  });
}

export function summarizeExperiment(pairs: ExperimentPair[]) {
  return experimentMetrics.map(([key, label]) => {
    const a = pairs.reduce((sum, pair) => sum + pair.a[key], 0) / pairs.length;
    const b = pairs.reduce((sum, pair) => sum + pair.b[key], 0) / pairs.length;
    return {key, label, a, b, delta: b - a};
  });
}

export function experimentCsv(config: ExperimentConfig, pairs: ExperimentPair[]) {
  const header = ['seed', 'group', 'engine', 'size', 'preset', 'initial_population', 'days', 'growth_percent', 'tick', ...experimentMetrics.map(([key]) => key), 'state_hash'];
  const rows = pairs.flatMap(({seed, a, b}) => {
    const safeSeed = /^[=+\-@\t\r\n＝＋－＠]/u.test(seed) ? "'" + seed : seed;
    return ([['A', a, config.growthA], ['B', b, config.growthB]] as const).map(([group, endpoint, growth]) =>
      ['"' + safeSeed.replaceAll('"', '""') + '"', group, endpoint.engine, config.size, group==='B'?config.presetB??config.preset:config.preset, group==='B'?config.populationB??config.population:config.population, config.days, growth,
        endpoint.tick, ...experimentMetrics.map(([key]) => endpoint[key]), endpoint.hash].join(','),
    );
  });
  return [header.join(','), ...rows].join('\r\n');
}
