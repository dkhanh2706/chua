const { test, expect } = require("@playwright/test");

for (const mobile of [false, true])
  test(`ambient music starts in game, water stays local and mute/leave clean up (${mobile ? "mobile" : "desktop"})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 },
        isMobile: mobile,
        hasTouch: mobile,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const tap = (selector) =>
      mobile ? page.locator(selector).tap() : page.locator(selector).click();
    try {
      await page.goto("/");
      await page.evaluate(() => {
        const start = TempleSound.prototype.start;
        TempleSound.prototype.start = function (...args) {
          window.soundQA = this;
          return start.apply(this, args);
        };
      });
      await page.locator("#name").fill("Nghe nhac");
      await tap("#join-button");
      await expect
        .poll(() => page.evaluate(() => window.soundQA?.music?.playing))
        .toBe(true);
      await expect
        .poll(() => page.evaluate(() => window.soundQA.ctx.state))
        .toBe("running");
      const state = await page.evaluate(() => ({
        voices: soundQA.music.voices.size,
        water: soundQA.water.gain.value,
        fall: soundQA.waterfall.gain.value,
      }));
      expect(state.voices).toBeGreaterThan(0);
      expect(state.water).toBe(0);
      expect(state.fall).toBe(0);
      await page.evaluate(() => {
        soundQA.nextBird = Infinity;
        soundQA.update(100, riverX(505) + 40, 505, 0);
      });
      await page.waitForTimeout(350);
      expect(
        await page.evaluate(() => soundQA.water.gain.value),
      ).toBeGreaterThan(0.3);
      await page.evaluate(() => soundQA.update(101, 450, 605, 0));
      await page.waitForTimeout(350);
      expect(await page.evaluate(() => soundQA.water.gain.value)).toBe(0);
      expect(await page.evaluate(() => soundQA.waterfall.gain.value)).toBe(0);
      await tap("#sound");
      await expect
        .poll(() => page.evaluate(() => soundQA.music.playing))
        .toBe(false);
      await expect
        .poll(() => page.evaluate(() => soundQA.music.voices.size))
        .toBe(0);
      expect(await page.evaluate(() => soundQA.music.timer)).toBe(null);
      await tap("#sound");
      await expect
        .poll(() => page.evaluate(() => soundQA.music.playing))
        .toBe(true);
      const duplicate = await page.evaluate(async () => {
        const music = soundQA.music,
          step = music.step;
        await soundQA.start(true);
        soundQA.setInGame(true);
        return {
          same: music === soundQA.music,
          unchanged: step === music.step,
        };
      });
      expect(duplicate).toEqual({ same: true, unchanged: true });
      // Render a short piece through a real Web Audio graph to catch silent or clipped synthesis.
      const waveform = await page.evaluate(async () => {
        const c = new OfflineAudioContext(2, 44100 * 3, 44100),
          music = new TempleAmbientMusic(c, c.destination);
        music.start();
        const buffer = await c.startRendering();
        music.stop();
        let sum = 0,
          peak = 0;
        for (const sample of buffer.getChannelData(0)) {
          sum += sample * sample;
          peak = Math.max(peak, Math.abs(sample));
        }
        return { rms: Math.sqrt(sum / buffer.length), peak };
      });
      expect(waveform.rms).toBeGreaterThan(0.001);
      expect(waveform.peak).toBeLessThan(0.8);
      await tap("#leave");
      await expect
        .poll(() => page.evaluate(() => soundQA.music.playing))
        .toBe(false);
      await expect
        .poll(() => page.evaluate(() => soundQA.music.voices.size))
        .toBe(0);
      expect(await page.evaluate(() => soundQA.music.timer)).toBe(null);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
