# Reverse engineering notes

The reference experience at `/i` is a small React single-page app centered on one repeated loop: choose a mode, choose a niche, spin a prompt, then optionally run a speech timer. The original also includes a deep-research mode with a research timer, a settings modal, local persistence, and optional Web Audio effects.

This clone preserves that behavioral surface while adding the requested Gemini-backed topic generation on the server. The browser never receives an API key. The original static prompt pools are represented in `server.js` as an offline fallback so the product remains functional without network access.

The local product is branded **Basement** and was redesigned around the supplied references: a centered Fraunces-style wordmark, purple-black palette (`#0A0616`, `#4A1754`, `#800080`, `#A080C0`), geometric symbol controls, custom niche picker, large editorial prompt, and a live topic reel while generation is in flight.
