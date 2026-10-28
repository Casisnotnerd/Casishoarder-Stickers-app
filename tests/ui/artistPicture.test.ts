import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { removeArtistPicture, setArtistPicture } from '../../src/ui/artistPicture';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

async function setup() {
  const repo = new MemoryRepo();
  const photos = new MemoryPhotoStore();
  const a = await repo.createArtist('JUIMJUIM');
  const b = await repo.createArtist('juimjuim2');
  await repo.updateArtist(a.id, { avatarPath: 'thumbs/old.jpg', avatarBytes: 99 });
  return { repo, photos, ids: [a.id, b.id] };
}

const small = new Blob(['small']);
const resize = async () => small;

test('uploads the resized image to every artist in the folder and deletes the old file', async () => {
  const { repo, photos, ids } = await setup();
  const upload = vi.spyOn(photos, 'upload');
  const remove = vi.spyOn(photos, 'remove');
  await setArtistPicture({ repo, photos, artistIds: ids, oldPaths: ['thumbs/old.jpg'], file: new Blob(['a huge photo']), resize });
  expect(upload).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledWith('thumbs', small);
  const path = (await upload.mock.results[0].value).path;
  const artists = (await repo.loadAll()).artists;
  for (const a of artists) expect(a).toMatchObject({ avatarPath: path, avatarBytes: 5 });
  expect(remove).toHaveBeenCalledWith('thumbs', ['thumbs/old.jpg']);
});

test('a failed upload keeps the old picture', async () => {
  const { repo, photos, ids } = await setup();
  vi.spyOn(photos, 'upload').mockRejectedValue(new Error('offline'));
  const remove = vi.spyOn(photos, 'remove');
  await expect(setArtistPicture({ repo, photos, artistIds: ids, oldPaths: ['thumbs/old.jpg'], file: small, resize })).rejects.toThrow();
  expect((await repo.loadAll()).artists[0].avatarPath).toBe('thumbs/old.jpg');
  expect(remove).not.toHaveBeenCalled();
});

test('remove clears the picture and deletes the file', async () => {
  const { repo, photos, ids } = await setup();
  const remove = vi.spyOn(photos, 'remove');
  await removeArtistPicture({ repo, photos, artistIds: ids, oldPaths: ['thumbs/old.jpg'] });
  for (const a of (await repo.loadAll()).artists) expect(a).toMatchObject({ avatarPath: null, avatarBytes: 0 });
  expect(remove).toHaveBeenCalledWith('thumbs', ['thumbs/old.jpg']);
});
