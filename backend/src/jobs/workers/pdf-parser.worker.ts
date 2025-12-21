import { parentPort } from 'worker_threads';
import { PdfParserUtil } from '../utils/pdf-parser.util';

if (!parentPort) {
  throw new Error('pdf-parser.worker must be run as a worker thread');
}

const port = parentPort;

port.on('message', (buffer: Buffer) => {
  void (async () => {
    try {
      const result = (await PdfParserUtil.extractTextFromBuffer(buffer)) as {
        text: string;
        pageCount: number;
      };

      const { text, pageCount } = result;
      port.postMessage({ text, pageCount });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      port.postMessage({ error: message });
    }
  })();
});
