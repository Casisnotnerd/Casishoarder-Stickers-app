import { fireEvent, render } from '@testing-library/react';
import { FramedPicture } from '../../src/ui/FramedPicture';

test('places the photo from the saved framing once it has loaded', () => {
  const { container } = render(<FramedPicture src="blob:x" frame="frame:0.5,0.5,2" />);
  const img = container.querySelector('.framed img') as HTMLImageElement; // decorative (alt=""), so no 'img' role
  Object.defineProperty(img, 'naturalWidth', { value: 400 });
  Object.defineProperty(img, 'naturalHeight', { value: 300 });
  fireEvent.load(img);
  expect(img.style.width).toBe('200%');
  expect(img.style.height).toBe('200%');
  expect(img.style.left).toBe('-50%');
  expect(img.style.top).toBe('-50%');
});
