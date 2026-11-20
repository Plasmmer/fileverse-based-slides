export { DSlidesEditor } from './dslides-editor';
export type {
  DSlidesEditorHandle,
  DSlidesEditorProps,
} from './dslides-editor';
export {
  createPresentationDocument,
  createPresentationId,
  createPresentationObject,
  createPresentationSlide,
  duplicatePresentationSlide,
  isPresentationDocument,
  PRESENTATION_SCHEMA_VERSION,
} from './model';
export type {
  PresentationDocument,
  PresentationObject,
  PresentationObjectType,
  PresentationSlide,
  PresentationTextAlignment,
} from './model';
export {
  localPresentationStorage,
  PRESENTATION_STORAGE_PREFIX,
} from './storage';
export type { PresentationStorageAdapter } from './storage';
