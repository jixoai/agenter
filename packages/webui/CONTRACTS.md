# WebUI Contracts

## 1. Input Contract

- Chat input is stored exactly as typed.
- The input layer never decodes or rewrites escape sequences.
- Preview/render layers are forbidden from guessing whether `\n` should become a real newline.

## 2. Message Contract

- `content` is the single source of truth for a chat block.
- `channel` only describes semantics (`to_user`, `self_talk`, `tool_call`, `tool_result`).
- View-only labels, badges, and grouping stay in the UI projection layer.

## 3. Markdown Contract

- Every Markdown block supports two modes:
  - `raw`: show the original Markdown text
  - `preview`: show a visual projection of the same Markdown
- Copy Markdown must use the raw source, not rendered HTML/text.
- Preview must hide raw fence syntax while preserving the fenced language semantics.

## 4. Tool Fence Contract

- Only fenced blocks with `yaml+tool_call` or `yaml+tool_result` are eligible for structured tool rendering.
- Schema-valid tool fences may be upgraded into tool accordions.
- Invalid tool fences fall back to a normal code block without semantic rewriting.

## 5. Chat Surface Contract

- Bubble tone is driven by semantic surface, not ad-hoc utility classes:
  - `bubble-user`
  - `bubble-assistant`
  - `bubble-self-talk`
- Code token colors must be readable inside each surface.
- Self-talk is styled differently, but the UI must not prepend extra `Self-talk` headings into the message body.

## 6. History / Prompt Contract

- Assistant history should preserve facts without leaking UI channel labels back into model context.
- Prompts should instruct the model not to prepend protocol wrappers such as `Self-talk`, `Reply`, XML, or JSON envelopes unless explicitly requested.
