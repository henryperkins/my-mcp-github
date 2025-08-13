// src/utils/pagination.ts
export const encodeCursor = (o: any) =>
  Buffer.from(JSON.stringify(o)).toString("base64");

export const decodeCursor = (c?: string) =>
  c ? JSON.parse(Buffer.from(c, "base64").toString()) : {};