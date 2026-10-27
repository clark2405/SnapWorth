import { gridColumnsFor, layoutClassFor } from './layout-class';

describe('layoutClassFor', () => {
  it('keeps the native apps on the phone layout at every width', () => {
    expect(layoutClassFor(1600, 'ios')).toBe('compact');
    expect(layoutClassFor(1600, 'android')).toBe('compact');
  });

  it('steps the web up at the medium and expanded breakpoints', () => {
    expect(layoutClassFor(767, 'web')).toBe('compact');
    expect(layoutClassFor(768, 'web')).toBe('medium');
    expect(layoutClassFor(1199, 'web')).toBe('medium');
    expect(layoutClassFor(1200, 'web')).toBe('expanded');
  });
});

describe('gridColumnsFor', () => {
  it('fits as many minimum-width cards as the width allows, up to the cap', () => {
    expect(gridColumnsFor(200)).toBe(1);
    expect(gridColumnsFor(600)).toBe(2);
    expect(gridColumnsFor(1000)).toBe(3);
    expect(gridColumnsFor(2000)).toBe(3);
    expect(gridColumnsFor(2000, 4)).toBe(4);
  });
});
