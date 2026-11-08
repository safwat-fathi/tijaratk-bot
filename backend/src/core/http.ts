import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { type ZodType, z } from 'zod';

/** FastAPI-shaped errors: `{ "detail": ... }`, so the frontend keeps working unchanged. */
export class ApiError extends HttpException {
  constructor(status: number, detail: unknown, headers?: Record<string, string>) {
    super({ detail }, status);
    this.headers = headers;
  }
  headers?: Record<string, string>;
}

export const notFound = (detail: string) => new ApiError(404, detail);

@Catch()
export class DetailExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('http');
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof ApiError) {
      if (exception.headers) res.set(exception.headers);
      return res.status(exception.getStatus()).json(exception.getResponse());
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail = typeof body === 'object' && body && 'message' in body ? (body as any).message : body;
      return res.status(status).json({ detail });
    }
    this.log.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return res.status(500).json({ detail: 'Internal Server Error' });
  }
}

/** Parses with zod, throwing FastAPI's 422 shape on failure. */
export function parse<S extends ZodType>(schema: S, data: unknown, where: 'body' | 'query' = 'body'): z.output<S> {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  throw new ApiError(
    422,
    r.error.issues.map((i) => ({ loc: [where, ...i.path], msg: i.message, type: i.code })),
  );
}
