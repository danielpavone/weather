const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function resolveCorsOrigins(raw: string | undefined = process.env.CORS_ORIGIN): string[] {
  if (raw === undefined || raw.trim() === '') {
    return [...DEFAULT_DEV_ORIGINS];
  }

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');

  if (origins.some((origin) => origin === '*')) {
    throw new Error('CORS_ORIGIN não aceita *. Informe origens explícitas, separadas por vírgula.');
  }

  if (origins.length === 0) {
    return [...DEFAULT_DEV_ORIGINS];
  }

  for (const origin of origins) {
    if (!isExplicitHttpOrigin(origin)) {
      throw new Error(
        `CORS_ORIGIN contém uma origem inválida: ${origin}. Use http(s)://host[:porta], sem caminho.`,
      );
    }
  }

  return origins;
}

function isExplicitHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}
