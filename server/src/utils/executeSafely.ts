import { Response, NextFunction } from "express";

export type ExecutorOptions<T = unknown> = {
  successStatus?: number;
  onEmpty?: { status: number; message?: string } | null;
  contentType?: string;
  transform?: (data: T) => unknown;
};

/**
 * Execute a service call, send a standardized successful response or handle empty results,
 * and forward errors to the global error handler via `next`.
 *
 * Usage: return executeSafely(() => Service.getX(id), res, next, { successStatus: 200 });
 */
export async function executeSafely<T>(
  fn: () => Promise<T>,
  res: Response,
  next: NextFunction,
  opts: ExecutorOptions<T> = {}
): Promise<void> {
  try {
    const data = await fn();

    const isEmpty =
      data === null ||
      data === undefined ||
      (Array.isArray(data) && data.length === 0);

    if (isEmpty && opts.onEmpty) {
      res
        .status(opts.onEmpty.status)
        .json({ message: opts.onEmpty.message ?? "Not found" });
      return;
    }

    if (opts.contentType) res.type(opts.contentType);

    const payload = opts.transform ? opts.transform(data) : data;
    res.status(opts.successStatus ?? 200).json(payload);
  } catch (err) {
    next(err);
  }
}

export default executeSafely;
