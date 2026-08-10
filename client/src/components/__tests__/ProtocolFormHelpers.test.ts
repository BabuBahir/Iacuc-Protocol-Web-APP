import { describe, test, expect } from "vitest";
import { normalizeStep, errorMessage } from "../ProtocolForm";

describe("ProtocolForm helpers", () => {
  describe("normalizeStep", () => {
    test("normalizes a string description to a full ResearchStep object", () => {
      const input = "Simple step";
      const result = normalizeStep(input);
      expect(result.description).toBe("Simple step");
      expect(result.frequency).toBe("Once");
      expect(result.anesthesia).toBe("No");
    });

    test("normalizes a partial ResearchStep object", () => {
      const input = { description: "Step", frequency: "Weekly" };
      const result = normalizeStep(input as any);
      expect(result.description).toBe("Step");
      expect(result.frequency).toBe("Weekly");
      expect(result.anesthesia).toBe("No");
    });

    test("normalizes anesthesia correctly", () => {
      expect(normalizeStep({ anesthesia: "Yes" } as any).anesthesia).toBe("Yes");
      expect(normalizeStep({ anesthesia: "No" } as any).anesthesia).toBe("No");
      expect(normalizeStep({} as any).anesthesia).toBe("No");
    });
  });

  describe("errorMessage", () => {
    test("extracts message from Error object", () => {
      expect(errorMessage(new Error("Boom!"))).toBe("Boom!");
    });

    test("returns string representation of non-Error input", () => {
      expect(errorMessage("Unknown")).toBe("Unknown");
      expect(errorMessage(123)).toBe("123");
    });
  });
});
