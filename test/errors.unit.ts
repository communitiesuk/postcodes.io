import { describe, expect, it } from "vitest";
import { errors } from "./helper/index";
const { PostcodesioHttpError, InvalidJsonError, NotFoundError } = errors;

describe("Errors", () => {
  describe("PostcodesioHttpError", () => {
    it("instantiates with default attributes", () => {
      const e = new PostcodesioHttpError();
      expect(e.name).toBe("PostcodesioHttpError");
      expect(e.status).toBe(500);
      expect(e.humanMessage).toContain("500 Server Error");
      expect(e.message).toContain("500 Server Error");
    });

    it("instantiates with correct attributes", () => {
      const code = 401;
      const msg = "Foo";
      const e = new PostcodesioHttpError(code, msg);
      expect(e.status).toBe(code);
      expect(e.humanMessage).toBe(msg);
    });

    it("has toJSON method", () => {
      const e = new PostcodesioHttpError();
      const result = e.toJSON();
      expect(result.status).toBe(e.status);
      expect(result.error).toBe(e.humanMessage);
    });
  });

  describe("InvalidJsonError", () => {
    it("instantiates with correct attributes", () => {
      const e = new InvalidJsonError();
      expect(e.status).toBe(400);
      expect(e.humanMessage).toContain("Invalid JSON submitted");
    });
  });

  describe("NotFoundError", () => {
    it("instantiates with correct attributes", () => {
      const e = new NotFoundError();
      expect(e.status).toBe(404);
      expect(e.humanMessage).toContain("Resource not found");
    });
  });
});

describe("mapDatabaseError", () => {
  it("maps a statement_timeout cancellation (57014) to a 503", () => {
    const pgError = Object.assign(
      new Error("canceling statement due to statement timeout"),
      { code: "57014" }
    );
    const mapped = errors.mapDatabaseError(pgError);
    expect(mapped).toBeInstanceOf(errors.DatabaseTimeoutError);
    expect(mapped?.status).toBe(503);
  });

  it("maps a pool connection timeout to a 503", () => {
    const poolError = new Error("timeout exceeded when trying to connect");
    const mapped = errors.mapDatabaseError(poolError);
    expect(mapped).toBeInstanceOf(errors.DatabasePoolTimeoutError);
    expect(mapped?.status).toBe(503);
  });

  it("returns null for other database errors", () => {
    const pgError = Object.assign(new Error("relation does not exist"), {
      code: "42P01",
    });
    expect(errors.mapDatabaseError(pgError)).toBeNull();
  });

  it("returns null for non-errors", () => {
    expect(errors.mapDatabaseError("boom")).toBeNull();
    expect(errors.mapDatabaseError(undefined)).toBeNull();
  });
});
