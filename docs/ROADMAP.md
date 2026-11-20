# 🌈 Implementation roadmap

This roadmap sequences the work so the new presentation editor can be built and tested without destabilizing the existing spreadsheet editor.

The phases are gates, not calendar estimates. Do not start the next phase merely because the previous branch compiles; satisfy its acceptance criteria.

## P0 — Repository inventory and engine decision

### Work

- Map the current DSheet public API, app shell, editor context, Yjs schema, and persistence lifecycle.
- Identify generic shell components that can be reused without importing workbook assumptions.
- Create a small, redistributable PPTX fixture corpus with known expected behavior.
- Build a throwaway spike for Casual Slides / Univer OSS Slides and compare it with DeckCraft.
- Verify whether the chosen engine can represent the initial object set and expose changes suitable for undo/redo and collaboration.
- Measure bundle size, load time, memory use, and large-deck performance.
- Review license compatibility before copying code or adding packages.
- Record the engine decision and rejected options.

### Exit criteria

- A written decision identifies the selected engine or explains why a custom/alternative engine is required.
- The editor can create a small deck and render text, shapes, and images.
- Initial .pptx import/export experiments are recorded against fixtures.
- A list of engine gaps and required fork patches exists.
- No DSheet production code or public API has been changed.

## P1 — Isolated presentation foundation

### Work

- Create a presentation-specific entry point and domain module.
- Introduce a versioned presentation document model or a documented adapter to the chosen engine model.
- Add an Office-style shell with ribbon, slide navigator, canvas host, and properties inspector.
- Implement local document creation, title/rename, add/duplicate/reorder/hide/delete slides, and object selection.
- Implement basic text, shape, and image editing.
- Add undo/redo and stable object/slide identifiers.
- Reuse generic design tokens and shell components only where their contracts are independent of spreadsheets.

### Exit criteria

- A user can create a deck and manipulate multiple slides and objects.
- The feature is isolated from Workbook, Sheet types, formula logic, and sheet update handlers.
- DSheet still builds and passes its existing regression checks.
- Presentation drafts use a separate local persistence namespace.

## P2 — PPTX import/export and local recovery

### Work

- Implement the import/export worker pipeline described in PPTX_COMPATIBILITY.md.
- Support the first feature matrix and return an import report for unsupported constructs.
- Preserve untouched OOXML parts when their relationships remain valid.
- Add local autosave/recovery and explicit failure handling.
- Build automated round-trip tests using the fixture corpus.
- Test files in PowerPoint and LibreOffice Impress, with Google Slides as an additional interoperability check.

### Exit criteria

- New decks export as valid .pptx files.
- Existing supported .pptx fixtures can be imported, edited, exported, and reopened.
- Tests prove that changes persist and unrelated supported content remains intact.
- Unsupported content is reported rather than silently discarded.
- Large-file parsing runs outside the UI main thread.
- A failed import/export never destroys the user's source file or local draft.

## P3 — Fileverse protocol and backend compatibility spike

### Work

- Study the current upstream Fileverse dSheets SyncManager, SocketClient, authentication, encryption, and storage callbacks.
- Confirm whether the deployed collaboration server and access gate support a distinct presentation app type.
- Confirm the document identity, room lifecycle, metadata, snapshots, update history, commits, media storage, revocation, and share-link requirements.
- Define the presentation CollaborationProvider and Fileverse adapter contract.
- Identify which changes belong in this repository and which require coordinated changes in Fileverse repositories/services.

### Exit criteria

- A protocol document explains how a presentation session authenticates, encrypts, syncs, recovers, commits, and terminates.
- The new app identity is accepted by the target backend, or a concrete upstream backend change is agreed and tested.
- No presentation document is mislabeled as a DSheet.
- No frontend secret or private signing key is required.
- A local-only presentation editor continues to work with remote collaboration disabled.

## P4 — Fileverse-backed collaboration

### Work

- Implement the Fileverse provider using the supported upstream protocol.
- Integrate encrypted document updates, durable recovery, awareness/presence, metadata, and storage commits.
- Integrate presentation sharing and permissions with the correct app identity.
- Handle disconnect/reconnect, access revocation, room rotation, and cleanup.
- Verify production and preview deployments from Vercel origins.
- Add end-to-end multi-browser and cross-device tests.

### Exit criteria

- Two authorized collaborators can edit one presentation without losing updates.
- A session can recover after all collaborators disconnect, according to the Fileverse persistence contract.
- Unauthorized users cannot edit; revoked users lose access.
- A presentation share link cannot be opened as a DSheet and a DSheet link cannot be opened as a presentation.
- Local persistence and remote synchronization statuses are clearly distinguished.
- DSheet collaboration regression tests still pass.

## P5 — Fidelity and presentation features

### Work

- Add tables, charts, connectors, notes, masters, layouts, themes, transitions, and animations in priority order.
- Add presenter view, keyboard navigation, slide-show controls, and accessible presentation controls.
- Expand OOXML preservation and the fixture corpus.
- Add comments/review flows where supported by the selected engine and Fileverse permissions.
- Improve large-deck rendering, virtualization, asset handling, and mobile viewing/editing based on measured needs.

### Exit criteria

- Each feature is classified as editable, preserved but not editable, or unsupported.
- Import/export regression coverage exists for every newly supported construct.
- UI compatibility claims match automated tests and documented limits.
- Performance and resource cleanup are measured on representative large decks.

## Cross-phase quality gates

Every phase must preserve these rules:

- **No spreadsheet regression:** keep DSheet public exports, room identities, and document schema stable.
- **No fake backend:** local IndexedDB must not be presented as Fileverse cloud storage.
- **No false fidelity claims:** only advertise features covered by tests.
- **No silent data loss:** warn when a file contains content that cannot safely be edited or preserved.
- **No credential leakage:** private credentials never enter browser bundles or VITE_ environment variables.
- **No dependency by assumption:** licenses, maintenance status, bundle size, and engine APIs must be checked before selection.
- **No placeholder implementation:** remove or label controls that do not yet perform their advertised actions.

## Current PR boundary

This PR adds planning documents only. It does not select a final engine, add presentation dependencies, implement PPTX parsing, change the DSheet component, or modify any Fileverse server. Those changes require the corresponding phase and its acceptance gate.
