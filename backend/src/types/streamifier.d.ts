// Type declaration for streamifier
declare module 'streamifier' {
  import type { Readable } from 'stream';
  // eslint-disable-next-line no-unused-vars
  export function createReadStream(buffer: Buffer): Readable;
}
