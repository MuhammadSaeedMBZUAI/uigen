// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify, SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } =
  await import("@/lib/auth");

const SECRET = new TextEncoder().encode("development-secret-key");

beforeEach(() => {
  vi.clearAllMocks();
});

test("createSession sets an http-only cookie with a valid JWT", async () => {
  await createSession("user-1", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, token, options] = mockCookieStore.set.mock.calls[0];

  expect(name).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
  expect(options.path).toBe("/");
  expect(options.expires).toBeInstanceOf(Date);

  const { payload } = await jwtVerify(token, SECRET);
  expect(payload.userId).toBe("user-1");
  expect(payload.email).toBe("user@example.com");
});

test("getSession returns the session payload for a valid token", async () => {
  const token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);

  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("user@example.com");
});

test("getSession returns null when no cookie is present", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("-1s")
    .sign(SECRET);

  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for a tampered token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "invalid.token.here" });

  const session = await getSession();

  expect(session).toBeNull();
});

test("deleteSession removes the auth cookie", async () => {
  await deleteSession();

  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

test("verifySession returns session payload for a valid request cookie", async () => {
  const token = await new SignJWT({ userId: "user-2", email: "other@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);

  const mockRequest = {
    cookies: { get: vi.fn().mockReturnValue({ value: token }) },
  } as any;

  const session = await verifySession(mockRequest);

  expect(session?.userId).toBe("user-2");
  expect(session?.email).toBe("other@example.com");
});

test("verifySession returns null when no cookie in request", async () => {
  const mockRequest = {
    cookies: { get: vi.fn().mockReturnValue(undefined) },
  } as any;

  const session = await verifySession(mockRequest);

  expect(session).toBeNull();
});

test("verifySession returns null for an invalid token in request", async () => {
  const mockRequest = {
    cookies: { get: vi.fn().mockReturnValue({ value: "bad.token" }) },
  } as any;

  const session = await verifySession(mockRequest);

  expect(session).toBeNull();
});
