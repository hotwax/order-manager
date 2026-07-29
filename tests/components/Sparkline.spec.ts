import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import Sparkline from '@common/components/Sparkline.vue';

describe('Sparkline', () => {
  it('renders a varying nonzero hourly fixture as a non-flat SVG polyline', () => {
    const points = Array.from({ length: 24 }, (_, hourOfDay) =>
      hourOfDay === 11 ? 5 : 0
    );
    const wrapper = mount(Sparkline, {
      props: { points }
    });

    const coordinates = wrapper.get('polyline').attributes('points').split(' ');
    const yCoordinates = coordinates.map((coordinate) => coordinate.split(',')[1]);

    expect(coordinates).toHaveLength(24);
    expect(new Set(yCoordinates).size).toBeGreaterThan(1);
  });

  it('applies a caller aria-label to the SVG instead of the wrapper', () => {
    const wrapper = mount(Sparkline, {
      props: { points: [0, 5, 0] },
      attrs: { 'aria-label': 'Entries into Unfillable today' }
    });
    const svg = wrapper.get('svg');

    expect(wrapper.attributes('aria-label')).toBeUndefined();
    expect(svg.attributes('role')).toBe('img');
    expect(svg.attributes('aria-label')).toBe('Entries into Unfillable today');
    expect(svg.attributes('aria-hidden')).toBeUndefined();
  });

  it('hides an unlabeled decorative SVG from assistive technology', () => {
    const wrapper = mount(Sparkline, {
      props: { points: [0, 5, 0] }
    });
    const svg = wrapper.get('svg');

    expect(svg.attributes('role')).toBeUndefined();
    expect(svg.attributes('aria-label')).toBeUndefined();
    expect(svg.attributes('aria-hidden')).toBe('true');
  });
});
