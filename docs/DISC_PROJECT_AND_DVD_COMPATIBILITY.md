# Disc project workflow and DVD compatibility

This document expands the proposed DVD/Blu-ray menu creator into a product and architecture direction. Everything here is a design proposal; it is not a claim that the current Slides editor can author or export discs.

## 1. Web-to-native authoring workflow

The authoring experience should be split by what each environment does best:

1. **Web editor:** create and arrange slides, menu pages, visual assets, buttons, and navigation. Provide live compatibility feedback and a preview of the target disc experience.
2. **Declarative project:** save the work as a portable, versioned project document. The project should describe intent (pages, assets, button actions, focus order, titles, chapters, audio/subtitle choices), not merely a flattened video or a rendered menu image.
3. **Native desktop authoring app:** open the same project, continue editing it, validate it against the selected disc profile, render assets, invoke authoring tools, build a disc folder or ISO, and optionally burn physical media.

The native app is not just a final "Burn" button. Users must be able to reopen and continue editing the original project after leaving the browser.

A future project bundle could use a `.discproj` directory or archive:

```text
Movie.discproj/
├── project.json
├── assets/
│   ├── backgrounds/
│   ├── buttons/
│   ├── audio/
│   └── fonts/
├── menus/
│   ├── main.json
│   └── chapters.json
└── previews/
```

The exact schema is intentionally undecided. It should be versioned, portable, validateable without the editor UI, and extensible through target-specific capability profiles. Keep semantic actions such as `play-title`, `open-menu`, and `select-audio-track` in the document rather than encoding them as browser event handlers.

**Guiding principle: the project is portable; the authoring environment is interchangeable.**

## 2. Compatibility UX: show what will not survive export

A presentation editor should not silently discard unsupported content. When a user selects DVD-Video (or a specific Blu-ray profile), enable a compatibility mode that annotates both the editor chrome and the slide/menu canvas.

### Where warnings appear

- **Editor UI:** disable or mark unavailable toolbar commands, insert menus, effects, widgets, and settings that cannot be represented by the selected target. Explain why, and link to an alternative where possible.
- **On the slide/canvas itself:** visibly mark each affected object in-place, including objects that look like ordinary slide content. A web embed, interactive chart, animated sticker, unsupported font effect, or arbitrary script should not look export-safe merely because it is inside the slide rather than the editor toolbar.
- **Document-level report:** provide a compatibility panel grouped by page and severity, with counts, explanations, and suggested fixes.
- **Export gate:** allow preview at any time, but require users to acknowledge unresolved blockers or choose an explicit fallback before producing the final disc image.

Use three distinct outcomes rather than one generic disabled state:

| Status | Meaning | Suggested treatment |
| --- | --- | --- |
| Supported | Can be represented in the target format | Normal appearance |
| Converted / degraded | Can be approximated, flattened, rasterized, or pre-rendered, with a known loss | Warning marker and a preview of the converted result |
| Unsupported / interactive behavior lost | Cannot run or be represented by the selected target | Disabled state, clear explanation, and a required replacement/removal decision |

A disabled-looking object must remain selectable in the editor so the user can inspect it and decide what to do. Do not silently delete it. Preserve the original object in the editable project even if the DVD export uses a fallback asset.

### Example compatibility feedback

- "Web video embed: unavailable on DVD-Video. Replace with a local video file."
- "JavaScript click handler: cannot execute in a DVD menu. Assign a DVD navigation action."
- "Animated transition: will be rendered into the menu/video stream. It will no longer be editable as a live transition on disc."
- "Custom font: will be rasterized or substituted unless the font can be safely embedded in the generated asset."
- "Interactive chart: data exploration is unavailable. Export a static image or a pre-rendered video."
- "Game/minigame: arbitrary gameplay code cannot run in a DVD-Video menu. Rebuild it using supported DVD navigation and authored video assets, or mark it as web/native-only."
- "Button: assign a supported destination and focus order so it can be operated with a remote control."

## 3. DVD-Video constraints users need to understand

DVD-Video is not a browser in a plastic disc. Its menu system is built around authored video/still backgrounds, subpicture graphics, button highlights, and a limited navigation command model. The editor should communicate these boundaries before export.

### Visual and media constraints

