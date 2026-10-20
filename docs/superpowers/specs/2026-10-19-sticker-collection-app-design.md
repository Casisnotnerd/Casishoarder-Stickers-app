# Sticker Collection App — Design Spec

Date: 2026-10-19 · Status: draft for user review

## 1. Goal

A personal app to catalogue a sticker-sheet collection (1,000+ sheets, ~20 added per month) by photo, video or shop screenshot. It records the artist, purchase date, cost and copies owned. It must cost nothing to run, and photos must never be used to train anyone's AI.

## 2. Requirements (confirmed with user)

| Area | Decision |
|---|---|
| Deliverable | Working app, used on iPhone and in a web browser |
| Unit of record | Sticker **sheet** (one record per design), with copies counted |
| Input | Camera photo, camera video, gallery upload, shop screenshot |
| Detection | Automatic: find each sheet, crop it, read its text, count stacked copies. User confirms counts and cost |
| Artist | Suggested when confident; otherwise the user is asked |
| Cost | Order total + listed price per sheet; shipping/fees stored separately on the order |
| Currency | Multi-currency. No exchange-rate service: the user enters the **SGD amount actually paid** per order, and the app derives the rate (SGD paid ÷ order total in the original currency) |
| Fields | Title, artist, purchase date, quantity, listed price, currency, shipping/fees, shop, tags |
| Old sheets | Blank allowed; rough values flagged "estimated" and totalled separately |
| Features | Collection gallery, search/filter, spending totals, duplicate warning, CSV export, "used up", delete |
| Data | Private cloud account (single user) + share link |
| Share link | Shows photos, titles and artists only. Prices, orders and shops are blocked on the server |
| Budget | Free only |
| Privacy | No service that may use the photos for training (rules out the Gemini free tier) |
| Languages | English and Korean titles (200–300 Korean sheets) |

## 3. Approach (chosen: E — classic image processing + small text readers, on the device)

Two other approaches were rejected:
- **Gemini free tier:** its free-tier content may be used to improve Google's products.
- **Cloud vision AI (Cloudflare / Hugging Face):** neither could be reached from the test workspace, and accuracy was unproven.

| Job | Method | Runs on |
|---|---|---|
| Find & crop sheets | OpenCV (background separation + rectangle detection); user fixes boxes | Device |
| Count stacked copies | Repeated header-strip matching inside a stack; user confirms | Device |
| Recognise known sheets / duplicates | SIFT feature matching against the catalogue's reference photos | Device |
| Read English text & prices | PP-OCR (small ONNX models, ~13 MB) | Device |
| Read Korean text | Tesseract Korean data (as packaged for Tesseract.js) | Device |
| Video | Sharpest frame per page; stable frames only; group frames by page | Device |
| Login, database, photo storage, share link | Supabase free tier | Cloud |

App type: **one installable web app (PWA)**. It is added to the iPhone home screen and also runs in a desktop browser. There is no App Store release.

### Recognition bands
Each detected sheet is scored against the catalogue:
- **Auto-match:** clearly the same sheet; added as a copy.
- **Ask me:** close call; "Is this *Autumn*? [Yes] [No]".
- **New sheet:** user fills in the title (typed once), then the sheet is recognised by image from then on.

The thresholds are set during the real recognition test (§8). In testing, correct matches scored 30–275 inliers and different designs scored at most 23, so the band edges must be tuned.

## 4. Data model

```
ARTIST ──< SHEET >── TAG
SHOP   ──< ORDER >──< ORDER_LINE >── SHEET
SHEET  ──< USAGE (used-up events)
```

| Entity | Fields |
|---|---|
| Artist | name, aliases (e.g. "Juimsuim" → JUIMJUIM) |
| Sheet | title, artist, tags, reference photo(s), image fingerprint (SIFT features) |
| Order | date (or blank), shop, currency, shipping/fees, order total, SGD paid (optional), estimated flag |
| Order line | sheet, quantity, listed price each, estimated flag |
| Usage | sheet, quantity used, date |

Derived values:
- **Copies owned** = Σ order-line quantities − Σ usage quantities
- **Order rate** = SGD paid ÷ order total (original currency). If the order total is blank, Σ(lines) + shipping is used instead. If the order currency is SGD, SGD paid = order total automatically.
- **Per-sheet cost (SGD)** = listed price × order rate. Shipping (SGD) = shipping × order rate, kept on the order and not added to sheets.
  - Example: ₩15,000 order, S$15.60 paid → rate 0.00104 → a ₩3,000 sheet = S$3.12.
- **SGD paid blank** → the order and its sheets show "S$ —" and are **excluded from SGD totals**. The Spending screen shows how many orders are missing an SGD amount.
- **Spending totals** = by artist / month / overall, with exact and estimated amounts shown separately. Used-up sheets still count.

Rules:
- Order total ≠ Σ(lines) + shipping → **warn and save both** (e.g. a discount).
- Sheets logged with no known order go to a per-user **"Unknown order"** (blank date and price).
- Only **cropped sheet photos** are stored (compressed, ~0.3 MB each, an estimate). The original photo or video is discarded after processing.

