import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { badRequest } from "../utils/errors.js";

type Schemas = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.defineProperty(req, 'query', { value: schemas.query.parse(req.query), configurable: true });
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request["params"];
      return next();
    } catch (error) {
      return next(badRequest(error instanceof Error ? error.message : "Invalid request", "VALIDATION_ERROR"));
    }
  };
}
