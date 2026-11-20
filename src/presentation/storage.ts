import {
  isPresentationDocument,
  type PresentationDocument,
} from './model';

export interface PresentationStorageAdapter {
  load(
    presentationId: string,
  ): PresentationDocument | null | Promise<PresentationDocument | null>;
  save(
    document: PresentationDocument,
  ): void | Promise<void>;
}

export const PRESENTATION_STORAGE_PREFIX = 'fileverse:dslides:v1:';

function storageKey(presentationId: string): string {
  return PRESENTATION_STORAGE_PREFIX + encodeURIComponent(presentationId);
}

/**
 * Browser-local storage for standalone use. Fileverse hosts can inject their
 * own encrypted persistence adapter without changing the editor or its model.
 */
export const localPresentationStorage: PresentationStorageAdapter = {
  load(presentationId) {
    if (typeof window === 'undefined') return null;

    const serialized = window.localStorage.getItem(storageKey(presentationId));
    if (serialized === null) return null;

    const parsed: unknown = JSON.parse(serialized);
    if (!isPresentationDocument(parsed) || parsed.id !== presentationId) {
      throw new Error(
        'The saved presentation is invalid or belongs to a different document.',
      );
    }

    return parsed;
  },

  save(document) {
    if (typeof window === 'undefined') {
      throw new Error('Browser storage is unavailable in this environment.');
    }

    window.localStorage.setItem(
      storageKey(document.id),
      JSON.stringify(document),
    );
  },
};
