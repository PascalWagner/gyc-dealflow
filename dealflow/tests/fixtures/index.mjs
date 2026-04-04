/**
 * Shared test fixtures — pure Node exports only.
 * Playwright-dependent fixtures (browser-session, api-mocks) are separate imports.
 */

export { base64UrlEncode, fakeJwt, decodeAuthEmail } from './jwt.mjs';
export { makeSessionUser, makeAdminSession } from './session.mjs';
export { withFixedNow } from './time.mjs';
