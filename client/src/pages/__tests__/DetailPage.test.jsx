import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import DetailPage from "../DetailPage.jsx";
import { api } from "../../api.js";

vi.mock("../../api.js", () => ({
  api: {
    getProtocol: vi.fn(),
    listSpecies: vi.fn(),
    updateProtocol: vi.fn(),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: vi.fn() };
});

const SAMPLE_PROTOCOL = {
  id: "IACUC-2026-0142",
  title: "Neurobehavioral Effects of Chronic Stress in C57BL/6 Mice",
  pi: "Dr. Elena Marsh",
  species: "Mouse",
  animals: 240,
  pain_category: "Category D",
  status: "IACUC Review",
  submitted: "2026-06-30",
  expires: null,
  stages: ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"],
  related: {
    Personnel: ["Dr. Elena Marsh — PI", "Sam Whitfield — Lab tech"],
    Amendments: ["AM-01 — Add second mouse strain (Pending)"],
  },
};

function renderDetailPage() {
  return render(
    <MemoryRouter initialEntries={["/protocols/IACUC-2026-0142"]}>
      <Routes>
        <Route path="/protocols/:id" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows a loading state before data resolves", () => {
    api.getProtocol.mockReturnValue(new Promise(() => {}));

    renderDetailPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  test("renders the protocol header and key fields once data resolves", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });
    expect(api.getProtocol).toHaveBeenCalledWith("IACUC-2026-0142");
    expect(screen.getByText("Dr. Elena Marsh")).toBeInTheDocument();
    expect(screen.getByText("Mouse")).toBeInTheDocument();
    expect(screen.getByText("240")).toBeInTheDocument();
    expect(screen.getByText("Category D")).toBeInTheDocument();
  });

  test("renders the stage stepper with the current status highlighted", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });
    for (const stage of SAMPLE_PROTOCOL.stages) {
      // The current status ("IACUC Review") also renders in the StatusBadge.
      const matches = screen.getAllByText(stage);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getAllByText(SAMPLE_PROTOCOL.status).length).toBeGreaterThanOrEqual(2);
  });

  test("renders the protocol information section with title and dates", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Protocol information")).toBeInTheDocument();
    });
    expect(screen.getByText(SAMPLE_PROTOCOL.title)).toBeInTheDocument();
    expect(screen.getByText("2026-06-30")).toBeInTheDocument();
    // null expires renders an em dash
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  test("renders related-item lists with counts", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Personnel (2)")).toBeInTheDocument();
    });
    expect(screen.getByText("Amendments (1)")).toBeInTheDocument();
    expect(screen.getByText("Dr. Elena Marsh — PI")).toBeInTheDocument();
    expect(screen.getByText("AM-01 — Add second mouse strain (Pending)")).toBeInTheDocument();
  });

  test("renders the study contact email derived from the PI name", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Study contact")).toBeInTheDocument();
    });
    expect(screen.getByText("elena@university.edu")).toBeInTheDocument();
  });

  test("navigates back via the IACUC Protocols breadcrumb button", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", { name: /IACUC Protocols/ });
    await user.click(backButton);
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  test("shows an error message and back link if the API call fails", async () => {
    api.getProtocol.mockRejectedValue(new Error("Network error"));

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load IACUC-2026-0142/)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Back to list" })).toBeInTheDocument();
  });

  test("does not set state after unmount (cancelled flag)", async () => {
    let resolve;
    api.getProtocol.mockReturnValue(new Promise(r => { resolve = r; }));

    const { unmount } = renderDetailPage();
    unmount();
    resolve(SAMPLE_PROTOCOL);
  });

  test("Edit button opens a pre-filled modal and Cancel closes it without saving", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }, { id: 2, name: "Rat" }]);
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Title")).toHaveValue(SAMPLE_PROTOCOL.title);
    expect(screen.getByLabelText("Principal investigator")).toHaveValue(SAMPLE_PROTOCOL.pi);
    expect(screen.getByLabelText("Status")).toHaveValue(SAMPLE_PROTOCOL.status);
    expect(screen.getByLabelText("Species")).toHaveValue(SAMPLE_PROTOCOL.species);
    expect(screen.getByLabelText("Number of animals")).toHaveValue(240);
    expect(screen.getByLabelText("Pain category")).toHaveValue(SAMPLE_PROTOCOL.pain_category);
    expect(screen.getByLabelText("Submitted")).toHaveValue(SAMPLE_PROTOCOL.submitted);
    expect(screen.getByLabelText("Expires")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.updateProtocol).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  test("saving edits calls updateProtocol and refreshes the detail view", async () => {
    const updated = { ...SAMPLE_PROTOCOL, title: "Updated Owl Title", animals: 100 };
    api.getProtocol.mockResolvedValueOnce(SAMPLE_PROTOCOL).mockResolvedValueOnce(updated);
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }]);
    api.updateProtocol.mockResolvedValue(updated);
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Updated Owl Title");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(api.updateProtocol).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ title: "Updated Owl Title" })
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Updated Owl Title")).toBeInTheDocument();
    });
    expect(api.getProtocol).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  test("shows an inline error when saving fails and keeps the modal open", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);
    api.listSpecies.mockResolvedValue([]);
    api.updateProtocol.mockRejectedValue(new Error("Validation failed"));
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.getByText("Validation failed")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  test("edit modal keeps a status that isn't in the standard stage list", async () => {
    const withOddStatus = { ...SAMPLE_PROTOCOL, status: "Expiring soon" };
    api.getProtocol.mockResolvedValue(withOddStatus);
    api.listSpecies.mockResolvedValue([]);
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Status")).toHaveValue("Expiring soon");
  });
});
