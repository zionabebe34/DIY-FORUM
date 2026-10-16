// Browser APIs that jsdom doesn't implement, plus per-test cleanup.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetAIStatusForTests } from '../lib/hooks.js';

// IntersectionObserver: report every observed element as visible right away,
// so infinite scroll / count-up animations run in tests.
class IO {
  constructor(cb) { this.cb = cb; }
  observe(el) { setTimeout(() => this.cb([{ isIntersecting: true, target: el }]), 0); }
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IO;
window.IntersectionObserver = IO;

window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((q) => ({
  matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
}));
URL.createObjectURL = vi.fn(() => 'blob:preview');
URL.revokeObjectURL = vi.fn();

// ProseMirror (TipTap) measures text with ranges; jsdom has no layout.
const rect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} };
Range.prototype.getBoundingClientRect = () => rect;
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
document.elementFromPoint = () => null;

// requestAnimationFrame → run on the next tick (CountUp animation)
window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now() + 5000), 0);

beforeEach(() => {
  window.location.hash = '';
  resetAIStatusForTests();   // each test's fake server answers /api/ai/status anew
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
