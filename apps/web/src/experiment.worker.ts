/// <reference lib="webworker" />
import {runExperiment, type ExperimentConfig, type ExperimentUpdate} from './experiment';

self.onmessage = (event: MessageEvent<ExperimentConfig>) => {
  try {
    runExperiment(event.data, update => self.postMessage(update));
    self.postMessage({type: 'done'} satisfies ExperimentUpdate);
  } catch (error) {
    self.postMessage({type: 'error', message: error instanceof Error ? error.message : String(error)} satisfies ExperimentUpdate);
  }
};
