# Artist tile picture editor — decisions (2026-10-28)

Agreed with the user in chat. Builds on `main` at `5e9eba9` (their local-model commits: `avatarPosition` field, crop box + rotate + vertical slider on the artist page). The user confirmed the `avatar_position` column exists in their Supabase database.

## What the user wants

- The artist tile picture on Collection is the user's own chosen picture, independent of the sticker sheets.
- **Until a picture is chosen**, the tile keeps showing the artist's newest sheet (today's behaviour). Once chosen, the tile only ever shows that picture.
- The picture **fills the whole tile**. The user can **move it in every direction, zoom in and out, and rotate** it to fit the tile.
- **Where:** a pencil (✎) button on each Collection tile opens the editor. Not on the "Unknown artist" tile.
- **Editor:** a frame with exactly the tile's shape over the photo. Drag to move (any direction), pinch or a zoom slider to zoom, Rotate left / Rotate right. Buttons: **Change photo · Remove picture · Cancel · Save**. What is inside the frame is exactly what the tile shows.
- **Re-adjust later:** the photo is kept (shrunk) together with its position and zoom, so ✎ reopens the editor on the same photo; changing only position/zoom does not re-upload.
- **Remove picture** (inside the editor) goes back to the newest sheet.
- **Artist page:** just shows the picture as a banner (same framing as the tile). The Change/Remove buttons, the crop box and the vertical slider are removed from the artist page.

## Decisions made while planning (stated to the user)

- The tile gets a fixed shape, **4 : 3** (width : height), instead of a fixed 128 px height, so the framing looks the same on every phone width. The editor frame and the artist-page banner use the same 4 : 3 shape.
- Framing is saved in the existing `avatar_position` text column as `frame:<x>,<y>,<zoom>` — x and y are the centre of the visible area as fractions (0–1) of the photo, zoom is 1–4 where 1 = the photo just covers the frame. No database change needed. Older values such as `50% 20%` (from the vertical slider) are read as centre (0.5, 0.2), zoom 1.
- Rotation is applied to the stored photo itself (the rotated photo is what gets saved).
- The stored photo is shrunk so its long side is at most **1200 px** (enough to zoom in on a phone; about 150–250 KB).
- Settings → Artists avatar upload keeps working; a picture set there starts centred at zoom 1.
