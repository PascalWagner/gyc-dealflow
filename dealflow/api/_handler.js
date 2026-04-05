/**
 * Wraps a Vercel serverless handler with automatic Sentry error capture.
 * Prevents silent failures on endpoints that don't import _sentry.js directly.
 *
 * Usage:
 *   import { withErrorCapture } from './_handler.js';
 *
 *   export default withErrorCapture(async (req, res) => {
 *     // handler logic
 *   }, 'endpoint-name');
 */
import { captureApiError } from './_sentry.js';

export function withErrorCapture(handler, endpoint) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      captureApiError(err, { endpoint, method: req.method });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}
