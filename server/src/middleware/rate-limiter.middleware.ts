import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

class MemoryRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodic cleanup of stale entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.records.entries()) {
        if (record.resetAt <= now) {
          this.records.delete(key);
        }
      }
    }, 300000);
  }

  public check(key: string): { allowed: boolean; remaining: number; retryAfterSec: number } {
    const now = Date.now();
    const record = this.records.get(key);

    if (!record || record.resetAt <= now) {
      this.records.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, retryAfterSec: 0 };
    }

    if (record.count >= this.maxRequests) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    record.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      retryAfterSec: 0,
    };
  }

  public reset(key: string): void {
    this.records.delete(key);
  }
}

// 10 requests per minute for authentication endpoints
export const authLimiterInstance = new MemoryRateLimiter(10, 60000);

// 60 requests per minute for username checks
export const searchLimiterInstance = new MemoryRateLimiter(60, 60000);

export function authRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { allowed, retryAfterSec } = authLimiterInstance.check(`auth:${ip}`);

  if (!allowed) {
    res.setHeader('Retry-After', retryAfterSec);
    res.status(429).json({
      error: 'Too many requests. Please wait before trying again.',
      retryAfter: retryAfterSec,
    });
    return;
  }

  next();
}

export function searchRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { allowed, retryAfterSec } = searchLimiterInstance.check(`search:${ip}`);

  if (!allowed) {
    res.setHeader('Retry-After', retryAfterSec);
    res.status(429).json({
      error: 'Rate limit exceeded for username inquiries.',
      retryAfter: retryAfterSec,
    });
    return;
  }

  next();
}
