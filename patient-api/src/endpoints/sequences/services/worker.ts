import SequenceRunWorker from '../../../services/sequence/SequenceRunWorker';

// Lazy-initialize the sequence run worker (only created after first use, i.e. after DB is connected)
let _sequenceRunWorker: SequenceRunWorker | null = null;

export function getSequenceRunWorker(): SequenceRunWorker {
  if (!_sequenceRunWorker) {
    _sequenceRunWorker = new SequenceRunWorker();
    console.log('✅ Sequence run worker initialized');
  }
  return _sequenceRunWorker;
}

// Backward-compatible named export - wraps lazy getter
export const sequenceRunWorker = {
  enqueueRun: (runId: string) => getSequenceRunWorker().enqueueRun(runId),
};

