import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseExperimentSeeds, runExperiment, summarizeExperiment} from './experiment.ts';

test('experiment seeds are ordered, unique and bounded', () => {
  assert.deepEqual(parseExperimentSeeds(' rain-river\n atlas\r\nrain-river\n'), ['rain-river', 'atlas']);
  assert.throws(() => parseExperimentSeeds(' \n '));
  assert.throws(() => parseExperimentSeeds('x'.repeat(129)));
  assert.throws(() => parseExperimentSeeds(Array.from({length: 21}, (_, index) => index).join('\n')));
});

test('a batch uses paired seeds, real simulation and reproducible controls', () => {
  const config = {seeds: ['rain-river', 'atlas'], size: 64, preset: 'continent', population: 24, days: 2, growthA: 100, growthB: 100} as const;
  const results = runExperiment(config);
  assert.deepEqual(results.map(pair => pair.seed), config.seeds);
  for (const pair of results) {
    assert.equal(pair.a.tick, 48);
    assert.ok(pair.a.harvested > 0);
    assert.deepEqual(pair.a, pair.b);
  }
  assert.deepEqual(runExperiment(config), results);
  assert.ok(summarizeExperiment(results).every(metric => metric.delta === 0));
  const changed = runExperiment({...config, days: 10, growthB: 0});
  assert.ok(changed.some(pair => pair.a.food > pair.b.food));
});
