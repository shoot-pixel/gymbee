import { feetInchesToCm, cmToFeetInches } from '../units';

describe('feetInchesToCm / cmToFeetInches', () => {
  it('converts feet+inches to cm', () => {
    expect(feetInchesToCm(5, 10)).toBeCloseTo(177.8, 1);
    expect(feetInchesToCm(6, 0)).toBeCloseTo(182.88, 1);
  });

  it('round-trips back to the original feet/inches', () => {
    expect(cmToFeetInches(feetInchesToCm(5, 10))).toEqual({ feet: 5, inches: 10 });
    expect(cmToFeetInches(feetInchesToCm(6, 0))).toEqual({ feet: 6, inches: 0 });
  });

  it('rolls 11.5+ inches over into the next foot instead of reporting 12 inches', () => {
    expect(cmToFeetInches(feetInchesToCm(5, 11.6))).toEqual({ feet: 6, inches: 0 });
  });
});
