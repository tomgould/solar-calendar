import type { SkyEventKind } from '../core/sky';

const svg = (body: string, size = 12) =>
  `<svg viewBox="0 0 12 12" width="${size}" height="${size}" aria-hidden="true" focusable="false">${body}</svg>`;

const rays = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  const [x1, y1, x2, y2] = [6 + 3.9 * Math.cos(angle), 6 + 3.9 * Math.sin(angle), 6 + 5.6 * Math.cos(angle), 6 + 5.6 * Math.sin(angle)];
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>`;
}).join('');

const sun = svg(`<circle cx="6" cy="6" r="2.4" fill="currentColor"/>${rays}`);
const equinox = svg('<circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 1.6a4.4 4.4 0 0 1 0 8.8z" fill="currentColor"/>');

/** Marks shown in calendar cells. Moon quarters other than new and full are left out. */
export const EVENT_ICONS: Partial<Record<SkyEventKind, string>> = {
  'march-equinox': equinox,
  'september-equinox': equinox,
  'june-solstice': sun,
  'december-solstice': sun,
  'full-moon': svg('<circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="1.3"/>'),
  'new-moon': svg('<circle cx="6" cy="6" r="4.2" fill="currentColor"/>'),
};

const sunRays = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  const [x1, y1, x2, y2] = [8 + 5 * Math.cos(angle), 8 + 5 * Math.sin(angle), 8 + 7 * Math.cos(angle), 8 + 7 * Math.sin(angle)];
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
}).join('');

/** Theme button icons: the moon offers dark mode, the sun offers light mode. */
export const THEME_ICONS = {
  dark: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M13.6 10.3A6 6 0 0 1 5.7 2.4a6 6 0 1 0 7.9 7.9z" fill="currentColor"/></svg>',
  light: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="3.2" fill="currentColor"/>${sunRays}</svg>`,
};

/** Marks a festival day in calendar cells: a four-pointed star. */
export const FESTIVAL_ICON = svg('<path d="M6 .8 7.4 4.6 11.2 6 7.4 7.4 6 11.2 4.6 7.4.8 6 4.6 4.6z" fill="currentColor"/>');

export const chevron = (direction: 'left' | 'right') =>
  `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="${direction === 'left' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
