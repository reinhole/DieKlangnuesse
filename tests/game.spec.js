// End-to-end specs for "Die Klangnüsse".
//
// Everything is driven through the DOM contract + window test hooks so the
// game is exercised deterministically without a microphone:
//   window.__setSeed(n)            -> deterministic world
//   window.__config = {...}        -> tunable physics/timing
//   window.__testMode = true       -> rAF renders only; __step advances physics
//   window.__step(n)               -> advance exactly n physics ticks
//   window.__setVolume / __setDirection / __queueJump
const { test, expect } = require('@playwright/test');

// Boot the page, seed it, apply config, then Start the run.
async function boot(page, { seed = 1234, config = {} } = {}) {
  await page.goto('/');
  await page.evaluate(
    ({ seed, config }) => {
      window.__testMode = true;
      window.__setSeed(seed);
      Object.assign(window.__config, config);
    },
    { seed, config }
  );
  await page.getByTestId('btn-start').click();
  await expect(page.getByTestId('game-status')).toHaveText('Running');
}

const step = (page, n) => page.evaluate((n) => window.__step(n), n);
const setVolume = (page, v) => page.evaluate((v) => window.__setVolume(v), v);
const setDirection = (page, d) => page.evaluate((d) => window.__setDirection(d), d);
const playerY = async (page) =>
  Number(await page.getByTestId('player').getAttribute('data-y'));

test('loads in Ready with pause disabled', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await expect(page.getByTestId('btn-pause')).toBeDisabled();
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('lives')).toHaveText('3');
  await expect(page.getByTestId('level')).toHaveText('1');
});

test('Start transitions to Running and toggles button availability', async ({ page }) => {
  await boot(page);
  await expect(page.getByTestId('btn-start')).toBeDisabled();
  await expect(page.getByTestId('btn-pause')).toBeEnabled();
});

test('Pause and resume toggle the status', async ({ page }) => {
  await boot(page);
  await page.getByTestId('btn-pause').click();
  await expect(page.getByTestId('game-status')).toHaveText('Paused');
  await page.getByTestId('btn-pause').click();
  await expect(page.getByTestId('game-status')).toHaveText('Running');
});

test('a loud peak makes the squirrel jump', async ({ page }) => {
  await boot(page);
  const before = await playerY(page);
  await setDirection(page, 0);
  await setVolume(page, 1); // loud -> jump on the rising edge
  await step(page, 4);
  expect(await playerY(page)).toBeGreaterThan(before);
});

test('collecting a nut increases the score and clears the nut', async ({ page }) => {
  // Branch directly above start so a straight-up jump grabs the first nut.
  await boot(page, { config: { branchOffsetX: 0 } });
  await setDirection(page, 0);
  await setVolume(page, 1);
  await step(page, 40);
  await expect(page.getByTestId('score')).toHaveText('1');
  await expect(page.getByTestId('nut-1')).toHaveAttribute('data-collected', '1');
});

test('collecting a level worth of nuts advances the level', async ({ page }) => {
  await boot(page, { config: { branchOffsetX: 0, nutsPerLevel: 1 } });
  await setDirection(page, 0);
  await setVolume(page, 1);
  await step(page, 40);
  await expect(page.getByTestId('score')).toHaveText('1');
  await expect(page.getByTestId('level')).toHaveText('2');
});

test('falling below the view costs lives and ends the game', async ({ page }) => {
  await boot(page);
  await setVolume(page, 0);
  await setDirection(page, 0);

  const fall = () =>
    page.evaluate(() => {
      const p = window.__game.player;
      p.y = window.__game.cameraY - 30;
      p.vy = -5;
      p.grounded = false;
    });

  await fall();
  await step(page, 1);
  await expect(page.getByTestId('lives')).toHaveText('2');

  await fall();
  await step(page, 1);
  await expect(page.getByTestId('lives')).toHaveText('1');

  await fall();
  await step(page, 1);
  await expect(page.getByTestId('game-status')).toHaveText('Game Over');
});

test('the same seed produces the same world', async ({ page }) => {
  await boot(page, { seed: 777 });
  const a = await page.getByTestId('nut-1').getAttribute('data-x');
  await boot(page, { seed: 777 });
  const b = await page.getByTestId('nut-1').getAttribute('data-x');
  expect(a).toBe(b);
});

test('the live (real-time) loop drives physics without __step', async ({ page }) => {
  // Explicitly DISABLE test mode so the requestAnimationFrame accumulator runs.
  await page.goto('/');
  await page.evaluate(() => {
    window.__testMode = false;
    window.__setSeed(99);
  });
  await page.getByTestId('btn-start').click();
  await expect(page.getByTestId('game-status')).toHaveText('Running');

  const before = await playerY(page);
  await setDirection(page, 0);
  await setVolume(page, 1); // loud -> jump, driven only by wall-clock frames
  await page.waitForTimeout(500);
  expect(await playerY(page)).toBeGreaterThan(before);
});

test('Reset returns to Ready and clears stats', async ({ page }) => {
  await boot(page, { config: { branchOffsetX: 0 } });
  await setVolume(page, 1);
  await step(page, 40);
  await expect(page.getByTestId('score')).toHaveText('1');

  await page.getByTestId('btn-reset').click();
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('lives')).toHaveText('3');
  await expect(page.getByTestId('level')).toHaveText('1');
});
