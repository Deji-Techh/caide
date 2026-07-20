import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelPicker } from "./ModelPicker";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  setChatMode: vi.fn(),
  updateSettings: vi.fn(),
  navigate: vi.fn(),
  posthogCapture: vi.fn(),
  renderSubContent: false,
  settingsLoading: false,
  settings: {
    enableDyadPro: false,
    providerSettings: {},
    selectedModel: { name: "auto", provider: "auto" },
    selectedChatMode: "build",
    defaultChatMode: "build",
  } as any,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: mocks.settings,
    updateSettings: mocks.updateSettings,
    envVars: {},
    loading: mocks.settingsLoading,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => ({ location: { pathname: "/", search: {} } }),
  useNavigate: () => mocks.navigate,
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mocks.posthogCapture }),
}));

vi.mock("@/routes/settings/providers/$provider", () => ({
  providerSettingsRoute: { id: "/settings/providers/$provider" },
}));

vi.mock("@/hooks/useChatMode", () => ({
  useChatMode: () => ({
    selectedMode: "build",
    setChatMode: mocks.setChatMode,
  }),
}));

vi.mock("@/hooks/useFreeModelQuota", () => ({
  useFreeModelQuota: () => ({
    quotaStatus: null,
    isLoading: false,
    error: null,
    isQuotaExceeded: false,
    messagesUsed: 0,
    messagesLimit: 0,
    messagesRemaining: 0,
    resetTime: null,
  }),
}));

vi.mock("@/hooks/useLanguageModelsByProviders", () => ({
  useLanguageModelsByProviders: () => ({
    isLoading: false,
    data: {
      auto: [
        {
          apiName: "auto",
          displayName: "Auto",
          description: "Automatically selects a configured model",
          type: "cloud",
        },
      ],
      openai: [
        {
          apiName: "gpt-5",
          displayName: "GPT 5",
          description: "OpenAI model",
          dollarSigns: 3,
          type: "cloud",
        },
        {
          apiName: "gpt-5-mini",
          displayName: "GPT 5 Mini",
          description: "OpenAI smaller model",
          dollarSigns: 2,
          type: "cloud",
        },
      ],
      chatgpt: [
        {
          apiName: "gpt-5.5",
          displayName: "GPT 5.5",
          description: "Available through a connected ChatGPT plan",
          dollarSigns: 0,
          type: "cloud",
        },
      ],
      deepseek: [
        {
          apiName: "deepseek-v4-pro",
          displayName: "DeepSeek V4 Pro",
          description: "DeepSeek reasoning and coding model",
          dollarSigns: 2,
          type: "cloud",
        },
      ],
    },
  }),
}));

vi.mock("@/hooks/useLanguageModelProviders", () => ({
  useLanguageModelProviders: () => ({
    isLoading: false,
    isProviderSetup: (provider: string) =>
      provider === "chatgpt" || provider === "deepseek",
    data: [
      { id: "auto", name: "CAIDE Engine", type: "cloud" },
      { id: "openai", name: "OpenAI", type: "cloud" },
      {
        id: "chatgpt",
        name: "ChatGPT",
        type: "cloud",
        configured: true,
      },
      { id: "deepseek", name: "DeepSeek", type: "cloud" },
    ],
  }),
}));

vi.mock("@/hooks/useLocalModels", () => ({
  useLocalModels: () => ({
    models: [],
    loading: false,
    error: null,
    loadModels: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLMStudioModels", () => ({
  useLocalLMSModels: () => ({
    models: [],
    loading: false,
    error: null,
    loadModels: vi.fn(),
  }),
}));

vi.mock("@/components/PriceBadge", () => ({ PriceBadge: () => null }));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ render }: any) => render,
  TooltipContent: () => null,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: any) =>
    mocks.renderSubContent ? <div>{children}</div> : null,
}));

describe("ModelPicker", () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.setChatMode.mockReset();
    mocks.updateSettings.mockReset();
    mocks.navigate.mockReset();
    mocks.posthogCapture.mockReset();
    mocks.renderSubContent = false;
    mocks.settingsLoading = false;
    mocks.settings.selectedModel = { name: "auto", provider: "auto" };
  });

  it("shows ChatGPT and DeepSeek models in the shared picker", () => {
    render(<ModelPicker />);

    expect(screen.getByText("GPT 5.5")).toBeTruthy();
    expect(screen.getByText("DeepSeek V4 Pro")).toBeTruthy();
  });

  it("shows ChatGPT and DeepSeek as provider groups", () => {
    mocks.renderSubContent = true;
    render(<ModelPicker />);

    expect(screen.getAllByText("ChatGPT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DeepSeek").length).toBeGreaterThan(0);
  });

  it("selects a connected ChatGPT account model", () => {
    render(<ModelPicker />);
    fireEvent.click(screen.getByText("GPT 5.5").closest("button")!);

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      selectedModel: expect.objectContaining({
        provider: "chatgpt",
        name: "gpt-5.5",
      }),
    });
  });

  it("selects a configured DeepSeek model", () => {
    render(<ModelPicker />);
    fireEvent.click(screen.getByText("DeepSeek V4 Pro").closest("button")!);

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      selectedModel: expect.objectContaining({
        provider: "deepseek",
        name: "deepseek-v4-pro",
      }),
    });
  });

  it("routes an unconfigured provider to its settings page", () => {
    render(<ModelPicker />);
    fireEvent.click(screen.getByText("GPT 5").closest("button")!);
    fireEvent.click(screen.getByText("Add OpenAI API key"));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/settings/providers/$provider",
      params: { provider: "openai" },
    });
  });

  it("keeps stronger models ahead of lower-cost models", () => {
    render(<ModelPicker />);
    const modelOrder = Array.from(document.querySelectorAll("button"))
      .map((button) => button.textContent?.trim())
      .filter(Boolean);

    const gpt5Index = modelOrder.findIndex((label) =>
      label?.startsWith("GPT 5OpenAI"),
    );
    const gpt5MiniIndex = modelOrder.findIndex((label) =>
      label?.startsWith("GPT 5 MiniOpenAI"),
    );
    expect(gpt5Index).toBeGreaterThanOrEqual(0);
    expect(gpt5MiniIndex).toBeGreaterThanOrEqual(0);
    expect(gpt5Index).toBeLessThan(gpt5MiniIndex);
  });

  it("uses the full active-model trigger on the overview", () => {
    render(<ModelPicker variant="overview" />);
    const trigger = screen.getByTestId("model-picker");

    expect(trigger.classList.contains("caide-model-button")).toBe(true);
    expect(trigger.textContent).toContain("ACTIVE MODEL");
    expect(trigger.textContent).toContain("Auto");
  });
});
