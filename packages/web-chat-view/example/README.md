# web-chat-view app-view

Framework7 host-owned app-view for `@agenter/web-chat-view`.

## Start

From the repo root:

```bash
bun run web-chat-view:example
```

This starts an isolated review harness + Framework7 example pair. By default it prefers:

- the review harness HTTP API near `http://127.0.0.1:4600`
- the room websocket transport near `ws://127.0.0.1:4601`
- the example app near `http://127.0.0.1:4292/`

If those ports are already occupied, the launcher automatically picks the next
available ports and prints a ready-to-open `review url` for the recommended
seed profile. This avoids connecting to stale dev servers or older harness
processes.

## Review flow

The app-view owns review-shell concerns that do not belong in the shared package:

- remote profile persistence
- query-string import/share
- Framework7 compact/mobile shell chrome
- bootstrap room selection
- partial room embedding for host products such as Studio

`@agenter/web-chat-view` remains the owner of:

- room transport hydration
- transcript rendering
- composer behavior
- resource completion / resource shelf / preview law

The app-view now mirrors Framework7's app-shell law:

- `App / View / Page` own the seeded review surface
- `Toolbar` owns compact/mobile root destinations
- wide desktop uses a Framework7-first split shell: left app navigation, middle master list, right detail surface
- `Sheet` owns review setup, source editing, room resources, and detail overlays
- `@agenter/web-chat-view` stays embedded as the shared chat domain surface

Style law for this example is stricter than the UX blueprints:

- IA and flow references can guide `Messages / Contacts / Me`, child destinations, and review tasks
- visible styling still defers to official Framework7 component families and their default composition behavior
- if a blueprint and Framework7 conflict on styling, Framework7 wins and the blueprint is treated as non-binding visual reference

## Query import

The example can preload the active review profile from query parameters:

```txt
?url=<transportUrl>&token=<accessToken>&viewer=<contactId>&name=<optional-name>
```

The app-view keeps the viewer contact explicit. It does not infer viewer ownership from room labels.

## Partial room mode

Studio embeds the same app-view through an iframe and selects a focused room route:

```txt
?mode=room&room=<chatId>&url=<transportUrl>&token=<viewer-token>&viewer=<contactId>&name=<room-name>
```

This is still app-view, not a lower-level widget API. The host controls iframe
size with CSS and switches rooms by changing the URL. Normal transcript state
flows through the backend/room transport; no resize bridge or event bridge is
part of the embedding contract.
