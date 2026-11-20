# 🌈 Fileverse integration plan

## Goal

Add presentations without breaking the existing DSheet product or pretending that a local Yjs/WebRTC session is equivalent to Fileverse cloud collaboration.

The frontend may be deployed on Vercel. Whether a separate backend is required depends on whether the Fileverse collaboration and storage services explicitly support a presentation application and its document lifecycle.

## What this repository does today

The current main branch has two distinct mechanisms:

### Local persistence

src/editor/hooks/use-editor-sync.tsx creates a Y.Doc and, when enabled, attaches y-indexeddb using dsheetId as the local database key. This preserves state in that browser profile. It is not remote cloud persistence and does not make a document available on another device by itself.

### Current WebRTC collaboration hook

src/editor/hooks/use-editor-collaboration.tsx constructs a y-webrtc WebrtcProvider and configures the public Yjs demo signaling endpoint at wss://demos.yjs.dev/ws. This is a WebRTC-based demo path, not the current upstream Fileverse Socket.IO / UCAN sync flow.

The repository README advertises Fileverse-style capabilities, but the inspected implementation paths above do not wire this fork to the current upstream Fileverse collaboration protocol. Keep documentation and UI claims aligned with the actual active code path.

## What the upstream Fileverse flow expects

The upstream Fileverse repositories describe a richer collaboration system:

- Yjs documents and updates are synchronized through a Socket.IO client.
- The client authenticates with UCAN-based credentials and a document/session identity.
- Update payloads are encrypted client-side before being sent to the collaboration server.
- The collaboration server persists encrypted updates and snapshots, so a document session can recover after all editors disconnect.
- Presence/awareness, room membership, access revocation, room rotation, metadata, and commit events have protocol-level handling.
- Fileverse dSheets sends appType: dsheet during authentication. Its RTC documentation describes an APP_MISMATCH failure when a room belongs to a different Fileverse app.

The current collaboration-server README describes durable encrypted update persistence and an access gate for edit credentials. The upstream dSheets RTC flow documents the client-side SyncManager/SocketClient integration and the app identity check.

This means the current Y-WebRTC hook cannot be switched to the Fileverse service by changing its signaling URL. It is a different transport, authentication, encryption, authorization, recovery, and storage contract.

## Application identity and isolation

A presentation app needs a distinct identity, for example dslides, if that is accepted by the Fileverse backend.

Do not send a presentation room as dsheet merely to pass the existing app-type check. That would mislabel the document and weaken the separation between spreadsheet and presentation documents.

Before enabling hosted collaboration, verify or implement all of the following with Fileverse:

1. The collaboration backend recognizes the chosen presentation app type.
2. Authentication and UCAN capabilities are issued and validated for that app type.
3. Access-gate and edit-permission rules apply to presentation documents.
4. Encrypted updates and snapshots are accepted and recoverable.
5. Presence, metadata, room termination, revocation, and room-key rotation work for the new app.
6. The storage/commit flow can persist the presentation state and its media assets.
7. Share links, document discovery, and any Fileverse content registry understand the presentation identity.
8. The hosted service allows the Vercel production and preview origins required by the deployment.

Some of these may require a Fileverse-side change. This plan does not assume that the currently deployed hosted backend accepts dslides.

## Recommended client architecture

Define a provider-neutral collaboration boundary for the presentation model. The editor UI should not call Socket.IO, Yjs encryption, or Fileverse endpoints directly.

The boundary should cover:

- Connect and authenticate a document session.
- Load a durable initial snapshot and pending updates.
- Send local Yjs updates and apply remote updates.
- Publish/read awareness and presence.
- Report connection, synchronization, and authorization states.
- Commit or flush the latest encrypted document state through the host storage callbacks.
- Update encrypted metadata.
- Handle revoked access, room rotation, disconnect, and cleanup.

Provide two explicit provider implementations:

| Provider | Intended use | Guarantees |
| --- | --- | --- |
| Local provider | First usable editor milestone and offline/local use | Yjs + IndexedDB in that browser. No remote share, cloud recovery, or cross-device sync claim. |
| Fileverse provider | Production collaboration after protocol support is confirmed | Fileverse authentication, client-side encryption, durable server recovery, permissions, presence, and storage/commit integration, subject to the deployed service capabilities. |

Do not expose a fake connected state when only IndexedDB has synchronized. Local persistence and remote collaboration need separate status labels.

## Hosted backend or our own server?

