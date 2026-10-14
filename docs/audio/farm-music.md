# Farm music

Original instrumental: **Buổi sáng trên nông trại Chibi**. A relaxed 80 BPM loop with nylon-style synthesized guitar arpeggios, soft piano, a flute answer and quiet brushed percussion. No external sampled recording is used.

- Runtime: `apps/game/src/assets/audio/music/farm-meadow-loop.mp3`.
- Source score: `tools/farm/music-score.json`.
- Deterministic generator: `tools/farm/build-music.py`.
- 48 seconds, stereo, 44.1 kHz, 128 kbps MP3; 769,137 bytes.
- Synthesis peak normalized to 0.60; instrument tails and short room echoes wrap across the loop boundary.

Regenerate with `uv run --with numpy python tools/farm/build-music.py` (ffmpeg required), then run `node tools/runtime/prepare-assets.mjs`.

The persistent application audio service selects this track on `/farm` and farm map instances rendered through `/location`. Entertainment locations use their own fairground loop; the world map and other screens retain the existing Chibi Town track. Route selection is shared in `application/_utils/location-music.ts`. Switching fades out the old source over 250 ms and fades in the new one over 1.2 seconds without rebuilding the AudioContext. Each track's decoded buffer and paused position are reused on return. Volume and mute preferences remain shared. A completed older download cannot replace the currently selected track.

Verification: MP3 duration and HTTP availability checked; tests cover track changes, decoded-buffer reuse, saved position, mute preferences, concurrent gestures and stale downloads. Check and build pass. Integrated for listening review; final musical preference belongs to the user.
