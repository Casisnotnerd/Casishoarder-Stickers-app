# Back Button, Artist Pictures, Spending by Year/Month Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a history-aware Back button to inner pages, let the user set/remove an artist's tile picture from the artist page, and turn Spending into a year view whose months open a month page.

**Architecture:** One shared `BackButton` component (react-router history, with a parent fallback). Search filter state moves into a small React context so it survives visiting a sheet. Artist pictures reuse the existing `avatarPath` field through two helpers shared by the artist page and Settings. Spending gets a `period` filter in the domain and a new `/spending/:month` route.

**Tech Stack:** Vite 8, React 19, TypeScript 7 (strict), react-router-dom 7 (HashRouter), Vitest 5 + jsdom + Testing Library, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-28-back-artist-picture-spending.md`

## Global Constraints

- Base: `main` at `1ade146`. Branch: `back-and-artist-picture`.
- All money is SGD minor units, shown with `formatMoney(minor, 'SGD')` (prints `S$`).
- Touch targets ≥ 44 px tall for every new control.
- Copy is plain and friendly, sentence case, no "please", no exclamation marks.
- No new npm dependencies.
- `npx tsc` clean and `npx vitest run` green after every task.
- Commit messages end with the two attribution lines used on this repo.

## Review Focus

1. **App opened straight onto an inner page** (home-screen relaunch, a pasted link): Back must go to the parent page, never out of the app or to a blank page. → Task 1 test `with no earlier page it goes to the fallback`.
2. **Leaving Add one / Add many with unsaved work:** must ask before discarding; already-saved bulk photos stay saved. → Task 2 test `leaving Add one with an unsaved sheet asks first`.
3. **Search text, filters and sort after viewing a sheet and coming Back:** must be exactly as left. → Task 3 test `search is kept after opening a sheet and coming back`.
4. **A 5 MB, 12-megapixel phone photo or a huge logo as artist picture:** must be shrunk before upload, and a failed upload must leave the old picture in place. → Task 4 tests `uploads the resized image` and `a failed upload keeps the old picture`.
5. **Orders across several years, plus orders with no date:** the year switcher must reach every year that has dated orders, and undated orders must still be visible somewhere. → Task 6 test `years run from the earliest dated order to this year` and Task 7 test `no-date orders show under the tiles`.

---

### Task 1: BackButton component

**Files:**
- Create: `src/ui/BackButton.tsx`
- Modify: `src/styles.css` (reuse the existing `.back` class; no new rule needed unless the button needs `background: none; border: 0; padding: 0`)
- Test: `tests/ui/backButton.test.tsx`

**Interfaces:**
- Produces: `export function BackButton(props: { fallback: string; confirmLeave?: string | null }): JSX.Element` — renders a button labelled **Back** with a `ChevronLeft` icon. On click: if `confirmLeave` is a non-empty string and `window.confirm(confirmLeave)` is false → do nothing. Else if `useLocation().key === 'default'` (no earlier page in this app session) → `navigate(fallback, { replace: true })`; otherwise `navigate(-1)`.

- [ ] **Step 1: Write the failing tests**

```tsx
test('goes back to the page you came from', async () => {
  render(<MemoryRouter initialEntries={['/artist/a', '/sheet/s']} initialIndex={1}>
    <Routes>
      <Route path="/artist/:id" element={<p>ARTIST PAGE</p>} />
      <Route path="/sheet/:id" element={<BackButton fallback="/" />} />
      <Route path="/" element={<p>HOME</p>} />
    </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByText('ARTIST PAGE')).toBeTruthy();
});

test('with no earlier page it goes to the fallback', async () => {
  // same routes, initialEntries={['/sheet/s']}
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByText('HOME')).toBeTruthy();
});

