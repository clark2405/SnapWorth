import { coachFor, generalPhotoTips } from './photo-coach';

it('gives the shots for a kind of item', () => {
  expect(coachFor('shoes').shots).toContain('The size tag inside the tongue');
  expect(coachFor('electronics').title).toBe('For electronics, also snap');
});

it('falls back to general tips when the kind is unknown or missing', () => {
  expect(coachFor('other')).toBe(generalPhotoTips);
  expect(coachFor(null)).toBe(generalPhotoTips);
  expect(coachFor('toString')).toBe(generalPhotoTips);
});
