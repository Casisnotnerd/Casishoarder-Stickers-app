# Sticker Shelf — Plan 1: Core App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, installable web app for cataloguing sticker sheets. It covers manual photo crop, orders with SGD-paid conversion, collection, spending, "used up", delete, CSV export and a privacy-safe share link. It is hosted free on GitHub Pages with Supabase.

**Architecture:** A React + TypeScript single-page app built with Vite. Pure domain logic (money, holdings, spending, filters, CSV) lives in `src/domain` and is fully unit-tested. Data access goes through a `Repo` interface with two implementations:
- `MemoryRepo`, used by tests and by "demo mode" when no Supabase keys are set;
- `SupabaseRepo`, used in production.

Photos go through a `PhotoStore` interface:
- full photos in a private Supabase bucket;
- thumbnails in a public bucket with unguessable paths.

**Tech Stack:** Vite, React, TypeScript, react-router-dom (HashRouter), @supabase/supabase-js, vite-plugin-pwa, Vitest + jsdom + @testing-library/react, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-19-sticker-collection-app-design.md`

**Scope of this plan (Plan 1 of 3):**

| In Plan 1 | Later plan |
|---|---|
| Manual crop (one sheet per photo), shop screenshots used as photos | Plan 2: automatic box detection, copy counting, image recognition, OCR suggestions |
| Duplicate warning by **title** | Plan 2: duplicate warning by **image** |
| Everything in spec §4–§6 except the rows below | Plan 3: video capture, offline upload queue |

**Decisions made while planning (confirmed with user 2026-10-19 unless marked):**
- Three plans; core app first.
- Hosting: GitHub Pages. The user has a GitHub account. The repo must be **public** on a free account; data stays private through Supabase row-level security.
- Login: **6-digit email code** (Supabase OTP). There is no password, and no magic link, because iPhone home-screen apps don't receive links opened from Mail. Sign-ups are disabled; the single user is created in the dashboard.
- Weekly keep-alive: a GitHub Actions cron job calls `ping()`. GitHub disables scheduled workflows in public repos after 60 days without repo activity, so the app shows a notice explaining how to re-enable it. Pausing is recoverable for 1 year per Supabase docs.
- Working app name **"Sticker Shelf"**. *(Assumption; user can rename.)*

---

## File Structure

```
sticker-app/
├── package.json, tsconfig.json, vite.config.ts, index.html
├── public/icon-192.png, public/icon-512.png
├── src/
│   ├── main.tsx                 # entry: HashRouter + App
│   ├── App.tsx                  # mode switch: shared view / demo / signed-in
│   ├── styles.css
│   ├── domain/                  # pure logic, no React, no network
│   │   ├── types.ts             # Artist, Sheet, Order, OrderLine, Usage, ShareLink
│   │   ├── text.ts              # normalizeText
│   │   ├── currency.ts          # exponent, toMinor, minorToInput, formatMoney
│   │   ├── money.ts             # SGD conversion from "SGD paid"
│   │   ├── holdings.ts          # copies owned, usage validation
│   │   ├── spending.ts          # totals, by artist / month, exact vs estimated
│   │   ├── filter.ts            # collection search & filters, allTags
│   │   ├── duplicates.ts        # findSameTitle, findArtistByName
│   │   ├── orderForm.ts         # form strings <-> NewOrder
│   │   └── csv.ts               # CSV export (UTF-8 BOM for Korean)
│   ├── data/
│   │   ├── repo.ts              # Repo + PhotoStore interfaces, input types
│   │   ├── token.ts             # randomToken
│   │   ├── memoryRepo.ts        # MemoryRepo, MemoryPhotoStore
│   │   ├── supabaseClient.ts    # client or null (demo mode)
│   │   └── supabaseRepo.ts      # SupabaseRepo, SupabasePhotoStore
│   ├── image/
│   │   ├── geometry.ts          # Rect, fitWithin, normalizeRect, fullRect (pure)
│   │   └── crop.ts              # loadImage, cropToJpeg (browser canvas)
│   └── ui/
│       ├── DataProvider.tsx     # loads Snapshot, exposes repo/photos/reload
│       ├── usePhotoUrl.ts
│       ├── Shell.tsx            # routes + bottom nav
│       ├── Login.tsx
│       ├── CropBox.tsx
│       ├── OrderFields.tsx
│       ├── SheetDraftEditor.tsx
│       └── pages/ Collection.tsx, AddOrder.tsx, SheetDetail.tsx,
│                  Spending.tsx, Orders.tsx, Settings.tsx, SharedView.tsx
├── supabase/migrations/001_init.sql
├── scripts/check-share-privacy.mjs
├── .github/workflows/ deploy.yml, keepalive.yml, privacy-check.yml
├── docs/setup/ supabase.md, github.md, iphone.md
└── tests/ (mirrors src/)
```

---

### Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `.gitignore`
- Test: `tests/smoke.test.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "sticker-shelf",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc"
  }
}
```

- [ ] **Step 2: Install dependencies with exact versions**

Run:
```bash
cd /home/claude/sticker-app
npm install -E react react-dom react-router-dom @supabase/supabase-js
npm install -E -D vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @types/react @types/react-dom vite-plugin-pwa
```
Expected: `added N packages`, and `package.json` now lists exact versions (no `^`).

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sticker Shelf',
        short_name: 'Stickers',
        start_url: '.',
        display: 'standalone',
        background_color: '#fffaf3',
        theme_color: '#f2a65a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
```

- [ ] **Step 5: Write `index.html`, `src/main.tsx`, placeholder `src/App.tsx`, empty `src/styles.css`, `.gitignore`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <link rel="apple-touch-icon" href="icon-192.png" />
    <title>Sticker Shelf</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
