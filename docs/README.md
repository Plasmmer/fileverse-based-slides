# 🌈 Documentation

This directory contains the product and engineering plan for adding a **native PowerPoint-style presentation editor** to this repository.

The target is a browser-based editor that opens, edits, and exports real .pptx files. This is not a Markdown-to-slides feature and it must not replace or corrupt the existing spreadsheet editor.

## Start here

1. [Presentation editor plan](PRESENTATION_EDITOR_PLAN.md) — product boundaries, editor architecture, engine research, and technical decision gates.
2. [PPTX compatibility plan](PPTX_COMPATIBILITY.md) — import/export pipeline, OOXML preservation, fidelity strategy, and test corpus.
3. [Built-in Pijul version history](VERSIONING.md) — embedded repository format, OPC packaging, and external-editor compatibility.
4. [Fileverse integration plan](FILEVERSE_INTEGRATION.md) — current repository behavior, Fileverse RTC protocol, hosted-backend decision, and compatibility rules.
5. [Roadmap](ROADMAP.md) — phased implementation order and acceptance criteria.

## Decisions captured so far

- **Native presentation editing:** slides are editable objects on a canvas, with a slide navigator, Office-style ribbon, properties inspector, notes, and presentation mode.
- **Built-in version history:** use libpijul to embed version history inside the .pptx package, with an OPC extension designed to be ignorable by PowerPoint and other editors.
- **PPTX is an interchange format:** the editor needs its own presentation model. A .pptx file is imported into that model and exported from it; the ZIP/XML package is not the live editing database.
- **Separate domain from spreadsheets:** retain the existing DSheet component, workbook engine, spreadsheet data, public exports, and collaboration identifiers. Presentation documents need their own model, state, UI, and application identity.
- **Reuse selectively:** shared shell components and proven Fileverse services may be adapted behind clear interfaces. Workbook-specific UI and data structures must not become the slide engine.
- **Fileverse backend reuse is conditional:** Vercel can serve the browser UI, but the Fileverse collaboration service must explicitly support the presentation app identity and its authentication, encryption, storage, and sharing lifecycle.
- **Choose the engine after a spike:** Casual Slides / Univer Slides is the closest inspected technical reference, not an automatically approved dependency. Import fidelity, license compatibility, bundle size, editing requirements, and Fileverse integration must be tested first.

## Repository baseline

The current repository still exposes DSheet:

- The package is named @fileverse-dev/dsheet.
- The public entry point exports DSheetEditor and spreadsheet utilities from src/index.ts.
- The workbook view renders the local sheet engine through Workbook.
- The current sync hook creates a Y.Doc and uses y-indexeddb for browser-local persistence.
- The current collaboration hook uses y-webrtc and the public Yjs demo signaling endpoint. That is not the Fileverse Socket.IO / UCAN synchronization protocol used by the current upstream Fileverse dSheets implementation.

These are observations of the repository's current main branch, not claims about all deployed Fileverse services. See the linked source files in the plans below.

## Scope of this documentation change

This plan does not add a slide editor, change the package API, or alter any backend. Implementation should proceed through the roadmap and preserve the spreadsheet path throughout.
