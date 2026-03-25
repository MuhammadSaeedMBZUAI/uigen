import { test, expect, vi, afterEach, describe } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainContent } from "../main-content";

vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: any) => <>{children}</>,
  useFileSystem: vi.fn(() => ({ files: {}, setFiles: vi.fn() })),
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: any) => <>{children}</>,
  useChat: vi.fn(() => ({
    messages: [],
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    append: vi.fn(),
  })),
}));

vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface" />,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame" />,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree" />,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions" />,
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: any) => <div>{children}</div>,
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}));

afterEach(() => {
  cleanup();
});

describe("Preview/Code toggle buttons", () => {
  test("renders both Preview and Code toggle buttons", () => {
    render(<MainContent />);
    expect(screen.getByRole("tab", { name: "Preview" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Code" })).toBeDefined();
  });

  test("defaults to Preview view on initial render", () => {
    render(<MainContent />);
    const previewTab = screen.getByRole("tab", { name: "Preview" });
    const codeTab = screen.getByRole("tab", { name: "Code" });

    expect(previewTab.getAttribute("data-state")).toBe("active");
    expect(codeTab.getAttribute("data-state")).toBe("inactive");
    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });

  test("switches to Code view when Code tab is clicked", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));

    const previewTab = screen.getByRole("tab", { name: "Preview" });
    const codeTab = screen.getByRole("tab", { name: "Code" });

    expect(codeTab.getAttribute("data-state")).toBe("active");
    expect(previewTab.getAttribute("data-state")).toBe("inactive");
    expect(screen.getByTestId("code-editor")).toBeDefined();
    expect(screen.getByTestId("file-tree")).toBeDefined();
    expect(screen.queryByTestId("preview-frame")).toBeNull();
  });

  test("switches back to Preview view after clicking Preview tab", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByTestId("code-editor")).toBeDefined();

    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByRole("tab", { name: "Preview" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });

  test("multiple toggles switch state correctly each time", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    // Start: Preview active
    expect(screen.getByTestId("preview-frame")).toBeDefined();

    // Switch to Code
    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByTestId("code-editor")).toBeDefined();
    expect(screen.queryByTestId("preview-frame")).toBeNull();

    // Back to Preview
    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();

    // Code again
    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByTestId("code-editor")).toBeDefined();
    expect(screen.queryByTestId("preview-frame")).toBeNull();
  });

  test("clicking the already-active tab does not change the view", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    // Preview is already active — click it again
    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByRole("tab", { name: "Preview" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });
});
