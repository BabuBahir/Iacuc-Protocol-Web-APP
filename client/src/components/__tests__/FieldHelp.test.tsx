import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FieldHelp from "../FieldHelp";

const TEXT = "Provide a concise, descriptive title that clearly identifies the main objective of the protocol.";

describe("FieldHelp (info icon / tooltip, issue #90)", () => {
  test("renders an info button whose aria-label carries the help text", () => {
    render(<FieldHelp text={TEXT} />);
    const button = screen.getByRole("button", { name: TEXT });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  test("shows the tooltip on hover and hides it on mouse leave", () => {
    render(<FieldHelp text={TEXT} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: TEXT }));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(TEXT);

    fireEvent.mouseLeave(screen.getByRole("button", { name: TEXT }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("is keyboard-accessible: shows on focus, hides on blur", () => {
    render(<FieldHelp text={TEXT} />);
    const button = screen.getByRole("button", { name: TEXT });

    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("toggles the tooltip on click and marks the trigger as expanded", () => {
    render(<FieldHelp text={TEXT} />);
    const button = screen.getByRole("button", { name: TEXT });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
