import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProtocolForm from "../ProtocolForm";

// Helper to mock the API calls
vi.mock("../../api", () => ({
  api: {
    listSpecies: vi.fn().mockResolvedValue([]),
  },
}));

describe("ProtocolForm validation", () => {
  test("shows error when required fields are missing on submit", async () => {
    const onSubmit = vi.fn();
    render(
      <ProtocolForm
        initialValues={{}}
        onSubmit={onSubmit}
        submitLabel="Save"
        showProtocolNumber={true}
      />
    );

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText(/Please fill in a protocol number, a title, a principal investigator/)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("does not show error when required fields are filled", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProtocolForm
        initialValues={{ id: "P1", title: "T1", pi: "PI1" }}
        onSubmit={onSubmit}
        submitLabel="Save"
        showProtocolNumber={true}
      />
    );

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Please fill in/)).not.toBeInTheDocument();
  });
});
