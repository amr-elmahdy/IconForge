import { describe, expect, it } from 'vitest';
import { assignFileNames, fileNameFor, variantToKebab } from '../../src/output/naming.js';

describe('file naming', () => {
  it('default becomes <slug>.svg, others <slug>-<kebab>.svg', () => {
    expect(fileNameFor('react', 'default')).toBe('react.svg');
    expect(fileNameFor('react', 'mono')).toBe('react-mono.svg');
    expect(fileNameFor('react', 'wordmarkLight')).toBe('react-wordmark-light.svg');
    expect(variantToKebab('iconDark')).toBe('icon-dark');
    expect(fileNameFor('aws-ec2', '16')).toBe('aws-ec2-16.svg');
  });
  it('rejects unsafe slugs', () => {
    expect(() => fileNameFor('../etc', 'default')).toThrow();
    expect(() => fileNameFor('A b', 'default')).toThrow();
  });
  it('detects collisions between slug-variant and a slug that looks like it', () => {
    const { files, collisions } = assignFileNames([
      { slug: 'foo', variant: 'mono' },
      { slug: 'foo-mono', variant: 'default' },
    ]);
    expect(files).toHaveLength(1);
    expect(collisions).toEqual([{ slug: 'foo-mono', variant: 'default', filename: 'foo-mono.svg', owner: 'foo/mono' }]);
  });
  it('respects names reserved by previous runs', () => {
    const { collisions } = assignFileNames([{ slug: 'foo-mono', variant: 'default' }], new Map([['foo-mono.svg', { slug: 'foo', variant: 'mono' }]]));
    expect(collisions).toHaveLength(1);
  });
});
