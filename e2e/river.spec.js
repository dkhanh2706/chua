const { test, expect } = require("@playwright/test");

for (const mobile of [false, true])
  test(`walk over the arched bridge and render flowing river (${mobile ? "mobile" : "desktop"})`, async ({
    browser,
  }) => {
    test.setTimeout(45000);
    const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
        isMobile: mobile,
        hasTouch: mobile,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    async function forwardUntil(predicate) {
      if (mobile) {
        const box = await page.locator("#joystick").boundingBox(),
          x = box.x + box.width / 2,
          y = box.y + box.height / 2,
          cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y, id: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - 35, id: 1 }],
        });
        try {
          await expect
            .poll(() => page.evaluate(predicate), {
              intervals: [50],
              timeout: 8000,
            })
            .toBe(true);
        } finally {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await cdp.detach();
        }
      } else {
        await page.locator("#canvas").focus();
        await page.keyboard.down("w");
        try {
          await expect
            .poll(() => page.evaluate(predicate), {
              intervals: [50],
              timeout: 8000,
            })
            .toBe(true);
        } finally {
          await page.keyboard.up("w");
        }
      }
      await page.waitForTimeout(200);
    }
    try {
      await page.goto("/");
      await page.locator("#name").fill("Qua cau");
      await page.locator("#join-button").click();
      await page.evaluate(async () => {
        const { TempleView } = await import("/scene3d.js");
        await new Promise((resolve) => {
          const original = TempleView.prototype.render;
          TempleView.prototype.render = function (...args) {
            original.apply(this, args);
            TempleView.prototype.render = original;
            window.riverQA = this;
            window.riverBody = this.models.get(args[3]).root;
            resolve();
          };
        });
      });
      await forwardUntil(() => window.riverBody.position.z < 15.8);
      await page.evaluate(() => (window.riverQA.yaw = -Math.PI / 2));
      await forwardUntil(
        () =>
          window.riverBody.position.x < (riverX(505) - 500) / 10 &&
          window.riverBody.position.x > (riverX(505) - 500) / 10 - 7.2,
      );
      await page.screenshot({
        path: `test-results/bridge-approach-${mobile ? "mobile" : "desktop"}.png`,
      });
      await forwardUntil(
        () => window.riverBody.position.x > (riverX(505) - 500) / 10 - 0.2,
      );
      expect(
        await page.evaluate(() => window.riverBody.position.y),
      ).toBeGreaterThan(0.9);
      await page.screenshot({
        path: `test-results/bridge-overhead-${mobile ? "mobile" : "desktop"}.png`,
      });
      await forwardUntil(
        () => window.riverBody.position.x > (riverX(505) - 500) / 10 + 7.2,
      );
      expect(
        await page.evaluate(() => window.riverBody.position.y),
      ).toBeCloseTo(0.025, 1);
      const before = await page.evaluate(() =>
        Array.from(
          window.riverQA.landscape.riverGarden.glints.instanceMatrix.array,
        ),
      );
      await page.waitForTimeout(200);
      expect(
        await page.evaluate(() =>
          Array.from(
            window.riverQA.landscape.riverGarden.glints.instanceMatrix.array,
          ),
        ),
      ).not.toEqual(before);
      await page.evaluate(() => {
        const v = window.riverQA,
          draw = v.renderer.render.bind(v.renderer),
          x = (riverX(505) - 500) / 10;
        v.renderer.render = (scene, camera) => {
          if (scene === v.scene) {
            camera.fov = 60;
            camera.updateProjectionMatrix();
            camera.position.set(x + 13, 16, 36);
            camera.lookAt(x, 0.5, 15.5);
          }
          draw(scene, camera);
        };
      });
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `test-results/river-bridge-${mobile ? "mobile" : "desktop"}.png`,
      });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
