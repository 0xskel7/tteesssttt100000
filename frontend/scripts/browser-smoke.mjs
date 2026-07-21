import { chromium } from "/tmp/pw/node_modules/playwright/index.mjs";

const url =
  process.argv[2] ??
  "https://0xskel7.github.io/tteesssttt100000/?smoke=1";
const output = process.argv[3] ?? "/tmp/horizon-smoke.png";
const mobile = process.argv.includes("--mobile");
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  isMobile: mobile,
  hasTouch: mobile,
});
const page = await context.newPage();
const errors = [];
const failed = [];
const badResponses = [];
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(
      `${message.text()} ${message.location().url}:${message.location().lineNumber}`,
    );
  }
});
page.on("pageerror", (error) => errors.push(error.message));
page.on("requestfailed", (request) => {
  failed.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`);
});
page.on("response", (response) => {
  if (response.status() >= 400) {
    badResponses.push(`${response.status()} ${response.url()}`);
  }
});
const response = await page.goto(url, {
  waitUntil: "networkidle",
  timeout: 60_000,
});
await page.waitForTimeout(8_000);
if (process.argv.includes("--select")) {
  await page.locator(".flight-chip").first().click();
  await page.waitForTimeout(2_500);
}
await page.screenshot({ path: output, fullPage: true });
console.log(
  JSON.stringify(
    {
      status: response?.status(),
      title: await page.title(),
      body: (await page.locator("body").innerText()).slice(0, 1_000),
      canvas: await page.locator("canvas").count(),
      errors,
      failed,
      badResponses,
      modelResources: await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((entry) => entry.name.includes("aircraft"))
          .map((entry) => ({
            name: entry.name,
            duration: entry.duration,
            transferSize:
              "transferSize" in entry ? entry.transferSize : undefined,
          })),
      ),
      viewport: page.viewportSize(),
      output,
    },
    null,
    2,
  ),
);
await browser.close();
