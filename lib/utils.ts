// Canonical stored/compared form is the bare 11-digit local number (no +88) —
// strip it here so "01712345678" and "+8801712345678" are always the same
// phone everywhere (DB writes, OTP lookup, session/authorization checks).
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '').replace(/^\+88/, '');
}

export const PHONE_VALIDATION_MESSAGE = 'Enter an 11-digit phone number, excluding the optional +88 prefix';

export function isValidPhone(phone: unknown): phone is string {
  return typeof phone === 'string' && /^(?:\+88)?\d{11}$/.test(normalizePhone(phone));
}

