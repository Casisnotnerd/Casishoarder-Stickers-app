import type { Artist, Sheet } from '../../src/domain/types';
import { findSameTitle, findArtistByName } from '../../src/domain/duplicates';

const sheets: Sheet[] = [
  { id: 'w', artistId: 'aP', title: 'Winter', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null, createdAt: '' },
  { id: 'x', artistId: null, title: '계란이 좋아', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null, createdAt: '' },
];
const artists: Artist[] = [{ id: 'aJ', name: 'JUIMJUIM', aliases: ['Juimsuim'], avatarPath: null, avatarBytes: 0, avatarPosition: null }];

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
