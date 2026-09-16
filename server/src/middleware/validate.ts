import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { badRequest, ErrorCodes } from '../utils/errors.js';

type Source = 'body' | 'query' | 'params';

function formatZodError(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/**
 * Parses and REPLACES the request payload with the validated result, so
 * controllers always receive typed, coerced, trimmed data and never the raw
 * input. Unknown keys are stripped by zod, which keeps mass-assignment
 * impossible.
 */
export function validate<T extends ZodTypeAny>(schema: T, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        badRequest(
          ErrorCodes.VALIDATION_ERROR,
          'Verifique os campos informados.',
          formatZodError(result.error),
        ),
      );
      return;
    }

    if (source === 'query') {
      // req.query is a getter in Express 5 and read-only in some setups.
      Object.defineProperty(req, 'validatedQuery', { value: result.data, writable: true });
    } else {
      req[source] = result.data as never;
    }
    next();
  };
}

/** Typed accessor for values validated from the query string. */
export function validatedQuery<T>(req: Request): T {
  return (req as Request & { validatedQuery?: T }).validatedQuery as T;
}

export type Validated<T extends ZodTypeAny> = z.infer<T>;
