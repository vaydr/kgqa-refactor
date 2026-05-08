import type { Page } from "@playwright/test";

const MODEL_BUTTON_REGEX = /Gemini|Claude|GPT|Grok/i;

export class ChatPage {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/");
  }

  async createNewChat() {
    await this.page.goto("/");
    await this.page.waitForSelector("[data-testid='multimodal-input']");
  }

  getInput() {
    return this.page.getByTestId("multimodal-input");
  }

  async typeMessage(message: string) {
    const input = this.getInput();
    await input.fill(message);
  }

  async sendMessage() {
    await this.page.getByTestId("send-button").click();
  }

  async sendUserMessage(message: string) {
    await this.typeMessage(message);
    await this.sendMessage();
  }

  getSendButton() {
    return this.page.getByTestId("send-button");
  }

  getStopButton() {
    return this.page.getByTestId("stop-button");
  }

  getPane(name: "data" | "chat" | "graph") {
    return this.page.getByTestId(`workspace-pane-${name}`);
  }

  getHandle(name: "horizontal" | "vertical") {
    return this.page.getByTestId(`workspace-handle-${name}`);
  }

  async getPaneBox(name: "data" | "chat" | "graph") {
    const box = await this.getPane(name).boundingBox();
    if (!box) {
      throw new Error(`Missing ${name} pane`);
    }
    return box;
  }

  async getPaneWidth(name: "data" | "chat" | "graph") {
    return (await this.getPaneBox(name)).width;
  }

  async getPaneHeight(name: "data" | "chat" | "graph") {
    return (await this.getPaneBox(name)).height;
  }

  async dragHandle(
    name: "horizontal" | "vertical",
    deltaX: number,
    deltaY: number
  ) {
    const box = await this.getHandle(name).boundingBox();
    if (!box) {
      throw new Error(`Missing ${name} handle`);
    }
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(
      box.x + box.width / 2 + deltaX,
      box.y + box.height / 2 + deltaY
    );
    await this.page.mouse.up();
  }

  getSampleQueryChips() {
    return this.page.getByTestId("sample-query-chip");
  }

  async clickSuggestedAction(index = 0) {
    const suggestions = this.page.locator(
      "[data-testid='suggested-actions'] button"
    );
    await suggestions.nth(index).click();
  }

  async openModelSelector() {
    const modelButton = this.page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();
  }

  async selectModel(modelName: string) {
    await this.openModelSelector();
    await this.page.getByText(modelName).first().click();
  }

  async searchModels(query: string) {
    await this.openModelSelector();
    await this.page.getByPlaceholder("Search models...").fill(query);
  }
}
