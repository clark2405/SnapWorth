import { intentFor, settleAnswer, talksMoney } from './worthy-replies';

it('reads the intent from the words when there is no model', () => {
  expect(intentFor('Is this a fair price?')).toBe('price');
  expect(intentFor('What is my collection worth?')).toBe('collection');
  expect(intentFor('Write my listing')).toBe('listing');
  expect(intentFor("What's trending?")).toBe('trend');
  expect(intentFor('How do I take a good photo?')).toBe('chat');
});

it('spots an amount of money in a reply', () => {
  expect(talksMoney('It sells for about ₱2,500.')).toBe(true);
  expect(talksMoney('Around 3000 pesos')).toBe(true);
  expect(talksMoney('Snap it and I will price it.')).toBe(false);
  expect(talksMoney('Shoot 2 or 3 close-ups.')).toBe(false);
});

it('uses the model’s own words only for a chat', () => {
  expect(
    settleAnswer('Tips for sneakers?', { intent: 'chat', reply: 'Use bright light.' }),
  ).toEqual({ intent: 'chat', words: 'Use bright light.' });
  // Anything with a number goes to the app's data, whatever the model wrote alongside.
  expect(settleAnswer('Worth?', { intent: 'price', reply: 'About ₱900' })).toEqual({
    intent: 'price',
  });
  expect(settleAnswer('What’s trending?', { intent: 'trend', reply: '' })).toEqual({
    intent: 'trend',
  });
});

it('never shows an amount the model let slip into a chat', () => {
  expect(
    settleAnswer('Tell me a price', { intent: 'chat', reply: 'A PS5 goes for ₱25,000.' }),
  ).toEqual({ intent: 'price' });
});

it('falls back to the words when the model has nothing usable', () => {
  expect(settleAnswer('Write my listing', null)).toEqual({ intent: 'listing' });
  expect(settleAnswer('Hello', { intent: 'chat', reply: '  ' })).toEqual({ intent: 'chat' });
  expect(settleAnswer('Is it fair?', { intent: 'nonsense' as never, reply: 'Sure' })).toEqual({
    intent: 'price',
  });
});
