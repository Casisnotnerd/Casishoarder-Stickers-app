import { guessTitle } from '../../src/domain/titleGuess';

test('picks the first name-like line', () => {
  expect(guessTitle('Winter\n@PAPERMILIO')).toBe('Winter');
  expect(guessTitle('@papermilio\n3.50\nAus Natives')).toBe('Aus Natives');
  expect(guessTitle('$ 12\nX\n계란이 좋아')).toBe('계란이 좋아');
  expect(guessTitle('')).toBe('');
});