- **Fixed video standards:** DVD-Video uses standard-definition video modes, commonly 720×480 for NTSC and 720×576 for PAL, with defined frame rates and aspect-ratio signaling. A modern widescreen slide may need scaling, letterboxing, cropping, or layout adjustment.
- **Constrained color and graphics:** menu button highlights use DVD subpicture palettes and transparency rules, not arbitrary CSS blending, shadows, gradients, or per-pixel alpha. Complex visual elements may need rasterization or simplified highlight assets.
- **Fonts and text:** text ultimately becomes rendered graphics. Live text editing, browser font loading, text selection, and arbitrary font effects do not exist on the disc. Small text can become unreadable at SD resolution and on televisions with overscan.
- **Still and motion menus:** a static menu can use an authored background; a motion menu is pre-rendered video with separately authored button/highlight behavior. It is not a live DOM or continuously running animation engine.
- **Audio/video encoding:** media must be prepared in DVD-compatible formats and stream configurations. Browser codecs and arbitrary uploaded formats cannot be assumed to work directly.
- **Safe areas:** important text and controls need title/action-safe margins to account for television overscan and different display behavior.

### Interaction and behavior constraints

- **No browser runtime:** HTML, CSS, DOM events, JavaScript, WebAssembly, web components, remote APIs, and embedded web apps do not execute on a DVD player.
- **No arbitrary minigames:** game loops, physics, user-generated scripts, free-form pointer input, and dynamic gameplay state are not part of DVD-Video menus. Some simple experiences can be redesigned as branching video or authored navigation, but that is a different interaction model.
- **Remote-control navigation:** users generally move focus with directional keys and confirm/back keys. Every interactive button needs a valid destination, deterministic directional neighbors/focus behavior, and a visible selected state.
- **Finite navigation model:** DVD navigation uses DVD Virtual Machine commands and player-defined state/register behavior. It is not a general-purpose programming environment. The editor should expose a safe, typed subset rather than promise arbitrary code.
- **Menu actions are specific:** title playback, chapter access, menu return, and audio/subtitle selection must map to actions supported by the chosen authoring profile and player behavior.

### Practical conversion choices

For each incompatible element, offer a deliberate choice where meaningful:

- **Replace:** use a DVD-compatible image, video, audio track, or navigation button.
- **Flatten:** render a complex visual into a still image, while clearly warning that its individual layers and interactions are lost on disc.
- **Pre-render:** turn an animation or supported linear sequence into video. It plays back but is no longer interactive.
- **Rebuild:** recreate a simple interaction using DVD menu buttons and navigation commands.
- **Keep web/native-only:** preserve the element in the source project but exclude it from the DVD output.
- **Remove:** delete it from the project only after explicit user confirmation.

## 4. Blu-ray is a separate target, not "DVD with more pixels"

Blu-ray offers different authoring paths, including HDMV navigation and BD-J for Java-based interactive applications on compatible players. These are not interchangeable with DVD-Video VM commands, and BD-J availability/behavior should not be treated as universal across every playback environment.

The project model can share concepts such as pages, assets, titles, chapters, and semantic actions, but validators and exporters must be target-specific. A feature marked unsupported for DVD may be possible in a Blu-ray profile, while still requiring compatibility checks for player support and authoring constraints.

Do not promise that a DVD menu or minigame can be automatically upgraded into a BD-J application. Treat richer Blu-ray interactivity as a separate implementation and testing milestone.

## 5. Suggested implementation sequence

1. Define the versioned, declarative project format and asset manifest.
2. Define capability profiles for DVD-Video and Blu-ray targets.
3. Add a compatibility analyzer that emits structured findings with severity, object/page references, explanation, and remediation options.
4. Render compatibility markers in both editor controls and the slide/menu canvas.
5. Add target-accurate previews and a document-level compatibility report.
6. Implement a native app that can import the project and continue editing it.
7. Add target-specific render/authoring pipelines only after validating the standards and toolchain.

## 6. Product promise

The editor should make the boundary visible: users can design rich presentations on the web, but a DVD player is a constrained, remote-controlled playback device rather than a general-purpose computer. The goal is not to pretend every slide feature will work. The goal is to help users understand the trade-offs, preserve their source project, and make intentional adaptations before authoring a disc.
