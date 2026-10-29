# Artist Tile Picture Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user set an artist's Collection tile picture from a ✎ button on the tile, and move / zoom / rotate it inside a tile-shaped frame, re-adjustable later.

**Architecture:** Pure framing maths in one domain file (`tileFrame.ts`: parse, clamp, layout, pan, zoom). One `FramedPicture` component renders a stored photo + frame anywhere (tile, banner, editor). A new editor page at `/artist/:id/picture` saves through the existing `artistPicture.ts` helpers, which gain a frame-only save. The framing lives in the existing `avatarPosition` string.

**Tech Stack:** Vite 8, React 19, TypeScript 7 (strict), react-router-dom 7 (HashRouter), Vitest 5 + jsdom + Testing Library, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-28-artist-tile-picture-editor.md`

## Global Constraints

- Base: `main` at `5e9eba9`. Branch: `tile-picture-editor`. Baseline: 96 tests pass, `tsc` clean.
- No database change: framing is stored in `Artist.avatarPosition` (`avatar_position` text column, already in the user's Supabase).
- Frame string format: `frame:<x>,<y>,<zoom>`, numbers rounded to 4 decimals, e.g. `frame:0.5,0.3,1.6`.
- `TILE_ASPECT = 4 / 3`; `MIN_ZOOM = 1`; `MAX_ZOOM = 4`; stored photo long side ≤ **1200 px**, JPEG quality 0.85.
- Every new control ≥ 44 px; copy plain, sentence case, no "please", no raw exception text shown to the user.
- No new npm dependencies.
- After every task: `npx tsc` clean and `npx vitest run` all green.

## Review Focus

1. **Very wide or very tall photos** (a panorama, a phone screenshot): at zoom 1 the photo must still cover the whole frame — no empty bands. → Task 1 test `zoom 1 always covers the frame`.
2. **Dragging or zooming past an edge:** the photo stops at the edge; the frame never shows empty space. → Task 1 tests `pan stops at the edge` and `clamp pulls the centre back inside`.
3. **Old or odd saved positions** (`50% 20%` from the slider, `null`, garbage): load as a sensible framing, never crash. → Task 1 test `parseFrame reads new, old and bad values`.
4. **Re-adjusting only** (no new photo, no rotation): must save the framing without uploading or deleting any file. → Task 2 test `frame-only edit uploads and deletes nothing`.
5. **Tapping ✎ on a tile that is itself a link:** must open the editor, not the artist page; and the Unknown artist tile has no ✎. → Task 3 tests `pencil opens the editor` and `unknown artist tile has no pencil`.

---

### Task 1: Framing maths (`tileFrame.ts`)

**Files:**
- Create: `src/domain/tileFrame.ts`
- Test: `tests/domain/tileFrame.test.ts`

**Interfaces:**
- Produces:
  - `export const TILE_ASPECT = 4 / 3; export const MIN_ZOOM = 1; export const MAX_ZOOM = 4;`
  - `export interface TileFrame { x: number; y: number; zoom: number }` — x, y = centre of the visible area as a fraction (0–1) of the photo's width / height; zoom 1 = photo just covers the frame.
  - `export const DEFAULT_FRAME: TileFrame = { x: 0.5, y: 0.5, zoom: 1 }`
  - `export function parseFrame(s: string | null | undefined): TileFrame` — `frame:x,y,z` → those numbers; legacy `"<a>% <b>%"` → `{ x: a/100, y: b/100, zoom: 1 }`; anything else → `DEFAULT_FRAME`.
  - `export function encodeFrame(f: TileFrame): string`
  - `export function frameLayout(f: TileFrame, imageAspect: number, tileAspect = TILE_ASPECT): { widthPct: number; heightPct: number; leftPct: number; topPct: number }` — photo size and offset as % of the frame (clamps `f` first).
  - `export function clampFrame(f: TileFrame, imageAspect: number, tileAspect = TILE_ASPECT): TileFrame`
  - `export function panFrame(f: TileFrame, dxPx: number, dyPx: number, frameWidthPx: number, imageAspect: number, tileAspect = TILE_ASPECT): TileFrame` — dragging right / down by the given pixels moves the photo with the finger; result clamped.
  - `export function zoomFrame(f: TileFrame, zoom: number, imageAspect: number, tileAspect = TILE_ASPECT): TileFrame` — keeps the centre, clamps zoom and centre.

The layout maths (I = imageAspect, A = tileAspect, z = zoom):

```
widthPct  = z * max(1, I / A) * 100
heightPct = z * max(1, A / I) * 100
visible fraction of the photo: fx = 100 / widthPct, fy = 100 / heightPct
x clamped to [fx/2, 1 - fx/2], y clamped to [fy/2, 1 - fy/2], z clamped to [1, 4]
leftPct = 50 - x * widthPct,  topPct = 50 - y * heightPct
pan:  x -= dxPx / (frameWidthPx * widthPct / 100);  y -= dyPx / ((frameWidthPx / A) * heightPct / 100)
```

- [ ] **Step 1: Write the failing tests**

```ts
test('parseFrame reads new, old and bad values', () => {
  expect(parseFrame('frame:0.25,0.75,2')).toEqual({ x: 0.25, y: 0.75, zoom: 2 });
  expect(parseFrame('50% 20%')).toEqual({ x: 0.5, y: 0.2, zoom: 1 });
  expect(parseFrame(null)).toEqual(DEFAULT_FRAME);
  expect(parseFrame('banana')).toEqual(DEFAULT_FRAME);
  expect(parseFrame('frame:a,b,c')).toEqual(DEFAULT_FRAME);
});

