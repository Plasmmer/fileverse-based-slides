# 🌈 Presentation editor plan

## Product goal

Add a **classic, object-based presentation editor** to this repository. Users should be able to create a deck, open an existing PowerPoint .pptx, edit individual objects, save/export a .pptx, and present the deck in the browser.

This is not a Markdown conversion pipeline. Markdown-to-slides can exist as an optional import feature in the future, but it is not the product model or the editing surface.

The expected interaction model is familiar to PowerPoint users:

- A file/title area and an Office-style ribbon with contextual tabs.
- A left slide navigator with thumbnails, selection, reordering, duplication, hiding, and deletion.
- A central slide canvas where text, images, shapes, and other objects can be selected and manipulated directly.
- A properties/format inspector for the selected object.
- Speaker notes and a presentation/presenter mode.
- Real .pptx import and export, with explicit compatibility reporting rather than silent data loss.

## Non-negotiable boundaries

### Keep the spreadsheet product intact

The current public entry point exports DSheetEditor, sheet utilities, FortuneCore, and workbook types from src/index.ts. The current editor is built around Workbook, Sheet data, cell-level updates, sheet-specific menus, formula bar behavior, and spreadsheet import/export.

Do not replace these pieces with slide equivalents. Do not reinterpret a Yjs sheet document as a presentation document. Do not reuse dsheet identifiers or rooms for slide documents.

The presentation feature should have its own domain boundary, public component, state model, persistence namespace, and Fileverse application identity. The existing DSheet API should continue to build and behave as it does today.

### Reuse the shell, not the workbook

Potentially reusable after inspection and decoupling:

- Generic application shell, title bar, navbar slots, menus, dialogs, modal infrastructure, status indicators, permission UI, theme tokens, and common buttons.
- Generic file-picker and upload/download utilities, where they do not assume spreadsheet formats.
- Shared authentication and collaboration services through adapters.

Keep these spreadsheet-specific:

- Workbook and cell rendering, sheet-engine aliases, worksheet/cell types, formula bar, formula evaluation, cell context menus, row/column operations, Fortune-specific hooks, and XLSX/CSV import/export code.
- The current sheet Yjs document schema and all sheet-specific update handlers.

Avoid a large refactor of DSheet just to make the new feature convenient. Extract a generic component only when it has a stable, genuinely shared contract.

## Proposed presentation boundary

The exact folder names can change after the engine spike. The architectural separation should not.

| Area | Responsibility |
| --- | --- |
| Presentation editor entry | Owns the presentation lifecycle and public props |
| Presentation model | Deck metadata, ordered slides, slide objects, themes, masters, layouts, notes, and presentation resources |
| Slide engine adapter | Hides the selected canvas/editor engine behind a small application-facing API |
| Presentation UI | Ribbon, slide navigator, canvas host, format inspector, notes panel, presenter view |
| PPTX I/O | Import/export workers, OOXML mapping, relationship/media handling, compatibility diagnostics |
| Local persistence | Browser-local draft and recovery, isolated from DSheet IndexedDB keys |
| Collaboration adapter | Connects the presentation model to a selected collaboration provider |
| Fileverse adapter | Authentication, encrypted updates, presence, commit/storage callbacks, sharing, and document metadata |

An illustrative source layout:

- src/presentation/ — presentation domain and public editor entry.
- src/presentation/model/ — model types and invariants.
- src/presentation/engine/ — selected engine integration.
- src/presentation/components/ — presentation-only UI.
- src/presentation/pptx/ — import/export and Web Worker entry points.
- src/presentation/persistence/ — local draft persistence.
- src/presentation/collaboration/ — provider-neutral collaboration interface.
- src/presentation/fileverse/ — Fileverse-specific adapter.

This is a target layout, not a request to create empty folders before they are needed.

## Presentation document model

The editor must represent presentation concepts directly. The selected engine may own the canonical model, but the application must document and version its expectations.

At minimum, account for:

- Deck metadata and slide dimensions.
- Ordered slides with stable slide IDs.
- Positioned objects with stable object IDs, transforms, stacking order, and accessibility descriptions.
- Text frames with paragraphs, runs, formatting, bullets, alignment, and hyperlinks.
- Shapes, connectors, and images, including crop and relationship/media metadata.
- Theme color and font schemes, slide backgrounds, masters, and layouts.
- Speaker notes and hidden slides.
- Transitions and animations as separate timeline/resource data.
- Embedded or linked assets and any unsupported OOXML parts that must survive a round trip.

A spreadsheet-style table of cells is not a suitable top-level model for these concepts.

## Browser editor and engine research

The following projects were inspected as references. They are not all equivalent: some are editor products, some are engine candidates, and some are server-hosted office suites.

