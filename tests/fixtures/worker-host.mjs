import {parentPort} from 'node:worker_threads';
globalThis.self={postMessage:(message,transfer)=>parentPort.postMessage(message,transfer)};
await import('../../packages/sim-worker/src/worker.ts');
parentPort.on('message',data=>globalThis.self.onmessage({data}));
