# Roadmap

This roadmap tracks ideas for the experimental presentation editor and adjacent authoring capabilities. Items below are proposals, not implemented features.

## Planned

- [ ] **DVD and Blu-ray menu creator**
  - Add a visual authoring workflow for disc menus, using slide-like editing concepts: backgrounds, text, images, buttons, page layouts, and navigation links.
  - Support DVD-Video menus and Blu-ray menu workflows as distinct output targets. Their navigation models and media/graphics constraints are different.
  - Explore project data that can represent menu pages, button focus states, directional remote-control navigation, title/chapter destinations, audio/subtitle selection, and return-to-menu behavior.
  - Investigate export pipelines for standards-compliant disc structures and ISO images. Treat encoding, menu rendering, disc authoring, and burning as separate stages.
  - Keep the first milestone focused on designing and previewing menus; actual disc authoring/export can follow once the target formats and toolchain are validated.
  - Use a portable, versioned declarative project as the handoff between the web editor and a native desktop authoring app. The native app must reopen and continue editing the project, not merely burn a flattened export.
  - Add target-aware compatibility feedback in both editor controls and on affected slide/menu objects. Distinguish supported, converted/degraded, and unsupported behavior; explain the reason and offer replace, flatten, pre-render, rebuild, keep web/native-only, or remove workflows.
  - Document DVD-Video constraints around SD video modes, subpicture/button graphics, pre-rendered motion menus, remote-control focus/navigation, limited DVD VM commands, and the lack of a browser runtime for JavaScript, web embeds, and arbitrary minigames.
  - Keep DVD-Video and Blu-ray capability profiles separate. Blu-ray HDMV and BD-J must not be presented as automatic extensions of DVD menus.

## Research notes: JavaScript / Node.js ecosystem

There does not appear to be one established, pure-JavaScript library that provides a complete DVD-Video and Blu-ray menu designer plus standards-compliant disc authoring. The practical direction may be a JavaScript/TypeScript UI and project model backed by focused authoring tools or native components.

Useful projects and building blocks to evaluate:

- [Disc Forge Studio](https://github.com/holdenitdown/Disc-Forge-Studio) — a Node.js authoring core (separate from its Electron UI) with menu rendering/layout, DVD authoring orchestration, and Blu-ray HDMV/interactive-graphics work. Particularly relevant as an implementation reference for a JS-based pipeline. Review its architecture and licensing before reusing code.
- [dvdauthor](https://github.com/ldo/dvdauthor) — native DVD-Video authoring tool driven by command-line options and XML control files. It can generate DVD structures and implement interactive DVD behavior, but it is not a JavaScript library. A Node integration could orchestrate it as an external dependency.
- [FFmpeg](https://ffmpeg.org/) — media probing, transcoding, still/video preparation, and audio/video encoding. It is a media pipeline component, not a DVD/Blu-ray menu authoring engine.
- [tsMuxeR](https://github.com/justdan96/tsMuxer) — useful to investigate for Blu-ray transport-stream muxing and related output preparation; it does not replace a menu designer or the full Blu-ray authoring layer.
- [oncemore](https://github.com/kajisho5/oncemore) — a Python-based DVD/Blu-ray authoring reference with a declarative JSON project format and separate libraries for DVD-Video and BDMV structures. Not JavaScript, but valuable for studying project schemas, menu navigation, and format boundaries.

### Initial technical investigation

1. Define a format-neutral menu document model, then add DVD-Video and Blu-ray-specific validation/export adapters.
2. Prototype menu composition and preview in the browser using ordinary web technologies (SVG/Canvas/DOM); keep remote-control focus/navigation as explicit data rather than visual-only behavior.
3. Evaluate whether to call tools such as `dvdauthor`, FFmpeg, and tsMuxeR from a Node.js worker, or implement selected format writers in JavaScript/TypeScript.
4. Compare the DVD VM and Blu-ray HDMV/IGS capabilities before promising feature parity. Blu-ray support must not be treated as a simple DVD export variant.
5. Audit every candidate's license, maintenance status, platform support, and redistribution requirements before adoption.

## Notes

- The disc-menu creator is a roadmap proposal only. No DVD/Blu-ray authoring capability is implied by the current experimental Slides editor.
- Prefer interoperable output (disc folders and ISO images) before adding physical-disc burning.
