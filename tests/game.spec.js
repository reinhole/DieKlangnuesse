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
  await page.locator('#btn-start-story').click();
  await expect(page.getByTestId('game-status')).toHaveText('Running');
}

const step = (page, n) => page.evaluate((n) => window.__step(n), n);
const setVolume = (page, v) => page.evaluate((v) => window.__setVolume(v), v);
const setDirection = (page, d) => page.evaluate((d) => window.__setDirection(d), d);
const playerY = async (page) =>
  Number(await page.getByTestId('player').getAttribute('data-y'));

test('loads in Running with pause enabled', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('game-status')).toHaveText('Story');
  await page.locator('#btn-start-story').click();
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
  // Use a higher nutsPerLevel so the topY is high enough that we don't accidentally skip levels
  await boot(page, { config: { branchOffsetX: 0, nutsPerLevel: 10 } });
  
  // Teleport player near the level up threshold
  await page.evaluate(() => {
    window.__game.player.y = window.__game.branches[window.__game.branches.length - 1].top - 50;
  });
  
  await step(page, 10);
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
  await page.locator('#btn-start-story').click();
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

test('squirrel can move via arrow keys in admin mode', async ({ page }) => {
  await boot(page);
  
  const getPlayerX = () => page.evaluate(() => window.__game.player.x);
  const startX = await getPlayerX();
  
  // Toggle admin mode to enable arrow keys
  await page.keyboard.press('Shift+A');
  
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
  await boot(page, { config: { branchOffsetX: 0, nutsPerLevel: 10 } });
  
  // Before leveling up, the overlay shouldn't be open
  await expect(page.getByTestId('level-up-screen')).toHaveJSProperty('open', false);

  // Teleport player precisely above the Level 2 start threshold dynamically
  await page.evaluate(() => {
    // The top of the last branch is exactly GameState.game.topY
    const topY = window.__game.branches[window.__game.branches.length - 1].top;
    window.__game.player.y = topY + 10; // Just high enough to cross level2StartY
    window.__game.player.invincible = true;
  });
  
  await step(page, 10);

  // Score doesn't need to increase for height-based leveling, but level becomes 2
  await expect(page.getByTestId('level')).toHaveText('2');
  await expect(page.getByTestId('level-up-screen')).toHaveJSProperty('open', true);
  await expect(page.getByTestId('level-up-num')).toHaveText('2');

  // Advance physics steps beyond the 90 tick timer
  await step(page, 95);
  await expect(page.getByTestId('level-up-screen')).toHaveJSProperty('open', false);
});

test('death screen is displayed on game over with stats and a functional reset button', async ({ page }) => {
  await boot(page, { config: { branchOffsetX: 0 } });
  
  // Before dying, death screen should be hidden
  await expect(page.getByTestId('death-screen')).toHaveJSProperty('open', false);

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
  await expect(page.getByTestId('death-screen')).toHaveJSProperty('open', true);
  await expect(page.getByTestId('death-score')).toHaveText('0');
  await expect(page.getByTestId('death-level')).toHaveText('1');

  // Click the reset button inside the death screen
  await page.getByTestId('btn-death-reset').click();

  // Status returns to Running, death screen hidden
  await expect(page.getByTestId('game-status')).toHaveText('Running');
  await expect(page.getByTestId('death-screen')).toHaveJSProperty('open', false);
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

test('enemies do not leave the screen and bounce on walls', async ({ page }) => {
  await boot(page, { seed: 1234, config: { nutsPerLevel: 30 } });
  const W = 480;
  const cameraOffX = 80;
  
  for (let i = 0; i < 200; i++) {
    await step(page, 1);
    const enemiesInfo = await page.evaluate(() => {
      return window.__game.enemies.map(e => ({ x: e.x, w: e.w, type: e.type }));
    });
    for (const e of enemiesInfo) {
      const leftEdge = e.x - e.w / 2;
      const rightEdge = e.x + e.w / 2;
      expect(leftEdge).toBeGreaterThanOrEqual(cameraOffX);
      expect(rightEdge).toBeLessThanOrEqual(W - cameraOffX);
    }
  }
});

test('crouching slows down horizontal speed and allows phasing through platforms', async ({ page }) => {
  // Use config that places platforms at predictable locations
  await boot(page, { seed: 1234, config: { branchOffsetX: 0, runThreshold: 0.1 } });

  // 1. Verify speed reduction:
  // Set direction and volume to move horizontal
  await setDirection(page, 1);
  await setVolume(page, 0.5);

  // Turn on crouching
  await page.evaluate(() => window.__setCrouch(true));

  const getPlayerX = () => page.evaluate(() => window.__game.player.x);
  const getPlayerY = () => page.evaluate(() => window.__game.player.y);
  
  const startX = await getPlayerX();
  await step(page, 10);
  
  const endX = await getPlayerX();
  // Horizontal position should have changed (walking is not completely inhibited)
  expect(endX).toBeGreaterThan(startX);
  // But it should be slower (moved 9 units instead of the normal 30 units)
  const deltaX = endX - startX;
  expect(deltaX).toBeLessThan(15);
  expect(deltaX).toBeGreaterThan(5);

  // 2. Verify platform phasing:
  // Reset direction inputs to stay centered, but keep crouching
  await setDirection(page, 0);
  await setVolume(page, 0);

  const branchTop = await page.evaluate(() => {
    const firstBranch = window.__game.branches.find(b => !b.ground);
    return firstBranch ? firstBranch.top : null;
  });
  expect(branchTop).not.toBeNull();

  // Teleport player above branchTop, descending, and let them fall down with crouch active
  await page.evaluate((top) => {
    const p = window.__game.player;
    p.y = top + 20;
    p.vy = -2;
    p.grounded = false;
  }, branchTop);

  // Step enough ticks to pass branchTop
  await step(page, 20);

  const currentY = await getPlayerY();
  // Player should have fallen through the branch platform (below its top)
  expect(currentY).toBeLessThan(branchTop);

  // 3. Verify they land when crouch is turned off:
  // Turn off crouching
  await page.evaluate(() => window.__setCrouch(false));

  // Teleport player above branchTop, descending
  await page.evaluate((top) => {
    const p = window.__game.player;
    p.x = 240; // Reset X to center to land flat on the branch
    p.y = top + 20;
    p.vy = -2;
    p.grounded = false;
  }, branchTop);

  await step(page, 20);
  const landedY = await getPlayerY();
  // Player should have landed precisely on the branch platform
  expect(landedY).toBe(branchTop);
});

test('defeating an enemy awards 1 point', async ({ page }) => {
  await boot(page, { seed: 1234, config: { nutsPerLevel: 30 } });

  // Teleport player directly above the first enemy and make them fall down
  await page.evaluate(() => {
    const enemy = window.__game.enemies[0];
    // Find the nut on the same branch as this enemy
    const matchingNut = window.__game.nuts.find(n => Math.abs(n.x - enemy.x) < 5 && Math.abs(n.y - (enemy.y + 16)) < 5);
    if (matchingNut) {
      matchingNut.collected = true;
    }
    const player = window.__game.player;
    player.x = enemy.x;
    player.y = enemy.y + enemy.h + 5;
    player.vy = -3;
    player.grounded = false;
  });

  // Advance physics steps to collide and trigger squish
  await step(page, 5);

  // Verify that score is updated to 1
  await expect(page.getByTestId('score')).toHaveText('1');
});



