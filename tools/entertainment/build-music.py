"""Original fairground waltz. Deterministic score/synthesis, no samples.
Run: uv run --with numpy python tools/entertainment/build-music.py (requires ffmpeg).
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
assert abs(len(score['sections']) * len(score['chords']) * score['beats_per_bar'] * BEAT - score['loop_seconds']) < 1e-6
mix = np.zeros((LENGTH, 2), dtype=np.float64)
rng = np.random.default_rng(score['seed'])

def voice(midi, seconds, instrument):
    t = np.arange(round(seconds * SR)) / SR
    f = 440 * 2 ** ((midi - 69) / 12)
    attack = np.minimum(t / .008, 1)
    release = np.clip((seconds - t) / .075, 0, 1)
    if instrument == 'marimba':
        signal = np.sin(2*np.pi*f*t)*np.exp(-t*4) + .16*np.sin(2*np.pi*f*4*t)*np.exp(-t*12)
    elif instrument == 'ukulele':
        signal = sum(g*np.sin(2*np.pi*f*k*t)*np.exp(-t*(3+k*.9)) for k,g in [(1,1),(2,.25),(3,.10),(4,.04)])
    elif instrument == 'flute':
        phase = 2*np.pi*f*t + .045*np.sin(2*np.pi*5*t)
        signal = .8*np.sin(phase) + .1*np.sin(phase*2)
        attack = np.minimum(t/.055, 1)
        release = np.clip((seconds-t)/.12, 0, 1)
    elif instrument == 'bass':
        signal = (np.sin(2*np.pi*f*t) + .16*np.sin(2*np.pi*f*2*t))*np.exp(-t*4)
    elif instrument == 'chime':
        signal = np.sin(2*np.pi*f*t)*np.exp(-t*4) + .12*np.sin(2*np.pi*f*2*t)*np.exp(-t*8)
    else:
        noise = rng.normal(0, 1, len(t))
        signal = np.convolve(noise, np.ones(8)/8, mode='same')*np.exp(-t*35)
    return signal * attack * release

def place(midi, beat, beats, instrument, gain, pan=0):
    signal = voice(midi, beats * BEAT, instrument) * gain
    stereo = signal[:,None] * np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)])
    indices = (round(beat*BEAT*SR) + np.arange(len(signal))) % LENGTH
    np.add.at(mix, indices, stereo)

for section, settings in enumerate(score['sections']):
    for bar, chord in enumerate(score['chords']):
        base = (section*8+bar)*3
        place(chord[0]-12, base, .8, 'bass', .08)
        for beat in [1,2]:
            for index, midi in enumerate(chord[1:]):
                place(midi, base+beat+index*.025, .75, 'ukulele', .033, -.22)
        for beat, midi, duration in score['melody'][bar]:
            place(midi, base+beat, duration+.25, settings['lead'], .083*settings['gain'], .12)
        for beat in [.5,1.5,2.5]:
            place(60, base+beat, .2, 'brush', .014, .3)
        if section != 1 and bar in [0,4]:
            place(chord[2]+12, base+2.5, 1.25, 'chime', .026, -.3)
# Wrap room tails into the next repetition rather than cutting them at the seam.
dry = mix.copy()
for delay, gain in [(.089,.10),(.173,.065),(.281,.035)]:
    mix += np.roll(dry[:,::-1], round(delay*SR), axis=0)*gain
mix *= .56 / max(float(np.max(np.abs(mix))), .001)
pcm = (np.clip(mix,-1,1)*32767).astype('<i2')
out = ROOT/'apps/game/src/assets/audio/music/entertainment-fairground-loop.mp3'
out.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
    wav = Path(temp)/'fairground.wav'
    with wave.open(str(wav),'wb') as file:
        file.setnchannels(2); file.setsampwidth(2); file.setframerate(SR); file.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','128k','-metadata','title='+score['title'],str(out)],check=True)
print(f"Exported {score['loop_seconds']}s stereo loop; peak={np.max(np.abs(mix)):.3f}; boundary jump={np.max(np.abs(mix[0]-mix[-1])):.5f}")
