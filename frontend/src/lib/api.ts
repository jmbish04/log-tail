export interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
}

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: import.meta.env.VITE_API_URL ?? '',
  apiKey: import.meta.env.VITE_API_KEY,
};

export function getApiConfig(): ApiConfig {
  return DEFAULT_CONFIG;
}

export async function fetchJson<T>(
  input: RequestInfo,
  init: RequestInit = {},
): Promise<T> {
  const config = getApiConfig();
  const headers = new Headers(init.headers);
  if (config.apiKey && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${config.apiKey}`);
  }
  headers.set('Content-Type', 'application/json');

  const response = await fetch(
    typeof input === 'string' && !input.startsWith('http')
      ? `${config.baseUrl}${input}`
      : input,
    {
      ...init,
      headers,
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}
