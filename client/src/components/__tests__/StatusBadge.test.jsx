import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "../StatusBadge.jsx";

describe("StatusBadge", () => {
  test("renders the status text", () => {
    render(<StatusBadge status="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  test("applies a known color class for a recognized status", () => {
    render(<StatusBadge status="Approved" />);
    const badge = screen.getByText("Approved");
    expect(badge.className).toContain("text-[#3B6D11]");
  });

  test("applies a distinct color for IACUC Review vs Approved", () => {
    const { rerender } = render(<StatusBadge status="IACUC Review" />);
    const reviewBadge = screen.getByText("IACUC Review");
    expect(reviewBadge.className).toContain("text-[#854F0B]");

    rerender(<StatusBadge status="Approved" />);
    const approvedBadge = screen.getByText("Approved");
    expect(approvedBadge.className).toContain("text-[#3B6D11]");
  });

  test("falls back to a default gray style for an unrecognized status", () => {
    render(<StatusBadge status="Some Unknown Status" />);
    const badge = screen.getByText("Some Unknown Status");
    expect(badge.className).toContain("bg-gray-100");
    expect(badge.className).toContain("text-gray-600");
  });
});
