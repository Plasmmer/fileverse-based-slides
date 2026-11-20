# 🌈 PPTX compatibility and round-trip plan

## Objective

Support real PowerPoint Open XML presentations (.pptx) as editable documents. A successful implementation must do more than accept a file upload or generate a new .pptx: it must import existing presentation content into the selected editor model, allow edits, and export a usable PowerPoint file while preserving as much unedited content as possible.

Legacy binary .ppt is not part of the first scope. The initial supported format is .pptx. A future conversion workflow for .ppt, .pptm, or .ppsx must be a separate, explicitly tested decision.

## Important distinction: generator vs editor

PptxGenJS is a useful JavaScript library for generating .pptx files from code. Its README covers creating presentations, slides, text, shapes, images, charts, tables, and writing a file in browser or Node environments.

That does **not** make it a complete editor or importer for arbitrary existing PowerPoint files. It does not provide the slide canvas, an editable slide model, selection/manipulation UI, or a general-purpose import-and-round-trip pipeline.

The repository currently depends on spreadsheet libraries such as ExcelJS, xlsx, xlsx-js-style, and LuckyExcel. Those packages address spreadsheet formats and do not constitute a PowerPoint import/export engine.

## File format model

A .pptx is an OOXML package: a ZIP archive containing XML parts and related assets. Important areas include:

- Presentation manifest, relationships, slide order, and page size.
- Slide XML and per-slide relationships.
- Slide layouts, slide masters, and theme definitions.
- Text bodies, paragraphs, runs, shapes, connectors, and transforms.
- Media assets and image relationships.
- Notes slides and notes masters.
- Charts, embedded workbooks, diagrams/SmartArt, comments, and other package parts.
- Transitions, animation timing, hyperlinks, metadata, and extension data.

The importer must follow relationships rather than assume file names or slide numbering are stable. For example, a slide's relationship IDs connect it to its images and layout; those links must be resolved and maintained when exporting.

## Proposed pipeline

### Open / import

1. Read the selected file as a Blob and validate the extension, ZIP signature, package structure, and size limit.
2. Parse the OOXML package in a Web Worker so large files do not block the editor's main thread.
3. Read content types and relationship parts before parsing dependent slides and assets.
4. Parse deck metadata, slide order, dimensions, themes, masters, layouts, slides, speaker notes, and supported objects.
5. Convert supported constructs into the selected presentation engine's model.
6. Retain unsupported package parts and their relationship context where safe, rather than silently discarding them.
7. Return a structured import report with warnings for constructs that cannot be rendered or edited.

### Edit

- The presentation engine owns the live document model.
- The editor mutates stable slide/object IDs, not raw XML strings.
- Local save/recovery operates on the presentation model and its associated assets.
- Collaboration operates on presentation-model changes through a presentation-specific Yjs schema or adapter. It must never attach a slide model to the existing sheet document namespace.

### Save / export

1. Snapshot the current presentation model and its resources.
2. Map supported model features back to OOXML PresentationML.
3. Preserve untouched unsupported package parts where their references remain valid.
4. Rebuild ZIP content types and relationship parts consistently.
5. Validate the generated package by reopening it through the importer and, where practical, other presentation software.
6. Return a Blob download and a compatibility report.

A future autosave format may store the editor's native model locally. That local representation is not a replacement for .pptx import/export.

## Fidelity policy

Do not promise 100% PowerPoint compatibility before it has been measured.

Use three explicit categories in the UI and documentation:

- **Editable:** the feature is mapped into the editor model and can be changed.
- **Preserved but not editable:** the feature is not represented by the editor, but its underlying package data can be retained through a round trip.
- **Unsupported / may change:** the feature cannot currently be rendered or reliably preserved. Warn the user before exporting when possible.

The importer should not silently turn unsupported objects into empty placeholders and then delete the original content on export.

Raw OOXML preservation is a compatibility strategy, not a magic guarantee. Editing a slide may alter relationships or package parts that an opaque preserved part references. The implementation needs tests for those dependencies and must clearly report when safe preservation is not possible.

