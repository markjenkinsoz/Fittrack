const { defineConfig, devices } = require("@playwright/test");

const iphone = devices["iPhone 14"];

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    // Project-site path, same shape as https://markjenkinsoz.github.io/Fittrack/
    baseURL: "http://127.0.0.1:4173/Fittrack/",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "python3 tools/serve_pages.py",
    url: "http://127.0.0.1:4173/Fittrack/",
    reuseExistingServer: false,
    timeout: 15000,
  },
  projects: [
    {
      name: "iphone",
      use: {
        ...iphone,
        browserName: "chromium",
        channel: "chrome",
        defaultBrowserType: "chromium",
      },
    },
  ],
});