| Situation | Frontend hosting | Collaboration/storage backend |
| --- | --- | --- |
| Local-only authoring | Vercel or any static host | No separate server required; browser-local IndexedDB |
| Fileverse has enabled and documented the new presentation app type | Vercel | Reuse Fileverse hosted services, after end-to-end integration tests and origin configuration |
| Fileverse hosted services do not accept the new app type, but Fileverse agrees to add it | Vercel | Request/implement the required upstream Fileverse backend and client protocol changes |
| Hosted Fileverse support is unavailable or cannot be changed | Vercel | Operate a compatible dedicated backend, or remain local-only; this is an explicit product/operations decision |

**Recommendation:** do not build a separate backend first. Build the editor with a local persistence provider and a Fileverse adapter boundary, then run a protocol spike against the deployed Fileverse service. Reuse the hosted backend only if the server, access gate, storage flow, and share infrastructure confirm support for the distinct presentation app identity.

If that support is missing, an independently operated service is not automatically equivalent to Fileverse. It would need to implement authentication, encryption, authorization, durable recovery, storage callbacks, revocation, and lifecycle behavior. Do not describe it as Fileverse-backed unless it actually integrates with those services.

## Vercel deployment notes

Vercel is suitable for hosting the browser application bundle. Hosting the UI does not provide a Yjs collaboration server or durable document storage.

For a Vercel deployment:

- Keep the browser UI statically deployable where possible.
- Configure public endpoint URLs and non-secret feature flags through build/runtime configuration.
- Never place private signing keys, server credentials, or storage secrets in VITE_* variables; those values are exposed to browser code.
- Configure the Fileverse service's allowed origins for production and preview domains where applicable.
- Verify WebSocket connectivity, authentication callbacks, upload/download flows, and browser security policies from the actual deployed origin.
- Do not make a Vercel serverless function a proxy for a long-lived WebSocket session unless the service architecture explicitly supports that pattern.

## Compatibility rules

1. Keep DSheet's existing public component and props stable.
2. Keep the DSheet Yjs schema and its dsheetId/room namespace unchanged.
3. Give presentation drafts a different IndexedDB namespace, schema version, document ID, and app type.
4. Do not mutate the existing DSheet collaboration hook to become presentation-specific.
5. Share generic authentication or UI code only through explicit interfaces.
6. Do not reuse a DSheet room or invite link for a presentation document.
7. Do not send plaintext slide content to the collaboration server. Follow the Fileverse client-side encryption protocol.
8. Treat server-reported permissions and document identity as authoritative; do not rely on frontend-only isAuthorized flags.
9. Keep local-only, Fileverse-connected, and error states distinguishable.
10. Add regression tests proving that a DSheet document opened by the old app remains a DSheet and that the presentation app rejects a DSheet room, and vice versa.

## Integration milestones

### Step A — local provider

Ship a usable presentation editor with local Yjs/IndexedDB persistence and explicit local-only status. This permits UI, model, import/export, and recovery work without claiming Fileverse cloud support.

### Step B — protocol spike

Compare the current upstream Fileverse dSheets client implementation with the presentation model. Confirm document identity, UCAN capabilities, encryption/key derivation, event lifecycle, storage callbacks, and app-type support. Document every protocol adaptation before implementing it.

### Step C — backend compatibility

Coordinate any required server/access-gate changes with Fileverse. Add the presentation app type and lifecycle only through an agreed and tested implementation. Do not overload dsheet.

### Step D — hosted integration

Implement the Fileverse provider, share-link flow, encrypted media/storage handling, commits, access revocation, presence, recovery, and cross-device tests. Verify on Vercel production and preview origins.

### Step E — compatibility release gate

Run DSheet regression tests and presentation integration tests together. A presentation release must not change DSheet's room identity, payload schema, exports, or existing collaboration behavior.

## Source references inspected

- [This fork's local persistence hook](https://github.com/Plasmmer/fileverse-based-slides/blob/main/src/editor/hooks/use-editor-sync.tsx)
- [This fork's current WebRTC hook](https://github.com/Plasmmer/fileverse-based-slides/blob/main/src/editor/hooks/use-editor-collaboration.tsx)
- [This fork's public exports](https://github.com/Plasmmer/fileverse-based-slides/blob/main/src/index.ts)
- [Upstream Fileverse dSheets RTC flow](https://github.com/fileverse/fileverse-dsheets/blob/main/docs/RTC_FLOW.md)
- [Fileverse collaboration server](https://github.com/fileverse/collaboration-server)
