import { motion } from '../motion';

describe('motion presets', () => {
  it('exposes the documented preset shapes', () => {
    expect(motion.spring).toEqual({ damping: 14, stiffness: 180 });
    expect(motion.springTight).toEqual({ damping: 18, stiffness: 240 });
    expect(motion.springLoose).toEqual({ damping: 10, stiffness: 140, mass: 1.2 });
    expect(motion.fade.duration).toBe(220);
    expect(motion.scaleTap).toEqual({ from: 1, to: 0.94 });
    expect(motion.confetti).toEqual({ particles: 24, durationMs: 1200 });
  });
});
