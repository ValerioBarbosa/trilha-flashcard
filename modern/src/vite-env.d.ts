/// <reference types="vite/client" />

declare module 'pdfjs-dist/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(source: { data: Uint8Array }): { promise: Promise<any> };
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const url: string;
  export default url;
}
