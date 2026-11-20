import { describe, expect, it } from 'vitest';
import {
  createPresentationDocument,
  createPresentationSlide,
  duplicatePresentationSlide,
  isPresentationDocument,
} from './model';

describe('presentation model', () => {
  it('creates an isolated 16:9 title deck', () => {
    const document = createPresentationDocument('deck-001', 'Quarterly review');

    expect(document.id).toBe('deck-001');
    expect(document.title).toBe('Quarterly review');
    expect(document.schemaVersion).toBe(1);
    expect(document.width / document.height).toBeCloseTo(16 / 9);
    expect(document.slides).toHaveLength(1);
    expect(document.slides[0].objects).toHaveLength(2);
    expect(isPresentationDocument(document)).toBe(true);
  });

  it('rejects empty document identifiers', () => {
    expect(() => createPresentationDocument('')).toThrow(
      'presentationId must be a non-empty string.',
    );
  });

  it('duplicates a slide without reusing slide or object IDs', () => {
    const original = createPresentationSlide(0);
    original.objects = [
      {
        id: 'object-a',
        type: 'text',
        x: 10,
        y: 20,
        width: 300,
        height: 80,
        rotation: 0,
        text: 'Keep this text',
        fill: 'transparent',
        color: '#111111',
        fontSize: 24,
        bold: false,
        align: 'left',
      },
    ];

    const duplicate = duplicatePresentationSlide(original, 1);

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.objects[0].id).not.toBe(original.objects[0].id);
    expect(duplicate.objects[0].text).toBe('Keep this text');
    expect(duplicate.name).toBe('Slide 1 copy');
  });

  it('rejects malformed nested entries without throwing', () => {
    const document = createPresentationDocument('deck-malformed');
    expect(isPresentationDocument({ ...document, slides: [null] })).toBe(false);
    expect(
      isPresentationDocument({
        ...document,
        slides: [{ ...document.slides[0], objects: [null] }],
      }),
    ).toBe(false);
  });

  it('rejects unsupported schema versions and empty slide collections', () => {
    const document = createPresentationDocument('deck-002');
    expect(
      isPresentationDocument({ ...document, schemaVersion: 2 }),
    ).toBe(false);
    expect(isPresentationDocument({ ...document, slides: [] })).toBe(false);
  });
});
