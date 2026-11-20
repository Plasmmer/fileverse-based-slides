import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  createPresentationDocument,
  createPresentationObject,
  createPresentationSlide,
  duplicatePresentationSlide,
  type PresentationDocument,
  type PresentationObject,
  type PresentationObjectType,
  type PresentationSlide,
} from './model';
import {
  isPresentationDocument,
  localPresentationStorage,
  type PresentationStorageAdapter,
} from './storage';

export interface DSlidesEditorHandle {
  /** Return the current in-memory document snapshot. */
  getDocument: () => PresentationDocument;
}

export interface DSlidesEditorProps {
  /** A presentation-specific ID. Never pass a DSheet ID or collaboration room ID. */
  presentationId: string;
  /** Optional initial document supplied by the host application. */
  initialDocument?: PresentationDocument;
  /** Host-owned persistence adapter. The built-in default is browser-local only. */
  storage?: PresentationStorageAdapter;
  /** Prevent all authoring actions while keeping slide navigation and presentation available. */
  isReadOnly?: boolean;
  /** Hide the editor's title bar when the host renders its own application chrome. */
  showTopbar?: boolean;
  /** Receives document snapshots after load and every local edit. */
  onDocumentChange?: (document: PresentationDocument) => void;
  /** Receives local/host storage failures. */
  onSaveError?: (error: Error) => void;
  className?: string;
}

type RibbonTab = 'Home' | 'Insert' | 'Design';
type SaveStatus = 'loading' | 'unsaved' | 'saved' | 'saving' | 'error';

