import { expect, test } from "@playwright/test";
import { ChatPage } from "../pages/chat";

test.describe("KGQA Workspace Layout", () => {
  test("desktop layout shows stacked left panes and graph hero", async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await chat.goto();

    await expect(chat.getPane("data")).toBeVisible();
    await expect(chat.getPane("chat")).toBeVisible();
    await expect(chat.getPane("graph")).toBeVisible();
    await expect(chat.getHandle("horizontal")).toBeVisible();
    await expect(chat.getHandle("vertical")).toBeVisible();
  });

  test("dataset explorer no longer renders legacy scatterplot toggle chrome", async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await chat.goto();

    await expect(
      chat.getPane("data").locator(".cursor-col-resize")
    ).toHaveCount(0);
  });

  test("sample query chip fills the composer without auto-sending", async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await chat.goto();

    const input = chat.getInput();
    const chip = page.getByTestId("sample-query-chip").first();
    const userMessageCount = page.locator("[data-testid='message-user']");

    await expect(page.getByTestId("sample-query-chips")).toBeVisible();
    await chip.click();

    await expect(input).not.toHaveValue("");
    await expect(userMessageCount).toHaveCount(0);
  });

  test("sample query chips support keyboard activation", async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();

    const chip = page.getByTestId("sample-query-chip").first();
    await chip.focus();
    await page.keyboard.press("Enter");

    await expect(chat.getInput()).not.toHaveValue("");
  });

  test("sample query chips stay hidden when a draft is restored", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("input", JSON.stringify("Restored draft"));
    });

    const chat = new ChatPage(page);
    await chat.goto();

    await expect(page.getByTestId("sample-query-chips")).toHaveCount(0);
    await expect(chat.getInput()).toHaveValue("Restored draft");
  });

  test("sub-1024 layout stacks graph, data, then chat", async ({ page }) => {
    const chat = new ChatPage(page);
    await page.setViewportSize({ width: 900, height: 1100 });
    await chat.goto();

    const graphBox = await chat.getPaneBox("graph");
    const dataBox = await chat.getPaneBox("data");
    const chatBox = await chat.getPaneBox("chat");

    expect(graphBox.y).toBeLessThan(dataBox.y);
    expect(dataBox.y).toBeLessThan(chatBox.y);
  });

  test("desktop pane sizes survive a refresh", async ({ page }) => {
    const chat = new ChatPage(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await chat.goto();

    await chat.dragHandle("horizontal", -160, 0);
    const resizedGraphWidth = await chat.getPaneWidth("graph");

    await page.reload();

    const restoredGraphWidth = await chat.getPaneWidth("graph");
    expect(Math.abs(restoredGraphWidth - resizedGraphWidth)).toBeLessThan(12);
  });

  test("desktop scatterplot starts collapsed but can be dragged open", async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await chat.goto();

    const initialHeight = await chat.getPaneHeight("data");
    expect(initialHeight).toBeLessThan(12);

    await chat.dragHandle("vertical", 0, -180);

    const expandedHeight = await chat.getPaneHeight("data");
    expect(expandedHeight).toBeGreaterThan(120);
  });

  test("desktop resize handles respond to keyboard arrows", async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await chat.goto();

    const before = await chat.getPaneWidth("graph");
    await chat.getHandle("horizontal").focus();
    await page.keyboard.press("ArrowLeft");
    const after = await chat.getPaneWidth("graph");

    expect(after).not.toBe(before);
  });

  test("graph pane exposes a stable hero shell in the idle state", async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await chat.goto();

    await expect(page.getByTestId("graph-hero-shell")).toBeVisible();
    await expect(page.getByTestId("graph-hero-shell")).toContainText(
      "Ask a question to see the answer-path subgraph"
    );
  });
});
