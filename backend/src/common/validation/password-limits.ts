/**
 * bcrypt hashes only the first 72 bytes and silently ignores the rest, so a
 * longer password would be accepted and then quietly weakened. Bytes, not
 * characters: a Turkish `ş` is two.
 */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

/**
 * Cap on passwords that are only *checked* (login, current password). It must
 * not be 72 bytes: accounts created before the cap may hold longer passwords,
 * and those users still need to sign in.
 */
export const MAX_SUBMITTED_PASSWORD_LENGTH = 1024;