test('encodeFrame rounds to 4 decimals and round-trips', () => {
  expect(encodeFrame({ x: 0.123456, y: 0.5, zoom: 1.6 })).toBe('frame:0.1235,0.5,1.6');
  expect(parseFrame(encodeFrame({ x: 0.3, y: 0.6, zoom: 2.5 }))).toEqual({ x: 0.3, y: 0.6, zoom: 2.5 });
});

test('zoom 1 always covers the frame', () => {
  for (const I of [4 / 3, 1, 3, 0.4]) {          // same shape, square, panorama, tall screenshot
    const l = frameLayout(DEFAULT_FRAME, I);
    expect(l.widthPct).toBeGreaterThanOrEqual(100);
    expect(l.heightPct).toBeGreaterThanOrEqual(100);
    expect(l.leftPct).toBeLessThanOrEqual(0);
    expect(l.topPct).toBeLessThanOrEqual(0);
    expect(l.leftPct + l.widthPct).toBeGreaterThanOrEqual(100);
    expect(l.topPct + l.heightPct).toBeGreaterThanOrEqual(100);
  }
  expect(frameLayout(DEFAULT_FRAME, 4 / 3)).toEqual({ widthPct: 100, heightPct: 100, leftPct: 0, topPct: 0 });
});

test('clamp pulls the centre back inside and keeps zoom in 1–4', () => {
  // square photo in a 4:3 frame at zoom 1: whole width visible, 75% of the height visible
  expect(clampFrame({ x: 0.9, y: 0.1, zoom: 1 }, 1)).toEqual({ x: 0.5, y: 0.375, zoom: 1 });
  expect(clampFrame({ x: 0.5, y: 0.5, zoom: 9 }, 1).zoom).toBe(4);
  expect(clampFrame({ x: 0.5, y: 0.5, zoom: 0.2 }, 1).zoom).toBe(1);
});

test('pan moves the photo with the finger', () => {
  // photo same shape as the frame, zoom 2, frame 300 px wide → photo 600 px wide
  expect(panFrame({ x: 0.5, y: 0.5, zoom: 2 }, 60, 0, 300, 4 / 3).x).toBeCloseTo(0.4);
  expect(panFrame({ x: 0.5, y: 0.5, zoom: 2 }, 0, -45, 300, 4 / 3).y).toBeCloseTo(0.6);
});

test('pan stops at the edge', () => {
  expect(panFrame({ x: 0.5, y: 0.5, zoom: 2 }, 5000, 5000, 300, 4 / 3)).toEqual({ x: 0.25, y: 0.25, zoom: 2 });
});

