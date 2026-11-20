# 🌈 Built-in version history with Pijul

## Goal

Every native presentation .pptx should be able to carry its own editable version history. The history is stored inside the PPTX package using Pijul's repository format and the Rust library libpijul.

This is file-native versioning, not a dependency on a separate Git/Pijul server. A user should be able to move or copy the .pptx file and retain its history, subject to the interoperability limitations below.

The history is optional metadata from the perspective of PowerPoint. A normal presentation editor that does not understand Pijul must still be able to open, edit, and present the slide content.

## Technology and current status

- Target library: [libpijul on crates.io](https://crates.io/crates/libpijul).
- The latest version listed by docs.rs during this plan update is `1.0.0-beta.11`, published on 2026-01-13. docs.rs reports that this release failed to build its documentation, so API details must be verified against the crate source and a compile-time spike.
- The crate describes itself as Pijul's core library. Its repository format contains a `.pijul` directory, including a `pristine` database and a `patches` directory.
- The crate declares `GPL-2.0-or-later`. Review the licensing implications for this AGPL-3.0 application and its distribution model before shipping it as a linked dependency.
- The beta crate has an `ondisk-repos` feature and a `tarball` feature; its Cargo manifest also declares a `wasm32`-specific `getrandom` configuration. These facts make a browser/WASM spike worth attempting, but do **not** prove the complete on-disk repository API builds and works in browsers.

Do not pin a version or write production bindings based only on the documentation site. First verify the exact published crate, API, feature set, compilation targets, and license text.

## Separation of responsibilities

Pijul and Yjs solve different problems here:

| Technology | Responsibility |
| --- | --- |
| Presentation engine | Live in-memory slide model and editing operations |
| Yjs + selected collaboration provider | Real-time multi-user editing, presence, and synchronization |
| libpijul | Durable, user-visible version history embedded in the .pptx file |
| OOXML/PPTX adapter | Projects the presentation package into a Pijul working tree and embeds/extracts its repository |
| Fileverse | Authentication, access control, encrypted sharing, durable collaboration updates, and file storage |

Do not use Pijul as a replacement for Yjs live synchronization. Do not use Yjs update logs as a substitute for durable, portable version history.

A Pijul version should be recorded from a stable, synchronized presentation snapshot, normally at an explicit Save/Create Version checkpoint. Do not create a permanent Pijul change for every keystroke or transient remote Yjs update.

## Proposed package layout

A .pptx file is an OPC package stored as a ZIP archive. The proposed first implementation stores the native Pijul repository as one nested archive part:

```text
presentation.pptx
├── [Content_Types].xml
├── _rels/
│   └── .rels
├── ppt/
│   ├── presentation.xml
│   ├── slides/
│   ├── slideMasters/
│   ├── slideLayouts/
│   ├── theme/
│   └── media/
└── pijul/
    └── history.tar
```

`pijul/history.tar` is a proposed OPC part whose payload is a tar archive containing the portable Pijul repository data, including the `.pijul/` directory tree. The exact archive wrapper and use of libpijul's `tarball` feature must be validated in a spike.

The PPTX package must register this extension using standard OPC mechanisms:

1. Add an explicit `Override` entry for `/pijul/history.tar` to `[Content_Types].xml`, with a project-defined media type such as `application/vnd.plasmmer.pijul-history+tar`.
2. Add a relationship from the package root in `_rels/.rels` to `pijul/history.tar`.
3. Use a stable, absolute, project-owned relationship type URI, for example `https://github.com/Plasmmer/fileverse-based-slides/relationships/pijul-history`.
4. Keep the extension payload self-contained. Do not require an external path, sidecar, service, or network lookup to read the embedded history.

The relationship type is intentionally unknown to PowerPoint. OPC permits unknown relationships; conforming consumers must not fail to load a document containing them, and producers are encouraged to round-trip them and their target parts. This is a compatibility strategy, **not a guarantee** that every external editor will preserve the history.

Do not simply add arbitrary `.pijul/` files to the ZIP without registering their content types and relationships. OOXML constrains package parts: a part that is not the target of a valid relationship is an unknown part that may be discarded, and ZIP items without valid part naming/content-type handling can make the package invalid.

## Avoiding self-reference

The embedded repository must never version its own embedded archive. That would create a recursive package.

The Pijul working tree should be a normalized **OOXML projection** of the presentation package:

- Track the standard PPTX package parts and assets: slide XML, relationships, masters, layouts, themes, media, notes, and other package parts.
- Exclude the Pijul history payload itself.
- Exclude the versioning relationship and its content-type declaration from the tracked projection.
- On import, strip only this feature's exact recognized relationship/content-type additions before materializing the Pijul working tree.
- On export, regenerate the relationship and content-type declaration from the current versioning state and inject the serialized Pijul history part.

This makes the history wrapper derived metadata around the tracked OOXML package rather than a file that the repository tries to version recursively.

The projection must preserve all other package parts and relationships. It must not normalize away unsupported OOXML content just because the editor cannot render it.

## Save and version creation flow

### Initial import

1. Parse and validate the outer PPTX package.
2. Detect the exact Pijul relationship type and resolve its target through OPC relationships; do not guess paths based only on a filename.
3. Validate the declared content type, archive signature, decompressed-size limits, and the repository manifest/version.
4. Extract the inner repository to a controlled working directory or browser-backed filesystem.
5. Remove the Pijul wrapper relationship and content-type entry from the OOXML projection.
6. Materialize the remaining PPTX parts as the Pijul working copy and verify the repository state against the embedded history.
7. If no history exists, initialize a new repository only after the user opts in or creates the first version. A normal open should remain compatible with PPTX files that do not contain Pijul data.

### Create a version

1. Wait for the presentation model and any active Yjs collaboration session to reach a consistent state.
2. Produce the canonical OOXML package parts from the current presentation model and retained source parts.
3. Materialize those parts in the Pijul working tree, excluding the Pijul wrapper metadata and history payload.
4. Ask libpijul to record a change with an explicit message and author metadata.
5. Serialize the resulting portable repository state to the nested history archive.
6. Inject the custom OPC relationship and content type, then write the final .pptx.
7. Reopen the final package and verify both the deck and the embedded history are readable before declaring the save successful.

The UI should support a named/manual version checkpoint. An optional automatic checkpoint policy can be added later, with deduplication so unchanged files do not create empty versions.

### Browse, compare, and restore

- Present a readable version list with message, author, timestamp, and available change metadata.
- Show a preview/diff where supported. Pijul changes are patches with dependencies and can form a non-linear history; do not assume every repository is a simple linear list.
- Restore by materializing the selected Pijul state into a separate candidate working tree, validating/importing it, and then applying it to the live editor as one undoable restore operation.
- Before restore, create a recovery checkpoint of the current state.
- Preserve the original .pptx until the restored package has passed validation.

Version attribution must be explicit. Fileverse authentication or a local username is not automatically a cryptographic Pijul signature. Do not embed private signing keys in the PPTX archive.

## PowerPoint and external-editor compatibility

The main invariant is:

> A PPTX with embedded Pijul history must remain an ordinary, valid presentation when opened by software that does not understand the history extension.

The compatibility strategy is deliberately additive:

- Keep slide XML, media, master/layout relationships, and standard package parts independent of the history feature.
- Store history in a separate OPC part and reference it through a package-root relationship with a unique unknown relationship type.
- Register the history part with an explicit content type.
- Do not insert Pijul-specific XML elements into `ppt/presentation.xml`, slide XML, or other standard presentation parts.
- Do not make presentation rendering or editing depend on the history part being present.
- If the history is missing, corrupt, or removed, open the slide content normally and report that version history is unavailable.
- Never block PowerPoint opening because the Pijul archive is missing, damaged, or from an unsupported repository format.

The OPC rules say conforming consumers must not fail to load unknown relationships, and producers are encouraged to preserve those relationships and target parts. However, unknown or unsupported content may be discarded by a producer when it saves a document. Therefore, **PowerPoint opening compatibility and PowerPoint history-preservation compatibility are two separate test results**.

Test at least:

1. Open an embedded-history deck in supported desktop PowerPoint versions.
2. Edit a slide and Save As a new .pptx.
3. Reopen the PowerPoint-saved file and confirm the deck works.
4. Inspect whether PowerPoint preserved the Pijul relationship and target part. Do not assume it will.
5. Repeat with PowerPoint for the web where available, LibreOffice Impress, and Google Slides import/export.
6. Open each externally saved file in this editor and report whether history is intact, missing, or detached.
7. Verify that standard PPTX validators do not report invalid parts or content-type/relationship errors.

If an external editor drops the unknown relationship or part, the deck must still work. The app should clearly state that an external save removed the embedded history. A separate history export/backup can be offered as a recovery path, but it must not be silently substituted for embedded history.

## Size, performance, and retention

A PPTX may contain large images, video, charts, and embedded objects. Version history can grow quickly.

- Benchmark text-heavy and media-heavy decks separately.
- Measure repository initialization, record, archive, restore, and PPTX save time.
- Track archive size growth after repeated changes to large binary assets.
- Deduplicate unchanged assets and avoid rewriting files that have not changed.
- Do not promise binary-delta compression until measured with real media fixtures.
- Consider configurable history retention/compaction only with explicit user consent and clear warnings that removed versions cannot be recovered.
- Never silently prune history to make a save fit a size limit.
- Apply limits to nested archive entry count, path length, compressed size, decompressed size, and total processing time.

## Runtime and storage spike

The preferred experience is local-first, with libpijul running in a Rust/WASM worker and a browser-backed filesystem.

This is a research gate, not an established implementation fact:

- Verify whether libpijul builds for `wasm32-unknown-unknown` with the required repository features.
- Verify whether its filesystem access can be backed by OPFS or another durable browser storage abstraction without changing repository semantics.
- Test browser persistence across reloads, quota exhaustion, private browsing, and interrupted writes.
- Verify that the `tarball` feature or another supported API can export/import the full repository reliably.
- Avoid blocking the UI thread during record, archive, or restore operations.

If a reliable browser/WASM filesystem path is not viable, evaluate a small Rust service/native helper that manipulates the Pijul repository. That fallback changes deployment and offline guarantees and must be an explicit product decision; it must not be hidden behind a claim that Vercel alone runs libpijul.

## Security

- Treat the embedded repository as untrusted input, even if it came from a PPTX file.
- Reject absolute paths, path traversal, symlinks or unsupported entry types, duplicate paths, and malformed repository metadata during extraction.
- Enforce nested archive decompression limits and avoid zip/tar bombs.
- Do not auto-fetch Pijul remotes or external resources when opening a deck.
- Never embed private author/signing keys, Fileverse secrets, UCAN bearer tokens, or room keys.
- Do not log slide contents, decrypted Yjs updates, or embedded patch contents.
- Keep version history within the same access-control boundary as the deck. A shareable PPTX must not reveal versions that its current permissions are supposed to hide.

## Acceptance tests

- A newly created deck can initialize an embedded Pijul repository and create its first version.
- Opening the same .pptx in this app restores the version history and current slide content.
- A later save creates a new Pijul change without recursively including the prior history archive.
- Restoring an older version recovers the correct slide order, objects, media, notes, masters, and unsupported preserved OOXML parts.
- A deck without Pijul data opens exactly as a normal PPTX and can gain history after an explicit opt-in/checkpoint.
- A deck with damaged or unsupported history still opens as a presentation and reports history unavailable.
- PowerPoint and other external editors open the deck without a repair prompt; history preservation after external save is measured separately.
- External removal of the history relationship does not damage normal PPTX content.
- Fileverse storage/sharing encrypts and protects the complete file, including the embedded history.
- DSheet documents, their Yjs schema, and their rooms remain unaffected.

## References

- [libpijul on crates.io](https://crates.io/crates/libpijul)
- [libpijul 1.0.0-beta.11 package metadata and dependencies](https://docs.rs/crate/libpijul/1.0.0-beta.11)
- [libpijul 1.0.0-beta.11 Cargo manifest](https://docs.rs/crate/libpijul/1.0.0-beta.11/source/Cargo.toml.orig)
- [Pijul manual: repository initialization and .pijul directory](https://pijul.org/manual/getting_started.html)
- [Pijul repository format](https://nest.pijul.com/pijul/nest:main/tree/AX7NN2MQXFV32.EYYUG)
- [ECMA-376 Office Open XML standard](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
- [Office Open XML Part 1: Fundamentals, package and unknown relationship rules](https://download.microsoft.com/download/e/1/4/e14fb96f-83b8-4a2a-84db-7fa8acbe061a/Office%20Open%20XML%20Part%201%20-%20Fundamentals.pdf)
