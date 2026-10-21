import type { createGameAudio } from '@chibi-town/game-audio';
import { publicPath } from '@/application/_utils/public-path';
import { getApiSdk } from '@/application/api-sdk';
import { createGameUi } from '@/application/game-ui-handler';
import { baseCss as screenCss } from '@/assets/generated-styles/base-css';
import { createTownGame } from '@/devtools/town/runtime/town-game';

export const styles = screenCss;

export function mount(root: HTMLElement, audio: ReturnType<typeof createGameAudio>) {
  const sharedUi = createGameUi(document.body, audio);
  const app = root;
  document.body.classList.add('town-screen');
  app.innerHTML = `
  <main class="town-stage" aria-label="Map Chibi Town">
    <div id="game"></div>
    <nav class="map-tools" aria-label="Công cụ">
      <a href="${publicPath('/character')}">Lab nhân vật</a>
    </nav>
    <p class="map-hint">WASD / phím mũi tên · Click hoặc chạm để đi</p>
  </main>`;

  let disposed = false;
  let disposeGame: (() => void) | undefined;

  async function boot() {
    const { outfit } = await getApiSdk().getPlayer();
    if (disposed) return;
    const game = await createTownGame(document.querySelector<HTMLElement>('#game')!, outfit);
    if (disposed) {
      game.destroy();
      return;
    }
    game.start();
    disposeGame = () => game.destroy();
  }

  void boot().catch((error: unknown) => {
    if (!disposed) {
      document.querySelector<HTMLElement>('#game')!.textContent = 'Không khởi tạo được game. Vui lòng tải lại trang.';
      console.error(error instanceof Error ? error.stack : String(error));
    }
  });
  return () => {
    sharedUi.destroy();
    document.body.classList.remove('town-screen');
    disposed = true;
    disposeGame?.();
  };
}