test('zoomFrame keeps the centre and re-clamps when zooming out', () => {
  expect(zoomFrame({ x: 0.3, y: 0.5, zoom: 2 }, 3, 4 / 3)).toEqual({ x: 0.3, y: 0.5, zoom: 3 });
  expect(zoomFrame({ x: 0.3, y: 0.5, zoom: 2 }, 1, 4 / 3)).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/domain/tileFrame.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/domain/tileFrame.ts` per Interfaces and the maths block.
- [ ] **Step 4: Run** the same command — Expected: 7 passed.
- [ ] **Step 5: Commit** `feat: tile framing maths (parse, clamp, layout, pan, zoom)`.

---

### Task 2: Saving a picture with its framing

**Files:**
- Modify: `src/ui/artistPicture.ts`
- Modify: `src/image/crop.ts` (`resizeImage` default `maxSide` → 1200)
- Test: `tests/ui/artistPicture.test.ts` (add tests; keep the existing three passing)

**Interfaces:**
- Consumes: `TileFrame`, `encodeFrame`, `DEFAULT_FRAME` (Task 1).
- Produces:
  - `setArtistPicture(args: { repo; photos; artistIds; oldPaths; file: Blob; frame?: TileFrame; resize?: (f: Blob) => Promise<Blob> }): Promise<void>` — as today, plus writes `avatarPosition: encodeFrame(frame ?? DEFAULT_FRAME)` on every artist.
  - `export async function setArtistFrame(args: { repo: Repo; artistIds: string[]; frame: TileFrame }): Promise<void>` — updates only `avatarPosition` on every artist; touches no files.
  - `removeArtistPicture` unchanged (already clears `avatarPosition`).

- [ ] **Step 1: Write the failing tests**

```ts
test('a new picture saves its framing on every artist in the folder', async () => {
  // setup(): two artists, ids; resize stub as in the existing tests
  await setArtistPicture({ repo, photos, artistIds: ids, oldPaths: [], file: small, resize, frame: { x: 0.3, y: 0.6, zoom: 2 } });
  for (const a of (await repo.loadAll()).artists) expect(a.avatarPosition).toBe('frame:0.3,0.6,2');
});

test('a new picture without a framing starts centred at zoom 1', async () => {
  await setArtistPicture({ repo, photos, artistIds: ids, oldPaths: [], file: small, resize });
  expect((await repo.loadAll()).artists[0].avatarPosition).toBe('frame:0.5,0.5,1');
});

test('frame-only edit uploads and deletes nothing', async () => {
  const upload = vi.spyOn(photos, 'upload'); const remove = vi.spyOn(photos, 'remove');
  await setArtistFrame({ repo, artistIds: ids, frame: { x: 0.4, y: 0.4, zoom: 1.5 } });
  expect(upload).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  const a = (await repo.loadAll()).artists[0];
  expect(a).toMatchObject({ avatarPath: 'thumbs/old.jpg', avatarPosition: 'frame:0.4,0.4,1.5' });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/artistPicture.test.ts` — Expected: the 3 new tests FAIL.
- [ ] **Step 3: Implement** the `frame` argument, `setArtistFrame`, and the 1200 px default.
- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: save artist picture framing; frame-only edits`.

---

### Task 3: `FramedPicture` and the Collection tile with ✎

**Files:**
- Create: `src/ui/FramedPicture.tsx`
- Modify: `src/ui/pages/Home.tsx` (`Folder`)
- Modify: `src/styles.css`
- Test: `tests/ui/framedPicture.test.tsx`; `tests/ui/collection.test.tsx` (update the existing "fills the tile" test, add tests)

**Interfaces:**
- Consumes: `frameLayout`, `parseFrame`, `TILE_ASPECT` (Task 1).
- Produces: `export function FramedPicture(props: { src: string; frame: string | null; className?: string; alt?: string }): JSX.Element` — a `div.framed` (position relative, overflow hidden, `aspect-ratio: 4 / 3`) holding an `<img>` absolutely positioned with `width/height/left/top` from `frameLayout(parseFrame(frame), naturalWidth / naturalHeight)`. Before the image has loaded (natural size unknown) use `object-fit: cover` filling the box. Read the natural size from the `<img>`'s `onLoad` (`currentTarget.naturalWidth/Height`).

`Folder` in `Home.tsx` becomes a `div.folder` wrapper (position relative) containing:
- the existing `<Link to={'/artist/' + id}>` with the cover, name and count — the cover is `<FramedPicture src={avatar} frame={artist.avatarPosition} />` when the folder has a picture, else today's newest-sheet look;
- for every folder except `UNKNOWN_FOLDER`, a sibling `<Link className="tile-edit" to={'/artist/' + id + '/picture'} aria-label={'Change picture for ' + name}>` with lucide `Pencil` (size 16), placed over the cover's top-right corner (44 × 44 px tap area). It must not be nested inside the other link.
- `ArtistFolder` needs the framing: add `avatarPosition: string | null` to `ArtistFolder` in `src/domain/folders.ts`, filled like `avatarPath` (first non-null in the group).

CSS: `.folder-cover` uses `aspect-ratio: 4 / 3` instead of `height: 128px`; remove the `.has-picture` rules; `.framed { position: relative; overflow: hidden; aspect-ratio: 4 / 3; width: 100%; }`, `.framed img { position: absolute; max-width: none; }`.

- [ ] **Step 1: Write the failing tests**

```tsx
// framedPicture.test.tsx
test('places the photo from the saved framing once it has loaded', () => {
  render(<FramedPicture src="blob:x" frame="frame:0.5,0.5,2" />);
  const img = screen.getByRole('img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: 400 }); Object.defineProperty(img, 'naturalHeight', { value: 300 });
  fireEvent.load(img);
  expect(img.style.width).toBe('200%'); expect(img.style.height).toBe('200%');
  expect(img.style.left).toBe('-50%'); expect(img.style.top).toBe('-50%');
});

// collection.test.tsx
test('pencil opens the editor', ...)
  // folderRepo(true); MemoryRouter + Routes: '/' → <Home/>, '/artist/:id' → <p>ARTIST</p>, '/artist/:id/picture' → <p>EDITOR</p>
  // click getByLabelText('Change picture for papermilio') → findByText('EDITOR'); queryByText('ARTIST') null

test('unknown artist tile has no pencil', ...)
  // folderRepo(false) has a sheet with no artist → queryByLabelText('Change picture for Unknown artist') null

test('a folder with a picture shows it framed', ...)   // replaces 'a folder with a picture fills the tile'
  // waitFor(document.querySelector('.folder-cover .framed img')) not null
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/framedPicture.test.tsx tests/ui/collection.test.tsx` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** `FramedPicture`, the `Folder` change, `avatarPosition` on `ArtistFolder`, CSS.
- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: framed artist picture on the tile, with a pencil to edit`.

---

### Task 4: Picture editor page `/artist/:id/picture`

**Files:**
- Create: `src/ui/pages/ArtistPictureEditor.tsx`
- Modify: `src/ui/Shell.tsx` (route `/artist/:id/picture`, before `/artist/:id` is not required in v7 but keep it adjacent)
- Modify: `src/styles.css`
- Test: `tests/ui/pictureEditor.test.tsx`

**Interfaces:**
- Consumes: `panFrame`, `zoomFrame`, `parseFrame`, `frameLayout`, `TileFrame`, `MIN_ZOOM`, `MAX_ZOOM`, `TILE_ASPECT` (Task 1); `setArtistPicture`, `setArtistFrame`, `removeArtistPicture` (Task 2); `BackButton` (`fallback="/"`); `artistFolders` / `UNKNOWN_FOLDER`; `loadImage`, `resizeImage` from `src/image/crop.ts`.

Page behaviour:
- Folder not found or `UNKNOWN_FOLDER` → BackButton + `<p className="empty">This artist wasn't found.</p>`.
- Heading `Picture for <name>`; hint `Drag to move. Pinch or use the slider to zoom.`
- **Working photo:** the saved photo (`usePhotoUrl('thumbs', folder.avatarPath)`) with `parseFrame(avatarPosition)`, or — after **Change photo** (hidden file input inside a `label.button-like`, `style={{ display: 'none' }}`) — the picked file as an object URL with `DEFAULT_FRAME`. No photo yet → only the **Change photo** button and the hint `Choose a photo for this tile.`
- **Frame:** `div.editor-frame` (4:3, overflow hidden, `touch-action: none`) rendering the photo with `frameLayout`. Pointer events: one pointer → `panFrame` with the pointer delta and the frame's `clientWidth`; two pointers → `zoomFrame(frame, startZoom * currentDistance / startDistance)`.
- **Photo shape:** `imageAspect` comes from the frame `<img>`'s `onLoad` (`naturalWidth / naturalHeight`); until it has loaded, use `TILE_ASPECT` (so the slider and Save still work, e.g. in tests).
- **Zoom slider:** `<input type="range" aria-label="Zoom" min=1 max=4 step=0.01>` → `zoomFrame`.
- **Rotate left / Rotate right:** draw the working photo rotated ±90° onto a canvas, make it the new working photo (object URL), reset to `DEFAULT_FRAME`, and mark it as a new photo.
- **Save:** new or rotated photo → `setArtistPicture({ …, file: <working blob>, frame })` (the helper shrinks to 1200 px); otherwise → `setArtistFrame({ repo, artistIds, frame })`. Then `d.reload()` and navigate back (`navigate(-1)`, or `/` when opened directly — reuse the BackButton rule by calling the same logic). Error → `Couldn't save the picture. Try again.`
- **Remove picture** (only when a saved picture exists): `removeArtistPicture`, reload, back.
- **Cancel:** back without saving (BackButton-style navigation; no question).
- Buttons order: `Change photo · Remove picture · Cancel · Save` (Save is `.primary`).

- [ ] **Step 1: Write the failing tests** (MemoryRepo + MemoryPhotoStore, stub `URL.createObjectURL`; routes `/` → `<p>HOME</p>`, `/artist/:id/picture` → editor; start at `['/', '/artist/<id>/picture']`)

```tsx
test('an artist without a picture is asked to choose a photo', ...)
  // getByText('Choose a photo for this tile.'); getByText('Change photo'); queryByText('Remove picture') null; queryByText('Save') null

test('with a saved picture: zoom slider then Save stores only the framing', ...)
  // artist with avatarPath + avatarPosition 'frame:0.5,0.5,1'; spy photos.upload
  // fireEvent.change(getByLabelText('Zoom'), { target: { value: '2' } }); click 'Save'
  // findByText('HOME'); artist.avatarPosition starts with 'frame:' and has zoom 2 (parseFrame(...).zoom === 2); upload not called

test('Remove picture clears it and goes back', ...)
  // click 'Remove picture' → findByText('HOME'); artist.avatarPath null

test('Cancel goes back without saving', ...)
  // change Zoom to 3, click 'Cancel' → findByText('HOME'); avatarPosition unchanged

test('the unknown artist has no editor', ...)
  // '/artist/unknown/picture' → getByText("This artist wasn't found.")
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/pictureEditor.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** the page, the route and CSS (`.editor-frame` with a 2 px accent outline, `.editor-actions` wrapping row).
- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: picture editor — move, zoom, rotate in a tile-shaped frame`.

---

### Task 5: Artist page shows the picture only

**Files:**
- Modify: `src/ui/pages/ArtistPage.tsx` (remove: crop box, rotate, Save/Cancel picture, Change/Remove picture, vertical slider, and their state/effects and unused imports)
- Modify: `src/styles.css` (remove `.pic-actions` rules if unused)
- Test: `tests/ui/collection.test.tsx` (replace the existing `artist page offers Change picture…` test)

**Interfaces:**
- Consumes: `FramedPicture` (Task 3).

Header: when the folder has a picture → `<FramedPicture className="artist-banner" src={avatar} frame={avatarPosition} />` above the name (full width, max-width 420 px, rounded 18 px). Without a picture → today's 64 px newest-sheet square.

- [ ] **Step 1: Write the failing tests**

```tsx
test('artist page shows the picture as a banner and has no picture buttons', ...)
  // folderRepo(true) → waitFor(document.querySelector('.artist-banner img')) not null;
  // queryByText('Change picture') null; queryByText('Remove picture') null; queryByLabelText('Vertical position') null
```

- [ ] **Step 2: Run** `npx vitest run tests/ui/collection.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** the clean-up and banner.
- [ ] **Step 4: Run** `npx tsc && npx vitest run && npm run build` — Expected: clean, all pass, build OK.
- [ ] **Step 5: Commit** `feat: artist page shows the framed picture; editing moved to the tile pencil`.

---

### Task 6: Phone walkthrough and package

- [ ] **Step 1:** Build, `vite preview`, Playwright (`executablePath: '/opt/pw-browsers/chromium'`, `devices['iPhone 13']`, `serviceWorkers: 'block'`): add sheets for one artist → Collection → ✎ → Change photo (a wide test image) → drag right and down → zoom slider to 2 → Rotate right once → Save → screenshot the tile; ✎ again → editor opens on the same photo and framing → Cancel; artist page banner screenshot; Remove picture → tile shows the newest sheet again. Expected: no page errors.
- [ ] **Step 2:** `git archive --format=zip --prefix=Casishoarder-Stickers-app/ -o <scratchpad>/Casishoarder-Stickers-app-v6.zip HEAD`.
