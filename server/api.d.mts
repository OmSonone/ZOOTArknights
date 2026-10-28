import type { IncomingMessage, ServerResponse } from "node:http";

export function handleImportApi(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
export function importApiMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
): void;
