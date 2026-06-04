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
  await page.addInitScript(
    ({ seed, config }) => {
      window.__testMode = true;
      window.__initialSeed = seed;
      window.__initialConfig = config;
    },
    { seed, config }
  );
  await page.goto('/');
  await expect(page.getByTestId('game-status')).toHaveText('Running');
}

const step = (page, n) => page.evaluate((n) => window.__step(n), n);
const setVolume = (page, v) => page.evaluate((v) => window.__setVolume(v), v);
const setDirection = (page, d) => page.evaluate((d) => window.__setDirection(d), d);
const playerY = async (page) =>
  Number(await page.getByTestId('player').getAttribute('data-y'));

test('loads in Running with pause enabled', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('game-status')).toHaveText('Running');
  await expect(page.getByTestId('btn-pause')).toBeEnabled();
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('lives')).toHaveText('3');
  await expect(page.getByTestId('level')).toHaveText('1');
});

test('Pause is enabled when running', async ({ page }) => {
  await boot(page);
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
  await page.addInitScript(() => {
    window.__testMode = false;
    window.__initialSeed = 99;
  });
  await page.goto('/');
  await expect(page.getByTestId('game-status')).toHaveText('Running');

  const before = await playerY(page);
  await setDirection(page, 0);
  await setVolume(page, 1); // loud -> jump, driven only by wall-clock frames
  await page.waitForTimeout(500);
  expect(await playerY(page)).toBeGreaterThan(before);
});

test('Reset returns to Running and clears stats', async ({ page }) => {
  await boot(page, { config: { branchOffsetX: 0 } });
  await setVolume(page, 1);
  await step(page, 40);
  await expect(page.getByTestId('score')).toHaveText('1');

  await page.getByTestId('btn-reset').click();
  await expect(page.getByTestId('game-status')).toHaveText('Running');
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('lives')).toHaveText('3');
  await expect(page.getByTestId('level')).toHaveText('1');
});

test('runThreshold scales running speed and separates it from jumpThreshold', async ({ page }) => {
  await boot(page, { config: { runThreshold: 0.5, jumpThreshold: 0.8, moveSpeedMax: 10 } });
  
  await setDirection(page, 1);
  await setVolume(page, 0.5);
  
  const getPlayerX = () => page.evaluate(() => window.__game.player.x);
  const startX = await getPlayerX();
  
  await step(page, 1);
  const endX = await getPlayerX();
  expect(endX - startX).toBeCloseTo(10, 1);
  
  const isGrounded = await page.evaluate(() => window.__game.player.grounded);
  expect(isGrounded).toBe(true);
});

test('squirrel can move via arrow keys without the mic on', async ({ page }) => {
  await boot(page);
  
  const getPlayerX = () => page.evaluate(() => window.__game.player.x);
  const startX = await getPlayerX();
  
  // Make sure volume is 0 (mic is off by default, and manual volume starts at 0)
  await setVolume(page, 0);
  
  // Press ArrowRight
  await page.keyboard.down('ArrowRight');
  
  // Advance physics step
  await step(page, 1);
  
  const endX = await getPlayerX();
  expect(endX).toBeGreaterThan(startX);
  
  // Release ArrowRight
  await page.keyboard.up('ArrowRight');
});

test('level-up screen appears and disappears after a short time', async ({ page }) => {
  await boot(page, { config: { branchOffsetX: 0, nutsPerLevel: 1 } });
  
  // Before leveling up, the overlay shouldn't have class "show"
  await expect(page.getByTestId('level-up-screen')).not.toHaveClass(/show/);

  // Jump to collect the nut
  await setDirection(page, 0);
  await setVolume(page, 1);
  await step(page, 40);

  // Score increases, level becomes 2, level-up screen should be shown
  await expect(page.getByTestId('score')).toHaveText('1');
  await expect(page.getByTestId('level')).toHaveText('2');
  await expect(page.getByTestId('level-up-screen')).toHaveClass(/show/);
  await expect(page.getByTestId('level-up-num')).toHaveText('2');

  // Advance physics steps beyond the 90 tick timer
  await step(page, 95);
  await expect(page.getByTestId('level-up-screen')).not.toHaveClass(/show/);
});

test('death screen is displayed on game over with stats and a functional reset button', async ({ page }) => {
  await boot(page, { config: { branchOffsetX: 0 } });
  
  // Before dying, death screen should be hidden
  await expect(page.getByTestId('death-screen')).toHaveClass(/hidden/);

  // Fall 3 times to lose all lives
  const fall = () =>
    page.evaluate(() => {
      const p = window.__game.player;
      p.y = window.__game.cameraY - 30;
      p.vy = -5;
      p.grounded = false;
    });

  await fall();
  await step(page, 1);
  await fall();
  await step(page, 1);
  await fall();
  await step(page, 1);

  // Game over state reached
  await expect(page.getByTestId('game-status')).toHaveText('Game Over');
  
  // Death screen should be visible
  await expect(page.getByTestId('death-screen')).not.toHaveClass(/hidden/);
  await expect(page.getByTestId('death-score')).toHaveText('0');
  await expect(page.getByTestId('death-level')).toHaveText('1');

  // Click the reset button inside the death screen
  await page.getByTestId('btn-death-reset').click();

  // Status returns to Running, death screen hidden
  await expect(page.getByTestId('game-status')).toHaveText('Running');
  await expect(page.getByTestId('death-screen')).toHaveClass(/hidden/);
});

test('spawns ant, gator, and grasshopper enemies based on seeds', async ({ page }) => {
  const getEnemyTypes = async (seed) => {
    await boot(page, { seed, config: { nutsPerLevel: 30 } });
    return await page.evaluate(() => {
      return window.__game.enemies.map(e => e.type || 'ant');
    });
  };

  const types1234 = await getEnemyTypes(1234);
  const types9999 = await getEnemyTypes(9999);
  const types5555 = await getEnemyTypes(5555);

  const allTypes = new Set([...types1234, ...types9999, ...types5555]);
  
  expect(allTypes.has('ant')).toBe(true);
  expect(allTypes.has('gator')).toBe(true);
  expect(allTypes.has('grasshopper')).toBe(true);
});


