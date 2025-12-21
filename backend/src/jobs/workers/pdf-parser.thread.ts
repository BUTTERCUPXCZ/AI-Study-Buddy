import { Worker } from 'worker_threads';
import path from 'path';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parsePdfInWorker(buffer: Buffer) {
  return new Promise<{ text: string; pageCount: number }>((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'pdf-parser.worker.js'));

    worker.postMessage(buffer);

    worker.once('message', (result: unknown) => {
      // Normalize and validate worker result safely
      if (isRecord(result)) {
        const resObj = result;

        if ('error' in resObj && resObj.error !== undefined) {
          const errVal = resObj.error;
          let message: string;

          if (typeof errVal === 'string') {
            message = errVal;
          } else if (errVal instanceof Error) {
            message = errVal.message;
          } else if (isRecord(errVal)) {
            if ('message' in errVal && typeof errVal['message'] === 'string') {
              message = errVal['message'];
            } else {
              message = 'Unknown error object';
            }
          } else {
            // errVal is not an object here; convert safely
            // Fallback for unknown non-object error values
            message = 'Unknown error value';
          }

          reject(new Error(message));
          return;
        }

        if ('text' in resObj && 'pageCount' in resObj) {
          const textVal = resObj.text;
          const pageCountVal = resObj.pageCount;

          if (typeof textVal === 'string' && typeof pageCountVal === 'number') {
            resolve({ text: textVal, pageCount: pageCountVal });
            return;
          }
        }
      }

      reject(new Error('Invalid worker response'));
    });

    worker.once('error', reject);

    worker.once('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`PDF parser worker exited with code ${code}`));
      }
    });
  });
}