| Candidate | What it contributes | Current assessment |
| --- | --- | --- |
| Casual Slides | Open-source browser editor with .pptx round-trip; built on Univer OSS Slides; custom OOXML import and PptxGenJS export; architecture and fidelity documentation | **First technical reference to study.** Its own README says collaboration is still a separate spike and Yjs/Hocuspocus work is not the Fileverse integration we need. Do not copy its collab stack as a substitute for Fileverse. |
| Univer OSS Slides | A presentation data model, slide canvas, object editing, slide UI, and a React/TypeScript integration path | **Strong engine candidate.** Validate API maturity, missing object types, PPTX import/export needs, bundle size, and collaboration mutation hooks in a spike. |
| DeckCraft / AnyEdit | Browser-local Office-like editing, PPTX open/save claims, local-file workflow, and a separate open-source engine | **Useful comparison and possible second spike.** The product page describes the engine as alpha and advises keeping desktop PowerPoint for complex animations, embedded media, or live co-editing. Verify the upstream repository, license, and fidelity before depending on it. |
| ONLYOFFICE Docs | Full online office suite with a presentation editor for PPTX | **Server-based alternative.** Consider if broad Office compatibility is more important than owning a native editor. It is an office server/integration decision, not a small React component to drop into this app. |
| Slides Ultra Editor | Browser-local PPTX editing, slide navigation, notes, presenter view, and a clearly documented list of unsupported editing features | **Product benchmark.** Its documented limits around slide masters, animation editing, SmartArt, and editable existing charts are useful for defining honest compatibility levels. Not selected as an embeddable engine. |
| Cromagnon Presentation Studio | Browser-local PPTX/PPSX creation, editing, presentation, and export claims | **Product/UX benchmark.** Treat its feature list as product claims, not evidence of an embeddable codebase or a dependency license. |
| PptxGenJS | Programmatic creation of PPTX objects and export in browser/Node environments | **Export tool only.** Its own README describes generating presentations. It does not provide the complete import, object-editing, canvas, or round-trip editor required here. |

### First engine spike

Start by evaluating Casual Slides and Univer OSS directly, not by committing to a wholesale transplant.

1. Build a small evaluation app outside the existing DSheet component.
2. Mount the candidate slide engine and create a deck with text, shapes, and images.
3. Import a representative .pptx corpus and export it without edits.
4. Edit one object, export again, and inspect what changed and what was lost.
5. Inspect whether the engine exposes a reliable command/mutation stream for Yjs synchronization.
6. Measure production bundle size, startup time, memory use, and large-deck behavior.
7. Review the candidate license and all transitive dependencies against this repository's AGPL-3.0 license and distribution model.
8. Record the decision, limitations, and rejected alternatives before adding the engine to the main app.

Casual Slides is especially valuable because its repository documents the engine, PPTX pipeline, known gaps, and fidelity tests. Use those documents as research material; independently verify every behavior against the version actually evaluated.

## UI composition

The first usable editor should have the following layout:

- **Top:** title/file actions and ribbon tabs such as Home, Insert, Design, Transitions, Animations, Slide Show, View, and Review. Only ship tabs whose controls are implemented.
- **Left:** slide thumbnails, slide selection, drag reorder, add/duplicate/hide/delete actions.
- **Center:** slide canvas with object selection, move/resize/rotate, text editing, zoom, and guides.
- **Right:** contextual inspector for size, position, text, fill, border, image crop, and ordering.
- **Bottom or collapsible panel:** speaker notes and slide-level status.
- **Presentation mode:** full-screen slide playback, keyboard navigation, and presenter view as a later milestone.

Do not expose disabled or decorative controls as if they work. The ribbon should be implementation-driven, not a row of aspirational buttons.

## Initial feature priorities

### First usable authoring milestone

- Create, rename, and save a local deck.
- Add, duplicate, reorder, hide, and delete slides.
- Edit text and basic formatting.
- Add and manipulate common shapes and images.
- Select, move, resize, rotate, reorder, and delete objects.
- Choose slide size and background.
- Undo/redo.
- Save/reopen local work and export .pptx.

### Later milestones

- Tables, charts, connectors, and diagram support.
- Masters, layouts, theme editing, and notes.
- Transitions, animations, timing, and presenter tools.
- Comments, access controls, real-time multi-user editing, and recovery through Fileverse.
- Advanced Office constructs such as SmartArt, embedded OLE objects, audio/video, and less common OOXML extensions, according to measured demand and fidelity.

The order should be adjusted after the engine spike and test corpus establish what is practical.

## References

- [This repository's public exports](https://github.com/Plasmmer/fileverse-based-slides/blob/main/src/index.ts)
- [Current workbook renderer](https://github.com/Plasmmer/fileverse-based-slides/blob/main/src/editor/components/editor-workbook.tsx)
- [Casual Slides source](https://github.com/CasualOffice/slides)
- [Casual Slides architecture](https://github.com/CasualOffice/slides/blob/main/docs/ARCHITECTURE.md)
- [Casual Slides PPTX pipeline](https://github.com/CasualOffice/slides/blob/main/docs/PPTX_PIPELINE.md)
- [DeckCraft / AnyEdit](https://anyedit.app/deckcraft/)
- [ONLYOFFICE Docs getting started](https://helpcenter.onlyoffice.com/docs/getting-started)
- [Slides Ultra Editor](https://gotmypdf.com/slides-ultra-editor)
- [Cromagnon Presentation Studio](https://cromagnon.app/studios/presentation-studio)
- [PptxGenJS](https://github.com/gitbrent/PptxGenJS)
