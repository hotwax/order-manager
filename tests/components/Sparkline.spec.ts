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
});
