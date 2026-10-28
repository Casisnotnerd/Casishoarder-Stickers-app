# Back button, artist pictures, spending by year and month — decisions (2026-10-28)

Agreed with the user in chat. Builds on main at `1ade146` (Collection = artist folders, Search = search and filters).

## 1. Back button

- Pages that get a **Back** button at the top: **Sheet detail**, **All orders**, **Add one sheet**, **Add many sheets**.
- The artist folder page keeps its existing `‹ Collection` link (not selected for change).
- Back returns to **where you came from** (browser history), e.g. a sheet opened from papermilio's folder goes back to that folder; a sheet opened from Search goes back to Search **with the search text, filters and sort kept**.
- If there is no earlier page in the app (the app was opened straight onto that page), Back goes to the page's parent instead: Sheet → Collection, Orders → Spending, Add one / Add many → the + choice screen.
- Leaving an Add page with unsaved work asks first. Already-saved photos in a bulk order stay saved.

## 2. Artist tile picture

- On the artist folder page: a **Change picture** button under the name, and **Remove picture** when one is set. Removing goes back to the artist's newest sheet as the cover.
- Not offered for the "Unknown artist" folder.
- The picture **fills the whole tile** edge to edge (edges may be trimmed).
- It is the same picture as the existing artist avatar in Settings → Artists (one picture per artist, not two).
- Pictures are shrunk before upload; the replaced file is deleted from storage.
- Artists with the same name that share one folder all get the picture.

## 3. Spending by year and month

- Spending gets a **year switcher** `‹ 2026 ›` with that year's total. The 12 tiles show **Jan–Dec of the chosen year** (replacing "last 12 months"). The switcher goes from the earliest year with a dated order up to the current year.
- A month's spending is decided by the **order date** ("Bought on"). Orders with no date are not in any month; they are shown as one "No date" line under the tiles, linking to All orders.
- **Tapping a month opens a month page**; months with S$0 are greyed out and cannot be tapped. The current month stays highlighted.
- The **month page** shows: the month total (with the shipping included), then **a bar per artist** for that month. It has a Back button (fallback: Spending on that month's year).
- The month page shows all artists; the artist filter on Spending does not carry over.
- The "By month" bar list is removed (the year tiles replace it).
