// Type declaration for Express Multer File
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  stream?: NodeJS.ReadableStream;
}

declare module 'express-serve-static-core' {
  interface Multer {
    File: MulterFile;
  }
}
