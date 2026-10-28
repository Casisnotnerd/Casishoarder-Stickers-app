import type { PhotoStore, Repo } from '../data/repo';
import { resizeImage } from '../image/crop';

/**
 * Sets one picture on every artist in a folder (same-name artists share a folder).
 * The old file is deleted only after the new picture is saved, so a failed upload keeps the old one.
 */
export async function setArtistPicture(args: {
  repo: Repo; photos: PhotoStore; artistIds: string[]; oldPaths: string[]; file: Blob;
  resize?: (f: Blob) => Promise<Blob>;
}): Promise<void> {
  const { repo, photos, artistIds, oldPaths, file, resize = (f) => resizeImage(f) } = args;
  const small = await resize(file);
  const up = await photos.upload('thumbs', small);
  for (const id of artistIds) await repo.updateArtist(id, { avatarPath: up.path, avatarBytes: up.bytes });
  const stale = oldPaths.filter((p) => p !== up.path);
  if (stale.length) await photos.remove('thumbs', stale).catch(() => {});
}

/** Clears the picture on every artist in a folder (the tile goes back to their newest sheet). */
export async function removeArtistPicture(args: {
  repo: Repo; photos: PhotoStore; artistIds: string[]; oldPaths: string[];
}): Promise<void> {
  const { repo, photos, artistIds, oldPaths } = args;
  for (const id of artistIds) await repo.updateArtist(id, { avatarPath: null, avatarBytes: 0 });
  if (oldPaths.length) await photos.remove('thumbs', oldPaths).catch(() => {});
}
