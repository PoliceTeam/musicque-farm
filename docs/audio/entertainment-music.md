# Entertainment street music

Original instrumental **Dạo phố hội Chibi**: a light fairground waltz at 108 BPM with synthesized marimba, ukulele offbeats, a flute variation, soft bass and brushed percussion. No external samples or recordings.

- Runtime: `apps/game/src/assets/audio/music/entertainment-fairground-loop.mp3`.
- Score: `tools/entertainment/music-score.json`.
- Generator: `tools/entertainment/build-music.py`.
- 24 bars in 3/4, exactly 40 seconds, stereo 44.1 kHz, 128 kbps MP3.
- PCM peak 0.56; instrument/reverb tails wrap into the loop start, boundary jump under 0.001.

Regenerate with `uv run --with numpy python tools/entertainment/build-music.py` (ffmpeg required), then `node tools/runtime/prepare-assets.mjs`.

`application/_utils/location-music.ts` chooses farm, entertainment or world music from the loaded route/map definition. All locations in region `fun` use this track. Channel switching keeps the current track playing. The existing shared audio service retains its decoded-buffer cache, fade transitions, mute/volume preferences and visibility handling. API/renderer implementations do not own the audio lifecycle.

Verification: routing tests cover entering entertainment and returning to the world map, alongside direct/map-instance farm entry. MP3 duration, channel count, boundary continuity and local HTTP availability are checked. Musical preference remains open to listening review.
