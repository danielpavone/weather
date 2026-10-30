export function resolveTrustProxy(raw: string | undefined = process.env.TRUST_PROXY): false | number {
  if (raw === undefined || raw.trim() === '') {
    return false;
  }

  const value = raw.trim().toLowerCase();
  if (value === 'false' || value === 'off' || value === '0') {
    return false;
  }

  if (/^[1-9]\d*$/.test(value)) {
    return Number(value);
  }

  throw new Error(
    'TRUST_PROXY deve ser false ou um número de hops (ex.: 1). O valor true não é aceito porque confiaria em qualquer cliente.',
  );
}