## 5. Screens

Bottom menu: **Collection · ➕ Add · Spending · Settings**

1. **Collection:** photo grid with search, artist and tag filters, and copy count. Used-up sheets (0 copies) are hidden behind a "Show used up" toggle.
2. **Add:** take photo / record video / pick from gallery / shop screenshot. While recording video, live hints show ("hold steady", "page detected ✓").
3. **Fix boxes:** detected boxes. The user can drag, split, delete or draw a box, and adjust copies with − / +.
4. **Confirm:** order fields at the top (date, shop, currency, shipping, total, **SGD paid** with the derived rate shown, mismatch warning; all skippable). Below that, one card per sheet: ✅ known, ❓ ask, 🆕 new with suggested title, artist and price.
5. **Sheet detail:** photo, title, artist, tags, copies owned, order history, usage history. Buttons:
   - **Used up:** −1 copy (or choose a number); kept in history and spending.
   - **Delete:** removes the sheet, its photos and its order lines, after a confirmation showing what will be removed. Spending totals drop accordingly. This is meant for mistakes.
6. **Spending:** total, exact vs estimated, by artist, by month; Export CSV.
7. **Settings:** share link (on/off, copy link), home currency (SGD), artist list (merge / aliases), export.

Duplicate warning (in the Confirm step):
- "You own 2 already. Add more or skip?"
- If the matched sheet is used up: "You had this (used up). Add again?"

## 6. Errors & edge cases

| Situation | Behaviour |
|---|---|
| No sheets found / wrong boxes | Manual box drawing |
| Blurry photo, mid-flip video frame | Discarded; "Too blurry, retake?" if none are usable |
| Slow phone / unsupported browser | Manual entry still works; heavy processing can be done in a desktop browser |
| Offline | Captures are queued on the device and uploaded when back online |
| SGD paid not entered | "S$ —"; order excluded from SGD totals; counted as "missing SGD" on Spending |
| Supabase project paused (free tier pauses after 1 week inactive) | Weekly automatic check-in; if paused anyway, a clear message with resume steps |
| Storage ≥ 80% of 1 GB | Warning |
| Same artist, two names | Merge in Settings; the old name becomes an alias |
| Delete a sheet with orders | Confirmation listing what is removed |
| Share link | Server-side rules expose only photo, title and artist |

## 7. Evidence from feasibility tests (2026-10-16 → 19)

| Test | Input | Result |
|---|---|---|
| Find stacks | Table photo (8 designs, 16 sheets as counted by Claude) | 4/4 stacks found; 4 overlapping different sheets merged into one region |
| Count copies | Same | 3/4 correct (Autumn 2 vs 3). Threshold tuned on the same photo, so likely optimistic |
| Recognise known sheet | 8 designs × 3 **simulated** re-photos, 3 random seeds | 24/24 each time; closest wrong pair Autumn↔Winter (23 inliers) |
| English OCR | Table photo | Plain caps text read; script fonts (Winter, Spring) missed |
| Korean OCR | 2 shop screenshots | Titles ❌ / ⚠️; artist ⚠️ close; price "3000원" ✅ |
| Video pages | WhatsApp video (464×832) | 4/4 pages + 1 extra mid-flip group |
| Video OCR | Same | Nothing readable (resolution) |
| Barcode | Shop screenshot | Not decoded |

Evidence images: `docs/test-evidence/result_photo.jpg`, `docs/test-evidence/result_video.jpg`.

## 8. Testing plan

1. **Baseline set:** table photo, binder video (original quality), shop screenshots. The build must match or beat the §7 results.
2. **Real recognition test (before the full build):** the user re-photographs ~20 already-logged sheets. Measure the real match accuracy and set the band thresholds.
3. **Money maths:** automated tests for the derived rate (including the ₩15,000 / S$15.60 example), blank SGD paid, SGD-currency orders, exact vs estimated totals, the mismatch warning, and copies owned after "used up".
4. **Share-link privacy:** an automated test that price, order and shop fields are never returned through the link.
5. **iPhone:** speed and camera on the user's iPhone (Safari / home-screen app).

## 9. Assumptions (stated, accepted by user unless noted)

1. A home-screen web app (PWA) is acceptable, with no App Store release.
2. Supabase alone holds login, data and photos; Cloudflare R2 is added only if storage runs out.
3. Binder video is mainly for logging owned sheets; table photos are for new purchases with stacks.
4. Export is CSV.
5. Single user; no other editors.
6. No exchange-rate service. The user enters SGD paid per order (changed 2026-10-19; replaces the earlier "rate on capture date" decision).

## 10. Open items to resolve during planning

- Choose a free way to schedule the weekly Supabase check-in.
- Confirm on the user's iPhone that the browser-based OpenCV and text readers run at acceptable speed.
- Real recognition accuracy (§8.2); the current evidence is simulated.

## 11. Out of scope

Wishlist, partly-used sheets (tracking individual stickers peeled off; a sheet is either owned or "used up"), condition, notes, multiple users, native App Store app, paid AI services.
