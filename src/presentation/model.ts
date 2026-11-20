export const PRESENTATION_SCHEMA_VERSION = 1 as const;

export type PresentationObjectType = 'text' | 'rectangle' | 'ellipse';
export type PresentationTextAlignment = 'left' | 'center' | 'right';

export interface PresentationObject {
  id: string;
  type: PresentationObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text: string;
  fill: string;
  color: string;
  fontSize: number;
  bold: boolean;
  align: PresentationTextAlignment;
}

export interface PresentationSlide {
  id: string;
  name: string;
  background: string;
  hidden: boolean;
  notes: string;
  objects: PresentationObject[];
}

export interface PresentationDocument {
  schemaVersion: typeof PRESENTATION_SCHEMA_VERSION;
  id: string;
  title: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  slides: PresentationSlide[];
}

/** Generate identifiers without requiring a browser-only global at module load. */
export function createPresentationId(prefix = 'dslides'): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return prefix + '-' + randomUuid;

  return (
    prefix +
    '-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 12)
  );
}

export function createPresentationSlide(index: number): PresentationSlide {
  return {
    id: createPresentationId('slide'),
    name: 'Slide ' + (index + 1),
    background: '#ffffff',
    hidden: false,
    notes: '',
    objects: [],
  };
}

export function createPresentationObject(
  type: PresentationObjectType,
  index = 0,
): PresentationObject {
  const common = {
    id: createPresentationId('object'),
    type,
    x: 220 + (index % 3) * 36,
    y: 190 + (index % 3) * 32,
    rotation: 0,
    text: '',
    fill: '#dbeafe',
    color: '#18212f',
    fontSize: 32,
    bold: false,
    align: 'center' as const,
  };

  if (type === 'text') {
    return {
      ...common,
      x: 150,
      y: 250 + (index % 3) * 36,
      width: 980,
      height: 100,
      text: 'Add your text',
      fill: 'transparent',
      fontSize: 34,
    };
  }

  return {
    ...common,
    width: type === 'ellipse' ? 220 : 300,
    height: type === 'ellipse' ? 220 : 180,
  };
}

/** Create a new 16:9 presentation with an editable title slide. */
export function createPresentationDocument(
  id: string,
  title = 'Untitled presentation',
): PresentationDocument {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('presentationId must be a non-empty string.');
  }

  const now = new Date().toISOString();
  const slide = createPresentationSlide(0);
  slide.objects = [
    {
      id: createPresentationId('object'),
      type: 'text',
      x: 100,
      y: 230,
      width: 1080,
      height: 100,
      rotation: 0,
      text: 'Your presentation starts here',
      fill: 'transparent',
      color: '#172033',
      fontSize: 54,
      bold: true,
      align: 'center',
    },
    {
      id: createPresentationId('object'),
      type: 'text',
      x: 180,
      y: 355,
      width: 920,
      height: 58,
      rotation: 0,
      text: 'Add a subtitle',
      fill: 'transparent',
      color: '#697386',
      fontSize: 25,
      bold: false,
      align: 'center',
    },
  ];

  return {
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    id,
    title,
    width: 1280,
    height: 720,
    createdAt: now,
    updatedAt: now,
    slides: [slide],
  };
}

/** Duplicate a slide while giving the slide and each object fresh identities. */
export function duplicatePresentationSlide(
  slide: PresentationSlide,
  _index: number,
): PresentationSlide {
  return {
    ...slide,
    id: createPresentationId('slide'),
    name: slide.name + ' copy',
    objects: slide.objects.map((object) => ({
      ...object,
      id: createPresentationId('object'),
    })),
    notes: slide.notes,
    hidden: false,
  };
}

/** Narrow runtime guard for documents loaded from browser or host storage. */
export function isPresentationDocument(
  value: unknown,
): value is PresentationDocument {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<PresentationDocument>;
  return (
    candidate.schemaVersion === PRESENTATION_SCHEMA_VERSION &&
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.width === 'number' &&
    candidate.width > 0 &&
    typeof candidate.height === 'number' &&
    candidate.height > 0 &&
    Array.isArray(candidate.slides) &&
    candidate.slides.length > 0 &&
    candidate.slides.every(
      (slide) =>
        typeof slide === 'object' &&
        slide !== null &&
        typeof slide.id === 'string' &&
        typeof slide.name === 'string' &&
        typeof slide.background === 'string' &&
        typeof slide.hidden === 'boolean' &&
        typeof slide.notes === 'string' &&
        Array.isArray(slide.objects) &&
        slide.objects.every(
          (object) =>
            typeof object === 'object' &&
            object !== null &&
            typeof object.id === 'string' &&
            (object.type === 'text' ||
              object.type === 'rectangle' ||
              object.type === 'ellipse') &&
            typeof object.x === 'number' &&
            typeof object.y === 'number' &&
            typeof object.width === 'number' &&
            typeof object.height === 'number' &&
            typeof object.rotation === 'number' &&
            typeof object.text === 'string' &&
            typeof object.fill === 'string' &&
            typeof object.color === 'string' &&
            typeof object.fontSize === 'number' &&
            typeof object.bold === 'boolean' &&
            (object.align === 'left' || object.align === 'center' || object.align === 'right'),
        ),
    )
  );
}
