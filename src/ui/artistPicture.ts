import type { PhotoStore, Repo } from '../data/repo';
import { resizeImage } from '../image/crop';
import { DEFAULT_FRAME, encodeFrame, type TileFrame } from '../domain/tileFrame';

/**
 * Sets one picture on every artist in a folder (same-name artists share a folder).
 * The old file is deleted only after the new picture is saved, so a failed upload keeps the old one.
 */
export async function setArtistPicture(args: {
  repo: Repo; photos: PhotoStore; artistIds: string[]; oldPaths: string[]; file: Blob;
  frame?: TileFrame; resize?: (f: Blob) => Promise<Blob>;
}): Promise<void> {
  const { repo, photos, artistIds, oldPaths, file, frame, resize = (f) => resizeImage(f) } = args;
  const small = await resize(file);
  const up = await photos.upload('thumbs', small);
  const avatarPosition = encodeFrame(frame ?? DEFAULT_FRAME);
  for (const id of artistIds) await repo.updateArtist(id, { avatarPath: up.path, avatarBytes: up.bytes, avatarPosition });
  const stale = oldPaths.filter((p) => p !== up.path);
  if (stale.length) await photos.remove('thumbs', stale).catch(() => {});
}

/** Clears the picture on every artist in a folder (the tile goes back to their newest sheet). */
export async function removeArtistPicture(args: {
  repo: Repo; photos: PhotoStore; artistIds: string[]; oldPaths: string[];
}): Promise<void> {
  const { repo, photos, artistIds, oldPaths } = args;
  for (const id of artistIds) await repo.updateArtist(id, { avatarPath: null, avatarBytes: 0, avatarPosition: null });
  if (oldPaths.length) await photos.remove('thumbs', oldPaths).catch(() => {});
}

/** Saves only a new position / zoom for the picture already there: no upload, no file deleted. */
export async function setArtistFrame(args: { repo: Repo; artistIds: string[]; frame: TileFrame }): Promise<void> {
  const avatarPosition = encodeFrame(args.frame);
  for (const id of args.artistIds) await args.repo.updateArtist(id, { avatarPosition });
}
