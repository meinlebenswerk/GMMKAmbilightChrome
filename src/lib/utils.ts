export const gcd = (a: number, b: number): number => {
  if (b === 0) return a;
  return gcd(b, a % b);
};

export const lcm = (a: number, b: number): number => (Math.abs(a) / gcd(a, b)) * Math.abs(b);

export const minMultF2I = (num: number): number => {
  const nstr = num.toString(10);
  const ndecimal = nstr.split('.')[1]?.length ?? 0;
  if (ndecimal === 0) return 1;
  const fractionDenominator = 10 ** ndecimal;
  return fractionDenominator / gcd(num * fractionDenominator, fractionDenominator);
};

export const deduplicateArray = <T>(array: Array<T>): Array<T> => {
  const deduped: Array<T> = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const el of array) {
    // eslint-disable-next-line no-continue
    if (deduped.includes(el)) continue;
    deduped.push(el);
  }
  return deduped;
};

export const linspace = (a: number, b: number, n: number): Array<number> => {
  const step = (b - a) / (n - 1);
  return new Array(n).fill(1).map((e, i) => a + (i) * step);
};

export const gaussian = (x: number, mu = 0, sigma = 0.01): number => {
  const a = 1 / (sigma * Math.sqrt(2 * Math.PI));
  return (a * Math.exp(-0.5 * ((x ** 2 - mu ** 2) / sigma ** 2)));
};
