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

describe("ProtocolForm field help icons (issue #90)", () => {
  test("renders an info button beside the Title, purpose, harm-benefit, scientific, and animals labels without changing their accessible names", () => {
    render(
      <ProtocolForm
        initialValues={{}}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        submitLabel="Save"
      />
    );

    // Labels keep their exact names so getByLabelText queries still resolve.
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Lay purpose")).toBeInTheDocument();
    expect(screen.getByLabelText("Harm–benefit analysis")).toBeInTheDocument();
    expect(screen.getByLabelText("Scientific summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Number of animals")).toBeInTheDocument();

    // Each of those fields carries a help trigger with its own guidance text.
    expect(screen.getByRole("button", { name: /descriptive title that clearly identifies/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /non-technical terms suitable for the general public/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /potential discomfort\/pain to animals/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /technical overview of the study design/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Maximum number of animals to be used/ })).toBeInTheDocument();
  });

  test("hovering a field's help icon reveals the tooltip", () => {
    render(
      <ProtocolForm
        initialValues={{}}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        submitLabel="Save"
      />
    );

    const titleHelp = screen.getByRole("button", { name: /descriptive title that clearly identifies/ });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(titleHelp);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/descriptive title/);

    fireEvent.mouseLeave(titleHelp);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
