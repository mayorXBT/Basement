# Disclosed privacy chaos drills

`catalog.json` is the only approved source of planted privacy failures. Each entry names the promise and deterministic rule that must catch it. A drill may be applied only on an issue labelled `autopilot::chaos-drill`, and its merge request must identify the entry by ID.

The mutation test applies each patch to a temporary copy. It never changes the working tree. These are test fixtures, not evidence that a real leak occurred.
