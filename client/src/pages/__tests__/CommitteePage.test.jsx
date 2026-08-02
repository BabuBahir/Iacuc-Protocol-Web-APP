import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CommitteePage from "../CommitteePage.jsx";
import { api } from "../../api.js";

vi.mock("../../api.js", () => ({
  api: {
    listCommitteeProtocols: vi.fn(),
    listVoters: vi.fn(),
    castVote: vi.fn(),
  },
}));

const SAMPLE_PROTOCOL = {
  id: "IACUC-2026-0142",
  title: "Neurobehavioral Effects of Chronic Stress in C57BL/6 Mice",
  pi: "Dr. Elena Marsh",
  species: "Mouse",
  status: "IACUC Review",
  counts: { Approve: 1, "Request Modifications": 0, Table: 0, "Withhold Approval": 0 },
  totalVotes: 1,
  votes: [
    { voter_name: "Dr. Priya Nair", role_name: "Attending Veterinarian", vote: "Approve", comment: null },
  ],
};

const SAMPLE_VOTERS = [
  { id: 1, name: "Dr. Priya Nair", role_name: "Attending Veterinarian" },
  { id: 2, name: "Dr. Harold Kim", role_name: "IACUC Chair" },
];

function renderCommitteePage() {
  return render(
    <MemoryRouter>
      <CommitteePage />
    </MemoryRouter>
  );
}

describe("CommitteePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows a loading state before data resolves", () => {
    api.listCommitteeProtocols.mockReturnValue(new Promise(() => {}));
    api.listVoters.mockReturnValue(new Promise(() => {}));

    renderCommitteePage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  test("renders protocol cards with title, PI, species, and vote options", async () => {
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);

    renderCommitteePage();

    await waitFor(() => {
      expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument();
    });
    expect(screen.getByText(SAMPLE_PROTOCOL.title)).toBeInTheDocument();
    expect(screen.getByText(/Dr. Elena Marsh · Mouse/)).toBeInTheDocument();
    for (const option of ["Approve", "Request Modifications", "Table", "Withhold Approval"]) {
      expect(screen.getByRole("option", { name: option })).toBeInTheDocument();
    }
  });

  test("shows 'No votes cast yet' when a protocol has no votes", async () => {
    api.listCommitteeProtocols.mockResolvedValue([
      { ...SAMPLE_PROTOCOL, counts: { Approve: 0, "Request Modifications": 0, Table: 0, "Withhold Approval": 0 }, totalVotes: 0, votes: [] },
    ]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);

    renderCommitteePage();

    await waitFor(() => {
      expect(screen.getByText("No votes cast yet.")).toBeInTheDocument();
    });
  });

  test("renders vote tally counts and a history row for cast votes", async () => {
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);

    renderCommitteePage();

    await waitFor(() => {
      expect(screen.getByText("Dr. Priya Nair")).toBeInTheDocument();
    });
    // Tally count for Approve appears in the vote bar.
    const approveCounts = screen.getAllByText("1");
    expect(approveCounts.length).toBeGreaterThan(0);
    expect(screen.getByText(/voted/)).toBeInTheDocument();
  });

  test("shows an empty state when no protocols are in review", async () => {
    api.listCommitteeProtocols.mockResolvedValue([]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);

    renderCommitteePage();

    await waitFor(() => {
      expect(screen.getByText("No protocols are currently in committee review.")).toBeInTheDocument();
    });
  });

  test("shows an error message if the API call fails", async () => {
    api.listCommitteeProtocols.mockRejectedValue(new Error("Network error"));
    api.listVoters.mockRejectedValue(new Error("Network error"));

    renderCommitteePage();

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load committee data/)).toBeInTheDocument();
    });
  });

  test("casts a vote with the selected voter, vote, and comment then reloads", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    api.castVote.mockResolvedValue({});

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    const voterSelect = screen.getAllByRole("combobox")[0];
    await user.selectOptions(voterSelect, "2");
    const voteSelect = screen.getAllByRole("combobox")[1];
    await user.selectOptions(voteSelect, "Withhold Approval");
    await user.type(screen.getByPlaceholderText("Comment (optional)"), "Concern about endpoints");
    await user.click(screen.getByRole("button", { name: "Cast vote" }));

    await waitFor(() => {
      expect(api.castVote).toHaveBeenCalledWith("IACUC-2026-0142", {
        personnel_id: 2,
        vote: "Withhold Approval",
        comment: "Concern about endpoints",
      });
    });
    // Reloads the committee data after voting.
    expect(api.listCommitteeProtocols).toHaveBeenCalled();
    expect(api.listVoters).toHaveBeenCalled();
  });

  test("sends null comment when the comment field is blank/whitespace", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    api.castVote.mockResolvedValue({});

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "1");
    await user.type(screen.getByPlaceholderText("Comment (optional)"), "   ");
    await user.click(screen.getByRole("button", { name: "Cast vote" }));

    await waitFor(() => {
      expect(api.castVote).toHaveBeenCalledWith("IACUC-2026-0142", {
        personnel_id: 1,
        vote: "Approve",
        comment: null,
      });
    });
  });
  test("shows the error from a failed vote submission", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    api.castVote.mockRejectedValue(new Error("That voter already voted."));

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Cast vote" }));

    await waitFor(() => {
      expect(screen.getByText("That voter already voted.")).toBeInTheDocument();
    });
  });

  test("disables the vote button when there are no committee-eligible voters", async () => {
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue([]);

    renderCommitteePage();

    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());
    expect(screen.getByText("No committee-eligible personnel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cast vote" })).toBeDisabled();
  });

  test("does not submit when no voter is selected", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue([]);

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "");
    await user.click(screen.getByRole("button", { name: "Cast vote" }));

    expect(api.castVote).not.toHaveBeenCalled();
  });
});
