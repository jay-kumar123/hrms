import type { NextFunction, Request, Response } from "express";

export function requireProperty(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const propertyId = req.headers["x-property-id"] as string | undefined;
  if (propertyId) {
    (req as any).propertyId = propertyId;
  }
  next();
}

export const requirePropertyContext = requireProperty;
