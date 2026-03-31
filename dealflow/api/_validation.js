export class RequestValidationError extends Error {
  constructor(message, { field = null, statusCode = 400 } = {}) {
    super(message);
    this.name = 'RequestValidationError';
    this.field = field;
    this.statusCode = statusCode;
  }
}

function fail(message, options = {}) {
  throw new RequestValidationError(message, options);
}

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeNonEmptyString(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

export function requireObjectBody(req, res) {
  if (!isPlainObject(req?.body)) {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return null;
  }
  return req.body;
}

export function expectPlainObject(value, field, { allowEmpty = true } = {}) {
  if (!isPlainObject(value)) {
    fail(`${field} must be an object`, { field });
  }

  if (!allowEmpty && Object.keys(value).length === 0) {
    fail(`${field} must not be empty`, { field });
  }

  return value;
}

export function expectNonEmptyString(value, field) {
  if (typeof value !== 'string') {
    fail(`${field} must be a string`, { field });
  }

  const trimmed = value.trim();
  if (!trimmed) {
    fail(`${field} is required`, { field });
  }

  return trimmed;
}

export function expectOptionalString(value, field, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  return expectNonEmptyString(value, field);
}

export function expectArray(value, field, { allowEmpty = true, fallback = undefined } = {}) {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    fail(`${field} must be an array`, { field });
  }

  if (!Array.isArray(value)) {
    fail(`${field} must be an array`, { field });
  }

  if (!allowEmpty && value.length === 0) {
    fail(`${field} must not be empty`, { field });
  }

  return value;
}

export function expectEnum(value, field, allowedValues) {
  const normalized = expectNonEmptyString(String(value ?? ''), field);
  if (!allowedValues.includes(normalized)) {
    fail(`${field} must be one of: ${allowedValues.join(', ')}`, { field });
  }
  return normalized;
}

export function expectBooleanish(value, field, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  fail(`${field} must be true or false`, { field });
}

export function expectOptionalNumber(
  value,
  field,
  { integer = false, min = null, max = null, fallback = null } = {}
) {
  if (value === undefined || value === null || value === '') return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    fail(`${field} must be a valid number`, { field });
  }
  if (integer && !Number.isInteger(parsed)) {
    fail(`${field} must be an integer`, { field });
  }
  if (min !== null && parsed < min) {
    fail(`${field} must be at least ${min}`, { field });
  }
  if (max !== null && parsed > max) {
    fail(`${field} must be at most ${max}`, { field });
  }

  return parsed;
}

export function sendValidationError(res, error) {
  return res.status(error?.statusCode || 400).json({
    error: 'Invalid request',
    message: error?.message || 'Request validation failed',
    ...(error?.field ? { field: error.field } : {})
  });
}
