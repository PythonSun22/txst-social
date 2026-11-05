import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import CollegeCarousel from './CollegeCarousel';

let container;
let root;
let reducedMotion;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  reducedMotion = true;
  window.matchMedia = jest.fn(() => ({
    matches: reducedMotion,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function click(label) {
  act(() => container.querySelector(`[aria-label="${label}"]`).click());
}

function finishAnimations() {
  act(() => {
    gsap.globalTimeline.getChildren(false, false, true).forEach(timeline => timeline.progress(1));
  });
}

function status() {
  return container.querySelector('[role="status"]').textContent;
}

test('all ten colleges are reachable, wrap in both directions, and support direct selection', () => {
  act(() => root.render(<CollegeCarousel />));
  expect(status()).toContain('college 1 of 10');
  click('Previous college');
  expect(status()).toContain('University College, college 10 of 10');
  click('Next college');
  expect(status()).toContain('college 1 of 10');
  for (let i = 2; i <= 10; i += 1) {
    click('Next college');
    expect(status()).toContain(`college ${i} of 10`);
  }
  act(() => container.querySelectorAll('.college-picker button')[4].click());
  expect(status()).toContain('Fine Arts & Communication');
  expect(container.querySelectorAll('.college-slide[aria-hidden="false"]')).toHaveLength(1);
  expect(container.querySelectorAll('.college-picker [aria-current="true"]')).toHaveLength(1);
});

test('arrow navigation works and ignores keystrokes in editable fields', () => {
  act(() => root.render(<CollegeCarousel />));
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(status()).toContain('college 2 of 10');
  const input = document.createElement('input');
  container.appendChild(input);
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(status()).toContain('college 2 of 10');
});

test('rapid input is locked until the coordinated animation completes', () => {
  reducedMotion = false;
  act(() => root.render(<CollegeCarousel />));
  finishAnimations();
  click('Next college');
  click('Next college');
  expect(status()).toContain('college 2 of 10');
  finishAnimations();
  click('Next college');
  expect(status()).toContain('college 3 of 10');
  finishAnimations();
});