function errorFromUnknown(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

interface PresentationCanvasProps {
  document: PresentationDocument;
  slide: PresentationSlide;
  selectedObjectId?: string | null;
  onSelectObject?: (objectId: string) => void;
  compact?: boolean;
  interactive?: boolean;
}

function PresentationCanvas({
  document,
  slide,
  selectedObjectId,
  onSelectObject,
  compact = false,
  interactive = true,
}: PresentationCanvasProps) {
  return (
    <div
      className={
        'dslides-canvas' +
        (compact ? ' dslides-canvas--compact' : '') +
        (interactive ? ' dslides-canvas--interactive' : '')
      }
      style={{
        aspectRatio: document.width + ' / ' + document.height,
        background: slide.background,
      }}
      onClick={() => onSelectObject?.('')}
      role="group"
      aria-label={slide.name}
    >
      {slide.objects.map((object) => {
        const selected = object.id === selectedObjectId;
        const style: React.CSSProperties = {
          left: (object.x / document.width) * 100 + '%',
          top: (object.y / document.height) * 100 + '%',
          width: (object.width / document.width) * 100 + '%',
          height: (object.height / document.height) * 100 + '%',
          transform: 'rotate(' + object.rotation + 'deg)',
          fontSize: (object.fontSize / document.width) * 100 + 'cqw',
          color: object.color,
          fontWeight: object.bold ? 700 : 400,
          textAlign: object.align,
          background:
            object.type === 'text' ? 'transparent' : object.fill,
        };

        return (
          <div
            key={object.id}
            className={
              'dslides-object dslides-object--' +
              object.type +
              (selected ? ' is-selected' : '')
            }
            style={style}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={
              object.type === 'text'
                ? object.text || 'Text object'
                : object.type + ' shape'
            }
            onClick={
              interactive
                ? (event) => {
                    event.stopPropagation();
                    onSelectObject?.(object.id);
                  }
                : undefined
            }
            onKeyDown={
              interactive
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectObject?.(object.id);
                    }
                  }
                : undefined
            }
          >
            {object.type === 'text' ? object.text : null}
          </div>
        );
      })}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={'dslides-action' + (active ? ' is-active' : '')}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export const DSlidesEditor = forwardRef<
  DSlidesEditorHandle,
  DSlidesEditorProps
>(function DSlidesEditor(
  {
    presentationId,
    initialDocument,
    storage = localPresentationStorage,
    isReadOnly = false,
    showTopbar = true,
    onDocumentChange,
    onSaveError,
    className = '',
  },
  ref,
) {
  const [document, setDocument] = useState<PresentationDocument>(() =>
    initialDocument ?? createPresentationDocument(presentationId),
  );
  const [activeSlideId, setActiveSlideId] = useState(
    () => initialDocument?.slides[0]?.id ?? '',
  );
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RibbonTab>('Home');
  const [isPresenting, setIsPresenting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const [storageError, setStorageError] = useState<string | null>(null);
  const onSaveErrorRef = useRef(onSaveError);
  const onDocumentChangeRef = useRef(onDocumentChange);

  // Keep host callbacks fresh without restarting document loading on every
  // parent render when the host passes inline callback functions.
  useEffect(() => {
    onSaveErrorRef.current = onSaveError;
  }, [onSaveError]);

  useEffect(() => {
    onDocumentChangeRef.current = onDocumentChange;
  }, [onDocumentChange]);

  useImperativeHandle(
    ref,
    () => ({
      getDocument: () => document,
    }),
    [document],
  );

  // Load one presentation-specific document. A failed load is not overwritten
  // automatically: the host/user must resolve the storage error first.
  useEffect(() => {
    let active = true;

    setIsLoaded(false);
    setStorageReady(false);
    setHasEdited(false);
    setSaveStatus('loading');
    setStorageError(null);

    const loadDocument = async () => {
      try {
        const loaded = initialDocument ?? (await storage.load(presentationId));
        if (loaded && (!isPresentationDocument(loaded) || loaded.id !== presentationId)) {
          throw new Error(
            'The storage adapter returned a document with an invalid schema or ID.',
          );
        }

        const nextDocument =
          loaded ?? createPresentationDocument(presentationId);

        if (!active) return;
        setDocument(nextDocument);
        setActiveSlideId(nextDocument.slides[0]?.id ?? '');
        setSelectedObjectId(null);
        setStorageReady(true);
        setSaveStatus(loaded ? 'saved' : 'unsaved');
      } catch (error) {
        if (!active) return;
        const normalizedError = errorFromUnknown(error);
        setDocument(createPresentationDocument(presentationId));
        setActiveSlideId('');
        setSelectedObjectId(null);
        setStorageError(normalizedError.message);
        setSaveStatus('error');
        onSaveErrorRef.current?.(normalizedError);
      } finally {
        if (active) setIsLoaded(true);
      }
    };

    void loadDocument();
    return () => {
      active = false;
    };
  }, [presentationId, initialDocument, storage]);

  const saveNow = useCallback(async () => {
    if (!storageReady) return;

    setSaveStatus('saving');
    try {
      await storage.save(document);
      setStorageError(null);
      setSaveStatus('saved');
    } catch (error) {
      const normalizedError = errorFromUnknown(error);
      setStorageError(normalizedError.message);
      setSaveStatus('error');
      onSaveErrorRef.current?.(normalizedError);
    }
  }, [document, storage, storageReady]);

  // Debounced persistence avoids writing a full deck for every inspector keystroke.
  useEffect(() => {
    if (!isLoaded || !storageReady || !hasEdited) return undefined;

    const timeout = window.setTimeout(() => {
      void saveNow();
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [document, hasEdited, isLoaded, saveNow, storageReady]);

  useEffect(() => {
    if (isLoaded) onDocumentChangeRef.current?.(document);
  }, [document, isLoaded]);

  const updateDocument = useCallback(
    (updater: (current: PresentationDocument) => PresentationDocument) => {
      if (isReadOnly || !isLoaded) return;
      setDocument((current) => ({
        ...updater(current),
        updatedAt: new Date().toISOString(),
      }));
      setHasEdited(true);
    },
    [isLoaded, isReadOnly],
  );

  const activeSlideIndex = Math.max(
    0,
    document.slides.findIndex((slide) => slide.id === activeSlideId),
  );
  const activeSlide =
    document.slides[activeSlideIndex] ?? document.slides[0];
  const selectedObject =
    activeSlide?.objects.find((object) => object.id === selectedObjectId) ??
    null;
  const visibleSlides = document.slides.filter((slide) => !slide.hidden);
  const canEdit = !isReadOnly && isLoaded;

  const updateActiveSlide = useCallback(
    (patch: Partial<PresentationSlide>) => {
      if (!activeSlide) return;
      updateDocument((current) => ({
        ...current,
        slides: current.slides.map((slide) =>
          slide.id === activeSlide.id ? { ...slide, ...patch } : slide,
        ),
      }));
    },
    [activeSlide, updateDocument],
  );

  const updateSelectedObject = useCallback(
    (patch: Partial<PresentationObject>) => {
      if (!activeSlide || !selectedObjectId) return;
      updateDocument((current) => ({
        ...current,
        slides: current.slides.map((slide) =>
          slide.id === activeSlide.id
            ? {
                ...slide,
                objects: slide.objects.map((object) =>
                  object.id === selectedObjectId
                    ? { ...object, ...patch }
                    : object,
                ),
              }
            : slide,
        ),
      }));
    },
    [activeSlide, selectedObjectId, updateDocument],
  );

  const addSlide = useCallback(() => {
    const nextSlide = createPresentationSlide(document.slides.length);
    updateDocument((current) => ({
      ...current,
      slides: [...current.slides, nextSlide],
    }));
    setActiveSlideId(nextSlide.id);
    setSelectedObjectId(null);
  }, [document.slides.length, updateDocument]);

  const duplicateActiveSlide = useCallback(() => {
    if (!activeSlide) return;
    const duplicate = duplicatePresentationSlide(
      activeSlide,
      document.slides.length,
    );
    updateDocument((current) => ({
      ...current,
      slides: [...current.slides, duplicate],
    }));
    setActiveSlideId(duplicate.id);
    setSelectedObjectId(null);
  }, [activeSlide, document.slides.length, updateDocument]);

  const deleteActiveSlide = useCallback(() => {
    if (!activeSlide || document.slides.length <= 1) return;
    const nextSlides = document.slides.filter(
      (slide) => slide.id !== activeSlide.id,
    );
    const nextSlide = nextSlides[Math.min(activeSlideIndex, nextSlides.length - 1)];
    updateDocument((current) => ({
      ...current,
      slides: nextSlides,
    }));
    setActiveSlideId(nextSlide.id);
    setSelectedObjectId(null);
  }, [
    activeSlide,
    activeSlideIndex,
    document.slides,
    document.slides.length,
    updateDocument,
  ]);

  const moveActiveSlide = useCallback(
    (direction: -1 | 1) => {
      const targetIndex = activeSlideIndex + direction;
      if (
        !activeSlide ||
        targetIndex < 0 ||
        targetIndex >= document.slides.length
      ) {
        return;
      }

      updateDocument((current) => {
        const slides = [...current.slides];
        const [moved] = slides.splice(activeSlideIndex, 1);
        slides.splice(targetIndex, 0, moved);
        return { ...current, slides };
      });
    },
    [activeSlide, activeSlideIndex, document.slides.length, updateDocument],
  );

  const insertObject = useCallback(
    (type: PresentationObjectType) => {
      if (!activeSlide) return;
      const object = createPresentationObject(
        type,
        activeSlide.objects.length,
      );
      updateDocument((current) => ({
        ...current,
        slides: current.slides.map((slide) =>
          slide.id === activeSlide.id
            ? { ...slide, objects: [...slide.objects, object] }
            : slide,
        ),
      }));
      setSelectedObjectId(object.id);
    },
    [activeSlide, updateDocument],
  );

  const deleteSelectedObject = useCallback(() => {
    if (!activeSlide || !selectedObjectId) return;
    updateDocument((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === activeSlide.id
          ? {
              ...slide,
              objects: slide.objects.filter(
                (object) => object.id !== selectedObjectId,
              ),
            }
          : slide,
      ),
    }));
    setSelectedObjectId(null);
  }, [activeSlide, selectedObjectId, updateDocument]);

  const selectSlide = (slideId: string) => {
    setActiveSlideId(slideId);
    setSelectedObjectId(null);
  };

  const movePresentation = useCallback(
    (direction: -1 | 1) => {
      const currentIndex = visibleSlides.findIndex(
        (slide) => slide.id === activeSlideId,
      );
      const nextSlide = visibleSlides[currentIndex + direction];
      if (nextSlide) {
        setActiveSlideId(nextSlide.id);
        setSelectedObjectId(null);
      }
    },
    [activeSlideId, visibleSlides],
  );

  useEffect(() => {
    if (!isPresenting) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPresenting(false);
      } else if (
        event.key === 'ArrowRight' ||
        event.key === 'PageDown' ||
        event.key === ' '
      ) {
        event.preventDefault();
        movePresentation(1);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        movePresentation(-1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPresenting, movePresentation]);

  const statusText =
    saveStatus === 'loading'
      ? 'Loading'
      : saveStatus === 'unsaved'
        ? 'Not saved yet'
        : saveStatus === 'saving'
          ? 'Saving…'
          : saveStatus === 'error'
            ? 'Storage issue'
            : storage === localPresentationStorage
              ? 'Saved on this device'
              : 'Saved by host';

  const canHideActiveSlide =
    Boolean(activeSlide) &&
    !activeSlide?.hidden &&
    visibleSlides.length > 1;

  if (!activeSlide) {
    return (
      <div className="dslides-root">
        <p className="dslides-storage-error">
          No slide is available in this presentation.
        </p>
      </div>
    );
  }

  return (
    <div className={'dslides-root ' + className}>
      {showTopbar && (
        <header className="dslides-topbar">
          <div className="dslides-brand">
            <span className="dslides-brand-mark" aria-hidden="true">D</span>
            <span>DSlides</span>
          </div>
          <div className="dslides-title-wrap">
            <input
              aria-label="Presentation title"
              className="dslides-title-input"
              value={document.title}
              onChange={(event) =>
                updateDocument((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              disabled={!canEdit || !isLoaded}
            />
            <span className="dslides-save-status" role="status">
              <span className={'dslides-status-dot is-' + saveStatus} />
              {statusText}
            </span>
          </div>
          <div className="dslides-top-actions">
            <button
              type="button"
              className="dslides-button dslides-button--quiet"
              onClick={() => void saveNow()}
              disabled={!storageReady || saveStatus === 'saving'}
            >
              Save
            </button>
            <button
              type="button"
              className="dslides-button dslides-button--primary"
              onClick={() => {
                const firstVisible = visibleSlides[0];
                if (firstVisible) setActiveSlideId(firstVisible.id);
                setSelectedObjectId(null);
                setIsPresenting(true);
              }}
              disabled={visibleSlides.length === 0 || !isLoaded}
            >
              Present
            </button>
          </div>
        </header>
      )}

      {storageError && (
        <div className="dslides-storage-error" role="alert">
          Storage could not be read or written: {storageError}
          <span> Automatic saving is paused to avoid overwriting existing data.</span>
        </div>
      )}

      <div className="dslides-ribbon" aria-label="Presentation tools">
        <div className="dslides-ribbon-tabs" role="tablist">
          {(['Home', 'Insert', 'Design'] as RibbonTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={'dslides-ribbon-tab' + (activeTab === tab ? ' is-active' : '')}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="dslides-ribbon-tools">
          {activeTab === 'Home' && (
            <>
              <ActionButton onClick={addSlide} disabled={!canEdit} title="Add a slide">
                <span aria-hidden="true">＋</span> New slide
              </ActionButton>
              <ActionButton
                onClick={duplicateActiveSlide}
                disabled={!canEdit}
                title="Duplicate the selected slide"
              >
                <span aria-hidden="true">▣</span> Duplicate
              </ActionButton>
              <span className="dslides-ribbon-divider" />
              <ActionButton
                onClick={() => moveActiveSlide(-1)}
                disabled={!canEdit || activeSlideIndex === 0}
                title="Move slide left"
              >
                ← Move
              </ActionButton>
              <ActionButton
                onClick={() => moveActiveSlide(1)}
                disabled={!canEdit || activeSlideIndex === document.slides.length - 1}
                title="Move slide right"
              >
                Move →
              </ActionButton>
              <ActionButton
                onClick={() => updateActiveSlide({ hidden: !activeSlide.hidden })}
                disabled={!canEdit || (!activeSlide.hidden && !canHideActiveSlide)}
                active={activeSlide.hidden}
                title="Toggle slide visibility"
              >
                {activeSlide.hidden ? 'Show slide' : 'Hide slide'}
              </ActionButton>
              <ActionButton
                onClick={deleteActiveSlide}
                disabled={!canEdit || document.slides.length <= 1}
                title="Delete the selected slide"
              >
                <span aria-hidden="true">⌫</span> Delete
              </ActionButton>
            </>
          )}
          {activeTab === 'Insert' && (
            <>
              <ActionButton onClick={() => insertObject('text')} disabled={!canEdit}>
                T&nbsp; Text box
              </ActionButton>
              <ActionButton onClick={() => insertObject('rectangle')} disabled={!canEdit}>
                ▭&nbsp; Rectangle
              </ActionButton>
              <ActionButton onClick={() => insertObject('ellipse')} disabled={!canEdit}>
                ◯&nbsp; Ellipse
              </ActionButton>
            </>
          )}
          {activeTab === 'Design' && (
            <label className="dslides-color-action">
              Slide background
              <input
                type="color"
                value={activeSlide.background}
                onChange={(event) =>
                  updateActiveSlide({ background: event.target.value })
                }
                disabled={!canEdit}
                aria-label="Slide background color"
              />
            </label>
          )}
        </div>
      </div>

      <div className="dslides-workspace">
        <aside className="dslides-slide-panel" aria-label="Slide navigator">
          <div className="dslides-panel-heading">
            <span>Slides</span>
            <span className="dslides-count">{document.slides.length}</span>
          </div>
          <div className="dslides-slide-list">
            {document.slides.map((slide, index) => (
              <button
                type="button"
                key={slide.id}
                className={
                  'dslides-slide-entry' +
                  (slide.id === activeSlide.id ? ' is-active' : '') +
                  (slide.hidden ? ' is-hidden' : '')
                }
                onClick={() => selectSlide(slide.id)}
                aria-current={slide.id === activeSlide.id ? 'true' : undefined}
                aria-label={'Select ' + slide.name}
              >
                <span className="dslides-slide-number">{index + 1}</span>
                <span className="dslides-thumbnail">
                  <span
                    className="dslides-thumbnail-inner"
                    style={{ background: slide.background }}
                  >
                    {slide.objects.slice(0, 5).map((object) => (
                      <span
                        key={object.id}
                        className={
                          'dslides-thumbnail-object dslides-thumbnail-object--' +
                          object.type
                        }
                        style={{
                          left: (object.x / document.width) * 100 + '%',
                          top: (object.y / document.height) * 100 + '%',
                          width: (object.width / document.width) * 100 + '%',
                          height: (object.height / document.height) * 100 + '%',
                          background:
                            object.type === 'text'
                              ? 'transparent'
                              : object.fill,
                          color: object.color,
                        }}
                      >
                        {object.type === 'text' ? object.text : ''}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="dslides-slide-name">{slide.name}</span>
                {slide.hidden && <span className="dslides-hidden-label">Hidden</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="dslides-add-slide"
            onClick={addSlide}
            disabled={!canEdit}
          >
            ＋ Add slide
          </button>
        </aside>

        <main className="dslides-stage-area">
          <div className="dslides-stage-toolbar">
            <span>{activeSlide.name}</span>
            <span>{document.width} × {document.height}</span>
          </div>
          <div className="dslides-stage-scroll">
            {isLoaded ? (
              <PresentationCanvas
                document={document}
                slide={activeSlide}
                selectedObjectId={selectedObjectId}
                onSelectObject={setSelectedObjectId}
              />
            ) : (
              <div className="dslides-loading">Loading presentation…</div>
            )}
          </div>
          <div className="dslides-notes">
            <label htmlFor="dslides-speaker-notes">Speaker notes</label>
            <textarea
              id="dslides-speaker-notes"
              value={activeSlide.notes}
              onChange={(event) => updateActiveSlide({ notes: event.target.value })}
              placeholder="Add notes for this slide…"
              disabled={!canEdit || !isLoaded}
            />
          </div>
        </main>

        <aside className="dslides-inspector" aria-label="Properties inspector">
          <div className="dslides-panel-heading">
            <span>{selectedObject ? 'Object' : 'Slide'} properties</span>
          </div>

          {selectedObject ? (
            <div className="dslides-inspector-content">
              <div className="dslides-property-section">
                <strong>{selectedObject.type === 'text' ? 'Text box' : selectedObject.type}</strong>
                {selectedObject.type === 'text' && (
                  <label className="dslides-field dslides-field--full">
                    Text
                    <textarea
                      rows={4}
                      value={selectedObject.text}
                      onChange={(event) =>
                        updateSelectedObject({ text: event.target.value })
                      }
                      disabled={!canEdit}
                    />
                  </label>
                )}
              </div>

              <div className="dslides-property-section">
                <strong>Position and size</strong>
                <div className="dslides-field-grid">
                  {(
                    [
                      ['X', 'x'],
                      ['Y', 'y'],
                      ['Width', 'width'],
                      ['Height', 'height'],
                    ] as const
                  ).map(([label, key]) => (
                    <label className="dslides-field" key={key}>
                      {label}
                      <input
                        type="number"
                        min={key === 'width' || key === 'height' ? 1 : 0}
                        value={Math.round(selectedObject[key])}
                        onChange={(event) =>
                          updateSelectedObject({
                            [key]: Math.max(
                              key === 'width' || key === 'height' ? 1 : 0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                        disabled={!canEdit}
                      />
                    </label>
                  ))}
                </div>
                <label className="dslides-field dslides-field--full">
                  Rotation
                  <input
                    type="number"
                    value={selectedObject.rotation}
                    onChange={(event) =>
                      updateSelectedObject({
                        rotation: Number(event.target.value) || 0,
                      })
                    }
                    disabled={!canEdit}
                  />
                </label>
              </div>

              <div className="dslides-property-section">
                <strong>Appearance</strong>
                {selectedObject.type !== 'text' && (
                  <label className="dslides-color-field">
                    Fill
                    <input
                      type="color"
                      value={selectedObject.fill}
                      onChange={(event) =>
                        updateSelectedObject({ fill: event.target.value })
                      }
                      disabled={!canEdit}
                    />
                  </label>
                )}
                {selectedObject.type === 'text' && (
                  <>
                    <label className="dslides-color-field">
                      Text color
                      <input
                        type="color"
                        value={selectedObject.color}
                        onChange={(event) =>
                          updateSelectedObject({ color: event.target.value })
                        }
                        disabled={!canEdit}
                      />
                    </label>
                    <label className="dslides-field dslides-field--full">
                      Font size
                      <input
                        type="number"
                        min={8}
                        max={160}
                        value={selectedObject.fontSize}
                        onChange={(event) =>
                          updateSelectedObject({
                            fontSize: Math.min(
                              160,
                              Math.max(8, Number(event.target.value) || 8),
                            ),
                          })
                        }
                        disabled={!canEdit}
                      />
                    </label>
                    <label className="dslides-field dslides-field--full">
                      Alignment
                      <select
                        value={selectedObject.align}
                        onChange={(event) =>
                          updateSelectedObject({
                            align: event.target.value as PresentationObject['align'],
                          })
                        }
                        disabled={!canEdit}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <label className="dslides-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedObject.bold}
                        onChange={(event) =>
                          updateSelectedObject({ bold: event.target.checked })
                        }
                        disabled={!canEdit}
                      />
                      Bold
                    </label>
                  </>
                )}
              </div>

              <button
                type="button"
                className="dslides-delete-object"
                onClick={deleteSelectedObject}
                disabled={!canEdit}
              >
                Delete object
              </button>
            </div>
          ) : (
            <div className="dslides-inspector-content">
              <p className="dslides-inspector-hint">
                Select an object on the slide to edit its properties.
              </p>
              <label className="dslides-color-field">
                Background
                <input
                  type="color"
                  value={activeSlide.background}
                  onChange={(event) =>
                    updateActiveSlide({ background: event.target.value })
                  }
                  disabled={!canEdit}
                />
              </label>
              <label className="dslides-field dslides-field--full">
                Slide name
                <input
                  type="text"
                  value={activeSlide.name}
                  onChange={(event) =>
                    updateActiveSlide({ name: event.target.value })
                  }
                  disabled={!canEdit}
                />
              </label>
            </div>
          )}
        </aside>
      </div>

      {isPresenting && (
        <div className="dslides-presenter" role="dialog" aria-modal="true" aria-label="Presentation mode">
          <div className="dslides-presenter-topbar">
            <span>{document.title}</span>
            <span>
              {Math.max(1, visibleSlides.findIndex((slide) => slide.id === activeSlide.id) + 1)} / {visibleSlides.length}
            </span>
            <button
              type="button"
              className="dslides-button dslides-button--quiet"
              onClick={() => setIsPresenting(false)}
            >
              Exit presentation
            </button>
          </div>
          <div className="dslides-presenter-canvas">
            <PresentationCanvas
              document={document}
              slide={activeSlide}
              interactive={false}
            />
          </div>
          <div className="dslides-presenter-controls">
            <button
              type="button"
              className="dslides-button dslides-button--quiet"
              onClick={() => movePresentation(-1)}
              disabled={visibleSlides[0]?.id === activeSlide.id}
            >
              ← Previous
            </button>
            <span>Use ← → or Esc</span>
            <button
              type="button"
              className="dslides-button dslides-button--quiet"
              onClick={() => movePresentation(1)}
              disabled={visibleSlides[visibleSlides.length - 1]?.id === activeSlide.id}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

DSlidesEditor.displayName = 'DSlidesEditor';
