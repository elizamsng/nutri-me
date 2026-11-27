import type { IncomingMessage, ServerResponse } from 'http';

const MEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1';
const MEALDB_API_KEY = process.env.MEALDB_API_KEY || '1';
const MEALDB_URL = `${MEALDB_BASE_URL}/${MEALDB_API_KEY}`;
const OFF_USER_AGENT = 'YourApp/1.0 (your-app.vercel.app)';
const FETCH_TIMEOUT_MS = 9500;

type ApiRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = ServerResponse & {
  status?: (code: number) => ApiResponse;
  json?: (body: unknown) => void;
};

function sendJson(res: ApiResponse, statusCode: number, body: unknown): void {
  if (typeof res.status === 'function') {
    const statusRes = res.status(statusCode);
    if (typeof statusRes.json === 'function') {
      statusRes.json(body);
      return;
    }
  }
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function fetchJsonWithTimeout(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    });
    if (!response.ok) {
      throw new Error(`Upstream API responded with status ${response.status}`);
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Upstream API returned invalid JSON');
    }
  } finally {
    clearTimeout(timer);
  }
}

function getQueryParam(req: ApiRequest, key: string): string {
  if (req.query && req.query[key] !== undefined) {
    const val = req.query[key];
    return Array.isArray(val) ? String(val[0] ?? '') : String(val);
  }
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return url.searchParams.get(key) || '';
  } catch {
    return '';
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const checkApis = getQueryParam(req, 'checkApis') === 'true';
  if (!checkApis) {
    sendJson(res, 200, {
      ok: true,
      service: 'nutri-me',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const checks = await Promise.all([
    fetchJsonWithTimeout(`${MEALDB_URL}/filter.php?i=chicken_breast`)
      .then((data) => ({
        service: 'TheMealDB',
        connected: Array.isArray(data?.meals) && data.meals.length > 0,
        count: Array.isArray(data?.meals) ? data.meals.length : 0,
      }))
      .catch((err: Error) => ({
        service: 'TheMealDB',
        connected: false,
        error: err.message,
      })),
    fetchJsonWithTimeout('https://wger.de/api/v2/exerciseinfo/?language=2&limit=5')
      .then((data) => ({
        service: 'Wger Exercise',
        connected: Array.isArray(data?.results) && data.results.length > 0,
        count: Array.isArray(data?.results) ? data.results.length : 0,
      }))
      .catch((err: Error) => ({
        service: 'Wger Exercise',
        connected: false,
        error: err.message,
      })),
    fetchJsonWithTimeout(
      'https://world.openfoodfacts.org/api/v2/product/3017624010701.json?fields=product_name,brands,nutriscore_grade',
      { 'User-Agent': OFF_USER_AGENT }
    )
      .then((data) => ({
        service: 'Open Food Facts',
        connected: data?.status === 1 && Boolean(data?.product?.product_name),
        sample: data?.product?.product_name ?? '',
      }))
      .catch((err: Error) => ({
        service: 'Open Food Facts',
        connected: false,
        error: err.message,
      })),
  ]);

  sendJson(res, 200, {
    ok: checks.every((c) => c.connected),
    apis: checks,
    timestamp: new Date().toISOString(),
  });
}
