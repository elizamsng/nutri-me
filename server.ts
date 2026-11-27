import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import healthHandler from './api/health.ts';
import nutriHandler from './api/nutri.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1';
const MEALDB_API_KEY = process.env.MEALDB_API_KEY || '1';
const MEALDB_URL = `${MEALDB_BASE_URL}/${MEALDB_API_KEY}`;
const OFF_USER_AGENT = 'YourApp/1.0 (your-app.vercel.app)';
const FETCH_TIMEOUT_MS = 9500;

interface WgerTranslation {
  id: number;
  name: string;
  description: string;
  description_source?: string;
  language: number;
}

interface WgerCategory {
  id: number;
  name: string;
}

interface WgerEquipment {
  id: number;
  name: string;
}

interface WgerMuscle {
  id: number;
  name: string;
  name_en?: string;
  is_front?: boolean;
}

interface WgerImage {
  id: number;
  image: string;
  is_main: boolean;
}

interface WgerExerciseRaw {
  id: number;
  uuid: string;
  category: WgerCategory;
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: WgerEquipment[];
  images: WgerImage[];
  translations: WgerTranslation[];
}

function stripHtmlToSteps(html: string): string[] {
  if (!html) return [];
  const withLineBreaks = html
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  const decoded = withLineBreaks
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return decoded
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function estimateKcalPerMinute(categoryName: string, equipmentList: WgerEquipment[]): number {
  const cat = categoryName.toLowerCase();
  let base = 5.2;
  if (cat.includes('cardio')) base = 8.6;
  else if (cat.includes('leg')) base = 6.5;
  else if (cat.includes('back') || cat.includes('chest')) base = 5.8;
  else if (cat.includes('abs')) base = 4.8;
  else if (cat.includes('shoulder')) base = 5.0;
  else if (cat.includes('arm') || cat.includes('calv')) base = 4.2;

  const hasHeavyGear = equipmentList.some((eq) =>
    /barbell|kettlebell|pull-up/i.test(eq.name)
  );
  if (hasHeavyGear) base += 0.8;
  return Number(base.toFixed(1));
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

async function createServer() {
  const app = express();
  app.use(express.json());

  // Root /api/health and /api/nutri handlers (shared with Vercel /api/*.ts functions)
  app.get('/api/health', (req, res) => {
    void healthHandler(
      req as unknown as Parameters<typeof healthHandler>[0],
      res as unknown as Parameters<typeof healthHandler>[1]
    );
  });

  app.get('/api/nutri', (req, res) => {
    void nutriHandler(
      req as unknown as Parameters<typeof nutriHandler>[0],
      res as unknown as Parameters<typeof nutriHandler>[1]
    );
  });

  // --- Wger Exercise API Proxy ---
  app.get('/api/wger/meta', async (_req, res) => {
    try {
      const [categoriesRes, equipmentRes] = await Promise.all([
        fetchJsonWithTimeout('https://wger.de/api/v2/exercisecategory/'),
        fetchJsonWithTimeout('https://wger.de/api/v2/equipment/'),
      ]);

      res.json({
        categories: categoriesRes?.results ?? [],
        equipment: equipmentRes?.results ?? [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load exercise metadata';
      res.status(502).json({ error: `Unable to reach Wger metadata API: ${message}` });
    }
  });

  app.get('/api/wger/exercises', async (req, res) => {
    try {
      const parseIdList = (val: unknown): string[] =>
        typeof val === 'string'
          ? val
              .split(',')
              .map((s) => s.trim())
              .filter((s) => /^\d+$/.test(s))
          : [];

      const categoryIds = parseIdList(req.query.category);
      const equipmentIds = parseIdList(req.query.equipment);
      const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 45, 10), 80);

      let rawResults: WgerExerciseRaw[] = [];

      if (categoryIds.length <= 1 && equipmentIds.length <= 1) {
        const params = new URLSearchParams({
          language: '2',
          limit: String(limit),
        });
        if (categoryIds[0]) params.set('category', categoryIds[0]);
        if (equipmentIds[0]) params.set('equipment', equipmentIds[0]);
        const data = await fetchJsonWithTimeout(
          `https://wger.de/api/v2/exerciseinfo/?${params.toString()}`
        );
        rawResults = Array.isArray(data?.results) ? data.results : [];
      } else {
        // Multi-select: fetch per selected category (or all if only equipment is multi-selected) in parallel
        const targetCats = categoryIds.length > 0 ? categoryIds : [''];
        const targetEqs = equipmentIds.length > 0 ? equipmentIds : [''];

        const fetches: Promise<WgerExerciseRaw[]>[] = [];
        for (const catId of targetCats) {
          for (const eqId of targetEqs) {
            const params = new URLSearchParams({
              language: '2',
              limit: String(Math.min(limit, 30)),
            });
            if (catId) params.set('category', catId);
            if (eqId) params.set('equipment', eqId);
            fetches.push(
              fetchJsonWithTimeout(`https://wger.de/api/v2/exerciseinfo/?${params.toString()}`)
                .then((d) => (Array.isArray(d?.results) ? (d.results as WgerExerciseRaw[]) : []))
                .catch(() => [])
            );
          }
        }

        const batches = await Promise.all(fetches);
        const deduped = new Map<number, WgerExerciseRaw>();
        for (const item of batches.flat()) {
          if (item?.id && !deduped.has(item.id)) {
            deduped.set(item.id, item);
          }
        }
        rawResults = Array.from(deduped.values());
      }

      const formatted = rawResults
        .map((item) => {
          const enTranslation =
            item.translations?.find((t) => t.language === 2) || item.translations?.[0];
          const name = enTranslation?.name?.trim();
          if (!name) return null;

          const steps = stripHtmlToSteps(enTranslation?.description || '');
          const mainImage =
            item.images?.find((img) => img.is_main)?.image || item.images?.[0]?.image || null;
          const equipmentNames = (item.equipment || []).map((eq) => ({
            id: eq.id,
            name: eq.name.replace('none (bodyweight exercise)', 'Bodyweight (None)'),
          }));

          return {
            id: item.id,
            name,
            category: item.category?.name || 'General',
            categoryId: item.category?.id ?? 0,
            equipment: equipmentNames.length > 0 ? equipmentNames : [{ id: 7, name: 'Bodyweight (None)' }],
            muscles: (item.muscles || []).map((m) => m.name_en || m.name).filter(Boolean),
            secondaryMuscles: (item.muscles_secondary || [])
              .map((m) => m.name_en || m.name)
              .filter(Boolean),
            steps:
              steps.length > 0
                ? steps
                : ['Perform with controlled form, steady breathing, and full range of motion.'],
            image: mainImage,
            kcalPerMin: estimateKcalPerMinute(item.category?.name || '', item.equipment || []),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const filtered = search
        ? formatted.filter(
            (ex) =>
              ex.name.toLowerCase().includes(search) ||
              ex.category.toLowerCase().includes(search) ||
              ex.muscles.some((m) => m.toLowerCase().includes(search)) ||
              ex.equipment.some((eq) => eq.name.toLowerCase().includes(search))
          )
        : formatted;

      res.json({
        count: filtered.length,
        exercises: filtered,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wger API connection failed';
      res.status(502).json({ error: `Could not connect to Wger Exercise API: ${message}` });
    }
  });

  // --- TheMealDB API Proxy (v1 with free key = 1) ---
  app.get('/api/meals/categories', async (_req, res) => {
    try {
      const data = await fetchJsonWithTimeout(`${MEALDB_URL}/categories.php`);
      res.json({ categories: Array.isArray(data?.categories) ? data.categories : [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load meal categories';
      res.status(502).json({ error: `Could not connect to TheMealDB categories: ${message}` });
    }
  });

  app.get('/api/meals/filter', async (req, res) => {
    try {
      const category = typeof req.query.c === 'string' ? req.query.c.trim() : '';
      const ingredient = typeof req.query.i === 'string' ? req.query.i.trim() : '';

      let url = `${MEALDB_URL}/filter.php?i=chicken_breast`;
      if (category) {
        url = `${MEALDB_URL}/filter.php?c=${encodeURIComponent(category)}`;
      } else if (ingredient) {
        url = `${MEALDB_URL}/filter.php?i=${encodeURIComponent(ingredient)}`;
      }

      const data = await fetchJsonWithTimeout(url);
      res.json({ meals: Array.isArray(data?.meals) ? data.meals : [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load meals';
      res.status(502).json({ error: `Could not connect to TheMealDB: ${message}` });
    }
  });

  app.get('/api/meals/multi-filter', async (req, res) => {
    try {
      const rawCategories = typeof req.query.categories === 'string' ? req.query.categories : '';
      const rawIngredients = typeof req.query.ingredients === 'string' ? req.query.ingredients : '';

      const categories = rawCategories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const ingredients = rawIngredients
        .split(',')
        .map((i) => i.trim())
        .filter(Boolean);

      if (categories.length === 0 && ingredients.length === 0) {
        const defaultData = await fetchJsonWithTimeout(`${MEALDB_URL}/filter.php?i=chicken_breast`);
        res.json({ meals: Array.isArray(defaultData?.meals) ? defaultData.meals : [] });
        return;
      }

      type RawMeal = Record<string, unknown> & { idMeal?: string; strMeal?: string };
      const dedupeMeals = (list: RawMeal[]) => {
        const map = new Map<string, RawMeal>();
        for (const item of list) {
          const id = String(item?.idMeal || '');
          if (id && !map.has(id)) {
            map.set(id, item);
          }
        }
        return Array.from(map.values());
      };

      // Resolve selected categories (union across selected categories so e.g. Chicken + Seafood includes both)
      let categorySet: RawMeal[] | null = null;
      if (categories.length > 0) {
        const catResults = await Promise.all(
          categories.map(async (cat) => {
            const d = await fetchJsonWithTimeout(
              `${MEALDB_URL}/filter.php?c=${encodeURIComponent(cat)}`
            );
            const list: RawMeal[] = Array.isArray(d?.meals) ? d.meals : [];
            return list.map((m) => ({ ...m, strCategory: m.strCategory || cat }));
          })
        );
        categorySet = dedupeMeals(catResults.flat());
      }

      // Resolve each ingredient (try both filter.php?i= and search.php?s=, then intersect across ingredients)
      const resolveIngredient = async (term: string): Promise<RawMeal[]> => {
        const slug = term.toLowerCase().replace(/\s+/g, '_');
        const pluralSlug = slug.endsWith('s') ? slug : `${slug}s`;
        const queries = [
          fetchJsonWithTimeout(`${MEALDB_URL}/filter.php?i=${encodeURIComponent(slug)}`).catch(() => ({ meals: [] })),
          fetchJsonWithTimeout(`${MEALDB_URL}/search.php?s=${encodeURIComponent(term)}`).catch(() => ({ meals: [] })),
        ];
        if (pluralSlug !== slug) {
          queries.push(
            fetchJsonWithTimeout(`${MEALDB_URL}/filter.php?i=${encodeURIComponent(pluralSlug)}`).catch(() => ({ meals: [] }))
          );
        }
        const responses = await Promise.all(queries);
        const combined = responses.flatMap((r) => (Array.isArray(r?.meals) ? (r.meals as RawMeal[]) : []));
        return dedupeMeals(combined);
      };

      let resultPool: RawMeal[] = categorySet ?? [];

      if (ingredients.length > 0) {
        const ingSets = await Promise.all(ingredients.map(resolveIngredient));
        let intersected = ingSets[0] || [];
        for (let i = 1; i < ingSets.length; i++) {
          const nextIds = new Set(ingSets[i].map((m) => String(m.idMeal)));
          intersected = intersected.filter((m) => nextIds.has(String(m.idMeal)));
        }

        if (categorySet !== null) {
          const catMap = new Map(categorySet.map((m) => [String(m.idMeal), m]));
          resultPool = intersected
            .filter((m) => catMap.has(String(m.idMeal)))
            .map((m) => ({
              ...catMap.get(String(m.idMeal)),
              ...m,
            }));
        } else {
          resultPool = intersected;
        }
      }

      res.json({ meals: resultPool });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Multi-filter meal request failed';
      res.status(502).json({ error: `Could not filter TheMealDB meals: ${message}` });
    }
  });

  app.get('/api/meals/search', async (req, res) => {
    try {
      const q = typeof req.query.s === 'string' ? req.query.s.trim() : '';
      if (!q) {
        res.json({ meals: [] });
        return;
      }
      const slug = q.toLowerCase().replace(/\s+/g, '_');
      const [byName, byIngredient] = await Promise.all([
        fetchJsonWithTimeout(`${MEALDB_URL}/search.php?s=${encodeURIComponent(q)}`).catch(() => ({ meals: [] })),
        fetchJsonWithTimeout(`${MEALDB_URL}/filter.php?i=${encodeURIComponent(slug)}`).catch(() => ({ meals: [] })),
      ]);

      const merged = new Map<string, Record<string, unknown>>();
      for (const m of Array.isArray(byName?.meals) ? byName.meals : []) {
        if (m?.idMeal) merged.set(String(m.idMeal), m);
      }
      for (const m of Array.isArray(byIngredient?.meals) ? byIngredient.meals : []) {
        if (m?.idMeal && !merged.has(String(m.idMeal))) {
          merged.set(String(m.idMeal), m);
        }
      }

      res.json({ meals: Array.from(merged.values()) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Meal search failed';
      res.status(502).json({ error: `Could not search TheMealDB: ${message}` });
    }
  });

  app.get('/api/meals/lookup/:id', async (req, res) => {
    try {
      const id = req.params.id;
      if (!/^\d{1,12}$/.test(id)) {
        res.status(400).json({ error: 'Invalid meal ID format' });
        return;
      }
      const data = await fetchJsonWithTimeout(
        `${MEALDB_URL}/lookup.php?i=${encodeURIComponent(id)}`
      );
      const meal = Array.isArray(data?.meals) ? data.meals[0] ?? null : null;
      if (!meal) {
        res.status(404).json({ error: 'Recipe not found on TheMealDB' });
        return;
      }
      res.json({ meal });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recipe lookup failed';
      res.status(502).json({ error: `Could not load recipe details from TheMealDB: ${message}` });
    }
  });

  // --- Open Food Facts API Proxy ---
  app.get('/api/food/product/:barcode', async (req, res) => {
    try {
      const barcode = req.params.barcode.trim();
      if (!/^\d{4,18}$/.test(barcode)) {
        res.status(400).json({ error: 'Barcode must be 4 to 18 numeric digits' });
        return;
      }
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        barcode
      )}.json?fields=code,product_name,brands,nutriscore_grade,nutriments,image_small_url,serving_size,quantity`;

      const data = await fetchJsonWithTimeout(url, {
        'User-Agent': OFF_USER_AGENT,
      });

      if (data?.status !== 1 || !data?.product) {
        res.status(404).json({
          error: `Product barcode ${barcode} was not found in Open Food Facts`,
          notFound: true,
        });
        return;
      }

      const rawProduct = data.product;
      const normalizedProduct = {
        ...rawProduct,
        code: String(rawProduct.code || barcode),
        product_name: String(rawProduct.product_name || 'Unnamed Product'),
        brands: Array.isArray(rawProduct.brands)
          ? rawProduct.brands.join(', ')
          : String(rawProduct.brands || ''),
      };

      res.json({ product: normalizedProduct });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Open Food Facts lookup failed';
      res.status(502).json({ error: `Could not connect to Open Food Facts: ${message}` });
    }
  });

  app.get('/api/food/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (!q) {
        res.json({ products: [] });
        return;
      }

      const normalizeItems = (items: unknown[]) =>
        items
          .filter(
            (p): p is Record<string, unknown> =>
              Boolean(p && typeof p === 'object' && typeof (p as { product_name?: unknown }).product_name === 'string' && String((p as { product_name?: string }).product_name).trim().length > 0)
          )
          .map((p) => ({
            ...p,
            code: String(p.code || ''),
            product_name: String(p.product_name || ''),
            brands: Array.isArray(p.brands) ? p.brands.join(', ') : String(p.brands || ''),
          }));

      // Use Open Food Facts Search-a-licious API first (more reliable than cgi/search.pl), with fallback
      try {
        const searchUrl = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(
          q
        )}&page_size=12&fields=code,product_name,brands,nutriscore_grade,nutriments,image_small_url,serving_size,quantity`;
        const data = await fetchJsonWithTimeout(searchUrl, {
          'User-Agent': OFF_USER_AGENT,
        });
        const hits = Array.isArray(data?.hits) ? data.hits : [];
        res.json({ products: normalizeItems(hits) });
        return;
      } catch {
        const legacyUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
          q
        )}&search_simple=1&action=process&json=1&page_size=12&fields=code,product_name,brands,nutriscore_grade,nutriments,image_small_url,serving_size,quantity`;
        const legacyData = await fetchJsonWithTimeout(legacyUrl, {
          'User-Agent': OFF_USER_AGENT,
        });
        const rawProducts = Array.isArray(legacyData?.products) ? legacyData.products : [];
        res.json({ products: normalizeItems(rawProducts) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Open Food Facts search failed';
      res.status(502).json({ error: `Could not search Open Food Facts: ${message}` });
    }
  });

  // Vite middleware in development; static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VitalTrack server listening on http://localhost:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
