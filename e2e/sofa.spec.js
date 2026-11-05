const { test, expect } = require("@playwright/test");

for (const mobile of [false, true])
  test(`sofa seating, solid furniture and connected exterior roof (${mobile ? "mobile" : "desktop"})`, async ({
    browser,
  }) => {
    test.setTimeout(60000);
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
    const touch = (selector) =>
      mobile ? page.locator(selector).tap() : page.locator(selector).click();
    try {
      await page.goto("/");
      await page.locator("#name").fill("Ngoi sofa");
      await touch("#join-button");
      await page.evaluate(async () => {
        const { TempleView } = await import("/scene3d.js");
        await new Promise((resolve) => {
          const render = TempleView.prototype.render;
          TempleView.prototype.render = function (...args) {
            render.apply(this, args);
            window.sofaQA = {
              view: this,
              me: args[1].find((p) => p.id === args[3]),
            };
            resolve();
          };
        });
      });
      await page.locator("#canvas").focus();
      await page.keyboard.down("w");
      try {
        await expect
          .poll(() => page.evaluate(() => window.sofaQA.me.y), {
            intervals: [30],
            timeout: 12000,
          })
          .toBeLessThan(250);
      } finally {
        await page.keyboard.up("w");
      }
      await page.evaluate(() => window.sofaQA.view.setMode("follow"));
      await page.waitForTimeout(600);
      const point = await page.evaluate(async () => {
        const { Vector3 } = await import("three"),
          v = window.sofaQA.view,
          s = SOFA_SEATS[1],
          p = new Vector3(
            (s.x - 500) / 10,
            SOFA_SEAT_HEIGHT + 0.02,
            (s.y - 350) / 10,
          ).project(v.camera),
          r = v.canvas.getBoundingClientRect();
        return {
          x: r.left + ((p.x + 1) * r.width) / 2,
          y: r.top + ((1 - p.y) * r.height) / 2,
        };
      });
      if (mobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await expect
        .poll(() => page.evaluate(() => window.sofaQA.me.sofaSeatId), {
          timeout: 15000,
        })
        .toBeTruthy();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.sofaQA.view.models.get(window.sofaQA.me.id).motionOutput
                .sit,
          ),
        )
        .toBe(1);
      await page.evaluate(() => {
        window.sofaQA.view.setMode("overhead");
        window.sofaQA.view.yaw = Math.PI;
      });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `test-results/sofa-seated-${mobile ? "mobile" : "desktop"}.png`,
      });
      await touch("#sit");
      await expect
        .poll(() => page.evaluate(() => window.sofaQA.me.sofaSeatId))
        .toBeFalsy();
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        window.sofaQA.view.yaw = 0;
      });
      await page.locator("#canvas").focus();
      await page.keyboard.down("s");
      await page.waitForTimeout(800);
      await page.keyboard.up("s");
      const blocked = await page.evaluate(() => ({
        y: window.sofaQA.me.y,
        edge: SOFA_LAYOUT[0].y - SOFA_LAYOUT[0].halfDepth,
        valid: validPosition(window.sofaQA.me.x, window.sofaQA.me.y),
      }));
      expect(blocked.valid).toBe(true);
      expect(blocked.y).toBeLessThanOrEqual(blocked.edge);
      await touch("#sit");
      await expect
        .poll(() => page.evaluate(() => window.sofaQA.me.sofaSeatId))
        .toBeTruthy();
      await page.waitForTimeout(650);
      await page.evaluate(() => {
        window.sofaQA.view.setMode("follow");
        window.sofaQA.view.yaw = Math.PI;
      });
      await page.waitForTimeout(450);
      const floor = await page.evaluate(async () => {
        const { Vector3 } = await import("three"),
          v = window.sofaQA.view,
          p = new Vector3(-5, 1.2, -11).project(v.camera),
          r = v.canvas.getBoundingClientRect();
        return {
          x: r.left + ((p.x + 1) * r.width) / 2,
          y: r.top + ((1 - p.y) * r.height) / 2,
        };
      });
      if (mobile) await page.touchscreen.tap(floor.x, floor.y);
      else await page.mouse.click(floor.x, floor.y);
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              Math.hypot(window.sofaQA.me.x - 450, window.sofaQA.me.y - 240),
            ),
          { timeout: 10000 },
        )
        .toBeLessThan(4);
      expect(
        await page.evaluate(() => window.sofaQA.me.sofaSeatId),
      ).toBeFalsy();
      await page.evaluate((mobile) => {
        const v = window.sofaQA.view,
          draw = v.renderer.render.bind(v.renderer);
        v.renderer.render = (scene, camera) => {
          if (scene === v.scene) {
            for (const roof of v.roofs)
              roof.traverse((o) => {
                if (o.material) {
                  o.material.opacity = o.isLineSegments ? 0.22 : 1;
                  o.material.transparent = !!o.isLineSegments;
                  o.material.depthWrite = true;
                  o.material.needsUpdate = true;
                }
              });
            camera.fov = mobile ? 70 : 48;
            camera.updateProjectionMatrix();
            camera.position.set(32, 17, 17);
            camera.lookAt(0, 9, -17.5);
          }
          draw(scene, camera);
        };
      }, mobile);
      expect(
        await page.evaluate(
          () =>
            window.sofaQA.view.roofs[0].getObjectByName(
              "connected-timber-roof-frame",
            ).userData.supports.length,
        ),
      ).toBe(22);
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `test-results/temple-roof-joints-${mobile ? "mobile" : "desktop"}.png`,
      });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
