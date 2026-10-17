/**
 * Equinox and solstice instants from Jean Meeus, Astronomical Algorithms
 * (2nd ed.), chapter 27, table 27.B (valid 1000 to 3000). Accurate to about
 * a minute; the tests cross-check it against astronomy-engine.
 */

export type Season = 'march-equinox' | 'june-solstice' | 'september-equinox' | 'december-solstice';

export const SEASONS: readonly Season[] = ['march-equinox', 'june-solstice', 'september-equinox', 'december-solstice'];

// Mean instants (JDE0) as polynomials in Y = (year - 2000) / 1000
const MEAN: Record<Season, readonly number[]> = {
  'march-equinox': [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  'june-solstice': [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
  'september-equinox': [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  'december-solstice': [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
};

// Periodic terms [A, B, C] from table 27.C
const TERMS: readonly (readonly [number, number, number])[] = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
  [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
  [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
  [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];

const JD_UNIX_EPOCH = 2440587.5;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Delta T (TT minus UT) in seconds, from the Espenak and Meeus polynomials
 * used by NASA's eclipse pages. Errors here move results by seconds, which
 * only matters when an equinox falls within a minute or two of midnight UTC.
 */
export function deltaT(year: number): number {
  const y = year;
  if (y < 1600) {
    const u = (y - 1000) / 100;
    return 1574.2 - 556.01 * u + 71.23472 * u ** 2 + 0.319781 * u ** 3 - 0.8503463 * u ** 4 - 0.005050998 * u ** 5 + 0.0083572073 * u ** 6;
  }
  if (y < 1700) {
    const t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129;
  }
  if (y < 1800) {
    const t = y - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000;
  }
  if (y < 1860) {
    const t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  if (y < 1900) {
    const t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    const t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  if (y < 2150) return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y);
  return -20 + 32 * ((y - 1820) / 100) ** 2;
}

/** The instant of an equinox or solstice, in ms since 1970-01-01 UTC. */
export function seasonInstant(year: number, season: Season): number {
  const Y = (year - 2000) / 1000;
  const [a, b, c, d, e] = MEAN[season];
  const jde0 = a + b * Y + c * Y ** 2 + d * Y ** 3 + e * Y ** 4;
  const T = (jde0 - 2451545.0) / 36525;
  const W = toRadians(35999.373 * T - 2.47);
  const deltaLambda = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
  const S = TERMS.reduce((sum, [A, B, C]) => sum + A * Math.cos(toRadians(B + C * T)), 0);
  const jde = jde0 + (0.00001 * S) / deltaLambda;
  const fractionalYear = year + 0.21 + 0.25 * SEASONS.indexOf(season);
  return (jde - JD_UNIX_EPOCH) * 86_400_000 - deltaT(fractionalYear) * 1000;
}
