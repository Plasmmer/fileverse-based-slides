# DSlides — first isolated editor slice

## Package boundary

The presentation editor is exposed as a separate package entry:

\`\`\`tsx
import { DSlidesEditor } from '@fileverse-dev/dsheet/slides';
import '@fileverse-dev/dsheet/styles';

export function SlidesApp() {
  return <DSlidesEditor presentationId="presentation-123" />;
}
\`\`\`

The existing package root and its DSheet exports are unchanged. The package name remains \`@fileverse-dev/dsheet\` for backwards compatibility; the new \`./slides\` subpath is the first independent presentation entry.

## Included in this slice

- A versioned \`PresentationDocument\` model with a 16:9 starter deck and stable slide/object IDs.
- Slide creation, duplication, reordering, hiding/showing, and deletion (the last slide cannot be deleted).
- Text boxes, rectangles, and ellipses.
- Object selection and property editing for text, position, size, rotation, fill, and basic typography.
- Slide background, slide names, and speaker notes.
- A simple presentation mode with keyboard navigation.
- A presentation-only browser storage namespace: \`fileverse:dslides:v1:\`.
- A \`PresentationStorageAdapter\` contract so the host can supply its own storage implementation.
- A separate \`/slides.html\` demo page at the demo app.

The object canvas is deliberately an early UI/model prototype. It is not a commitment to the final PPTX engine.

## Host and Fileverse compatibility

A Fileverse host can inject a persistence adapter and receive document snapshots:

\`\`\`ts
import type { PresentationStorageAdapter } from '@fileverse-dev/dsheet/slides';

const storage: PresentationStorageAdapter = {
  async load(presentationId) {
    return hostStorage.loadPresentation(presentationId);
  },
  async save(document) {
    await hostStorage.savePresentation(document.id, document);
  },
};
\`\`\`

\`\`\`tsx
<DSlidesEditor
  presentationId={presentationId}
  storage={storage}
  onDocumentChange={(document) => hostEvents.onPresentationChange(document)}
/>
\`\`\`

The adapter is intentionally transport-neutral. A Fileverse integration must encrypt and authorize data according to the host's actual protocol; the editor itself does not claim that a custom adapter is Fileverse cloud collaboration.

The current app-type identifier specification documents only \`ddoc\` and \`dsheet\`. This implementation therefore:

- Uses a distinct \`presentationId\` and local-storage namespace.
- Does not accept a \`dsheetId\` prop.
- Does not create or join DSheet Yjs documents or collaboration rooms.
- Does not claim Fileverse RTC, encrypted cloud persistence, sharing, or cross-device recovery.
- Does not change the Fileverse collaboration server or its app-type contract.

A future hosted implementation must introduce and verify a separate presentation app identity (for example, \`dslides\`) end-to-end. It must not masquerade as \`dsheet\`.

## Current limitations

- No PPTX/PPSX/PPT import or export.
- No OOXML relationship/media preservation yet.
- No embedded libpijul history yet.
- No image, chart, table, connector, master, layout, theme, transition, or animation editing.
- No drag-to-move/resize, snapping, grouping, or undo/redo.
- No real-time collaboration or Fileverse backend adapter.
- The current canvas/model is a first vertical slice; the engine-selection spike and PPTX fixture evaluation remain open.

Do not treat a local draft as a PowerPoint file. Do not claim Office round-trip compatibility until the import/export and fixture gates pass.

## Development demo

From \`demo/\`:

\`\`\`bash
npm install
npm run dev
\`\`\`

Open \`/slides.html\` for the initial presentation editor demo. Use \`?presentation=your-id\` to reopen the same local draft in that browser profile.