test('confirmLeave: cancel stays, OK leaves', async () => {
  // initialEntries ['/artist/a', '/sheet/s'], <BackButton fallback="/" confirmLeave="Leave without saving?" />
  const spy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.queryByText('ARTIST PAGE')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByText('ARTIST PAGE')).toBeTruthy();
  expect(spy).toHaveBeenCalledWith('Leave without saving?');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/backButton.test.tsx` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `BackButton`** as described in Interfaces. Class `back` so it matches the artist page's `‹ Collection` link.
- [ ] **Step 4: Run** the same command — Expected: 3 passed.
- [ ] **Step 5: Commit** `feat: BackButton (history-aware, parent fallback, optional confirm)`.

---

### Task 2: Back on Sheet detail, All orders, Add one, Add many

**Files:**
- Modify: `src/ui/pages/SheetDetail.tsx` (top of `<main>`, also on the "Sheet not found" return)
- Modify: `src/ui/pages/Orders.tsx` (top of `<main>`)
- Modify: `src/ui/pages/AddOrder.tsx` (top of `<main>`)
- Modify: `src/ui/pages/BulkAdd.tsx` (top of `<main>`, both returns; rename the two in-flow step buttons from `Back` to `Previous step`)
- Test: `tests/ui/backPages.test.tsx`

**Interfaces:**
- Consumes: `BackButton` from Task 1.

| Page | `fallback` | `confirmLeave` |
|---|---|---|
| SheetDetail | `/` | — |
| Orders | `/spending` | — |
| AddOrder | `/add` | `drafts.length > 0 \|\| editing ? 'Leave without saving these sheets?' : null` |
| BulkAdd | `/add` | `img !== null \|\| step === 'details' \|\| step === 'titles' ? "Leave without saving this photo's sheets? Photos you already saved stay saved." : null` |

- [ ] **Step 1: Write the failing tests**

```tsx
test('sheet detail has a Back button that returns to the artist folder', ...)
  // MemoryRouter ['/artist/x', '/sheet/<id>'] index 1, DataProvider with a MemoryRepo sheet,
  // routes: /sheet/:id → <SheetDetail/>, /artist/:id → <p>FOLDER</p>
  // click Back → findByText('FOLDER')

test('leaving Add one with an unsaved sheet asks first', ...)
  // MemoryRouter ['/add', '/add/one'] index 1; routes /add → <p>CHOICE</p>, /add/one → <AddOrder/>
  // click '📷 Add a sheet'; confirm spy → false; click Back → CHOICE not shown
  // confirm spy → true; click Back → findByText('CHOICE')

test('bulk add step buttons say Previous step, not Back', ...)
  // render <BulkAdd/> at '/add/many' → getAllByRole('button', { name: 'Back' }) has length 1
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/backPages.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Add `<BackButton …/>` to the four pages** with the values in the table; rename the BulkAdd step buttons.
- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: Back on sheet, orders and add pages`.

---

### Task 3: Search keeps its state and scroll position

**Files:**
- Create: `src/ui/SearchState.tsx`
- Modify: `src/ui/Shell.tsx` (wrap `<Routes>` in `<SearchStateProvider>`)
- Modify: `src/ui/pages/Collection.tsx` (replace the local `useState` for `f`, `order`, `minS`, `maxS` with the context; call `useScrollMemory('search')`)
- Modify: `src/ui/pages/ArtistPage.tsx` (call `useScrollMemory('artist:' + id)`)
- Test: `tests/ui/searchState.test.tsx`

**Interfaces:**
- Produces:
  - `export interface SearchState { filter: SheetFilter; order: SortOrder; minS: string; maxS: string }`
  - `export function SearchStateProvider({ children }: { children: ReactNode }): JSX.Element` — initial state `{ filter: EMPTY_FILTER, order: 'newest', minS: '', maxS: '' }`.
  - `export function useSearchState(): [SearchState, (patch: Partial<SearchState>) => void]` — throws `useSearchState must be used inside SearchStateProvider` outside the provider.
  - `export function useScrollMemory(key: string): void` — remembers `window.scrollY` for `key` in a module-level `Map` when the page unmounts; on mount, if a value exists, calls `window.scrollTo(0, value)` in a `requestAnimationFrame`.

- [ ] **Step 1: Write the failing tests**

```tsx
test('search is kept after opening a sheet and coming back', async () => {
  // DataProvider(MemoryRepo with 'Winter' + 'Spring', both owned) > MemoryRouter(['/search']) > SearchStateProvider > Routes:
  //   /search → <Collection searchMode />, /sheet/:id → <SheetDetail />
  // type 'win' in the search box; change Sort to 'az'
  // click the 'Winter' card; findByRole('button', { name: 'Back' }); click it
  expect((await screen.findByPlaceholderText('Find a sticker, artist or tag') as HTMLInputElement).value).toBe('win');
  expect((screen.getByLabelText('Sort') as HTMLSelectElement).value).toBe('az');
  expect(screen.queryByText('Spring')).toBeNull();
});

test('scroll position is restored when coming back', async () => {
  // render a page using useScrollMemory('k'); set window.scrollY = 640 (defineProperty, configurable);
  // unmount; spy window.scrollTo; render again; flush requestAnimationFrame
  expect(scrollToSpy).toHaveBeenCalledWith(0, 640);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/searchState.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement `SearchState.tsx`** and switch Collection/ArtistPage to it. Existing `tests/ui/collection.test.tsx` renders `<Collection />` without the provider: wrap those renders in `<SearchStateProvider>`.
- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: Search keeps text, filters, sort and scroll after Back`.

---

### Task 4: Artist picture helpers

**Files:**
- Modify: `src/image/crop.ts` (add `resizeImage`)
- Create: `src/ui/artistPicture.ts`
- Test: `tests/ui/artistPicture.test.ts`

**Interfaces:**
- Produces:
  - `export async function resizeImage(file: Blob, maxSide = 600): Promise<Blob>` in `src/image/crop.ts` — `loadImage` then `cropToJpeg(img, { x: 0, y: 0, w: img.width, h: img.height }, maxSide, 0.85)`.
  - `export async function setArtistPicture(args: { repo: Repo; photos: PhotoStore; artistIds: string[]; oldPaths: string[]; file: Blob; resize?: (f: Blob) => Promise<Blob> }): Promise<void>` — resize (default `resizeImage`) → `photos.upload('thumbs', …)` → `repo.updateArtist(id, { avatarPath, avatarBytes })` for **every** id in `artistIds` → only then `photos.remove('thumbs', oldPaths)` (errors from remove are ignored).
  - `export async function removeArtistPicture(args: { repo: Repo; photos: PhotoStore; artistIds: string[]; oldPaths: string[] }): Promise<void>` — sets `{ avatarPath: null, avatarBytes: 0 }` on every id, then removes `oldPaths` (errors ignored).

- [ ] **Step 1: Write the failing tests** (stub `URL.createObjectURL`/`revokeObjectURL` with `vi.fn` because `MemoryPhotoStore` uses them; pass `resize: async (f) => new Blob(['small'])`)

```ts
test('uploads the resized image to every artist in the folder and deletes the old file', ...)
  // two artists 'JUIMJUIM' and 'juimjuim' (one folder); oldPaths ['thumbs/old.jpg']; spy photos.remove and photos.upload
  // expect upload called once with ('thumbs', <the 'small' blob>)
  // expect both artists' avatarPath === the uploaded path and avatarBytes === 5
  // expect remove called with ('thumbs', ['thumbs/old.jpg'])

test('a failed upload keeps the old picture', ...)
  // photos.upload rejects → setArtistPicture rejects; avatarPath still 'thumbs/old.jpg'; remove not called

test('remove clears the picture and deletes the file', ...)
  // after removeArtistPicture: avatarPath null, avatarBytes 0 on both; remove called with oldPaths
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/artistPicture.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `resizeImage`, `setArtistPicture`, `removeArtistPicture`.
- [ ] **Step 4: Run** the same command — Expected: 3 passed.
- [ ] **Step 5: Commit** `feat: set / remove artist picture (resized, old file cleaned up)`.

---

### Task 5: Artist page picture controls, full-tile picture, Settings reuse

**Files:**
- Modify: `src/ui/pages/ArtistPage.tsx`
- Modify: `src/ui/pages/Home.tsx` (`Folder`: add class `has-picture` on `.folder-cover` when the avatar URL is used)
- Modify: `src/ui/pages/Settings.tsx` (avatar `onChange` calls `setArtistPicture` with `artistIds: [a.id]`, `oldPaths: a.avatarPath ? [a.avatarPath] : []`)
- Modify: `src/styles.css`
- Test: `tests/ui/collection.test.tsx` (add tests)

**Interfaces:**
- Consumes: `setArtistPicture`, `removeArtistPicture` (Task 4); `ArtistFolder` from `src/domain/folders.ts` (`id`, `artistIds`, `avatarPath`, `name`).

Artist page header (not for `UNKNOWN_FOLDER`): a 64 px square picture (avatar, else cover sheet thumb) left of the name; under the "N sheets owned" line:
- `<label className="button-like">Change picture<input type="file" accept="image/*" hidden /></label>`
- `<button>Remove picture</button>` only when `folder.avatarPath` is set.
- While uploading show `Saving picture…`; on error show `Couldn't save the picture. Try again.` (no raw exception text). After success call `d.reload()`.
- `oldPaths` = distinct non-null `avatarPath` of the artists in `folder.artistIds`.

CSS: `.folder-cover.has-picture img { width: 100%; height: 100%; max-width: none; max-height: none; object-fit: cover; border-radius: 0; box-shadow: none; }` and `.folder-cover.has-picture::before { display: none; }`. `.button-like` matches `button` (min-height 46 px).

- [ ] **Step 1: Write the failing tests**

```tsx
test('artist page offers Change picture; Remove picture only once one is set', ...)
  // artist without avatar → getByText('Change picture'); queryByText('Remove picture') null
  // artist with avatarPath set → getByText('Remove picture')

test('the Unknown artist folder has no picture controls', ...)
  // route /artist/unknown with a sheet that has no artist → queryByText('Change picture') null

test('a folder with a picture fills the tile', ...)
  // artist with avatar uploaded to MemoryPhotoStore (stub createObjectURL → 'blob:x')
  // render <Home/> → document.querySelector('.folder-cover.has-picture') not null
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/collection.test.tsx` — Expected: the 3 new tests FAIL.
- [ ] **Step 3: Implement** the artist page controls, the `has-picture` class, the CSS and the Settings change.
- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: change artist picture from the artist page; picture fills the tile`.

---

### Task 6: Spending domain — period filter and years

**Files:**
- Modify: `src/domain/spending.ts`
- Test: `tests/domain/spending.test.ts` (add tests)

**Interfaces:**
- Produces:
  - `summarizeSpending(d: SpendingData, filterArtistId?: string | null, period?: string | null): SpendingSummary` — new third parameter. When `period` is `'YYYY'` or `'YYYY-MM'`, only orders whose `orderDate` starts with `period` count (orders with `orderDate === null` are excluded). Existing callers are unchanged.
  - `export function spendingYears(orders: Order[], now: Date = new Date()): number[]` — ascending list from the earliest year of any non-null `orderDate` to `now`'s year; `[now's year]` when there are none.
  - `export function monthsOfYear(year: number): string[]` — `['YYYY-01', …, 'YYYY-12']`.
  - `export function noDateSgdMinor(d: SpendingData): number` — sum of `effectiveSgdPaidMinor` for non-unknown orders with `orderDate === null` (nulls skipped).

- [ ] **Step 1: Write the failing tests** (reuse the fixtures at the top of `tests/domain/spending.test.ts`)

```ts
test('period filters to a month or a year by order date', () => {
  expect(summarizeSpending({ artists, sheets, orders, lines }, null, '2026-10').totalMinor).toBe(1560);
  expect(summarizeSpending({ artists, sheets, orders, lines }, null, '2026-09').totalMinor).toBe(0);
  expect(summarizeSpending({ artists, sheets, orders, lines }, null, '2026').totalMinor).toBe(1560);
  expect(summarizeSpending({ artists, sheets, orders, lines }, null, '2025').totalMinor).toBe(0);
});

test('years run from the earliest dated order to this year', () => {
  const o = [{ ...base, id: 'a', orderDate: '2024-03-01' }, { ...base, id: 'b', orderDate: null }];
  expect(spendingYears(o, new Date('2026-10-28'))).toEqual([2024, 2025, 2026]);
  expect(spendingYears([], new Date('2026-10-28'))).toEqual([2026]);
});

test('monthsOfYear and noDateSgdMinor', () => {
  expect(monthsOfYear(2025)[0]).toBe('2025-01');
  expect(monthsOfYear(2025)).toHaveLength(12);
  // 'sgdEst' has no date, SGD, lines 2 × 450 → 900
  expect(noDateSgdMinor({ artists, sheets, orders, lines })).toBe(900);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/domain/spending.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the parameter (skip an order at the top of the loop when `period` is set and `!order.orderDate?.startsWith(period)`) and the three helpers.
- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: spending period filter, years and no-date total`.

---

### Task 7: Spending year switcher and month page

**Files:**
- Create: `src/ui/Bars.tsx` (move `Bars` out of `Spending.tsx`, unchanged)
- Modify: `src/ui/pages/Spending.tsx`
- Create: `src/ui/pages/SpendingMonth.tsx`
- Modify: `src/ui/Shell.tsx` (route `/spending/:month`; keep the Spending tab active for it, like the artist page does for Collection)
- Modify: `src/styles.css`
- Test: `tests/ui/spending.test.tsx` (add tests)

**Interfaces:**
- Consumes: `summarizeSpending(d, artistId, period)`, `spendingYears`, `monthsOfYear`, `noDateSgdMinor` (Task 6); `BackButton` (Task 1); `Bars` (this task).

Spending page:
- Year comes from the URL query `?year=YYYY` (default: current year; clamp to `spendingYears`). The switcher is `‹` / `›` buttons (aria-labels `Previous year` / `Next year`, hidden at the ends) around the year, plus `S$… this year` from `summarizeSpending(d, filterArtistId, String(year)).totalMinor`. Changing year uses `setSearchParams({ year }, { replace: true })`.
- The all-time total card stays as it is.
- Heading `Months` (replaces "Last 12 months"). 12 tiles from `monthsOfYear(year)` labelled `Jan`…`Dec` (`Intl.DateTimeFormat('en-SG', { month: 'short' })`), amount from `summarizeSpending(d, filterArtistId, month)`. Tile with amount > 0 is a `<Link to={'/spending/' + month}>`; amount 0 is a non-interactive `<div aria-disabled="true">` with class `month-tile empty` (greyed). Current month keeps the `--accent-soft` background.
- Under the tiles, when `noDateSgdMinor(d) > 0`: `<p className="hint">No date: S$… · <Link to="/orders">See orders</Link></p>`.
- Remove the "By month" heading and bars. "By artist" stays.

Month page `/spending/:month`:
- If `month` does not match `/^\d{4}-(0[1-9]|1[0-2])$/` → `<BackButton fallback="/spending" />` and `<p className="empty">That month wasn't found.</p>`.
- Else: `<BackButton fallback={'/spending?year=' + month.slice(0, 4)} />`, `<h1>` = `Intl.DateTimeFormat('en-SG', { month: 'long', year: 'numeric' })` (e.g. `October 2026`), a total card from `summarizeSpending(d, null, month)` showing `totalMinor` and `Includes shipping S$…`, then `<h2>By artist</h2>` and `<Bars items={s.byArtist} colorOf={…} />` (same colour rule as Spending).

- [ ] **Step 1: Write the failing tests**

```tsx
test('year switcher shows Jan–Dec of the chosen year and only spent months are links', ...)
  // MemoryRepo orders: 2025-03-10 S$12.00, 2026-10-05 S$15.60 (both SGD, one line each)
  // render <Spending/> at '/spending?year=2026' (Routes path="/spending")
  // getByText('2026'); getByText('S$15.60 this year')
  // getByRole('link', { name: /Oct/ }); queryByRole('link', { name: /Sep/ }) null
  // click 'Previous year' → getByText('2025'); getByRole('link', { name: /Mar/ }); queryByLabelText('Previous year') null

test('tapping a month opens its page with the total and a bar per artist', ...)
  // routes /spending and /spending/:month; click the Oct link
  // findByRole('heading', { name: 'October 2026' }); getAllByText('S$15.60').length ≥ 1; getByText('JUIMJUIM', { selector: 'span' })
  // click Back → getByText('S$15.60 this year')

test('no-date orders show under the tiles', ...)
  // an SGD order with orderDate null worth S$9.00 → getByText(/No date: S\$9\.00/)

test('a bad month address shows not found', ...)
  // '/spending/2026-13' → getByText("That month wasn't found.")
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/spending.test.tsx` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `Bars.tsx`, the Spending changes, `SpendingMonth.tsx`, the route and CSS (`.year-switch`, `.month-tile`, `.month-tile.empty { opacity: .45 }`, tiles ≥ 44 px tall).
- [ ] **Step 4: Run** `npx tsc && npx vitest run && npm run build` — Expected: clean, all pass, build OK.
- [ ] **Step 5: Commit** `feat: spending by year with month pages`.

---

### Task 8: Phone walkthrough and package

**Files:** none in the repo.

- [ ] **Step 1:** `npm run build`, start `npx vite preview`, and in Playwright (`executablePath: '/opt/pw-browsers/chromium'`, `devices['iPhone 13']`, `serviceWorkers: 'block'`) walk: Collection → artist folder → sheet → Back (lands on the folder); Search → type → sheet → Back (text kept); artist page → Change picture with `/mnt/user-data/uploads/WhatsApp_Image_2026-10-16_at_4_22_18_PM.jpeg` → Collection tile filled; Spending → year switch → month → Back. Expected: no page errors; screenshots of each step.
- [ ] **Step 2:** `git archive --format=zip --prefix=Casishoarder-Stickers-app/ -o <scratchpad>/Casishoarder-Stickers-app-v5.zip HEAD`.