```

`src/App.tsx` (placeholder, replaced in Task 12):
```tsx
export function App() {
  return <p>Sticker Shelf</p>;
}
```

`src/styles.css`: empty file.

`.gitignore`:
```
node_modules
dist
.env*
```

- [ ] **Step 6: Write a smoke test**

`tests/smoke.test.ts`:
```ts
test('test runner works', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: `1 passed`; tsc prints nothing.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS app with Vitest and PWA plugin"
```

---

### Task 2: Domain types, text normalisation, currency

**Files:**
- Create: `src/domain/types.ts`, `src/domain/text.ts`, `src/domain/currency.ts`
- Test: `tests/domain/currency.test.ts`

- [ ] **Step 1: Write `src/domain/types.ts`**

```ts
export interface Artist {
  id: string;
  name: string;
  aliases: string[];
}

export interface Sheet {
  id: string;
  artistId: string | null;
  title: string;
  tags: string[];
  photoPath: string | null;
  thumbPath: string | null;
  photoBytes: number; // photo + thumbnail bytes, for the storage meter
  createdAt: string; // ISO timestamp
}

export interface Order {
  id: string;
  orderDate: string | null; // YYYY-MM-DD
  shop: string | null;
  currency: string; // ISO 4217, e.g. KRW, SGD
  shippingMinor: number; // in order currency minor units
  totalMinor: number | null; // order total as charged, order currency
  sgdPaidMinor: number | null; // SGD actually paid, cents
  estimated: boolean;
  isUnknown: boolean; // the per-user "Unknown order" for old sheets
  createdAt: string;
}

export interface OrderLine {
  id: string;
  orderId: string;
  sheetId: string;
  quantity: number;
  priceMinor: number | null; // listed price each, order currency
  estimated: boolean;
}

export interface Usage {
  id: string;
  sheetId: string;
  quantity: number;
  usedOn: string; // YYYY-MM-DD
}

export interface ShareLink {
  token: string;
  enabled: boolean;
}
```

- [ ] **Step 2: Write `src/domain/text.ts`**

```ts
export function normalizeText(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 3: Write the failing currency tests**

`tests/domain/currency.test.ts`:
```ts
import { exponent, toMinor, minorToInput, formatMoney } from '../../src/domain/currency';
import { normalizeText } from '../../src/domain/text';

test('exponent: KRW has no decimals, SGD has 2, unknown defaults to 2', () => {
  expect(exponent('KRW')).toBe(0);
  expect(exponent('sgd')).toBe(2);
  expect(exponent('XYZ')).toBe(2);
});

test('toMinor parses decimal strings into minor units', () => {
  expect(toMinor('3000', 'KRW')).toBe(3000);
  expect(toMinor('3,000', 'KRW')).toBe(3000);
  expect(toMinor('15.60', 'SGD')).toBe(1560);
  expect(toMinor('15.6', 'SGD')).toBe(1560);
  expect(toMinor(' 4 ', 'SGD')).toBe(400);
});

test('toMinor rejects invalid or over-precise input', () => {
  expect(toMinor('', 'SGD')).toBeNull();
  expect(toMinor('abc', 'SGD')).toBeNull();
  expect(toMinor('1.234', 'SGD')).toBeNull();
  expect(toMinor('3000.5', 'KRW')).toBeNull();
  expect(toMinor('-1', 'SGD')).toBeNull();
});

test('minorToInput formats for editing', () => {
  expect(minorToInput(1560, 'SGD')).toBe('15.60');
  expect(minorToInput(3000, 'KRW')).toBe('3000');
});

test('formatMoney shows a dash for unknown SGD', () => {
  expect(formatMoney(null, 'SGD')).toBe('S$ —');
  expect(formatMoney(null, 'KRW')).toBe('KRW —');
  expect(formatMoney(312, 'SGD')).toMatch(/3\.12/);
  expect(formatMoney(3000, 'KRW')).toMatch(/3,000/);
});

test('normalizeText trims, lowercases and collapses spaces', () => {
  expect(normalizeText('  Winter   Sheet ')).toBe('winter sheet');
  expect(normalizeText('계란이  좋아')).toBe('계란이 좋아');
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run tests/domain/currency.test.ts`
Expected: FAIL, `Cannot find module '../../src/domain/currency'`.

- [ ] **Step 5: Write `src/domain/currency.ts`**

```ts
const EXPONENTS: Record<string, number> = {
  SGD: 2, KRW: 0, JPY: 0, USD: 2, AUD: 2, EUR: 2, GBP: 2,
  CNY: 2, HKD: 2, MYR: 2, THB: 2, TWD: 2,
};

export const COMMON_CURRENCIES: string[] = Object.keys(EXPONENTS);

export function exponent(code: string): number {
  return EXPONENTS[code.toUpperCase()] ?? 2;
}

export function toMinor(input: string, code: string): number | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const exp = exponent(code);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > exp) return null;
  const fracPadded = (frac + '0'.repeat(exp)).slice(0, exp);
  return Number(whole) * 10 ** exp + (exp > 0 ? Number(fracPadded) : 0);
}

export function minorToInput(minor: number, code: string): string {
  const exp = exponent(code);
  return exp === 0 ? String(minor) : (minor / 10 ** exp).toFixed(exp);
}

export function formatMoney(minor: number | null, code: string): string {
  const c = code.toUpperCase();
  if (minor === null) return c === 'SGD' ? 'S$ —' : `${c} —`;
  const exp = exponent(c);
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: c,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(minor / 10 ** exp);
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run tests/domain/currency.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(domain): types, text normalisation, currency minor units"
```

---

### Task 3: Money — SGD conversion from "SGD paid"

**Files:**
- Create: `src/domain/money.ts`
- Test: `tests/domain/money.test.ts`

Rule (spec §4): rate = SGD paid ÷ order total in original currency. If the order total is blank, use Σ(lines) + shipping. For SGD orders, SGD paid defaults to total (or Σ + shipping).

- [ ] **Step 1: Write the failing tests**

`tests/domain/money.test.ts`:
```ts
import type { Order, OrderLine } from '../../src/domain/types';
import {
  itemsSumMinor, rateBaseMinor, effectiveSgdPaidMinor, lineSgdMinor,
  unitSgdMinor, shippingSgdMinor, derivedRate, orderMismatch,
} from '../../src/domain/money';

const order = (o: Partial<Order>): Order => ({
  id: 'o1', orderDate: '2026-10-19', shop: 'JUIMJUIM', currency: 'KRW',
  shippingMinor: 3000, totalMinor: 15000, sgdPaidMinor: 1560,
  estimated: false, isUnknown: false, createdAt: '2026-10-19T00:00:00Z', ...o,
});
const line = (l: Partial<OrderLine>): OrderLine => ({
  id: 'l1', orderId: 'o1', sheetId: 's1', quantity: 1, priceMinor: 3000, estimated: false, ...l,
});

// Spec example: ₩15,000 order (4 sheets × ₩3,000 + ₩3,000 shipping), S$15.60 paid.
const krwLines = [line({ id: 'a', sheetId: 'sA', quantity: 3 }), line({ id: 'b', sheetId: 'sB', quantity: 1 })];

test('spec example: ₩3,000 sheet costs S$3.12; rate 0.00104', () => {
  const o = order({});
  expect(unitSgdMinor(krwLines[0], o, krwLines)).toBe(312);
  expect(lineSgdMinor(krwLines[0], o, krwLines)).toBe(936);
  expect(lineSgdMinor(krwLines[1], o, krwLines)).toBe(312);
  expect(shippingSgdMinor(o, krwLines)).toBe(312);
  expect(derivedRate(o, krwLines)).toBeCloseTo(0.00104, 8);
});

test('blank order total falls back to items + shipping', () => {
  const o = order({ totalMinor: null });
  expect(itemsSumMinor(krwLines)).toBe(12000);
  expect(rateBaseMinor(o, krwLines)).toBe(15000);
  expect(unitSgdMinor(krwLines[0], o, krwLines)).toBe(312);
});

test('blank SGD paid gives null SGD amounts for foreign orders', () => {
  const o = order({ sgdPaidMinor: null });
  expect(effectiveSgdPaidMinor(o, krwLines)).toBeNull();
  expect(lineSgdMinor(krwLines[0], o, krwLines)).toBeNull();
  expect(derivedRate(o, krwLines)).toBeNull();
});

test('SGD orders need no SGD paid entry', () => {
  const lines = [line({ priceMinor: 450, quantity: 2 })];
  const o = order({ currency: 'SGD', shippingMinor: 0, totalMinor: null, sgdPaidMinor: null });
  expect(effectiveSgdPaidMinor(o, lines)).toBe(900);
  expect(unitSgdMinor(lines[0], o, lines)).toBe(450);
});

test('missing line price with blank total gives no base', () => {
  const lines = [line({ priceMinor: null })];
  const o = order({ totalMinor: null });
  expect(rateBaseMinor(o, lines)).toBeNull();
  expect(lineSgdMinor(lines[0], o, lines)).toBeNull();
});

test('orderMismatch reports discount differences', () => {
  expect(orderMismatch(order({}), krwLines)).toBeNull();
  const m = orderMismatch(order({ totalMinor: 14000 }), krwLines);
  expect(m).toEqual({ expectedMinor: 15000, totalMinor: 14000, diffMinor: -1000 });
  expect(orderMismatch(order({ totalMinor: null }), krwLines)).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/domain/money.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/domain/money.ts`**

```ts
import type { Order, OrderLine } from './types';
import { exponent } from './currency';

export function linesOf(order: Order, lines: OrderLine[]): OrderLine[] {
  return lines.filter((l) => l.orderId === order.id);
}

export function itemsSumMinor(orderLines: OrderLine[]): number | null {
  let sum = 0;
  for (const l of orderLines) {
    if (l.priceMinor === null) return null;
    sum += l.priceMinor * l.quantity;
  }
  return sum;
}

export function rateBaseMinor(order: Order, orderLines: OrderLine[]): number | null {
  if (order.totalMinor !== null) return order.totalMinor > 0 ? order.totalMinor : null;
  const items = itemsSumMinor(orderLines);
  if (items === null) return null;
  const base = items + order.shippingMinor;
  return base > 0 ? base : null;
}

export function effectiveSgdPaidMinor(order: Order, orderLines: OrderLine[]): number | null {
  if (order.sgdPaidMinor !== null) return order.sgdPaidMinor;
  if (order.currency.toUpperCase() !== 'SGD') return null;
  if (order.totalMinor !== null) return order.totalMinor;
  const items = itemsSumMinor(orderLines);
  return items === null ? null : items + order.shippingMinor;
}

function convert(amountMinor: number, order: Order, orderLines: OrderLine[]): number | null {
  const paid = effectiveSgdPaidMinor(order, orderLines);
  const base = rateBaseMinor(order, orderLines);
  if (paid === null || base === null) return null;
  return Math.round((amountMinor * paid) / base);
}

export function lineSgdMinor(line: OrderLine, order: Order, orderLines: OrderLine[]): number | null {
  return line.priceMinor === null ? null : convert(line.priceMinor * line.quantity, order, orderLines);
}

export function unitSgdMinor(line: OrderLine, order: Order, orderLines: OrderLine[]): number | null {
  return line.priceMinor === null ? null : convert(line.priceMinor, order, orderLines);
}

export function shippingSgdMinor(order: Order, orderLines: OrderLine[]): number | null {
  return convert(order.shippingMinor, order, orderLines);
}

/** SGD per 1 unit of the order currency (e.g. 0.00104 SGD per ₩1). */
export function derivedRate(order: Order, orderLines: OrderLine[]): number | null {
  const paid = effectiveSgdPaidMinor(order, orderLines);
  const base = rateBaseMinor(order, orderLines);
  if (paid === null || base === null) return null;
  return paid / 100 / (base / 10 ** exponent(order.currency));
}

export interface Mismatch {
  expectedMinor: number;
  totalMinor: number;
  diffMinor: number;
}

export function orderMismatch(order: Order, orderLines: OrderLine[]): Mismatch | null {
  if (order.totalMinor === null) return null;
  const items = itemsSumMinor(orderLines);
  if (items === null) return null;
  const expected = items + order.shippingMinor;
  if (expected === order.totalMinor) return null;
  return { expectedMinor: expected, totalMinor: order.totalMinor, diffMinor: order.totalMinor - expected };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/domain/money.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): SGD conversion from SGD-paid per order"
```

---

### Task 4: Holdings — copies owned and "used up"

**Files:**
- Create: `src/domain/holdings.ts`
- Test: `tests/domain/holdings.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/domain/holdings.test.ts`:
```ts
import type { OrderLine, Usage } from '../../src/domain/types';
import { copiesBought, copiesUsed, copiesOwned, usageError } from '../../src/domain/holdings';

const lines: OrderLine[] = [
  { id: 'l1', orderId: 'o1', sheetId: 'winter', quantity: 2, priceMinor: 450, estimated: false },
  { id: 'l2', orderId: 'o2', sheetId: 'winter', quantity: 1, priceMinor: 450, estimated: false },
  { id: 'l3', orderId: 'o2', sheetId: 'spring', quantity: 1, priceMinor: 450, estimated: false },
];
const usages: Usage[] = [{ id: 'u1', sheetId: 'winter', quantity: 1, usedOn: '2026-10-19' }];

test('copies owned = bought − used', () => {
  expect(copiesBought('winter', lines)).toBe(3);
  expect(copiesUsed('winter', usages)).toBe(1);
  expect(copiesOwned('winter', lines, usages)).toBe(2);
  expect(copiesOwned('spring', lines, usages)).toBe(1);
  expect(copiesOwned('none', lines, usages)).toBe(0);
});

test('usageError blocks using more than owned or invalid numbers', () => {
  expect(usageError('winter', 2, lines, usages)).toBeNull();
  expect(usageError('winter', 3, lines, usages)).toBe('You only have 2 copies.');
  expect(usageError('spring', 2, lines, usages)).toBe('You only have 1 copy.');
  expect(usageError('winter', 0, lines, usages)).toBe('Enter a whole number of 1 or more.');
  expect(usageError('winter', 1.5, lines, usages)).toBe('Enter a whole number of 1 or more.');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/domain/holdings.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/domain/holdings.ts`**

```ts
import type { OrderLine, Usage } from './types';

export function copiesBought(sheetId: string, lines: OrderLine[]): number {
  return lines.filter((l) => l.sheetId === sheetId).reduce((n, l) => n + l.quantity, 0);
}

export function copiesUsed(sheetId: string, usages: Usage[]): number {
  return usages.filter((u) => u.sheetId === sheetId).reduce((n, u) => n + u.quantity, 0);
}

export function copiesOwned(sheetId: string, lines: OrderLine[], usages: Usage[]): number {
  return copiesBought(sheetId, lines) - copiesUsed(sheetId, usages);
}

export function usageError(sheetId: string, quantity: number, lines: OrderLine[], usages: Usage[]): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a whole number of 1 or more.';
  const owned = copiesOwned(sheetId, lines, usages);
  if (quantity > owned) return `You only have ${owned} ${owned === 1 ? 'copy' : 'copies'}.`;
  return null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/domain/holdings.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): copies owned and used-up validation"
```

---

### Task 5: Spending summary

**Files:**
- Create: `src/domain/spending.ts`
- Test: `tests/domain/spending.test.ts`

Definitions:
- **Total** = Σ SGD paid (what left the bank). Parts are line amounts by artist, shipping, and "Discount / rounding" (total − parts).
- **Exact vs estimated:** a line counts as estimated if its own flag or its order's flag is set; shipping and "other" follow the order flag.
- **Missing SGD:** orders with no SGD paid are counted, excluding the "Unknown order".

- [ ] **Step 1: Write the failing tests**

`tests/domain/spending.test.ts`:
```ts
import type { Artist, Order, OrderLine, Sheet } from '../../src/domain/types';
import { summarizeSpending } from '../../src/domain/spending';

const artists: Artist[] = [
  { id: 'aJ', name: 'JUIMJUIM', aliases: [] },
  { id: 'aP', name: 'papermilio', aliases: [] },
];
const sheet = (id: string, artistId: string | null): Sheet => ({
  id, artistId, title: id, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, createdAt: '2026-01-01T00:00:00Z',
});
const sheets = [sheet('egg', 'aJ'), sheet('dumpling', 'aJ'), sheet('winter', 'aP'), sheet('mystery', null)];
const base: Omit<Order, 'id'> = {
  orderDate: null, shop: null, currency: 'SGD', shippingMinor: 0, totalMinor: null, sgdPaidMinor: null,
  estimated: false, isUnknown: false, createdAt: '2026-01-01T00:00:00Z',
};
const orders: Order[] = [
  { ...base, id: 'krw', orderDate: '2026-10-05', currency: 'KRW', shippingMinor: 3000, totalMinor: 15000, sgdPaidMinor: 1560 },
  { ...base, id: 'sgdEst', estimated: true },
  { ...base, id: 'krwMissing', orderDate: '2026-09-01', currency: 'KRW', totalMinor: 6000 },
  { ...base, id: 'unknown', isUnknown: true },
];
const lines: OrderLine[] = [
  { id: 'l1', orderId: 'krw', sheetId: 'egg', quantity: 3, priceMinor: 3000, estimated: false },
  { id: 'l2', orderId: 'krw', sheetId: 'dumpling', quantity: 1, priceMinor: 3000, estimated: false },
  { id: 'l3', orderId: 'sgdEst', sheetId: 'winter', quantity: 2, priceMinor: 450, estimated: false },
  { id: 'l4', orderId: 'krwMissing', sheetId: 'mystery', quantity: 2, priceMinor: 3000, estimated: false },
  { id: 'l5', orderId: 'unknown', sheetId: 'mystery', quantity: 1, priceMinor: null, estimated: false },
];

test('summarizeSpending totals, buckets and missing SGD', () => {
  const s = summarizeSpending({ artists, sheets, orders, lines });
  expect(s.totalMinor).toBe(2460);
  expect(s.exactMinor).toBe(1560);
  expect(s.estimatedMinor).toBe(900);
  expect(s.shippingMinor).toBe(312);
  expect(s.otherMinor).toBe(0);
  expect(s.byArtist).toEqual([
    { label: 'JUIMJUIM', minor: 1248 },
    { label: 'papermilio', minor: 900 },
  ]);
  expect(s.byMonth).toEqual([
    { label: '2026-10', minor: 1560 },
    { label: 'No date', minor: 900 },
  ]);
  expect(s.missingSgdOrderIds).toEqual(['krwMissing']);
});

test('discount shows up as negative "other"', () => {
  const discounted = orders.map((o) => (o.id === 'krw' ? { ...o, totalMinor: 14000 } : o));
  const s = summarizeSpending({ artists, sheets, orders: discounted, lines });
  // base 14000: egg 3×3000→1003, dumpling →334, shipping →334; parts 1671; paid 1560; other −111
  expect(s.otherMinor).toBe(-111);
  expect(s.totalMinor).toBe(2460);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/domain/spending.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/domain/spending.ts`**

```ts
import type { Artist, Order, OrderLine, Sheet } from './types';
import { effectiveSgdPaidMinor, lineSgdMinor, linesOf, shippingSgdMinor } from './money';

export interface SpendingData {
  artists: Artist[];
  sheets: Sheet[];
  orders: Order[];
  lines: OrderLine[];
}

export interface Bucket {
  label: string;
  minor: number;
}

export interface SpendingSummary {
  totalMinor: number;
  exactMinor: number;
  estimatedMinor: number;
  shippingMinor: number;
  otherMinor: number;
  byArtist: Bucket[];
  byMonth: Bucket[];
  missingSgdOrderIds: string[];
}

const UNKNOWN_ARTIST = 'Unknown artist';
const NO_DATE = 'No date';

function add(map: Map<string, number>, key: string, v: number) {
  map.set(key, (map.get(key) ?? 0) + v);
}

export function summarizeSpending(d: SpendingData): SpendingSummary {
  const artistName = new Map(d.artists.map((a) => [a.id, a.name]));
  const sheetArtist = new Map(
    d.sheets.map((s) => [s.id, (s.artistId && artistName.get(s.artistId)) || UNKNOWN_ARTIST]),
  );
  const byArtist = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const missing: string[] = [];
  let total = 0, exact = 0, estimated = 0, shipping = 0, other = 0;

  for (const order of d.orders) {
    const ol = linesOf(order, d.lines);
    const paid = effectiveSgdPaidMinor(order, ol);
    if (paid === null) {
      if (!order.isUnknown) missing.push(order.id);
      continue;
    }
    total += paid;
    add(byMonth, order.orderDate ? order.orderDate.slice(0, 7) : NO_DATE, paid);
    let parts = 0;
    for (const l of ol) {
      const v = lineSgdMinor(l, order, ol);
      if (v === null) continue;
      parts += v;
      add(byArtist, sheetArtist.get(l.sheetId) ?? UNKNOWN_ARTIST, v);
      if (order.estimated || l.estimated) estimated += v;
      else exact += v;
    }
    const s = shippingSgdMinor(order, ol) ?? 0;
    parts += s;
    shipping += s;
    const rest = paid - parts;
    other += rest;
    if (order.estimated) estimated += s + rest;
    else exact += s + rest;
  }

  const toBuckets = (m: Map<string, number>) => [...m].map(([label, minor]) => ({ label, minor }));
  return {
    totalMinor: total,
    exactMinor: exact,
    estimatedMinor: estimated,
    shippingMinor: shipping,
    otherMinor: other,
    byArtist: toBuckets(byArtist).sort((a, b) => b.minor - a.minor),
    byMonth: toBuckets(byMonth).sort((a, b) =>
      a.label === NO_DATE ? 1 : b.label === NO_DATE ? -1 : a.label.localeCompare(b.label),
    ),
    missingSgdOrderIds: missing,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/domain/spending.test.ts`
Expected: PASS (2 tests). If the discount test is off by 1 cent, recompute by hand: 9000×1560/14000 = 1002.86 → 1003; 3000×1560/14000 = 334.29 → 334 (twice); 1003+334+334 = 1671; 1560−1671 = −111. Fix the code, not the expectation.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): spending summary with exact/estimated and missing SGD"
```

---

### Task 6: Collection filters, duplicate title warning, artist lookup

**Files:**
- Create: `src/domain/filter.ts`, `src/domain/duplicates.ts`
- Test: `tests/domain/filter.test.ts`, `tests/domain/duplicates.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/domain/filter.test.ts`:
```ts
import type { Artist, Order, OrderLine, Sheet, Usage } from '../../src/domain/types';
import { EMPTY_FILTER, filterSheets, allTags } from '../../src/domain/filter';

const artists: Artist[] = [{ id: 'aP', name: 'papermilio', aliases: ['paper milio'] }];
const mk = (id: string, title: string, tags: string[], createdAt: string): Sheet => ({
  id, artistId: 'aP', title, tags, photoPath: null, thumbPath: null, photoBytes: 0, createdAt,
});
const sheets = [
  mk('w', 'Winter', ['seasonal'], '2026-01-01T00:00:00Z'),
  mk('e', '계란이 좋아', ['food'], '2026-02-01T00:00:00Z'),
  mk('s', 'Spring', ['seasonal'], '2026-03-01T00:00:00Z'),
];
const orders: Order[] = [{
  id: 'o', orderDate: '2026-10-05', shop: null, currency: 'SGD', shippingMinor: 0, totalMinor: null,
  sgdPaidMinor: null, estimated: false, isUnknown: false, createdAt: '2026-10-05T00:00:00Z',
}];
const lines: OrderLine[] = [
  { id: 'l1', orderId: 'o', sheetId: 'w', quantity: 1, priceMinor: 450, estimated: false },
  { id: 'l2', orderId: 'o', sheetId: 'e', quantity: 1, priceMinor: 300, estimated: false },
  { id: 'l3', orderId: 'o', sheetId: 's', quantity: 1, priceMinor: 600, estimated: false },
];
const usages: Usage[] = [{ id: 'u', sheetId: 's', quantity: 1, usedOn: '2026-10-10' }];
const d = { artists, sheets, orders, lines, usages };

test('default filter hides used-up sheets, newest first', () => {
  expect(filterSheets(EMPTY_FILTER, d).map((s) => s.id)).toEqual(['e', 'w']);
  expect(filterSheets({ ...EMPTY_FILTER, showUsedUp: true }, d).map((s) => s.id)).toEqual(['s', 'e', 'w']);
});

test('text search covers title, artist, alias, tags (Korean too)', () => {
  expect(filterSheets({ ...EMPTY_FILTER, text: 'win' }, d).map((s) => s.id)).toEqual(['w']);
  expect(filterSheets({ ...EMPTY_FILTER, text: '계란' }, d).map((s) => s.id)).toEqual(['e']);
  expect(filterSheets({ ...EMPTY_FILTER, text: 'paper milio' }, d)).toHaveLength(2);
  expect(filterSheets({ ...EMPTY_FILTER, text: 'food' }, d).map((s) => s.id)).toEqual(['e']);
});

test('tag, date and SGD price filters', () => {
  expect(filterSheets({ ...EMPTY_FILTER, tag: 'seasonal' }, d).map((s) => s.id)).toEqual(['w']);
  expect(filterSheets({ ...EMPTY_FILTER, dateFrom: '2026-11-01' }, d)).toHaveLength(0);
  expect(filterSheets({ ...EMPTY_FILTER, dateFrom: '2026-10-01', dateTo: '2026-10-31' }, d)).toHaveLength(2);
  expect(filterSheets({ ...EMPTY_FILTER, minSgdMinor: 400 }, d).map((s) => s.id)).toEqual(['w']);
  expect(filterSheets({ ...EMPTY_FILTER, maxSgdMinor: 400 }, d).map((s) => s.id)).toEqual(['e']);
});

test('allTags is sorted and unique', () => {
  expect(allTags(sheets)).toEqual(['food', 'seasonal']);
});
```

`tests/domain/duplicates.test.ts`:
```ts
import type { Artist, Sheet } from '../../src/domain/types';
import { findSameTitle, findArtistByName } from '../../src/domain/duplicates';

const sheets: Sheet[] = [
  { id: 'w', artistId: 'aP', title: 'Winter', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, createdAt: '' },
  { id: 'x', artistId: null, title: '계란이 좋아', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, createdAt: '' },
];
const artists: Artist[] = [{ id: 'aJ', name: 'JUIMJUIM', aliases: ['Juimsuim'] }];

test('findSameTitle matches normalised title, same or unknown artist', () => {
  expect(findSameTitle('  winter ', 'aP', sheets)?.id).toBe('w');
  expect(findSameTitle('Winter', null, sheets)?.id).toBe('w');
  expect(findSameTitle('Winter', 'other', sheets)).toBeNull();
  expect(findSameTitle('계란이  좋아', 'aJ', sheets)?.id).toBe('x');
  expect(findSameTitle('', null, sheets)).toBeNull();
});

test('findArtistByName matches name or alias, case-insensitive', () => {
  expect(findArtistByName('juimjuim', artists)?.id).toBe('aJ');
  expect(findArtistByName('JUIMSUIM', artists)?.id).toBe('aJ');
  expect(findArtistByName('papermilio', artists)).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/domain/filter.test.ts tests/domain/duplicates.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `src/domain/filter.ts`**

```ts
import type { Artist, Order, OrderLine, Sheet, Usage } from './types';
import { normalizeText } from './text';
import { copiesOwned } from './holdings';
import { linesOf, unitSgdMinor } from './money';

export interface SheetFilter {
  text: string;
  artistId: string | null;
  tag: string | null;
  showUsedUp: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  minSgdMinor: number | null;
  maxSgdMinor: number | null;
}

export const EMPTY_FILTER: SheetFilter = {
  text: '', artistId: null, tag: null, showUsedUp: false,
  dateFrom: null, dateTo: null, minSgdMinor: null, maxSgdMinor: null,
};

export interface FilterData {
  artists: Artist[];
  sheets: Sheet[];
  orders: Order[];
  lines: OrderLine[];
  usages: Usage[];
}

export function allTags(sheets: Sheet[]): string[] {
  return [...new Set(sheets.flatMap((s) => s.tags))].sort((a, b) => a.localeCompare(b));
}

export function filterSheets(f: SheetFilter, d: FilterData): Sheet[] {
  const artistById = new Map(d.artists.map((a) => [a.id, a]));
  const orderById = new Map(d.orders.map((o) => [o.id, o]));
  const q = normalizeText(f.text);
  const needsLines = f.dateFrom || f.dateTo || f.minSgdMinor !== null || f.maxSgdMinor !== null;

  return d.sheets
    .filter((s) => {
      if (!f.showUsedUp && copiesOwned(s.id, d.lines, d.usages) <= 0) return false;
      if (f.artistId && s.artistId !== f.artistId) return false;
      if (f.tag && !s.tags.includes(f.tag)) return false;
      if (q) {
        const a = s.artistId ? artistById.get(s.artistId) : undefined;
        const hay = [s.title, a?.name ?? '', ...(a?.aliases ?? []), ...s.tags].map(normalizeText);
        if (!hay.some((h) => h.includes(q))) return false;
      }
      if (needsLines) {
        const mine = d.lines.filter((l) => l.sheetId === s.id);
        const ok = mine.some((l) => {
          const o = orderById.get(l.orderId);
          if (!o) return false;
          if (f.dateFrom && (!o.orderDate || o.orderDate < f.dateFrom)) return false;
          if (f.dateTo && (!o.orderDate || o.orderDate > f.dateTo)) return false;
          if (f.minSgdMinor !== null || f.maxSgdMinor !== null) {
            const v = unitSgdMinor(l, o, linesOf(o, d.lines));
            if (v === null) return false;
            if (f.minSgdMinor !== null && v < f.minSgdMinor) return false;
            if (f.maxSgdMinor !== null && v > f.maxSgdMinor) return false;
          }
          return true;
        });
        if (!ok) return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
```

- [ ] **Step 4: Write `src/domain/duplicates.ts`**

```ts
import type { Artist, Sheet } from './types';
import { normalizeText } from './text';

export function findSameTitle(title: string, artistId: string | null, sheets: Sheet[]): Sheet | null {
  const t = normalizeText(title);
  if (!t) return null;
  return (
    sheets.find(
      (s) => normalizeText(s.title) === t && (artistId === null || s.artistId === null || s.artistId === artistId),
    ) ?? null
  );
}

export function findArtistByName(name: string, artists: Artist[]): Artist | null {
  const n = normalizeText(name);
  if (!n) return null;
  return artists.find((a) => [a.name, ...a.aliases].some((x) => normalizeText(x) === n)) ?? null;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/domain/filter.test.ts tests/domain/duplicates.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(domain): collection filters, title duplicate warning, artist lookup"
```

---

### Task 7: Order form parsing and CSV export

**Files:**
- Create: `src/domain/orderForm.ts`, `src/domain/csv.ts`
- Test: `tests/domain/orderForm.test.ts`, `tests/domain/csv.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/domain/orderForm.test.ts`:
```ts
import { EMPTY_ORDER_FORM, parseOrderForm, orderToForm } from '../../src/domain/orderForm';

test('parses the spec KRW example', () => {
  const r = parseOrderForm({
    ...EMPTY_ORDER_FORM, date: '2026-10-19', shop: 'JUIMJUIM', currency: 'KRW',
    shipping: '3000', total: '15000', sgdPaid: '15.60',
  });
  expect(r).toEqual({
    ok: true,
    value: {
      orderDate: '2026-10-19', shop: 'JUIMJUIM', currency: 'KRW',
      shippingMinor: 3000, totalMinor: 15000, sgdPaidMinor: 1560, estimated: false,
    },
  });
});

test('blank fields become null / zero', () => {
  const r = parseOrderForm(EMPTY_ORDER_FORM);
  expect(r).toEqual({
    ok: true,
    value: {
      orderDate: null, shop: null, currency: 'SGD',
      shippingMinor: 0, totalMinor: null, sgdPaidMinor: null, estimated: false,
    },
  });
});

test('invalid amounts give a field error', () => {
  expect(parseOrderForm({ ...EMPTY_ORDER_FORM, sgdPaid: '1.234' })).toEqual({ ok: false, error: 'SGD paid: not a valid amount.' });
  expect(parseOrderForm({ ...EMPTY_ORDER_FORM, currency: 'KRW', total: '3000.5' })).toEqual({ ok: false, error: 'Order total: not a valid amount.' });
});

test('orderToForm round-trips', () => {
  const form = orderToForm({
    id: 'o', orderDate: '2026-10-19', shop: null, currency: 'KRW', shippingMinor: 3000,
    totalMinor: 15000, sgdPaidMinor: 1560, estimated: true, isUnknown: false, createdAt: '',
  });
  expect(form).toEqual({
    date: '2026-10-19', shop: '', currency: 'KRW', shipping: '3000', total: '15000', sgdPaid: '15.60', estimated: true,
  });
});
```

`tests/domain/csv.test.ts`:
```ts
import type { Artist, Order, OrderLine, Sheet, Usage } from '../../src/domain/types';
import { csvEscape, toCsv, collectionCsv } from '../../src/domain/csv';

test('csvEscape quotes commas, quotes and newlines', () => {
  expect(csvEscape('plain')).toBe('plain');
  expect(csvEscape('a,b')).toBe('"a,b"');
  expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  expect(csvEscape(null)).toBe('');
  expect(csvEscape(3)).toBe('3');
});

test('toCsv starts with a UTF-8 BOM so Excel shows Korean', () => {
  expect(toCsv([['계란이 좋아']])).toBe('﻿계란이 좋아\r\n');
});

test('collectionCsv: one row per order line, SGD per sheet', () => {
  const artists: Artist[] = [{ id: 'aJ', name: 'JUIMJUIM', aliases: [] }];
  const sheets: Sheet[] = [
    { id: 'egg', artistId: 'aJ', title: '계란이 좋아', tags: ['food', 'korean'], photoPath: null, thumbPath: null, photoBytes: 0, createdAt: '' },
    { id: 'none', artistId: null, title: 'No order yet', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, createdAt: '' },
  ];
  const orders: Order[] = [{
    id: 'o', orderDate: '2026-10-19', shop: 'Shop, Seoul', currency: 'KRW', shippingMinor: 3000,
    totalMinor: 15000, sgdPaidMinor: 1560, estimated: false, isUnknown: false, createdAt: '',
  }];
  const lines: OrderLine[] = [{ id: 'l', orderId: 'o', sheetId: 'egg', quantity: 4, priceMinor: 3000, estimated: false }];
  const usages: Usage[] = [{ id: 'u', sheetId: 'egg', quantity: 1, usedOn: '2026-10-20' }];
  const rows = collectionCsv({ artists, sheets, orders, lines, usages }).replace('﻿', '').trim().split('\r\n');
  expect(rows[0]).toBe('Title,Artist,Tags,Copies owned,Order date,Shop,Currency,Quantity,Price each,Price each (SGD),Estimated');
  expect(rows[1]).toBe('No order yet,,,0,,,,,,,');
  expect(rows[2]).toBe('계란이 좋아,JUIMJUIM,food; korean,3,2026-10-19,"Shop, Seoul",KRW,4,3000,3.12,no');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/domain/orderForm.test.ts tests/domain/csv.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `src/domain/orderForm.ts`**

```ts
import type { Order } from './types';
import { minorToInput, toMinor } from './currency';

export interface OrderForm {
  date: string;
  shop: string;
  currency: string;
  shipping: string;
  total: string;
  sgdPaid: string;
  estimated: boolean;
}

export const EMPTY_ORDER_FORM: OrderForm = {
  date: '', shop: '', currency: 'SGD', shipping: '', total: '', sgdPaid: '', estimated: false,
};

export interface ParsedOrder {
  orderDate: string | null;
  shop: string | null;
  currency: string;
  shippingMinor: number;
  totalMinor: number | null;
  sgdPaidMinor: number | null;
  estimated: boolean;
}

export type ParseResult = { ok: true; value: ParsedOrder } | { ok: false; error: string };

function amount(label: string, s: string, currency: string): { v: number | null } | { error: string } {
  if (!s.trim()) return { v: null };
  const v = toMinor(s, currency);
  return v === null ? { error: `${label}: not a valid amount.` } : { v };
}

export function parseOrderForm(f: OrderForm): ParseResult {
  const currency = f.currency.toUpperCase();
  const shipping = amount('Shipping', f.shipping, currency);
  if ('error' in shipping) return { ok: false, error: shipping.error };
  const total = amount('Order total', f.total, currency);
  if ('error' in total) return { ok: false, error: total.error };
  const paid = amount('SGD paid', f.sgdPaid, 'SGD');
  if ('error' in paid) return { ok: false, error: paid.error };
  return {
    ok: true,
    value: {
      orderDate: f.date.trim() || null,
      shop: f.shop.trim() || null,
      currency,
      shippingMinor: shipping.v ?? 0,
      totalMinor: total.v,
      sgdPaidMinor: paid.v,
      estimated: f.estimated,
    },
  };
}

export function orderToForm(o: Order): OrderForm {
  return {
    date: o.orderDate ?? '',
    shop: o.shop ?? '',
    currency: o.currency,
    shipping: o.shippingMinor ? minorToInput(o.shippingMinor, o.currency) : '',
    total: o.totalMinor === null ? '' : minorToInput(o.totalMinor, o.currency),
    sgdPaid: o.sgdPaidMinor === null ? '' : minorToInput(o.sgdPaidMinor, 'SGD'),
    estimated: o.estimated,
  };
}
```

- [ ] **Step 4: Write `src/domain/csv.ts`**

```ts
import type { Artist, Order, OrderLine, Sheet, Usage } from './types';
import { minorToInput } from './currency';
import { copiesOwned } from './holdings';
import { linesOf, unitSgdMinor } from './money';

type Cell = string | number | null;

export function csvEscape(v: Cell): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export interface CsvData {
  artists: Artist[];
  sheets: Sheet[];
  orders: Order[];
  lines: OrderLine[];
  usages: Usage[];
}

export function collectionCsv(d: CsvData): string {
  const artistName = new Map(d.artists.map((a) => [a.id, a.name]));
  const orderById = new Map(d.orders.map((o) => [o.id, o]));
  const rows: Cell[][] = [[
    'Title', 'Artist', 'Tags', 'Copies owned', 'Order date', 'Shop', 'Currency',
    'Quantity', 'Price each', 'Price each (SGD)', 'Estimated',
  ]];
  const sorted = [...d.sheets].sort((a, b) => a.title.localeCompare(b.title));
  for (const s of sorted) {
    const head: Cell[] = [
      s.title,
      s.artistId ? artistName.get(s.artistId) ?? '' : '',
      s.tags.join('; '),
      copiesOwned(s.id, d.lines, d.usages),
    ];
    const mine = d.lines.filter((l) => l.sheetId === s.id);
    if (mine.length === 0) {
      rows.push([...head, null, null, null, null, null, null, null]);
      continue;
    }
    for (const l of mine) {
      const o = orderById.get(l.orderId);
      if (!o) continue;
      const sgd = unitSgdMinor(l, o, linesOf(o, d.lines));
      rows.push([
        ...head,
        o.orderDate,
        o.shop,
        o.currency,
        l.quantity,
        l.priceMinor === null ? null : minorToInput(l.priceMinor, o.currency),
        sgd === null ? null : minorToInput(sgd, 'SGD'),
        o.estimated || l.estimated ? 'yes' : 'no',
      ]);
    }
  }
  return toCsv(rows);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/domain/orderForm.test.ts tests/domain/csv.test.ts`
Expected: PASS (7 tests). Sort note: `'No order yet'.localeCompare('계란이 좋아')` is negative in ICU (Latin before Hangul). If the environment orders differently, the row order assertion fails; in that case keep the code and adjust only the row indices in the test.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(domain): order form parsing and CSV export with BOM"
```

---

### Task 8: Repo interface and in-memory implementation

**Files:**
- Create: `src/data/repo.ts`, `src/data/token.ts`, `src/data/memoryRepo.ts`
- Test: `tests/data/memoryRepo.test.ts`

- [ ] **Step 1: Write `src/data/repo.ts`**

```ts
import type { Artist, Order, OrderLine, Sheet, ShareLink, Usage } from '../domain/types';

export interface Snapshot {
  artists: Artist[];
  sheets: Sheet[];
  orders: Order[];
  lines: OrderLine[];
  usages: Usage[];
}

export type NewSheet = Omit<Sheet, 'id' | 'createdAt'>;
export type SheetPatch = Partial<Pick<Sheet, 'artistId' | 'title' | 'tags'>>;
export type NewOrder = Omit<Order, 'id' | 'createdAt' | 'isUnknown'>;
export type NewLine = Omit<OrderLine, 'id'>;

export interface SharedSheet {
  sheetId: string;
  title: string;
  artist: string | null;
  thumbPath: string | null;
}

export interface Repo {
  loadAll(): Promise<Snapshot>;
  createArtist(name: string): Promise<Artist>;
  mergeArtists(keepId: string, mergeId: string): Promise<void>;
  createSheet(input: NewSheet): Promise<Sheet>;
  updateSheet(id: string, patch: SheetPatch): Promise<void>;
  /** Deletes the sheet, its order lines and usages, and any order left with no lines. */
  deleteSheet(id: string): Promise<void>;
  createOrder(input: NewOrder): Promise<Order>;
  updateOrder(id: string, patch: Partial<NewOrder>): Promise<void>;
  getOrCreateUnknownOrder(): Promise<Order>;
  addLine(input: NewLine): Promise<OrderLine>;
  addUsage(sheetId: string, quantity: number, usedOn: string): Promise<Usage>;
  getShareLink(): Promise<ShareLink | null>;
  setShareLinkEnabled(enabled: boolean): Promise<ShareLink>;
  sharedCollection(token: string): Promise<SharedSheet[]>;
}

export type PhotoKind = 'photos' | 'thumbs';

export interface PhotoStore {
  upload(kind: PhotoKind, blob: Blob): Promise<{ path: string; bytes: number }>;
  url(kind: PhotoKind, path: string): Promise<string>;
  remove(kind: PhotoKind, paths: string[]): Promise<void>;
}
```

- [ ] **Step 2: Write `src/data/token.ts`**

```ts
export function randomToken(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 3: Write the failing tests**

`tests/data/memoryRepo.test.ts`:
```ts
import { MemoryRepo } from '../../src/data/memoryRepo';
import type { NewOrder } from '../../src/data/repo';

const krwOrder: NewOrder = {
  orderDate: '2026-10-19', shop: 'JUIMJUIM', currency: 'KRW', shippingMinor: 3000,
  totalMinor: 15000, sgdPaidMinor: 1560, estimated: false,
};
const sheetInput = (title: string, artistId: string | null = null) => ({
  artistId, title, tags: [], photoPath: null, thumbPath: null, photoBytes: 0,
});

test('deleteSheet removes lines and usages, and orders left empty', async () => {
  const r = new MemoryRepo();
  const a = await r.createSheet(sheetInput('A'));
  const b = await r.createSheet(sheetInput('B'));
  const shared = await r.createOrder(krwOrder);
  const solo = await r.createOrder(krwOrder);
  await r.addLine({ orderId: shared.id, sheetId: a.id, quantity: 1, priceMinor: 3000, estimated: false });
  await r.addLine({ orderId: shared.id, sheetId: b.id, quantity: 1, priceMinor: 3000, estimated: false });
  await r.addLine({ orderId: solo.id, sheetId: a.id, quantity: 2, priceMinor: 3000, estimated: false });
  await r.addUsage(a.id, 1, '2026-10-20');

  await r.deleteSheet(a.id);
  const s = await r.loadAll();
  expect(s.sheets.map((x) => x.id)).toEqual([b.id]);
  expect(s.lines.every((l) => l.sheetId === b.id)).toBe(true);
  expect(s.usages).toHaveLength(0);
  expect(s.orders.map((o) => o.id)).toEqual([shared.id]);
});

test('getOrCreateUnknownOrder is created once', async () => {
  const r = new MemoryRepo();
  const u1 = await r.getOrCreateUnknownOrder();
  const u2 = await r.getOrCreateUnknownOrder();
  expect(u1.id).toBe(u2.id);
  expect(u1.isUnknown).toBe(true);
  expect(u1.sgdPaidMinor).toBeNull();
});

test('mergeArtists moves sheets and keeps the old name as alias', async () => {
  const r = new MemoryRepo();
  const keep = await r.createArtist('JUIMJUIM');
  const typo = await r.createArtist('Juimsuim');
  await r.createSheet(sheetInput('Egg', typo.id));
  await r.mergeArtists(keep.id, typo.id);
  const s = await r.loadAll();
  expect(s.artists).toEqual([{ id: keep.id, name: 'JUIMJUIM', aliases: ['Juimsuim'] }]);
  expect(s.sheets[0].artistId).toBe(keep.id);
});

test('addUsage rejects using more copies than owned', async () => {
  const r = new MemoryRepo();
  const a = await r.createSheet(sheetInput('A'));
  const o = await r.getOrCreateUnknownOrder();
  await r.addLine({ orderId: o.id, sheetId: a.id, quantity: 1, priceMinor: null, estimated: false });
  await expect(r.addUsage(a.id, 2, '2026-10-20')).rejects.toThrow('You only have 1 copy.');
});

test('sharedCollection: only when enabled, hides used-up, no price fields', async () => {
  const r = new MemoryRepo();
  const artist = await r.createArtist('papermilio');
  const w = await r.createSheet(sheetInput('Winter', artist.id));
  const s = await r.createSheet(sheetInput('Spring', artist.id));
  const o = await r.createOrder({ ...krwOrder, currency: 'SGD', totalMinor: null, sgdPaidMinor: null, shippingMinor: 0 });
  await r.addLine({ orderId: o.id, sheetId: w.id, quantity: 1, priceMinor: 450, estimated: false });
  await r.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: 450, estimated: false });
  await r.addUsage(s.id, 1, '2026-10-20');

  const off = await r.setShareLinkEnabled(false);
  expect(await r.sharedCollection(off.token)).toEqual([]);
  const on = await r.setShareLinkEnabled(true);
  expect(on.token).toBe(off.token);
  const shared = await r.sharedCollection(on.token);
  expect(shared).toEqual([{ sheetId: w.id, title: 'Winter', artist: 'papermilio', thumbPath: null }]);
  expect(Object.keys(shared[0]).sort()).toEqual(['artist', 'sheetId', 'thumbPath', 'title']);
  expect(await r.sharedCollection('wrong')).toEqual([]);
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run tests/data/memoryRepo.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 5: Write `src/data/memoryRepo.ts`**

```ts
import type { Artist, Order, OrderLine, Sheet, ShareLink, Usage } from '../domain/types';
import { copiesOwned, usageError } from '../domain/holdings';
import type { NewLine, NewOrder, NewSheet, PhotoKind, PhotoStore, Repo, SharedSheet, SheetPatch, Snapshot } from './repo';
import { randomToken } from './token';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class MemoryRepo implements Repo {
  private n = 0;
  private s: Snapshot = { artists: [], sheets: [], orders: [], lines: [], usages: [] };
  private share: ShareLink | null = null;

  private nextId(prefix: string): string {
    this.n += 1;
    return `${prefix}-${this.n}`;
  }

  private stamp(): string {
    return new Date(Date.UTC(2026, 0, 1) + this.n * 1000).toISOString();
  }

  async loadAll(): Promise<Snapshot> {
    return clone(this.s);
  }

  async createArtist(name: string): Promise<Artist> {
    const a: Artist = { id: this.nextId('artist'), name: name.trim(), aliases: [] };
    this.s.artists.push(a);
    return clone(a);
  }

  async mergeArtists(keepId: string, mergeId: string): Promise<void> {
    if (keepId === mergeId) throw new Error('Pick two different artists.');
    const keep = this.s.artists.find((a) => a.id === keepId);
    const merge = this.s.artists.find((a) => a.id === mergeId);
    if (!keep || !merge) throw new Error('Artist not found.');
    for (const sh of this.s.sheets) if (sh.artistId === mergeId) sh.artistId = keepId;
    keep.aliases = [...new Set([...keep.aliases, merge.name, ...merge.aliases])];
    this.s.artists = this.s.artists.filter((a) => a.id !== mergeId);
  }

  async createSheet(input: NewSheet): Promise<Sheet> {
    const id = this.nextId('sheet');
    const sh: Sheet = { ...input, id, createdAt: this.stamp() };
    this.s.sheets.push(sh);
    return clone(sh);
  }

  async updateSheet(id: string, patch: SheetPatch): Promise<void> {
    const sh = this.s.sheets.find((x) => x.id === id);
    if (!sh) throw new Error('Sheet not found.');
    Object.assign(sh, patch);
  }

  async deleteSheet(id: string): Promise<void> {
    const affected = new Set(this.s.lines.filter((l) => l.sheetId === id).map((l) => l.orderId));
    this.s.lines = this.s.lines.filter((l) => l.sheetId !== id);
    this.s.usages = this.s.usages.filter((u) => u.sheetId !== id);
    this.s.sheets = this.s.sheets.filter((x) => x.id !== id);
    this.s.orders = this.s.orders.filter(
      (o) => !affected.has(o.id) || this.s.lines.some((l) => l.orderId === o.id),
    );
  }

  async createOrder(input: NewOrder): Promise<Order> {
    const id = this.nextId('order');
    const o: Order = { ...input, id, isUnknown: false, createdAt: this.stamp() };
    this.s.orders.push(o);
    return clone(o);
  }

  async updateOrder(id: string, patch: Partial<NewOrder>): Promise<void> {
    const o = this.s.orders.find((x) => x.id === id);
    if (!o) throw new Error('Order not found.');
    Object.assign(o, patch);
  }

  async getOrCreateUnknownOrder(): Promise<Order> {
    const existing = this.s.orders.find((o) => o.isUnknown);
    if (existing) return clone(existing);
    const id = this.nextId('order');
    const o: Order = {
      id, orderDate: null, shop: null, currency: 'SGD', shippingMinor: 0, totalMinor: null,
      sgdPaidMinor: null, estimated: false, isUnknown: true, createdAt: this.stamp(),
    };
    this.s.orders.push(o);
    return clone(o);
  }

  async addLine(input: NewLine): Promise<OrderLine> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error('Quantity must be 1 or more.');
    const l: OrderLine = { ...input, id: this.nextId('line') };
    this.s.lines.push(l);
    return clone(l);
  }

  async addUsage(sheetId: string, quantity: number, usedOn: string): Promise<Usage> {
    const err = usageError(sheetId, quantity, this.s.lines, this.s.usages);
    if (err) throw new Error(err);
    const u: Usage = { id: this.nextId('usage'), sheetId, quantity, usedOn };
    this.s.usages.push(u);
    return clone(u);
  }

  async getShareLink(): Promise<ShareLink | null> {
    return this.share ? clone(this.share) : null;
  }

  async setShareLinkEnabled(enabled: boolean): Promise<ShareLink> {
    if (!this.share) this.share = { token: randomToken(), enabled };
    else this.share.enabled = enabled;
    return clone(this.share);
  }

  async sharedCollection(token: string): Promise<SharedSheet[]> {
    if (!this.share || !this.share.enabled || this.share.token !== token) return [];
    const name = new Map(this.s.artists.map((a) => [a.id, a.name]));
    return this.s.sheets
      .filter((sh) => copiesOwned(sh.id, this.s.lines, this.s.usages) > 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((sh) => ({
        sheetId: sh.id,
        title: sh.title,
        artist: sh.artistId ? name.get(sh.artistId) ?? null : null,
        thumbPath: sh.thumbPath,
      }));
  }
}

export class MemoryPhotoStore implements PhotoStore {
  private n = 0;
  private urls = new Map<string, string>();

  async upload(kind: PhotoKind, blob: Blob): Promise<{ path: string; bytes: number }> {
    this.n += 1;
    const path = `${kind}/mem-${this.n}.jpg`;
    this.urls.set(path, URL.createObjectURL(blob));
    return { path, bytes: blob.size };
  }

  async url(_kind: PhotoKind, path: string): Promise<string> {
    return this.urls.get(path) ?? '';
  }

  async remove(_kind: PhotoKind, paths: string[]): Promise<void> {
    for (const p of paths) {
      const u = this.urls.get(p);
      if (u) URL.revokeObjectURL(u);
      this.urls.delete(p);
    }
  }
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run tests/data/memoryRepo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(data): Repo/PhotoStore interfaces and in-memory implementation"
```

---

### Task 9: Supabase database schema and setup guide

**Files:**
- Create: `supabase/migrations/001_init.sql`, `docs/setup/supabase.md`

This workspace cannot reach supabase.com, so the SQL is run by the user (guide below). Its behaviour is checked in Task 18 by `scripts/check-share-privacy.mjs` in GitHub Actions.

- [ ] **Step 1: Write `supabase/migrations/001_init.sql`**

```sql
-- Sticker Shelf schema. Run once in Supabase → SQL Editor.
create table public.artists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.sheets (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  artist_id uuid references public.artists on delete set null,
  title text not null,
  tags text[] not null default '{}',
  photo_path text,
  thumb_path text,
  photo_bytes integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  order_date date,
  shop text,
  currency text not null default 'SGD',
  shipping_minor bigint not null default 0,
  total_minor bigint,
  sgd_paid_minor bigint,
  estimated boolean not null default false,
  is_unknown boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index orders_one_unknown_per_owner on public.orders (owner) where is_unknown;

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  order_id uuid not null references public.orders on delete cascade,
  sheet_id uuid not null references public.sheets on delete cascade,
  quantity integer not null check (quantity >= 1),
  price_minor bigint,
  estimated boolean not null default false
);

create table public.usages (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  sheet_id uuid not null references public.sheets on delete cascade,
  quantity integer not null check (quantity >= 1),
  used_on date not null default current_date
);

create table public.share_links (
  owner uuid primary key default auth.uid() references auth.users on delete cascade,
  token text not null unique,
  enabled boolean not null default false
);

-- Row-level security: each signed-in user sees only their own rows; anonymous sees nothing.
do $$
declare t text;
begin
  foreach t in array array['artists','sheets','orders','order_lines','usages','share_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

-- Share link: returns ONLY id, title, artist, thumbnail path. Never prices, orders or shops.
create or replace function public.shared_collection(p_token text)
returns table (sheet_id uuid, title text, artist text, thumb_path text)
language sql stable security definer set search_path = public as $$
  select s.id, s.title, a.name, s.thumb_path
  from public.share_links l
  join public.sheets s on s.owner = l.owner
  left join public.artists a on a.id = s.artist_id
  where l.token = p_token and l.enabled
    and (select coalesce(sum(ol.quantity), 0) from public.order_lines ol where ol.sheet_id = s.id)
      > (select coalesce(sum(u.quantity), 0) from public.usages u where u.sheet_id = s.id)
  order by s.created_at desc;
$$;
revoke all on function public.shared_collection(text) from public;
grant execute on function public.shared_collection(text) to anon, authenticated;

-- Keep-alive target for the weekly GitHub Action.
create or replace function public.ping() returns integer language sql stable as $$ select 1 $$;
grant execute on function public.ping() to anon;

-- Photo storage: private full photos, public thumbnails (unguessable paths).
insert into storage.buckets (id, name, public) values ('photos', 'photos', false), ('thumbs', 'thumbs', true)
on conflict (id) do nothing;

create policy own_files on storage.objects for all to authenticated
  using (bucket_id in ('photos', 'thumbs') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('photos', 'thumbs') and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 2: Write `docs/setup/supabase.md` (user-facing steps)**

```markdown
# Set up Supabase (free) — about 10 minutes

Menu names below were written in Oct 2026; if Supabase renamed something, look for the closest match.

1. Go to supabase.com → sign up (free) → **New project**.
   - Name: `sticker-shelf` · Region: **Southeast Asia (Singapore)** · set a database password and keep it safe.
2. Left menu → **SQL Editor** → **New query** → paste everything from `supabase/migrations/001_init.sql` → **Run**.
   Expected: "Success. No rows returned".
3. Left menu → **Authentication** → **Users** → **Add user** → **Create new user** → your email,
   tick **Auto Confirm User**. (No password needed for the app — it uses an email code.)
4. **Authentication** → **Sign In / Providers** (or **Providers → Email**) → turn **off** "Allow new users to sign up".
   This makes you the only person who can log in.
5. **Authentication** → **Email Templates** → **Magic Link** → make sure the message contains `{{ .Token }}`
   (the 6-digit code). Example body: `Your Sticker Shelf code is {{ .Token }}`. Save.
6. **Project Settings** → **API** (or **Data API**) → copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / publishable key** (long text). This key is designed to be public; your data is protected by
     the row-level security rules in step 2.
   Put both into GitHub as described in `docs/setup/github.md` step 4.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): Supabase schema with RLS, share RPC, storage buckets; setup guide"
```

---

### Task 10: Supabase repo and photo store

**Files:**
- Create: `src/data/supabaseClient.ts`, `src/data/supabaseRepo.ts`
- Test: typecheck only (no network here); behaviour is covered by MemoryRepo tests plus the Task 18 privacy check.

- [ ] **Step 1: Write `src/data/supabaseClient.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null → demo mode (in-memory, nothing saved). */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
```

- [ ] **Step 2: Write `src/data/supabaseRepo.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Artist, Order, OrderLine, Sheet, ShareLink, Usage } from '../domain/types';
import { usageError } from '../domain/holdings';
import type { NewLine, NewOrder, NewSheet, PhotoKind, PhotoStore, Repo, SharedSheet, SheetPatch, Snapshot } from './repo';
import { randomToken } from './token';

type Row = Record<string, unknown>;
interface Res<T> { data: T | null; error: { message: string } | null }

function ok<T>(r: Res<T>): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

const artistFrom = (r: Row): Artist => ({ id: r.id as string, name: r.name as string, aliases: (r.aliases as string[]) ?? [] });
const sheetFrom = (r: Row): Sheet => ({
  id: r.id as string, artistId: (r.artist_id as string | null) ?? null, title: r.title as string,
  tags: (r.tags as string[]) ?? [], photoPath: (r.photo_path as string | null) ?? null,
  thumbPath: (r.thumb_path as string | null) ?? null, photoBytes: Number(r.photo_bytes ?? 0),
  createdAt: r.created_at as string,
});
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const orderFrom = (r: Row): Order => ({
  id: r.id as string, orderDate: (r.order_date as string | null) ?? null, shop: (r.shop as string | null) ?? null,
  currency: r.currency as string, shippingMinor: Number(r.shipping_minor ?? 0), totalMinor: num(r.total_minor),
  sgdPaidMinor: num(r.sgd_paid_minor), estimated: Boolean(r.estimated), isUnknown: Boolean(r.is_unknown),
  createdAt: r.created_at as string,
});
const lineFrom = (r: Row): OrderLine => ({
  id: r.id as string, orderId: r.order_id as string, sheetId: r.sheet_id as string,
  quantity: Number(r.quantity), priceMinor: num(r.price_minor), estimated: Boolean(r.estimated),
});
const usageFrom = (r: Row): Usage => ({
  id: r.id as string, sheetId: r.sheet_id as string, quantity: Number(r.quantity), usedOn: r.used_on as string,
});

const orderTo = (o: Partial<NewOrder>): Row => {
  const m: Row = {};
  if (o.orderDate !== undefined) m.order_date = o.orderDate;
  if (o.shop !== undefined) m.shop = o.shop;
  if (o.currency !== undefined) m.currency = o.currency;
  if (o.shippingMinor !== undefined) m.shipping_minor = o.shippingMinor;
  if (o.totalMinor !== undefined) m.total_minor = o.totalMinor;
  if (o.sgdPaidMinor !== undefined) m.sgd_paid_minor = o.sgdPaidMinor;
  if (o.estimated !== undefined) m.estimated = o.estimated;
  return m;
};

const PAGE = 1000; // PostgREST returns at most 1000 rows per request by default

export class SupabaseRepo implements Repo {
  constructor(private db: SupabaseClient) {}

  private async selectAll(table: string): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = ok(await this.db.from(table).select('*').range(from, from + PAGE - 1)) as Row[];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  async loadAll(): Promise<Snapshot> {
    const [a, s, o, l, u] = await Promise.all(
      ['artists', 'sheets', 'orders', 'order_lines', 'usages'].map((t) => this.selectAll(t)),
    );
    return {
      artists: a.map(artistFrom), sheets: s.map(sheetFrom), orders: o.map(orderFrom),
      lines: l.map(lineFrom), usages: u.map(usageFrom),
    };
  }

  async createArtist(name: string): Promise<Artist> {
    return artistFrom(ok(await this.db.from('artists').insert({ name: name.trim() }).select().single()) as Row);
  }

  async mergeArtists(keepId: string, mergeId: string): Promise<void> {
    if (keepId === mergeId) throw new Error('Pick two different artists.');
    const rows = ok(await this.db.from('artists').select('*').in('id', [keepId, mergeId])) as Row[];
    const keep = rows.map(artistFrom).find((a) => a.id === keepId);
    const merge = rows.map(artistFrom).find((a) => a.id === mergeId);
    if (!keep || !merge) throw new Error('Artist not found.');
    ok(await this.db.from('sheets').update({ artist_id: keepId }).eq('artist_id', mergeId));
    const aliases = [...new Set([...keep.aliases, merge.name, ...merge.aliases])];
    ok(await this.db.from('artists').update({ aliases }).eq('id', keepId));
    ok(await this.db.from('artists').delete().eq('id', mergeId));
  }

  async createSheet(input: NewSheet): Promise<Sheet> {
    const row = {
      artist_id: input.artistId, title: input.title, tags: input.tags, photo_path: input.photoPath,
      thumb_path: input.thumbPath, photo_bytes: input.photoBytes,
    };
    return sheetFrom(ok(await this.db.from('sheets').insert(row).select().single()) as Row);
  }

  async updateSheet(id: string, patch: SheetPatch): Promise<void> {
    const m: Row = {};
    if (patch.artistId !== undefined) m.artist_id = patch.artistId;
    if (patch.title !== undefined) m.title = patch.title;
    if (patch.tags !== undefined) m.tags = patch.tags;
    ok(await this.db.from('sheets').update(m).eq('id', id));
  }

  async deleteSheet(id: string): Promise<void> {
    const affected = (ok(await this.db.from('order_lines').select('order_id').eq('sheet_id', id)) as Row[])
      .map((r) => r.order_id as string);
    ok(await this.db.from('sheets').delete().eq('id', id)); // cascades to lines and usages
    for (const orderId of new Set(affected)) {
      const left = ok(await this.db.from('order_lines').select('id').eq('order_id', orderId).limit(1)) as Row[];
      if (left.length === 0) ok(await this.db.from('orders').delete().eq('id', orderId));
    }
  }

  async createOrder(input: NewOrder): Promise<Order> {
    return orderFrom(ok(await this.db.from('orders').insert(orderTo(input)).select().single()) as Row);
  }

  async updateOrder(id: string, patch: Partial<NewOrder>): Promise<void> {
    ok(await this.db.from('orders').update(orderTo(patch)).eq('id', id));
  }

  async getOrCreateUnknownOrder(): Promise<Order> {
    const found = ok(await this.db.from('orders').select('*').eq('is_unknown', true).limit(1)) as Row[];
    if (found.length) return orderFrom(found[0]);
    return orderFrom(ok(await this.db.from('orders').insert({ is_unknown: true, currency: 'SGD' }).select().single()) as Row);
  }

  async addLine(input: NewLine): Promise<OrderLine> {
    const row = {
      order_id: input.orderId, sheet_id: input.sheetId, quantity: input.quantity,
      price_minor: input.priceMinor, estimated: input.estimated,
    };
    return lineFrom(ok(await this.db.from('order_lines').insert(row).select().single()) as Row);
  }

  async addUsage(sheetId: string, quantity: number, usedOn: string): Promise<Usage> {
    const lines = (ok(await this.db.from('order_lines').select('*').eq('sheet_id', sheetId)) as Row[]).map(lineFrom);
    const usages = (ok(await this.db.from('usages').select('*').eq('sheet_id', sheetId)) as Row[]).map(usageFrom);
    const err = usageError(sheetId, quantity, lines, usages);
    if (err) throw new Error(err);
    return usageFrom(ok(await this.db.from('usages').insert({ sheet_id: sheetId, quantity, used_on: usedOn }).select().single()) as Row);
  }

  async getShareLink(): Promise<ShareLink | null> {
    const rows = ok(await this.db.from('share_links').select('*').limit(1)) as Row[];
    return rows.length ? { token: rows[0].token as string, enabled: Boolean(rows[0].enabled) } : null;
  }

  async setShareLinkEnabled(enabled: boolean): Promise<ShareLink> {
    const current = await this.getShareLink();
    if (current) {
      ok(await this.db.from('share_links').update({ enabled }).eq('token', current.token));
      return { ...current, enabled };
    }
    const token = randomToken();
    ok(await this.db.from('share_links').insert({ token, enabled }));
    return { token, enabled };
  }

  async sharedCollection(token: string): Promise<SharedSheet[]> {
    const rows = ok(await this.db.rpc('shared_collection', { p_token: token })) as Row[];
    return rows.map((r) => ({
      sheetId: r.sheet_id as string, title: r.title as string,
      artist: (r.artist as string | null) ?? null, thumbPath: (r.thumb_path as string | null) ?? null,
    }));
  }
}

export class SupabasePhotoStore implements PhotoStore {
  /** userId may be '' for read-only use (shared view). */
  constructor(private db: SupabaseClient, private userId: string) {}

  async upload(kind: PhotoKind, blob: Blob): Promise<{ path: string; bytes: number }> {
    if (!this.userId) throw new Error('Not signed in.');
    const path = `${this.userId}/${crypto.randomUUID()}.jpg`;
    ok(await this.db.storage.from(kind).upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
    return { path, bytes: blob.size };
  }

  async url(kind: PhotoKind, path: string): Promise<string> {
    if (kind === 'thumbs') return this.db.storage.from('thumbs').getPublicUrl(path).data.publicUrl;
    const r = ok(await this.db.storage.from('photos').createSignedUrl(path, 3600)) as { signedUrl: string };
    return r.signedUrl;
  }

  async remove(kind: PhotoKind, paths: string[]): Promise<void> {
    if (paths.length) ok(await this.db.storage.from(kind).remove(paths));
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no output. If supabase-js types reject `ok(...)` on a builder result, `await` the builder first (as shown); every call above already awaits.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(data): Supabase repo and photo store"
```

---

### Task 11: Image crop and compression

**Files:**
- Create: `src/image/geometry.ts`, `src/image/crop.ts`, `src/ui/CropBox.tsx`
- Test: `tests/image/geometry.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/image/geometry.test.ts`:
```ts
import { fitWithin, normalizeRect, fullRect } from '../../src/image/geometry';

test('fitWithin keeps aspect ratio and never upscales', () => {
  expect(fitWithin(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
  expect(fitWithin(3000, 4000, 1600)).toEqual({ w: 1200, h: 1600 });
  expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });
});

test('normalizeRect works for any drag direction and clamps', () => {
  expect(normalizeRect({ x: 50, y: 80 }, { x: 10, y: 20 }, 100, 100)).toEqual({ x: 10, y: 20, w: 40, h: 60 });
  expect(normalizeRect({ x: -5, y: 10 }, { x: 120, y: 30 }, 100, 100)).toEqual({ x: 0, y: 10, w: 100, h: 20 });
});

test('fullRect leaves a 3% margin', () => {
  expect(fullRect(1000, 2000)).toEqual({ x: 30, y: 60, w: 940, h: 1880 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/image/geometry.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/image/geometry.ts`**

```ts
export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function fitWithin(w: number, h: number, maxSide: number): { w: number; h: number } {
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

export function normalizeRect(a: Point, b: Point, maxW: number, maxH: number): Rect {
  const x1 = clamp(Math.min(a.x, b.x), 0, maxW), x2 = clamp(Math.max(a.x, b.x), 0, maxW);
  const y1 = clamp(Math.min(a.y, b.y), 0, maxH), y2 = clamp(Math.max(a.y, b.y), 0, maxH);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function fullRect(w: number, h: number): Rect {
  const mx = Math.round(w * 0.03), my = Math.round(h * 0.03);
  return { x: mx, y: my, w: w - 2 * mx, h: h - 2 * my };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/image/geometry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `src/image/crop.ts`** (browser-only; exercised in the Task 19 browser check)

```ts
import { fitWithin, type Rect } from './geometry';

export async function loadImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

export async function cropToJpeg(img: ImageBitmap, rect: Rect, maxSide: number, quality: number): Promise<Blob> {
  const { w, h } = fitWithin(rect.w, rect.h, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode photo.'))), 'image/jpeg', quality),
  );
}

/** Full photo ≈ 1600 px long side (target ~0.3 MB); thumbnail 400 px. */
export const PHOTO = { maxSide: 1600, quality: 0.82 };
export const THUMB = { maxSide: 400, quality: 0.75 };
```

- [ ] **Step 6: Write `src/ui/CropBox.tsx`**

```tsx
import { useRef } from 'react';
import { fullRect, normalizeRect, type Point, type Rect } from '../image/geometry';

interface Props {
  src: string;
  naturalW: number;
  naturalH: number;
  value: Rect;
  onChange: (r: Rect) => void;
}

export function CropBox({ src, naturalW, naturalH, value, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<Point | null>(null);

  const toNatural = (e: React.PointerEvent): Point => {
    const r = box.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * naturalW) / r.width, y: ((e.clientY - r.top) * naturalH) / r.height };
  };

  return (
    <div className="crop">
      <div
        ref={box}
        className="crop-area"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = toNatural(e);
        }}
        onPointerMove={(e) => {
          if (start.current) onChange(normalizeRect(start.current, toNatural(e), naturalW, naturalH));
        }}
        onPointerUp={() => {
          start.current = null;
          if (value.w < 20 || value.h < 20) onChange(fullRect(naturalW, naturalH));
        }}
      >
        <img src={src} alt="Photo to crop" draggable={false} />
        <div
          className="crop-rect"
          style={{
            left: `${(value.x / naturalW) * 100}%`,
            top: `${(value.y / naturalH) * 100}%`,
            width: `${(value.w / naturalW) * 100}%`,
            height: `${(value.h / naturalH) * 100}%`,
          }}
        />
      </div>
      <p className="hint">Drag across the sheet to crop it. Tap once to reset.</p>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck && npx vitest run tests/image`
Expected: no tsc output; 3 tests pass.

```bash
git add -A
git commit -m "feat(image): crop geometry, JPEG compression, CropBox"
```

---

### Task 12: App shell — data provider, demo mode, login, navigation, styles

**Files:**
- Create: `src/ui/DataProvider.tsx`, `src/ui/usePhotoUrl.ts`, `src/ui/Login.tsx`, `src/ui/Shell.tsx`
- Modify: `src/App.tsx` (replace placeholder), `src/styles.css`
- Create (placeholders replaced in Tasks 13–17): `src/ui/pages/{Collection,AddOrder,SheetDetail,Spending,Orders,Settings,SharedView}.tsx`
- Test: `tests/ui/shell.test.tsx`

- [ ] **Step 1: Write `src/ui/DataProvider.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PhotoStore, Repo, Snapshot } from '../data/repo';

const EMPTY: Snapshot = { artists: [], sheets: [], orders: [], lines: [], usages: [] };

export interface DataValue extends Snapshot {
  repo: Repo;
  photos: PhotoStore;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const Ctx = createContext<DataValue | null>(null);

export function DataProvider({ repo, photos, children }: { repo: Repo; photos: PhotoStore; children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSnap(await repo.loadAll());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return <Ctx.Provider value={{ ...snap, repo, photos, loading, error, reload }}>{children}</Ctx.Provider>;
}

export function useData(): DataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}
```

- [ ] **Step 2: Write `src/ui/usePhotoUrl.ts`**

```ts
import { useEffect, useState } from 'react';
import type { PhotoKind } from '../data/repo';
import { useData } from './DataProvider';

export function usePhotoUrl(kind: PhotoKind, path: string | null): string | null {
  const { photos } = useData();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path) {
      photos.url(kind, path).then((u) => alive && setUrl(u)).catch(() => alive && setUrl(null));
    }
    return () => {
      alive = false;
    };
  }, [photos, kind, path]);
  return url;
}
```

- [ ] **Step 3: Write `src/ui/Login.tsx`**

```tsx
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const send = async () => {
    setMsg(null);
    const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    if (error) setMsg(error.message);
    else setSent(true);
  };

  const verify = async () => {
    setMsg(null);
    const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error) setMsg(error.message);
  };

  return (
    <main className="page narrow">
      <h1>Sticker Shelf</h1>
      {!sent ? (
        <>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <button className="primary" onClick={send} disabled={!email.includes('@')}>Send me a code</button>
        </>
      ) : (
        <>
          <p>We emailed a 6-digit code to {email}.</p>
          <label>Code<input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></label>
          <button className="primary" onClick={verify} disabled={code.trim().length < 6}>Sign in</button>
          <button onClick={() => setSent(false)}>Use a different email</button>
        </>
      )}
      {msg && <p className="error">{msg}</p>}
    </main>
  );
}
```

- [ ] **Step 4: Write `src/ui/Shell.tsx`**

```tsx
import { NavLink, Route, Routes } from 'react-router-dom';
import { useData } from './DataProvider';
import { Collection } from './pages/Collection';
import { AddOrder } from './pages/AddOrder';
import { SheetDetail } from './pages/SheetDetail';
import { Spending } from './pages/Spending';
import { Orders } from './pages/Orders';
import { Settings } from './pages/Settings';

export function Shell({ demo, onSignOut }: { demo: boolean; onSignOut?: () => void }) {
  const { loading, error } = useData();
  return (
    <div className="app">
      {demo && <div className="banner">Demo mode: nothing is saved. Add Supabase keys to go live.</div>}
      {error && <div className="banner error">Couldn't load your collection: {error}</div>}
      {loading ? (
        <p className="page">Loading…</p>
      ) : (
        <Routes>
          <Route path="/" element={<Collection />} />
          <Route path="/add" element={<AddOrder />} />
          <Route path="/sheet/:id" element={<SheetDetail />} />
          <Route path="/spending" element={<Spending />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/settings" element={<Settings onSignOut={onSignOut} />} />
          <Route path="*" element={<Collection />} />
        </Routes>
      )}
      <nav className="tabs">
        <NavLink to="/" end>Collection</NavLink>
        <NavLink to="/add">➕ Add</NavLink>
        <NavLink to="/spending">Spending</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/App.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './data/supabaseClient';
import { MemoryPhotoStore, MemoryRepo } from './data/memoryRepo';
import { SupabasePhotoStore, SupabaseRepo } from './data/supabaseRepo';
import { DataProvider } from './ui/DataProvider';
import { Shell } from './ui/Shell';
import { Login } from './ui/Login';
import { SharedView } from './ui/pages/SharedView';

export function App() {
  const { pathname } = useLocation();
  const shared = pathname.match(/^\/s\/([^/]+)$/);
  if (shared) return <SharedView token={shared[1]} client={supabase} />;
  if (!supabase) return <DemoApp />;
  return <SignedInApp client={supabase} />;
}

function DemoApp() {
  const stores = useMemo(() => ({ repo: new MemoryRepo(), photos: new MemoryPhotoStore() }), []);
  return (
    <DataProvider repo={stores.repo} photos={stores.photos}>
      <Shell demo />
    </DataProvider>
  );
}

function SignedInApp({ client }: { client: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [client]);

  const userId = session?.user.id ?? '';
  const stores = useMemo(
    () => ({ repo: new SupabaseRepo(client), photos: new SupabasePhotoStore(client, userId) }),
    [client, userId],
  );

  if (session === undefined) return <p className="page">Loading…</p>;
  if (session === null) return <Login client={client} />;
  return (
    <DataProvider key={userId} repo={stores.repo} photos={stores.photos}>
      <Shell demo={false} onSignOut={() => void client.auth.signOut()} />
    </DataProvider>
  );
}
```

- [ ] **Step 6: Create placeholder pages** (each replaced by its own task)

For each of `Collection`, `AddOrder`, `SheetDetail`, `Spending`, `Orders`, create `src/ui/pages/<Name>.tsx`:
```tsx
export function Collection() {
  return <main className="page"><h1>Collection</h1></main>;
}
```
(changing the function name and heading for each file).

`src/ui/pages/Settings.tsx` placeholder:
```tsx
export function Settings(_props: { onSignOut?: () => void }) {
  return <main className="page"><h1>Settings</h1></main>;
}
```

`src/ui/pages/SharedView.tsx` placeholder:
```tsx
import type { SupabaseClient } from '@supabase/supabase-js';
export function SharedView(_props: { token: string; client: SupabaseClient | null }) {
  return <main className="page"><h1>Shared collection</h1></main>;
}
```

- [ ] **Step 7: Write `src/styles.css`**

```css
:root {
  --bg: #fffaf3; --card: #ffffff; --ink: #2b2620; --muted: #7a6f63; --line: #eadfce;
  --accent: #f2a65a; --accent-ink: #5a3410; --warn: #b5541c; --ok: #3d7a3d;
  font-family: system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: var(--ink); background: var(--bg);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); }
.app { min-height: 100vh; padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
.page { padding: 16px; max-width: 900px; margin: 0 auto; }
.page.narrow { max-width: 420px; }
h1 { font-size: 1.4rem; margin: 8px 0 16px; }
h2 { font-size: 1.1rem; margin: 20px 0 8px; }
label { display: block; margin: 10px 0; font-size: .9rem; color: var(--muted); }
input, select { display: block; width: 100%; margin-top: 4px; padding: 10px; font-size: 1rem;
  border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: var(--ink); }
input[type="checkbox"] { display: inline; width: auto; margin-right: 6px; }
button { padding: 10px 14px; font-size: 1rem; border-radius: 10px; border: 1px solid var(--line);
  background: var(--card); color: var(--ink); margin: 4px 4px 4px 0; min-height: 44px; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
button.danger { color: var(--warn); border-color: var(--warn); }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: end; }
.row > * { flex: 1 1 140px; }
.banner { background: #fff1d6; padding: 8px 16px; font-size: .9rem; }
.error { color: var(--warn); }
.warn { background: #fff1d6; border-radius: 10px; padding: 10px; margin: 8px 0; }
.hint { color: var(--muted); font-size: .85rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.tile { background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
  text-decoration: none; color: inherit; }
.tile img, .tile .noimg { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; background: #f3ebe0; display: block; }
.tile .meta { padding: 8px; font-size: .85rem; }
.tile .title { font-weight: 600; }
.tile .count { float: right; color: var(--accent-ink); font-weight: 600; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin: 10px 0; }
.bar { height: 10px; background: var(--accent); border-radius: 5px; }
.tabs { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: var(--card);
  border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
.tabs a { flex: 1; text-align: center; padding: 14px 4px; text-decoration: none; color: var(--muted); font-size: .9rem; }
.tabs a.active { color: var(--accent-ink); font-weight: 700; }
.crop-area { position: relative; touch-action: none; user-select: none; }
.crop-area img { width: 100%; display: block; }
.crop-rect { position: absolute; border: 3px solid var(--accent); box-shadow: 0 0 0 9999px rgba(0,0,0,.35); }
.detail-photo { width: 100%; max-height: 60vh; object-fit: contain; background: #f3ebe0; border-radius: 12px; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; }
td, th { text-align: left; padding: 6px 4px; border-bottom: 1px solid var(--line); }
```

- [ ] **Step 8: Write the failing shell test**

`tests/ui/shell.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Shell } from '../../src/ui/Shell';

test('demo shell shows banner and bottom tabs', async () => {
  render(
    <MemoryRouter>
      <DataProvider repo={new MemoryRepo()} photos={new MemoryPhotoStore()}>
        <Shell demo />
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/Demo mode/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Spending' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '➕ Add' })).toBeTruthy();
});
```

- [ ] **Step 9: Run tests, typecheck, build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass. tsc prints nothing. Vite prints `dist/index.html` and a PWA `sw.js` line. The icon files are missing until Task 18, so the manifest still references them; the build does not fail.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(ui): app shell, demo mode, email-code login, navigation, styles"
```

---

### Task 13: Collection page

**Files:**
- Modify: `src/ui/pages/Collection.tsx`
- Test: `tests/ui/collection.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/ui/collection.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Collection } from '../../src/ui/pages/Collection';

async function seed() {
  const r = new MemoryRepo();
  const a = await r.createArtist('papermilio');
  const w = await r.createSheet({ artistId: a.id, title: 'Winter', tags: ['seasonal'], photoPath: null, thumbPath: null, photoBytes: 0 });
  const s = await r.createSheet({ artistId: a.id, title: 'Spring', tags: ['seasonal'], photoPath: null, thumbPath: null, photoBytes: 0 });
  const o = await r.getOrCreateUnknownOrder();
  await r.addLine({ orderId: o.id, sheetId: w.id, quantity: 3, priceMinor: null, estimated: false });
  await r.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: null, estimated: false });
  await r.addUsage(s.id, 1, '2026-10-19');
  return r;
}

test('shows owned sheets with copy count; used-up hidden until toggled', async () => {
  render(
    <MemoryRouter>
      <DataProvider repo={await seed()} photos={new MemoryPhotoStore()}>
        <Collection />
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Winter')).toBeTruthy();
  expect(screen.getByText('×3')).toBeTruthy();
  expect(screen.queryByText('Spring')).toBeNull();
  fireEvent.click(screen.getByLabelText('Show used up'));
  expect(screen.getByText('Spring')).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('Search title, artist, tag'), { target: { value: 'win' } });
  expect(screen.queryByText('Spring')).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/collection.test.tsx`
Expected: FAIL, unable to find text "Winter".

- [ ] **Step 3: Write `src/ui/pages/Collection.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Sheet } from '../../domain/types';
import { EMPTY_FILTER, allTags, filterSheets, type SheetFilter } from '../../domain/filter';
import { copiesOwned } from '../../domain/holdings';
import { toMinor } from '../../domain/currency';
import { useData } from '../DataProvider';
import { usePhotoUrl } from '../usePhotoUrl';

export function Collection() {
  const d = useData();
  const [f, setF] = useState<SheetFilter>(EMPTY_FILTER);
  const [minS, setMinS] = useState('');
  const [maxS, setMaxS] = useState('');
  const shown = useMemo(() => filterSheets(f, d), [f, d]);
  const tags = useMemo(() => allTags(d.sheets), [d.sheets]);
  const artistName = useMemo(() => new Map(d.artists.map((a) => [a.id, a.name])), [d.artists]);

  return (
    <main className="page">
      <h1>Collection <span className="hint">({shown.length})</span></h1>
      <input placeholder="Search title, artist, tag" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <div className="row">
        <select aria-label="Artist" value={f.artistId ?? ''} onChange={(e) => setF({ ...f, artistId: e.target.value || null })}>
          <option value="">All artists</option>
          {d.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select aria-label="Tag" value={f.tag ?? ''} onChange={(e) => setF({ ...f, tag: e.target.value || null })}>
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <label>
        <input type="checkbox" checked={f.showUsedUp} onChange={(e) => setF({ ...f, showUsedUp: e.target.checked })} />
        Show used up
      </label>
      <details>
        <summary className="hint">More filters (date, price)</summary>
        <div className="row">
          <label>Bought from<input type="date" value={f.dateFrom ?? ''} onChange={(e) => setF({ ...f, dateFrom: e.target.value || null })} /></label>
          <label>to<input type="date" value={f.dateTo ?? ''} onChange={(e) => setF({ ...f, dateTo: e.target.value || null })} /></label>
        </div>
        <div className="row">
          <label>Min S$ each<input inputMode="decimal" value={minS} onChange={(e) => { setMinS(e.target.value); setF({ ...f, minSgdMinor: toMinor(e.target.value, 'SGD') }); }} /></label>
          <label>Max S$ each<input inputMode="decimal" value={maxS} onChange={(e) => { setMaxS(e.target.value); setF({ ...f, maxSgdMinor: toMinor(e.target.value, 'SGD') }); }} /></label>
        </div>
      </details>
      {d.sheets.length === 0 && <p className="hint">No sheets yet. Tap ➕ Add to log your first one.</p>}
      <div className="grid">
        {shown.map((s) => (
          <Tile key={s.id} sheet={s} artist={s.artistId ? artistName.get(s.artistId) ?? '' : ''}
            copies={copiesOwned(s.id, d.lines, d.usages)} />
        ))}
      </div>
    </main>
  );
}

function Tile({ sheet, artist, copies }: { sheet: Sheet; artist: string; copies: number }) {
  const url = usePhotoUrl('thumbs', sheet.thumbPath);
  return (
    <Link className="tile" to={`/sheet/${sheet.id}`}>
      {url ? <img src={url} alt={sheet.title} loading="lazy" /> : <div className="noimg" />}
      <div className="meta">
        <span className="count">{copies > 0 ? `×${copies}` : 'used up'}</span>
        <div className="title">{sheet.title}</div>
        <div className="hint">{artist}</div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/ui/collection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): collection grid with search, filters, used-up toggle"
```

---

### Task 14: Add order — order fields, sheet drafts, duplicate warning, save

**Files:**
- Create: `src/ui/OrderFields.tsx`, `src/ui/SheetDraftEditor.tsx`
- Modify: `src/ui/pages/AddOrder.tsx`
- Create: `src/ui/saveOrder.ts`
- Test: `tests/ui/saveOrder.test.ts`

The save logic is kept outside the component so it can be tested without a camera.

- [ ] **Step 1: Write the failing test**

`tests/ui/saveOrder.test.ts`:
```ts
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { saveOrder, type DraftLine } from '../../src/ui/saveOrder';
import { EMPTY_ORDER_FORM } from '../../src/domain/orderForm';

const draft = (d: Partial<DraftLine>): DraftLine => ({
  key: 'k', photo: null, thumb: null, title: 'Egg', artistName: 'JUIMJUIM', tags: 'food, korean',
  quantity: '1', price: '3000', estimated: false, existingSheetId: null, ...d,
});

test('saves a KRW order with new artist, sheets, lines', async () => {
  const repo = new MemoryRepo();
  const res = await saveOrder({
    repo, photos: new MemoryPhotoStore(), unknownOrder: false,
    form: { ...EMPTY_ORDER_FORM, date: '2026-10-19', currency: 'KRW', shipping: '3000', total: '15000', sgdPaid: '15.60' },
    drafts: [draft({ key: 'a', quantity: '3' }), draft({ key: 'b', title: 'Dumpling', artistName: 'juimjuim' })],
  });
  expect(res).toEqual({ ok: true });
  const s = await repo.loadAll();
  expect(s.artists).toHaveLength(1);
  expect(s.sheets.map((x) => x.title).sort()).toEqual(['Dumpling', 'Egg']);
  expect(s.sheets[0].tags).toEqual(['food', 'korean']);
  expect(s.orders[0]).toMatchObject({ currency: 'KRW', totalMinor: 15000, sgdPaidMinor: 1560 });
  expect(s.lines.map((l) => l.quantity).sort()).toEqual([1, 3]);
});

test('existing sheet gets copies added instead of a new sheet', async () => {
  const repo = new MemoryRepo();
  const w = await repo.createSheet({ artistId: null, title: 'Winter', tags: [], photoPath: null, thumbPath: null, photoBytes: 0 });
  const res = await saveOrder({
    repo, photos: new MemoryPhotoStore(), unknownOrder: true, form: EMPTY_ORDER_FORM,
    drafts: [draft({ existingSheetId: w.id, quantity: '2', price: '' })],
  });
  expect(res).toEqual({ ok: true });
  const s = await repo.loadAll();
  expect(s.sheets).toHaveLength(1);
  expect(s.orders[0].isUnknown).toBe(true);
  expect(s.lines[0]).toMatchObject({ sheetId: w.id, quantity: 2, priceMinor: null });
});

test('validation errors stop the save and name the sheet', async () => {
  const repo = new MemoryRepo();
  const bad = await saveOrder({
    repo, photos: new MemoryPhotoStore(), unknownOrder: false,
    form: { ...EMPTY_ORDER_FORM, currency: 'KRW' }, drafts: [draft({ price: '3000.5' })],
  });
  expect(bad).toEqual({ ok: false, error: 'Egg: price is not a valid amount.' });
  const none = await saveOrder({ repo, photos: new MemoryPhotoStore(), unknownOrder: false, form: EMPTY_ORDER_FORM, drafts: [] });
  expect(none).toEqual({ ok: false, error: 'Add at least one sheet.' });
  const qty = await saveOrder({ repo, photos: new MemoryPhotoStore(), unknownOrder: false, form: EMPTY_ORDER_FORM, drafts: [draft({ quantity: '0' })] });
  expect(qty).toEqual({ ok: false, error: 'Egg: copies must be 1 or more.' });
  expect((await repo.loadAll()).orders).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/saveOrder.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/ui/saveOrder.ts`**

```ts
import type { PhotoStore, Repo } from '../data/repo';
import { toMinor } from '../domain/currency';
import { findArtistByName } from '../domain/duplicates';
import { parseOrderForm, type OrderForm } from '../domain/orderForm';
import type { Artist } from '../domain/types';

export interface DraftLine {
  key: string;
  photo: Blob | null; // cropped full photo
  thumb: Blob | null; // cropped thumbnail
  title: string;
  artistName: string;
  tags: string; // comma-separated
  quantity: string;
  price: string; // listed price each, order currency
  estimated: boolean;
  existingSheetId: string | null; // set when the user chose "add copies to existing"
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveOrder(args: {
  repo: Repo;
  photos: PhotoStore;
  form: OrderForm;
  unknownOrder: boolean;
  drafts: DraftLine[];
}): Promise<SaveResult> {
  const { repo, photos, form, unknownOrder, drafts } = args;
  if (drafts.length === 0) return { ok: false, error: 'Add at least one sheet.' };
  const parsed = parseOrderForm(form);
  if (!parsed.ok) return parsed;
  const currency = unknownOrder ? 'SGD' : parsed.value.currency;

  const prepared = [];
  for (const d of drafts) {
    const label = d.title.trim() || 'Untitled sheet';
    if (!d.existingSheetId && !d.title.trim()) return { ok: false, error: 'Every new sheet needs a title.' };
    const qty = Number(d.quantity);
    if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: `${label}: copies must be 1 or more.` };
    let priceMinor: number | null = null;
    if (d.price.trim()) {
      priceMinor = toMinor(d.price, currency);
      if (priceMinor === null) return { ok: false, error: `${label}: price is not a valid amount.` };
    }
    prepared.push({ d, qty, priceMinor });
  }

  const order = unknownOrder ? await repo.getOrCreateUnknownOrder() : await repo.createOrder(parsed.value);
  const artists: Artist[] = (await repo.loadAll()).artists;

  for (const { d, qty, priceMinor } of prepared) {
    let sheetId = d.existingSheetId;
    if (!sheetId) {
      let artistId: string | null = null;
      if (d.artistName.trim()) {
        let a = findArtistByName(d.artistName, artists);
        if (!a) {
          a = await repo.createArtist(d.artistName);
          artists.push(a);
        }
        artistId = a.id;
      }
      const photo = d.photo ? await photos.upload('photos', d.photo) : null;
      const thumb = d.thumb ? await photos.upload('thumbs', d.thumb) : null;
      const sheet = await repo.createSheet({
        artistId,
        title: d.title.trim(),
        tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
        photoPath: photo?.path ?? null,
        thumbPath: thumb?.path ?? null,
        photoBytes: (photo?.bytes ?? 0) + (thumb?.bytes ?? 0),
      });
      sheetId = sheet.id;
    }
    await repo.addLine({ orderId: order.id, sheetId, quantity: qty, priceMinor, estimated: d.estimated });
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/ui/saveOrder.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `src/ui/OrderFields.tsx`**

```tsx
import type { OrderForm } from '../domain/orderForm';
import { COMMON_CURRENCIES } from '../domain/currency';

export function OrderFields({ value, onChange }: { value: OrderForm; onChange: (f: OrderForm) => void }) {
  const set = (patch: Partial<OrderForm>) => onChange({ ...value, ...patch });
  const foreign = value.currency !== 'SGD';
  return (
    <div className="card">
      <div className="row">
        <label>Date<input type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} /></label>
        <label>Shop<input value={value.shop} onChange={(e) => set({ shop: e.target.value })} /></label>
      </div>
      <div className="row">
        <label>Currency
          <select value={value.currency} onChange={(e) => set({ currency: e.target.value })}>
            {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Shipping / fees ({value.currency})<input inputMode="decimal" value={value.shipping} onChange={(e) => set({ shipping: e.target.value })} /></label>
        <label>Order total ({value.currency})<input inputMode="decimal" value={value.total} onChange={(e) => set({ total: e.target.value })} /></label>
      </div>
      {foreign && (
        <label>SGD actually paid (from your bank / card)
          <input inputMode="decimal" placeholder="e.g. 15.60" value={value.sgdPaid} onChange={(e) => set({ sgdPaid: e.target.value })} />
        </label>
      )}
      <label>
        <input type="checkbox" checked={value.estimated} onChange={(e) => set({ estimated: e.target.checked })} />
        Date / amounts are rough estimates
      </label>
    </div>
  );
}
```

- [ ] **Step 6: Write `src/ui/SheetDraftEditor.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { DraftLine } from './saveOrder';
import { CropBox } from './CropBox';
import { cropToJpeg, loadImage, PHOTO, THUMB } from '../image/crop';
import { fullRect, type Rect } from '../image/geometry';
import { findArtistByName, findSameTitle } from '../domain/duplicates';
import { copiesOwned } from '../domain/holdings';
import { useData } from './DataProvider';

export function SheetDraftEditor({ currency, onDone, onCancel }: {
  currency: string;
  onDone: (d: DraftLine) => void;
  onCancel: () => void;
}) {
  const data = useData();
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [tags, setTags] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [estimated, setEstimated] = useState(false);
  const [existingSheetId, setExisting] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const artistId = findArtistByName(artistName, data.artists)?.id ?? null;
  const same = !dismissed && !existingSheetId ? findSameTitle(title, artistId, data.sheets) : null;
  const existing = existingSheetId ? data.sheets.find((s) => s.id === existingSheetId) : null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const bmp = await loadImage(file);
    setImg(bmp);
    setSrc(URL.createObjectURL(file));
    setRect(fullRect(bmp.width, bmp.height));
  };

  const done = async () => {
    setBusy(true);
    try {
      const photo = img && rect && !existingSheetId ? await cropToJpeg(img, rect, PHOTO.maxSide, PHOTO.quality) : null;
      const thumb = img && rect && !existingSheetId ? await cropToJpeg(img, rect, THUMB.maxSide, THUMB.quality) : null;
      onDone({
        key: crypto.randomUUID(), photo, thumb,
        title: existing ? existing.title : title, artistName, tags, quantity, price, estimated, existingSheetId,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Add a sheet</h2>
      {!existingSheetId && (
        <label>Photo or shop screenshot
          <input type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      )}
      {img && src && rect && !existingSheetId && (
        <CropBox src={src} naturalW={img.width} naturalH={img.height} value={rect} onChange={setRect} />
      )}
      {existing ? (
        <p className="warn">Adding copies to <b>{existing.title}</b>.{' '}
          <button onClick={() => setExisting(null)}>Undo</button></p>
      ) : (
        <>
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          {same && (
            <div className="warn">
              You already have <b>{same.title}</b> ({copiesOwned(same.id, data.lines, data.usages)} copies).
              <div>
                <button onClick={() => setExisting(same.id)}>Add copies to it</button>
                <button onClick={() => setDismissed(true)}>It's a different sheet</button>
              </div>
            </div>
          )}
          <label>Artist
            <input list="artist-names" value={artistName} onChange={(e) => setArtistName(e.target.value)} />
            <datalist id="artist-names">{data.artists.map((a) => <option key={a.id} value={a.name} />)}</datalist>
          </label>
          <label>Tags (comma-separated)<input value={tags} onChange={(e) => setTags(e.target.value)} /></label>
        </>
      )}
      <div className="row">
        <label>Copies<input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
        <label>Price each ({currency})<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      </div>
      <label><input type="checkbox" checked={estimated} onChange={(e) => setEstimated(e.target.checked)} />Price is a rough estimate</label>
      <button className="primary" disabled={busy || (!existingSheetId && !title.trim())} onClick={() => void done()}>
        {busy ? 'Preparing photo…' : 'Add to list'}
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 7: Write `src/ui/pages/AddOrder.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMPTY_ORDER_FORM, parseOrderForm, type OrderForm } from '../../domain/orderForm';
import { derivedRate, orderMismatch } from '../../domain/money';
import { formatMoney, toMinor } from '../../domain/currency';
import type { Order, OrderLine } from '../../domain/types';
import { useData } from '../DataProvider';
import { OrderFields } from '../OrderFields';
import { SheetDraftEditor } from '../SheetDraftEditor';
import { saveOrder, type DraftLine } from '../saveOrder';

export function AddOrder() {
  const data = useData();
  const nav = useNavigate();
  const [unknownOrder, setUnknown] = useState(false);
  const [form, setForm] = useState<OrderForm>(EMPTY_ORDER_FORM);
  const [drafts, setDrafts] = useState<DraftLine[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const currency = unknownOrder ? 'SGD' : form.currency;

  // Live preview of the derived rate and mismatch warning.
  const parsed = parseOrderForm(form);
  const preview = parsed.ok && !unknownOrder ? (() => {
    const o: Order = { ...parsed.value, id: 'draft', isUnknown: false, createdAt: '' };
    const ls: OrderLine[] = drafts.map((d) => ({
      id: d.key, orderId: 'draft', sheetId: d.key, quantity: Number(d.quantity) || 0,
      priceMinor: d.price.trim() ? toMinor(d.price, o.currency) : null, estimated: d.estimated,
    }));
    return { rate: derivedRate(o, ls), mismatch: orderMismatch(o, ls), currency: o.currency };
  })() : null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await saveOrder({ repo: data.repo, photos: data.photos, form, unknownOrder, drafts });
      if (!r.ok) { setError(r.error); return; }
      await data.reload();
      nav('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <h1>Add sheets</h1>
      <label>
        <input type="checkbox" checked={unknownOrder} onChange={(e) => setUnknown(e.target.checked)} />
        Old sheets: I don't know the order (date / price unknown)
      </label>
      {!unknownOrder && <OrderFields value={form} onChange={setForm} />}
      {preview?.rate != null && preview.currency !== 'SGD' && (
        <p className="hint">Rate from your payment: 1 {preview.currency} = S${preview.rate.toPrecision(3)}</p>
      )}
      {preview?.mismatch && (
        <p className="warn">Order total {formatMoney(preview.mismatch.totalMinor, preview.currency)} ≠ sheets + shipping
          {' '}{formatMoney(preview.mismatch.expectedMinor, preview.currency)} (difference {formatMoney(preview.mismatch.diffMinor, preview.currency)}).
          Both will be saved.</p>
      )}

      <h2>Sheets in this {unknownOrder ? 'batch' : 'order'} ({drafts.length})</h2>
      {drafts.map((d) => (
        <div key={d.key} className="card row">
          <span>{d.title || '(existing sheet)'} ×{d.quantity}{d.price ? ` · ${d.price} ${currency}` : ''}</span>
          <button onClick={() => setDrafts(drafts.filter((x) => x.key !== d.key))}>Remove</button>
        </div>
      ))}
      {editing ? (
        <SheetDraftEditor currency={currency} onCancel={() => setEditing(false)}
          onDone={(d) => { setDrafts([...drafts, d]); setEditing(false); }} />
      ) : (
        <button onClick={() => setEditing(true)}>📷 Add a sheet</button>
      )}

      {error && <p className="error">{error}</p>}
      <div>
        <button className="primary" disabled={saving || drafts.length === 0 || editing} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass; no tsc output.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): add order flow with crop, title duplicate warning, SGD-paid preview"
```

---

### Task 15: Sheet detail — edit, used up, delete

**Files:**
- Modify: `src/ui/pages/SheetDetail.tsx`
- Test: `tests/ui/sheetDetail.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/ui/sheetDetail.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { SheetDetail } from '../../src/ui/pages/SheetDetail';

async function setup() {
  const repo = new MemoryRepo();
  const s = await repo.createSheet({ artistId: null, title: 'Winter', tags: [], photoPath: null, thumbPath: null, photoBytes: 0 });
  const o = await repo.createOrder({ orderDate: '2026-10-19', shop: 'papermilio', currency: 'SGD', shippingMinor: 0, totalMinor: null, sgdPaidMinor: null, estimated: false });
  await repo.addLine({ orderId: o.id, sheetId: s.id, quantity: 3, priceMinor: 450, estimated: false });
  render(
    <MemoryRouter initialEntries={[`/sheet/${s.id}`]}>
      <DataProvider repo={repo} photos={new MemoryPhotoStore()}>
        <Routes>
          <Route path="/sheet/:id" element={<SheetDetail />} />
          <Route path="/" element={<p>HOME</p>} />
        </Routes>
      </DataProvider>
    </MemoryRouter>,
  );
  return repo;
}

test('used up reduces copies and keeps history', async () => {
  const repo = await setup();
  expect(await screen.findByText('Own: 3 copies')).toBeTruthy();
  fireEvent.click(screen.getByText('Mark used up'));
  expect(await screen.findByText('Own: 2 copies')).toBeTruthy();
  expect((await repo.loadAll()).usages).toHaveLength(1);
});

test('delete asks for confirmation, then removes the sheet', async () => {
  const repo = await setup();
  await screen.findByText('Own: 3 copies');
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByText('Delete sheet'));
  expect(confirmSpy.mock.calls[0][0]).toContain('1 order line');
  expect(await screen.findByText('HOME')).toBeTruthy();
  await waitFor(async () => expect((await repo.loadAll()).sheets).toHaveLength(0));
  confirmSpy.mockRestore();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/sheetDetail.test.tsx`
Expected: FAIL, "Own: 3 copies" not found.

- [ ] **Step 3: Write `src/ui/pages/SheetDetail.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { copiesOwned } from '../../domain/holdings';
import { formatMoney } from '../../domain/currency';
import { findArtistByName } from '../../domain/duplicates';
import { linesOf, lineSgdMinor, unitSgdMinor } from '../../domain/money';
import { useData } from '../DataProvider';
import { usePhotoUrl } from '../usePhotoUrl';

const today = () => new Date().toISOString().slice(0, 10);

export function SheetDetail() {
  const { id } = useParams();
  const d = useData();
  const nav = useNavigate();
  const sheet = d.sheets.find((s) => s.id === id);
  const photoUrl = usePhotoUrl('photos', sheet?.photoPath ?? null);
  const [useQty, setUseQty] = useState('1');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [tags, setTags] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  if (!sheet) return <main className="page"><p>Sheet not found.</p></main>;
  const artistName = d.artists.find((a) => a.id === sheet.artistId)?.name ?? '';
  const owned = copiesOwned(sheet.id, d.lines, d.usages);
  const myLines = d.lines.filter((l) => l.sheetId === sheet.id);
  const myUsages = d.usages.filter((u) => u.sheetId === sheet.id);

  const markUsed = async () => {
    setMsg(null);
    try {
      await d.repo.addUsage(sheet.id, Number(useQty), today());
      await d.reload();
      setUseQty('1');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async () => {
    let sgd = 0;
    for (const l of myLines) {
      const o = d.orders.find((x) => x.id === l.orderId);
      if (o) sgd += lineSgdMinor(l, o, linesOf(o, d.lines)) ?? 0;
    }
    const text = `Delete "${sheet.title}"?\n\nThis removes: the sheet, its photo, ${myLines.length} order line${myLines.length === 1 ? '' : 's'} (${formatMoney(sgd, 'SGD')}), ${myUsages.length} used-up record${myUsages.length === 1 ? '' : 's'}. Orders left with no sheets are removed too.\n\nTo record that you used a sheet, use "Mark used up" instead.`;
    if (!window.confirm(text)) return;
    if (sheet.photoPath) await d.photos.remove('photos', [sheet.photoPath]);
    if (sheet.thumbPath) await d.photos.remove('thumbs', [sheet.thumbPath]);
    await d.repo.deleteSheet(sheet.id);
    await d.reload();
    nav('/');
  };

  const saveEdit = async () => {
    let artistId: string | null = null;
    if (artist.trim()) artistId = (findArtistByName(artist, d.artists) ?? (await d.repo.createArtist(artist))).id;
    await d.repo.updateSheet(sheet.id, {
      title: title.trim() || sheet.title, artistId, tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    await d.reload();
    setEditing(false);
  };

  return (
    <main className="page">
      {photoUrl ? <img className="detail-photo" src={photoUrl} alt={sheet.title} /> : null}
      {editing ? (
        <div className="card">
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>Artist<input value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
          <label>Tags<input value={tags} onChange={(e) => setTags(e.target.value)} /></label>
          <button className="primary" onClick={() => void saveEdit()}>Save</button>
          <button onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <>
          <h1>{sheet.title}</h1>
          <p>{artistName}{sheet.tags.length ? ` · ${sheet.tags.map((t) => '#' + t).join(' ')}` : ''}</p>
          <button onClick={() => { setTitle(sheet.title); setArtist(artistName); setTags(sheet.tags.join(', ')); setEditing(true); }}>Edit</button>
        </>
      )}

      <div className="card">
        <p><b>{owned > 0 ? `Own: ${owned} ${owned === 1 ? 'copy' : 'copies'}` : 'Used up'}</b></p>
        {owned > 0 && (
          <div className="row">
            <label>Copies used<input inputMode="numeric" value={useQty} onChange={(e) => setUseQty(e.target.value)} /></label>
            <button onClick={() => void markUsed()}>Mark used up</button>
          </div>
        )}
        {msg && <p className="error">{msg}</p>}
      </div>

      <h2>Orders</h2>
      <table>
        <thead><tr><th>Date</th><th>Shop</th><th>Qty</th><th>Price each</th><th>S$ each</th></tr></thead>
        <tbody>
          {myLines.map((l) => {
            const o = d.orders.find((x) => x.id === l.orderId);
            if (!o) return null;
            return (
              <tr key={l.id}>
                <td>{o.isUnknown ? 'Unknown' : o.orderDate ?? '—'}{o.estimated || l.estimated ? ' (est.)' : ''}</td>
                <td>{o.shop ?? ''}</td>
                <td>{l.quantity}</td>
                <td>{formatMoney(l.priceMinor, o.currency)}</td>
                <td>{formatMoney(unitSgdMinor(l, o, linesOf(o, d.lines)), 'SGD')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {myUsages.length > 0 && (
        <>
          <h2>Used up</h2>
          <ul>{myUsages.map((u) => <li key={u.id}>{u.usedOn}: {u.quantity}</li>)}</ul>
        </>
      )}

      <h2>Mistake?</h2>
      <button className="danger" onClick={() => void remove()}>Delete sheet</button>
    </main>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/ui/sheetDetail.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): sheet detail with edit, used up, delete with confirmation"
```

---

### Task 16: Spending and Orders pages

**Files:**
- Modify: `src/ui/pages/Spending.tsx`, `src/ui/pages/Orders.tsx`
- Create: `src/ui/download.ts`
- Test: `tests/ui/spending.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/ui/spending.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Spending } from '../../src/ui/pages/Spending';

test('shows total, exact/estimated and missing SGD count', async () => {
  const repo = new MemoryRepo();
  const a = await repo.createArtist('JUIMJUIM');
  const s = await repo.createSheet({ artistId: a.id, title: 'Egg', tags: [], photoPath: null, thumbPath: null, photoBytes: 0 });
  const paid = await repo.createOrder({ orderDate: '2026-10-19', shop: null, currency: 'KRW', shippingMinor: 3000, totalMinor: 15000, sgdPaidMinor: 1560, estimated: false });
  const missing = await repo.createOrder({ orderDate: '2026-09-01', shop: null, currency: 'KRW', shippingMinor: 0, totalMinor: 3000, sgdPaidMinor: null, estimated: false });
  await repo.addLine({ orderId: paid.id, sheetId: s.id, quantity: 4, priceMinor: 3000, estimated: false });
  await repo.addLine({ orderId: missing.id, sheetId: s.id, quantity: 1, priceMinor: 3000, estimated: false });
  render(
    <MemoryRouter>
      <DataProvider repo={repo} photos={new MemoryPhotoStore()}><Spending /></DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/1 order is missing the SGD amount/)).toBeTruthy();
  expect(screen.getByTestId('total').textContent).toMatch(/15\.60/);
  expect(screen.getByText('JUIMJUIM')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/spending.test.tsx`
Expected: FAIL, text not found.

- [ ] **Step 3: Write `src/ui/download.ts`**

```ts
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 4: Write `src/ui/pages/Spending.tsx`**

```tsx
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { summarizeSpending, type Bucket } from '../../domain/spending';
import { formatMoney } from '../../domain/currency';
import { collectionCsv } from '../../domain/csv';
import { useData } from '../DataProvider';
import { downloadText } from '../download';

function Bars({ items }: { items: Bucket[] }) {
  const max = Math.max(1, ...items.map((b) => Math.abs(b.minor)));
  return (
    <table>
      <tbody>
        {items.map((b) => (
          <tr key={b.label}>
            <td style={{ width: '40%' }}>{b.label}</td>
            <td><div className="bar" style={{ width: `${(Math.abs(b.minor) / max) * 100}%` }} /></td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMoney(b.minor, 'SGD')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Spending() {
  const d = useData();
  const s = useMemo(() => summarizeSpending(d), [d]);
  const missing = s.missingSgdOrderIds.length;
  return (
    <main className="page">
      <h1>Spending</h1>
      <div className="card">
        <div style={{ fontSize: '1.6rem', fontWeight: 700 }} data-testid="total">{formatMoney(s.totalMinor, 'SGD')}</div>
        <div className="hint">Exact {formatMoney(s.exactMinor, 'SGD')} · Estimated {formatMoney(s.estimatedMinor, 'SGD')}</div>
        <div className="hint">Includes shipping {formatMoney(s.shippingMinor, 'SGD')}
          {s.otherMinor !== 0 && <> · discounts / rounding {formatMoney(s.otherMinor, 'SGD')}</>}</div>
      </div>
      {missing > 0 && (
        <p className="warn">{missing} order{missing === 1 ? ' is' : 's are'} missing the SGD amount and not counted.{' '}
          <Link to="/orders?missing=1">Fill in</Link></p>
      )}
      <h2>By artist</h2>
      <Bars items={s.byArtist} />
      <h2>By month</h2>
      <Bars items={s.byMonth} />
      <p>
        <Link to="/orders">All orders</Link>{' · '}
        <button onClick={() => downloadText('sticker-collection.csv', collectionCsv(d))}>Export CSV</button>
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Write `src/ui/pages/Orders.tsx`**

```tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Order } from '../../domain/types';
import { formatMoney } from '../../domain/currency';
import { effectiveSgdPaidMinor, linesOf } from '../../domain/money';
import { orderToForm, parseOrderForm, type OrderForm } from '../../domain/orderForm';
import { useData } from '../DataProvider';
import { OrderFields } from '../OrderFields';

export function Orders() {
  const d = useData();
  const [params] = useSearchParams();
  const [onlyMissing, setOnlyMissing] = useState(params.get('missing') === '1');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<OrderForm | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const rows = d.orders
    .filter((o) => !o.isUnknown)
    .filter((o) => !onlyMissing || effectiveSgdPaidMinor(o, linesOf(o, d.lines)) === null)
    .sort((a, b) => (b.orderDate ?? '').localeCompare(a.orderDate ?? '') || b.createdAt.localeCompare(a.createdAt));

  const startEdit = (o: Order) => { setEditId(o.id); setForm(orderToForm(o)); setMsg(null); };
  const save = async () => {
    if (!editId || !form) return;
    const p = parseOrderForm(form);
    if (!p.ok) { setMsg(p.error); return; }
    await d.repo.updateOrder(editId, p.value);
    await d.reload();
    setEditId(null);
  };

  return (
    <main className="page">
      <h1>Orders</h1>
      <label><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />Only orders missing SGD</label>
      {rows.map((o) => {
        const ol = linesOf(o, d.lines);
        const sheets = ol.reduce((n, l) => n + l.quantity, 0);
        return (
          <div key={o.id} className="card">
            {editId === o.id && form ? (
              <>
                <OrderFields value={form} onChange={setForm} />
                {msg && <p className="error">{msg}</p>}
                <button className="primary" onClick={() => void save()}>Save</button>
                <button onClick={() => setEditId(null)}>Cancel</button>
              </>
            ) : (
              <div className="row">
                <span>{o.orderDate ?? 'No date'}{o.estimated ? ' (est.)' : ''} · {o.shop ?? 'No shop'} · {sheets} sheet{sheets === 1 ? '' : 's'}</span>
                <span>{formatMoney(o.totalMinor, o.currency)} → {formatMoney(effectiveSgdPaidMinor(o, ol), 'SGD')}</span>
                <button onClick={() => startEdit(o)}>Edit</button>
              </div>
            )}
          </div>
        );
      })}
      {rows.length === 0 && <p className="hint">Nothing here.</p>}
    </main>
  );
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): spending summary, orders list with SGD-paid editing, CSV export"
```

---

### Task 17: Settings and shared view

**Files:**
- Modify: `src/ui/pages/Settings.tsx`, `src/ui/pages/SharedView.tsx`
- Test: `tests/ui/settings.test.tsx`

Storage meter: Σ `photoBytes` ÷ 1 GB (the Supabase free limit); warn at ≥ 80%.

- [ ] **Step 1: Write the failing test**

`tests/ui/settings.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Settings } from '../../src/ui/pages/Settings';

test('share link toggles on and shows a link; artists can be merged', async () => {
  const repo = new MemoryRepo();
  await repo.createArtist('JUIMJUIM');
  await repo.createArtist('Juimsuim');
  await repo.createSheet({ artistId: null, title: 'Big', tags: [], photoPath: null, thumbPath: null, photoBytes: 900_000_000 });
  render(
    <MemoryRouter>
      <DataProvider repo={repo} photos={new MemoryPhotoStore()}><Settings /></DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/Storage almost full/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Share my collection'));
  expect(await screen.findByText(/#\/s\/[0-9a-f]{32}/)).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Keep'), { target: { value: 'artist-1' } });
  fireEvent.change(screen.getByLabelText('Merge into it'), { target: { value: 'artist-2' } });
  fireEvent.click(screen.getByText('Merge artists'));
  await screen.findByText(/Merged/);
  const s = await repo.loadAll();
  expect(s.artists).toEqual([{ id: 'artist-1', name: 'JUIMJUIM', aliases: ['Juimsuim'] }]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/settings.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/ui/pages/Settings.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { ShareLink } from '../../domain/types';
import { collectionCsv } from '../../domain/csv';
import { useData } from '../DataProvider';
import { downloadText } from '../download';

const FREE_STORAGE_BYTES = 1024 ** 3; // Supabase free plan: 1 GB file storage

export function Settings({ onSignOut }: { onSignOut?: () => void }) {
  const d = useData();
  const [share, setShare] = useState<ShareLink | null>(null);
  const [keep, setKeep] = useState('');
  const [merge, setMerge] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { void d.repo.getShareLink().then(setShare); }, [d.repo]);

  const used = d.sheets.reduce((n, s) => n + s.photoBytes, 0);
  const pct = (used / FREE_STORAGE_BYTES) * 100;
  const link = share ? `${location.origin}${location.pathname}#/s/${share.token}` : '';

  const doMerge = async () => {
    setMsg(null);
    try {
      await d.repo.mergeArtists(keep, merge);
      await d.reload();
      setMerge('');
      setMsg('Merged. The old name is kept as an alias.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="page">
      <h1>Settings</h1>

      <h2>Share link</h2>
      <div className="card">
        <label>
          <input type="checkbox" checked={share?.enabled ?? false}
            onChange={async (e) => setShare(await d.repo.setShareLinkEnabled(e.target.checked))} />
          Share my collection
        </label>
        <p className="hint">Shows photos, titles and artists only. Prices, orders and shops are never shared.</p>
        {share?.enabled && (
          <>
            <p style={{ wordBreak: 'break-all' }}>{link}</p>
            <button onClick={() => void navigator.clipboard?.writeText(link)}>Copy link</button>
          </>
        )}
      </div>

      <h2>Artists</h2>
      <div className="card">
        <p className="hint">Same artist under two names? Merge them.</p>
        <div className="row">
          <label>Keep
            <select value={keep} onChange={(e) => setKeep(e.target.value)}>
              <option value="">Choose…</option>
              {d.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label>Merge into it
            <select value={merge} onChange={(e) => setMerge(e.target.value)}>
              <option value="">Choose…</option>
              {d.artists.filter((a) => a.id !== keep).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>
        <button disabled={!keep || !merge} onClick={() => void doMerge()}>Merge artists</button>
        {msg && <p className="hint">{msg}</p>}
      </div>

      <h2>Storage</h2>
      <div className="card">
        <p>{(used / 1024 ** 2).toFixed(0)} MB of 1024 MB used ({pct.toFixed(0)}%)</p>
        {pct >= 80 && <p className="warn">Storage almost full. Ask Claude to add Cloudflare R2 storage.</p>}
      </div>

      <h2>Data</h2>
      <button onClick={() => downloadText('sticker-collection.csv', collectionCsv(d))}>Export CSV</button>
      {onSignOut && <button onClick={onSignOut}>Sign out</button>}
      <p className="hint">Home currency: SGD.</p>
    </main>
  );
}
```

- [ ] **Step 4: Write `src/ui/pages/SharedView.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SharedSheet } from '../../data/repo';
import { SupabasePhotoStore, SupabaseRepo } from '../../data/supabaseRepo';

export function SharedView({ token, client }: { token: string; client: SupabaseClient | null }) {
  const [items, setItems] = useState<SharedSheet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const store = useMemo(() => (client ? new SupabasePhotoStore(client, '') : null), [client]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!client || !store) return;
    new SupabaseRepo(client).sharedCollection(token)
      .then(async (rows) => {
        setItems(rows);
        const m: Record<string, string> = {};
        for (const r of rows) if (r.thumbPath) m[r.sheetId] = await store.url('thumbs', r.thumbPath);
        setUrls(m);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [client, store, token]);

  if (!client) return <main className="page"><p>Sharing works in the online version only.</p></main>;
  if (error) return <main className="page"><p className="error">{error}</p></main>;
  if (!items) return <main className="page"><p>Loading…</p></main>;
  return (
    <main className="page">
      <h1>Sticker collection</h1>
      {items.length === 0 && <p className="hint">This link is turned off or has no sheets.</p>}
      <div className="grid">
        {items.map((s) => (
          <div key={s.sheetId} className="tile">
            {urls[s.sheetId] ? <img src={urls[s.sheetId]} alt={s.title} loading="lazy" /> : <div className="noimg" />}
            <div className="meta"><div className="title">{s.title}</div><div className="hint">{s.artist ?? ''}</div></div>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): settings (share link, artist merge, storage meter, export) and shared view"
```

---

### Task 18: Icons, deployment, keep-alive, share-privacy check, setup guides

**Files:**
- Create: `public/icon-192.png`, `public/icon-512.png`, `scripts/make-icons.py`, `.github/workflows/deploy.yml`, `.github/workflows/keepalive.yml`, `.github/workflows/privacy-check.yml`, `scripts/check-share-privacy.mjs`, `docs/setup/github.md`, `docs/setup/iphone.md`

- [ ] **Step 1: Write `scripts/make-icons.py` and generate icons**

```python
# Generates simple app icons (a sticker sheet with a peeling corner). Requires Pillow.
from PIL import Image, ImageDraw
for size in (192, 512):
    im = Image.new("RGB", (size, size), "#f2a65a")
    d = ImageDraw.Draw(im)
    m = size // 6
    d.rounded_rectangle([m, m, size - m, size - m], radius=size // 12, fill="#fffaf3")
    r = size // 9
    for cx, cy in [(size * .38, size * .4), (size * .62, size * .4), (size * .5, size * .64)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill="#f2a65a")
    c = size // 4
    d.polygon([(size - m - c, size - m), (size - m, size - m - c), (size - m, size - m)], fill="#e08a3c")
    im.save(f"public/icon-{size}.png")
```

Run: `mkdir -p public scripts && python3 scripts/make-icons.py && ls -la public`
Expected: `icon-192.png` and `icon-512.png` listed.

- [ ] **Step 2: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_BASE: /${{ github.event.repository.name }}/
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Write `.github/workflows/keepalive.yml`**

```yaml
# Supabase pauses free projects after 1 week of inactivity. This pings it weekly.
# GitHub disables scheduled workflows in public repos after 60 days without repo activity;
# if that happens, open Actions → "Keep Supabase awake" → "Enable workflow".
name: Keep Supabase awake
on:
  schedule:
    - cron: '17 3 * * 1,4' # Mon and Thu 03:17 UTC
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS --fail -X POST "${{ secrets.VITE_SUPABASE_URL }}/rest/v1/rpc/ping" \
            -H "apikey: ${{ secrets.VITE_SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.VITE_SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" -d '{}'
```

- [ ] **Step 4: Write `scripts/check-share-privacy.mjs`**

```js
// Verifies against the live Supabase project that:
//  1. anonymous visitors cannot read any table directly (RLS), and
//  2. the share RPC returns only sheet_id, title, artist, thumb_path.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... [SHARE_TOKEN=...] node scripts/check-share-privacy.mjs
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const token = process.env.SHARE_TOKEN || 'not-a-real-token';
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(2);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
let failed = false;
const fail = (m) => { console.error('FAIL', m); failed = true; };

for (const t of ['artists', 'sheets', 'orders', 'order_lines', 'usages', 'share_links']) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers });
  const body = await r.json().catch(() => null);
  if (r.ok && Array.isArray(body) && body.length > 0) fail(`anonymous can read ${t}`);
  else console.log('ok  ', t, 'not readable anonymously');
}

const r = await fetch(`${url}/rest/v1/rpc/shared_collection`, {
  method: 'POST', headers, body: JSON.stringify({ p_token: token }),
});
const rows = await r.json();
if (!r.ok) fail(`shared_collection error ${r.status} ${JSON.stringify(rows)}`);
const allowed = ['artist', 'sheet_id', 'thumb_path', 'title'];
for (const row of Array.isArray(rows) ? rows : []) {
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(allowed)) fail(`shared row has fields ${keys.join(',')}`);
}
console.log('ok   shared_collection returned', Array.isArray(rows) ? rows.length : 0, 'rows with allowed fields only');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 5: Write `.github/workflows/privacy-check.yml`**

```yaml
name: Share privacy check
on:
  workflow_run:
    workflows: [Deploy to GitHub Pages]
    types: [completed]
  workflow_dispatch:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node scripts/check-share-privacy.mjs
        env:
          SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          SHARE_TOKEN: ${{ secrets.SHARE_TOKEN }}
```

- [ ] **Step 6: Write `docs/setup/github.md`**

```markdown
# Put the app online with GitHub Pages (free)

1. On github.com → **New repository** → name `sticker-shelf` → **Public** → don't add any files → Create.
   (Free GitHub Pages needs a public repo. Only the app's code is public. Your stickers, prices and
   photos live in Supabase and need your login.)
2. Tell Claude your GitHub username; Claude pushes the code.
3. Repo → **Settings** → **Pages** → Source: **GitHub Actions**.
4. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, add:
   - `VITE_SUPABASE_URL` = Project URL from Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable key from Supabase
   - (later, optional) `SHARE_TOKEN` = the code at the end of your share link, for the privacy check
5. Repo → **Actions** → "Deploy to GitHub Pages" → **Run workflow**. When it's green, your app is at
   `https://<your-username>.github.io/sticker-shelf/`.
6. Keep-alive: Actions → "Keep Supabase awake" runs twice a week. If GitHub ever shows it as disabled
   (after 60 days without changes to the repo), click **Enable workflow**.
```

- [ ] **Step 7: Write `docs/setup/iphone.md`**

```markdown
# Install on your iPhone

1. Open `https://<your-username>.github.io/sticker-shelf/` in **Safari**.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open **Stickers** from your home screen → enter your email → type the 6-digit code from the email.
4. To add sheets: ➕ Add → 📷 Add a sheet → choose **Take Photo** or **Photo Library** (works for shop screenshots too).
```

- [ ] **Step 8: Verify build and commit**

Run: `npm test && npm run build && ls dist`
Expected: tests pass; `dist` contains `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`.

```bash
git add -A
git commit -m "chore: icons, GitHub Pages deploy, Supabase keep-alive, share privacy check, setup guides"
```

---

### Task 19: Final verification in a phone-sized browser (demo mode)

**Files:**
- Create: `scripts/screenshot-demo.mjs`
- Output: `docs/test-evidence/plan1-*.png` (not committed if large)

- [ ] **Step 1: Install Playwright (uses the pre-installed Chromium)**

Run: `npm install -E -D playwright`
Expected: installs without downloading a browser (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set in this workspace).

- [ ] **Step 2: Write `scripts/screenshot-demo.mjs`**

```js
// Runs the built app in demo mode at iPhone size, adds one sheet using a sample photo,
// and saves screenshots. Usage: node scripts/screenshot-demo.mjs <sample-image>
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';

const sample = process.argv[2];
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const page = await browser.newPage({ ...devices['iPhone 13'] });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://localhost:4173/');
  await page.getByText('Demo mode').waitFor();
  await page.screenshot({ path: 'docs/test-evidence/plan1-1-empty.png' });
  await page.getByRole('link', { name: '➕ Add' }).click();
  await page.getByLabel('Currency').selectOption('KRW');
  await page.getByLabel('Shipping / fees (KRW)').fill('3000');
  await page.getByLabel('Order total (KRW)').fill('15000');
  await page.getByLabel('SGD actually paid (from your bank / card)').fill('15.60');
  await page.getByText('📷 Add a sheet').click();
  await page.setInputFiles('input[type=file]', sample);
  await page.getByText('Drag across the sheet').waitFor();
  await page.getByLabel('Title').fill('계란이 좋아');
  await page.getByLabel('Artist').fill('JUIMJUIM');
  await page.getByLabel('Copies').fill('4');
  await page.getByLabel('Price each (KRW)').fill('3000');
  await page.screenshot({ path: 'docs/test-evidence/plan1-2-add.png', fullPage: true });
  await page.getByText('Add to list').click();
  await page.getByText('Rate from your payment').waitFor();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('×4').waitFor();
  await page.screenshot({ path: 'docs/test-evidence/plan1-3-collection.png' });
  await page.getByRole('link', { name: 'Spending' }).click();
  await page.getByTestId('total').waitFor();
  const total = await page.getByTestId('total').textContent();
  await page.screenshot({ path: 'docs/test-evidence/plan1-4-spending.png', fullPage: true });
  console.log('Spending total shown:', total);
  console.log('Page errors:', errors.length ? errors : 'none');
} finally {
  await browser.close();
  server.kill();
}
```

- [ ] **Step 3: Build and run it with the user's shop screenshot**

Run:
```bash
npm run build
cp "/root/.claude/uploads/ef992fb7-05e9-5795-8528-b8c638ca7cb2/c8972314-image.jpg" /tmp/claude-0/-home-claude/ef992fb7-05e9-5795-8528-b8c638ca7cb2/scratchpad/sample.jpg
node scripts/screenshot-demo.mjs /tmp/claude-0/-home-claude/ef992fb7-05e9-5795-8528-b8c638ca7cb2/scratchpad/sample.jpg
```
Expected:
- The run prints `Spending total shown: S$15.60` (or `$15.60`, depending on locale formatting) and `Page errors: none`.
- Four PNGs are saved.

- [ ] **Step 4: Look at each screenshot** (Read tool). Check:
  - text is readable at phone width;
  - the bottom tabs don't cover content;
  - the crop rectangle is visible;
  - the Korean title displays correctly.

  Fix any problem, rebuild, and re-run.

- [ ] **Step 5: Full check**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, no type errors, and the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add scripts/screenshot-demo.mjs package.json package-lock.json
git commit -m "test: phone-size demo walkthrough script"
```

- [ ] **Step 7: Hand-off to user (not code)**

Send the user the screenshots, plus the three setup guides in this order:
1. `docs/setup/supabase.md`
2. `docs/setup/github.md`
3. `docs/setup/iphone.md`

Then ask for their GitHub username so the code can be pushed. After deployment, the user tests on their iPhone (spec §8.5), and Plan 2 starts with the real recognition test (spec §8.2).

---

## Spec coverage check

| Spec item | Task |
|---|---|
| §2 Sheet as unit, copies | 4, 8, 13 |
| §2 Inputs: photo, gallery, shop screenshot | 11, 14 (camera/library via file input); video → Plan 3 |
| §2 Detection / recognition / OCR | Plan 2 (manual crop here: 11, 14) |
| §2 Cost: total + listed price + shipping separate | 3, 7, 14 |
| §2 Currency via SGD paid | 3, 7, 14, 16 |
| §2 Fields incl. shop, tags | 2, 14, 15 |
| §2 Old sheets blank / estimated | 5, 8 (Unknown order), 14 |
| §2 Gallery, search/filter (artist, title, date, price) | 6, 13 |
| §2 Spending totals | 5, 16 |
| §2 Duplicate warning | 6, 14 (title-based; image-based in Plan 2) |
| §2 Export | 7, 16, 17 |
| §2 Used up / delete | 4, 8, 15 |
| §2 Private cloud + share link (no prices) | 9, 10, 17, 18 |
| §2 Free only / no training on photos | 9, 18 (Supabase free, GitHub Pages; no AI service) |
| §4 Rules: mismatch warn, Unknown order, crop-only photos | 3, 8, 11, 14 |
| §6 Errors: storage 80%, artist merge, delete confirm, share server-side, SGD missing, paused project | 17, 15, 9, 16, 18 |
| §6 Offline queue | Plan 3 |
| §8 Tests: money maths, share privacy, iPhone | 3–7, 18, 19 + user iPhone check |
