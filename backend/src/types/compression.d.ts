/* eslint-disable no-unused-vars */
declare module 'compression' {
  import type { RequestHandler, Request, Response } from 'express';

  interface CompressionOptions {
    level?: number;
    threshold?: number | string;
    filter?(_req: Request, _res: Response): boolean;
    chunkSize?: number;
    memLevel?: number;
    strategy?: number;
    flush?: number;
    finishFlush?: number;
    windowBits?: number;
  }

  function compression(_options?: CompressionOptions): RequestHandler;

  export = compression;
}


