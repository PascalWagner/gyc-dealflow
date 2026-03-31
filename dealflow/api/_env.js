export function requireServerEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

export function optionalServerEnv(name, fallback = '') {
  const value = process.env[name];
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  return value.trim();
}

export function requireAnyServerEnv(names) {
  for (const name of names) {
    const value = optionalServerEnv(name, '');
    if (value) return value;
  }
  throw new Error(`Missing required server environment variable: one of ${names.join(', ')}`);
}
