"""Original instrumental loop; deterministic score + synthesis, no sampled recordings.

Run: uv run --with numpy python tools/world-map/build-music.py
Requires ffmpeg to encode the runtime MP3. WAV is a temporary intermediate.
"""
import json
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
score = json.loads(Path(__file__).with_name('music-score.json').read_text())
SR = score['sample_rate']
BEAT = 60 / score['bpm']
LENGTH = round(score['loop_seconds'] * SR)
mix = np.zeros((LENGTH, 2), dtype=np.float64)
rng = np.random.default_rng(score['seed'])


def note(midi, seconds, voice):
    t = np.arange(round(seconds * SR)) / SR
    f = 440 * 2 ** ((midi - 69) / 12)
    attack = np.minimum(t / 0.012, 1)
    release = np.minimum((seconds - t) / 0.09, 1)
    if voice == 'bell':
        signal = (np.sin(2*np.pi*f*t) * np.exp(-t*3.2)
                  + .27*np.sin(2*np.pi*f*2*t)*np.exp(-t*6)
                  + .10*np.sin(2*np.pi*f*3*t)*np.exp(-t*9))
    elif voice == 'flute':
        phase = 2*np.pi*f*t + .06*np.sin(2*np.pi*4.6*t)
        signal = (.8*np.sin(phase) + .13*np.sin(phase*2) + .04*np.sin(phase*3))
        attack = np.minimum(t/.07, 1)
        release = np.minimum((seconds-t)/.18, 1)
    elif voice == 'piano':
        signal = sum(g*np.sin(2*np.pi*f*k*t)*np.exp(-t*(1.2+k*.35))
                     for k,g in [(1,1),(2,.28),(3,.13),(4,.055)])
    elif voice == 'bass':
        signal = np.sin(2*np.pi*f*t)*np.exp(-t*1.5)
    else:
        signal = rng.normal(0, 1, len(t))
        signal = np.convolve(signal, np.ones(12)/12, mode='same')*np.exp(-t*24)
    return signal*attack*np.maximum(release, 0)


def place(midi, at, duration, voice, gain, pan=0):
    signal = note(midi, duration, voice)*gain
    stereo = signal[:,None]*np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)])
    # Wrap tails into the start: the PCM loop has no abrupt cut at its boundary.
    indices = (round(at*SR) + np.arange(len(signal))) % LENGTH
    np.add.at(mix, indices, stereo)


for section, settings in enumerate(score['sections']):
    for bar, chord in enumerate(score['chords']):
        base = (section*8+bar)*4*BEAT
        for pulse in range(8):
            midi = chord[[0,2,1,3,0,2,1,2][pulse]]
            place(midi, base+pulse*.5*BEAT, 1.1, 'piano', .075, -.28)
        for offset, midi, beats in score['melody'][bar]:
            # Section three answers the phrase with a lower bell counterline.
            place(midi, base+offset*BEAT, beats*BEAT+.25, settings['lead'],
                  .11*settings['gain'], .22)
        place(chord[0]-24, base, 1.45, 'bass', .105)
        place(chord[2]-24, base+2*BEAT, 1.2, 'bass', .075)
        for beat in [1,3]:
            place(60, base+beat*BEAT, .18, 'brush', .035, -.1)

# Short stereo room echoes, wrapped at the loop boundary.
dry = mix.copy()
for delay, gain in [(.087,.14),(.173,.09),(.291,.06)]:
    mix += np.roll(dry[:,::-1], round(delay*SR), axis=0)*gain
peak = float(np.max(np.abs(mix)))
mix *= .67/max(peak, .001)
pcm = (np.clip(mix,-1,1)*32767).astype('<i2')
out = ROOT/'apps/game/src/assets/map/audio'
out.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
    wav = Path(temp)/'chibi-town-loop.wav'
    with wave.open(str(wav),'wb') as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(SR)
        file.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-codec:a','libmp3lame',
                    '-b:a','128k','-metadata','title='+score['title'],
                    str(out/'chibi-town-loop.mp3')], check=True)
print(f"Exported {score['loop_seconds']}s stereo loop; peak={np.max(np.abs(mix)):.3f}")
