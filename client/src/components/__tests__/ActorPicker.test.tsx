import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActorPicker from "../ActorPicker";
import { api } from "../../api";
import { getActingAs, setActingAs } from "../../identity";

vi.mock("../../api", () => ({
  api: { listPersonnel: vi.fn() },
}));

const SAMPLE_PERSONNEL = [
  { id: 1, name: "Dr. Elena Marsh", email: null, role_id: 1, role_name: "Principal Investigator" },
  { id: 2, name: "Dr. Sofia Ramos", email: null, role_id: 2, role_name: "Committee Member" },
];

describe("ActorPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("shows 'anonymous' by default, with no identity set", () => {
    render(<ActorPicker />);
    expect(screen.getByText("Acting as: anonymous")).toBeInTheDocument();
  });

  test("shows the stored name if an identity was already picked (e.g. after a reload)", () => {
    setActingAs({ personnelId: 3, name: "Dr. Prior Session", roleName: "PI" });
    render(<ActorPicker />);
    expect(screen.getByText("Dr. Prior Session")).toBeInTheDocument();
  });

  test("does not fetch personnel until the dropdown is opened", () => {
    render(<ActorPicker />);
    expect(api.listPersonnel).not.toHaveBeenCalled();
  });

  test("opening the dropdown loads and lists personnel", async () => {
    (api.listPersonnel as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_PERSONNEL);
    const user = userEvent.setup();
    render(<ActorPicker />);

    await user.click(screen.getByText("Acting as: anonymous"));

    await waitFor(() => {
      expect(screen.getByText("Dr. Elena Marsh")).toBeInTheDocument();
    });
    expect(screen.getByText("Dr. Sofia Ramos")).toBeInTheDocument();
  });

  test("picking a person persists the identity and updates the button label", async () => {
    (api.listPersonnel as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_PERSONNEL);
    const user = userEvent.setup();
    render(<ActorPicker />);

    await user.click(screen.getByText("Acting as: anonymous"));
    await waitFor(() => expect(screen.getByText("Dr. Elena Marsh")).toBeInTheDocument());
    await user.click(screen.getByText("Dr. Elena Marsh"));

    expect(screen.getByText("Dr. Elena Marsh")).toBeInTheDocument(); // now the button label
    expect(getActingAs()).toEqual({ personnelId: 1, name: "Dr. Elena Marsh", roleName: "Principal Investigator" });
  });

  test("'Stay anonymous' clears a previously-set identity", async () => {
    setActingAs({ personnelId: 1, name: "Dr. Elena Marsh", roleName: "Principal Investigator" });
    (api.listPersonnel as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_PERSONNEL);
    const user = userEvent.setup();
    render(<ActorPicker />);

    await user.click(screen.getByText("Dr. Elena Marsh"));
    await waitFor(() => expect(screen.getByText("Stay anonymous")).toBeInTheDocument());
    await user.click(screen.getByText("Stay anonymous"));

    expect(screen.getByText("Acting as: anonymous")).toBeInTheDocument();
    expect(getActingAs()).toBeNull();
  });

  test("does not break if the personnel list fails to load — fails quiet, stays usable", async () => {
    (api.listPersonnel as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<ActorPicker />);

    await user.click(screen.getByText("Acting as: anonymous"));

    await waitFor(() => {
      expect(screen.getByText("No personnel found.")).toBeInTheDocument();
    });
    // Anonymous use remains fully intact even when this fails.
    expect(screen.getByText("Stay anonymous")).toBeInTheDocument();
  });
});
