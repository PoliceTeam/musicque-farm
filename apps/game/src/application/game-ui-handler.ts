import { createGameAudio } from '@chibi-town/game-audio';
import { createUiFeedback, installGameUi } from '@chibi-town/ui';

const musicUrl = '/chibi-assets/map/audio/chibi-town-loop.mp3';

/** Screen feedback and input; the app may provide a persistent audio service. */
export function createGameUi(root: HTMLElement, sharedAudio?: ReturnType<typeof createGameAudio>) {
  const audio =
    sharedAudio ??
    createGameAudio({
      musicUrl,
      loopSeconds: 76.8,

      onState() {},
    });
  const feedback = createUiFeedback(root);
  const cleanup = installGameUi(root, { play: (sound) => audio.play(sound) });

  const unlock = () => void audio.unlock();

  if (!sharedAudio) {
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
  }
  return {
    audio,
    ...feedback,

    destroy() {
      feedback.destroy();
      cleanup();
      document.removeEventListener('pointerdown', unlock, { capture: true });
      document.removeEventListener('keydown', unlock, { capture: true });
      if (!sharedAudio) audio.destroy();
    },
  };
}
