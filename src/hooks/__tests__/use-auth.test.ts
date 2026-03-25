import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

const ANON_WORK = {
  messages: [{ id: "1", role: "user", content: "Hello" }],
  fileSystemData: { "/": { type: "directory" }, "/App.tsx": { type: "file", content: "export default () => <div />" } },
};

const EXISTING_PROJECTS = [
  { id: "proj-1", name: "Project 1", createdAt: new Date(), updatedAt: new Date() },
  { id: "proj-2", name: "Project 2", createdAt: new Date(), updatedAt: new Date() },
];

const NEW_PROJECT = { id: "new-proj", name: "New Design", createdAt: new Date(), updatedAt: new Date(), messages: "[]", data: "{}", userId: "user-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue(NEW_PROJECT);
});

describe("useAuth", () => {
  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    describe("happy paths", () => {
      test("calls signInAction with email and password", async () => {
        mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
      });

      test("returns the result from signInAction", async () => {
        mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
        const { result } = renderHook(() => useAuth());

        let returnValue: any;
        await act(async () => {
          returnValue = await result.current.signIn("user@example.com", "wrong");
        });

        expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
      });

      test("navigates to anon work project when anon messages exist", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(ANON_WORK);
        mockCreateProject.mockResolvedValue(NEW_PROJECT);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: ANON_WORK.messages,
          data: ANON_WORK.fileSystemData,
        });
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
      });

      test("navigates to most recent project when no anon work", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue(EXISTING_PROJECTS);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
        expect(mockCreateProject).not.toHaveBeenCalled();
      });

      test("creates new project when no anon work and no existing projects", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue(NEW_PROJECT);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
      });
    });

    describe("isLoading management", () => {
      test("sets isLoading to true while signing in, false after", async () => {
        let resolveSignIn!: (value: any) => void;
        mockSignIn.mockReturnValue(new Promise((resolve) => { resolveSignIn = resolve; }));

        const { result } = renderHook(() => useAuth());
        expect(result.current.isLoading).toBe(false);

        act(() => { result.current.signIn("user@example.com", "password123"); });
        expect(result.current.isLoading).toBe(true);

        await act(async () => { resolveSignIn({ success: false, error: "Invalid" }); });
        expect(result.current.isLoading).toBe(false);
      });

      test("resets isLoading to false even when signInAction rejects", async () => {
        mockSignIn.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });
    });

    describe("error / failure paths", () => {
      test("does not call handlePostSignIn when signIn fails", async () => {
        mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "wrong");
        });

        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });
    });
  });

  describe("signUp", () => {
    describe("happy paths", () => {
      test("calls signUpAction with email and password", async () => {
        mockSignUp.mockResolvedValue({ success: false, error: "Already registered" });
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "password123");
      });

      test("returns the result from signUpAction", async () => {
        mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });
        const { result } = renderHook(() => useAuth());

        let returnValue: any;
        await act(async () => {
          returnValue = await result.current.signUp("existing@example.com", "password123");
        });

        expect(returnValue).toEqual({ success: false, error: "Email already registered" });
      });

      test("navigates to anon work project after signup when anon messages exist", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(ANON_WORK);
        mockCreateProject.mockResolvedValue(NEW_PROJECT);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: ANON_WORK.messages,
          data: ANON_WORK.fileSystemData,
        });
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
      });

      test("navigates to most recent project after signup when no anon work", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue(EXISTING_PROJECTS);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
      });

      test("creates new project after signup when no anon work and no existing projects", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue(NEW_PROJECT);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
      });
    });

    describe("isLoading management", () => {
      test("sets isLoading to true while signing up, false after", async () => {
        let resolveSignUp!: (value: any) => void;
        mockSignUp.mockReturnValue(new Promise((resolve) => { resolveSignUp = resolve; }));

        const { result } = renderHook(() => useAuth());
        expect(result.current.isLoading).toBe(false);

        act(() => { result.current.signUp("new@example.com", "password123"); });
        expect(result.current.isLoading).toBe(true);

        await act(async () => { resolveSignUp({ success: false, error: "Already registered" }); });
        expect(result.current.isLoading).toBe(false);
      });

      test("resets isLoading to false even when signUpAction rejects", async () => {
        mockSignUp.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "password123").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });
    });

    describe("error / failure paths", () => {
      test("does not call handlePostSignIn when signUp fails", async () => {
        mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("existing@example.com", "password123");
        });

        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });
    });
  });

  describe("handlePostSignIn edge cases", () => {
    test("skips anon work when getAnonWorkData returns null", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue(EXISTING_PROJECTS);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
    });

    test("skips anon work when messages array is empty", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue(EXISTING_PROJECTS);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
    });

    test("does not fetch projects when anon work exists", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(ANON_WORK);
      mockCreateProject.mockResolvedValue(NEW_PROJECT);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockGetProjects).not.toHaveBeenCalled();
    });

    test("project name for anon work includes current time", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(ANON_WORK);
      mockCreateProject.mockResolvedValue(NEW_PROJECT);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: expect.stringMatching(/^Design from .+$/) })
      );
    });

    test("new project name contains a random number", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue(NEW_PROJECT);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      const call = mockCreateProject.mock.calls[0][0];
      expect(call.name).toMatch(/^New Design #\d+$/);
      const num = parseInt(call.name.replace("New Design #", ""), 10);
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThan(100000);
    });
  });
});