## Minimum supported object set

Choose the first engine and MVP around a narrow but useful set:

| Feature | Initial expectation |
| --- | --- |
| Slide order, size, and background | Import, render, edit, export |
| Text boxes | Import, render, edit, export basic rich text |
| Common shapes | Import, render, edit, export |
| Images | Import, render, move/resize/crop where supported, export |
| Basic fills, borders, transforms, and z-order | Import, render, edit, export |
| Speaker notes | Preserve first; add editing UI in a later milestone |
| Masters, layouts, and theme inheritance | Preserve first; full editor later |
| Tables and charts | Evaluate after core objects; do not flatten silently |
| Transitions and animations | Preserve when possible; editing/playback can follow later |
| SmartArt, embedded objects, audio, and video | Report support individually; do not claim editable parity by default |

This matrix is a starting point. The engine spike and test corpus may change it.

## Test corpus

Create a small, versioned corpus of legally redistributable .pptx fixtures. Include at least:

1. A blank deck, title deck, 16:9 deck, and 4:3 deck.
2. Text boxes with multiple paragraphs, rich-text runs, bullets, indentation, hyperlinks, and mixed fonts.
3. Common shapes, lines/connectors, rotation, grouping, transparency, gradients, shadows, and z-order.
4. Images with crop, flips, rotation, and different media types.
5. Slide masters, multiple layouts, inherited theme colors/fonts, and placeholders.
6. Tables and charts, including embedded chart workbooks.
7. Speaker notes and hidden slides.
8. Transitions and simple/complex animation timelines.
9. SmartArt/diagrams, audio/video, embedded objects, and custom XML where fixtures can be sourced safely.
10. RTL text, non-Latin scripts, missing fonts, and long text that exercises wrapping/autofit.
11. Corrupt, truncated, encrypted/password-protected, oversized, and non-PPTX files.

For every fixture, record expected behavior per feature: editable, preserved but not editable, or unsupported.

## Required test scenarios

- Import a fixture and export without editing. Compare semantic OOXML content and relationships, not ZIP byte-for-byte equality.
- Import, change one text run, export, reopen, and verify both the edit and unrelated content.
- Import, move/resize an image, export, and verify the media relationship still resolves.
- Import a deck containing unsupported content, edit a supported object, export, and verify preserved parts remain present when safe.
- Delete an object and confirm its own relationships/assets are removed without deleting assets still used elsewhere.
- Duplicate and reorder slides; verify IDs, order, notes, layouts, and relationships.
- Reopen exported files in PowerPoint and LibreOffice Impress. Use Google Slides import as an additional interoperability check, not as the only oracle.
- Verify undo/redo, browser reload recovery, and export after recovery.
- Test large decks and large images for memory pressure, worker responsiveness, and useful error messages.

## Reliability and security

- Parse untrusted ZIP/XML input defensively. Enforce file-size and decompressed-size limits.
- Reject invalid package paths and malformed relationship targets.
- Avoid loading external links or embedded scripts automatically.
- Treat embedded objects and external media as untrusted content.
- Revoke object URLs and release image/worker resources when decks close.
- Do not log document contents, text, images, or decrypted collaboration payloads.
- Make import/export failures recoverable: never discard the user's source file because conversion failed.

## Engine-specific notes

Casual Slides documents a pipeline that parses OOXML with JSZip and an XML parser into Univer's slide data model, exports using PptxGenJS, and retains unmapped source parts in a raw-resource slot for round-trip preservation. Its architecture is a valuable reference, but its implementation and fidelity claims must be verified against our own fixture corpus and chosen engine version.

References:

- [Casual Slides repository](https://github.com/CasualOffice/slides)
- [Casual Slides PPTX pipeline](https://github.com/CasualOffice/slides/blob/main/docs/PPTX_PIPELINE.md)
- [PptxGenJS repository](https://github.com/gitbrent/PptxGenJS)
- [OOXML PresentationML overview](http://officeopenxml.com/prSlide.php)
- [ECMA-376 Office Open XML standard](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
