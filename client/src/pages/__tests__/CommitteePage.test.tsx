import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import CommitteePage from "../CommitteePage";
import { api as realApi } from "../../api";
import { setActingAs } from "../../identity";
import type {
  CommitteeProtocol,
  CommitteeTally,
  Protocol,
  ReviewComment,
  ReviewerAssignment,
  Voter,
} from "../../types";

vi.mock("../../api", () => ({
  api: {
    listCommitteeProtocols: vi.fn(),
    listVoters: vi.fn(),
    castVote: vi.fn(),
    setReviewMethod: vi.fn(),
    assignReviewer: vi.fn(),
    postComment: vi.fn(),
  },
}));

const api = vi.mocked(realApi);

const SAMPLE_PROTOCOL: CommitteeProtocol = {
  id: "IACUC-2026-0142",
  title: "Neurobehavioral Effects of Chronic Stress in C57BL/6 Mice",
  pi: "Dr. Elena Marsh",
  species: "Mouse",
  status: "IACUC Review",
  review_method: "DMR",
  counts: { Approve: 1, "Request Modifications": 0, Table: 0, "Withhold Approval": 0 },
  totalVotes: 1,
  votes: [
    { voter_name: "Dr. Priya Nair", role_name: "Attending Veterinarian", vote: "Approve", comment: null },
  ],
  assignments: [],
  comments: [],
};

const SAMPLE_VOTERS: Voter[] = [
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
    localStorage.clear();
  });

  test("shows a loading state before data resolves", () => {
    api.listCommitteeProtocols.mockReturnValue(new Promise<CommitteeProtocol[]>(() => {}));
    api.listVoters.mockReturnValue(new Promise<Voter[]>(() => {}));

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
    api.castVote.mockResolvedValue({} as CommitteeTally);

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    const voterSelect = screen.getAllByRole("combobox")[1];
    await user.selectOptions(voterSelect, "2");
    const voteSelect = screen.getAllByRole("combobox")[2];
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
    api.castVote.mockResolvedValue({} as CommitteeTally);

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1], "1");
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
    expect(screen.getAllByText("No committee-eligible personnel").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Cast vote" })).toBeDisabled();
  });

  test("does not submit when no voter is selected", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue([]);

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1], "");
    await user.click(screen.getByRole("button", { name: "Cast vote" }));

    expect(api.castVote).not.toHaveBeenCalled();
  });

  test("shows the review-method selector with FCR and DMR options", async () => {
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    const method = screen.getByLabelText("Review method");
    expect(method).toHaveValue("DMR");
    expect(screen.getByRole("option", { name: "FCR" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "DMR" })).toBeInTheDocument();
  });

  test("changing the review method calls setReviewMethod and reloads", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    api.setReviewMethod.mockResolvedValue({} as Protocol);

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Review method"), "FCR");

    await waitFor(() => {
      expect(api.setReviewMethod).toHaveBeenCalledWith("IACUC-2026-0142", "FCR");
    });
    expect(api.listCommitteeProtocols).toHaveBeenCalled();
  });

  test("renders seeded reviewer assignments and section comments", async () => {
    api.listCommitteeProtocols.mockResolvedValue([
      {
        ...SAMPLE_PROTOCOL,
        assignments: [
          { personnel_id: 2, reviewer_name: "Dr. Harold Kim", role: "Primary Reviewer", assigned_at: "2026-07-01" },
        ],
        comments: [
          { id: 1, personnel_id: 2, commenter_name: "Dr. Harold Kim", section: "procedures", comment: "Add a scoring rubric.", created_at: "2026-07-01" },
        ],
      },
    ]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);

    renderCommitteePage();

    await waitFor(() => {
      expect(screen.getByText("Dr. Harold Kim")).toBeInTheDocument();
    });
    const assignment = screen.getByText("Dr. Harold Kim").closest("li");
    expect(assignment).not.toBeNull();
    expect(assignment!.textContent).toContain("Primary Reviewer");
    expect(screen.getByText(/Add a scoring rubric/)).toBeInTheDocument();
  });

  test("assigns a reviewer through the assign form", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    api.assignReviewer.mockResolvedValue({} as ReviewerAssignment);

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Assignee"), "2");
    await user.selectOptions(screen.getByLabelText("Assignment role"), "Designated Member");
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(api.assignReviewer).toHaveBeenCalledWith("IACUC-2026-0142", {
        personnel_id: 2,
        role: "Designated Member",
      });
    });
  });

  test("posts a section-specific comment through the comments form", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    api.postComment.mockResolvedValue({} as ReviewComment);

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Commenter"), "2");
    await user.selectOptions(screen.getByLabelText("Comment section"), "procedures");
    await user.type(screen.getByPlaceholderText("Add section feedback…"), "Add a scoring rubric.");
    await user.click(screen.getByRole("button", { name: "Add comment" }));

    await waitFor(() => {
      expect(api.postComment).toHaveBeenCalledWith("IACUC-2026-0142", {
        personnel_id: 2,
        section: "procedures",
        comment: "Add a scoring rubric.",
      });
    });
  });

  test("shows an error when assigning fails", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    api.assignReviewer.mockRejectedValue(new Error("Role already taken."));

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(screen.getByText("Role already taken.")).toBeInTheDocument();
    });
  });

  test("shows an error when posting a comment fails", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    api.postComment.mockRejectedValue(new Error("That section is closed."));

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Add section feedback…"), "needs work");
    await user.click(screen.getByRole("button", { name: "Add comment" }));

    await waitFor(() => {
      expect(screen.getByText("That section is closed.")).toBeInTheDocument();
    });
  });

  test("shows an error when changing the review method fails", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    api.setReviewMethod.mockRejectedValue(new Error("Invalid review method."));

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Review method"), "FCR");

    await waitFor(() => {
      expect(screen.getByText("Invalid review method.")).toBeInTheDocument();
    });
  });

  test("disables the Add comment button until comment text is present", async () => {
    const user = userEvent.setup();
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);

    renderCommitteePage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Add comment" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Add section feedback…"), "please expand");
    expect(screen.getByRole("button", { name: "Add comment" })).toBeEnabled();
  });
});

describe("CommitteePage — committee access banner", () => {
  function renderWithActingAs(actingAs: { personnelId: number; name: string; roleName: string }) {
    setActingAs(actingAs);
    api.listCommitteeProtocols.mockResolvedValue([SAMPLE_PROTOCOL]);
    api.listVoters.mockResolvedValue(SAMPLE_VOTERS);
    renderCommitteePage();
    return waitFor(() => expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument());
  }

  test("shows a notice for a non-committee persona", async () => {
    await renderWithActingAs({ personnelId: 9, name: "Dr. Bench Scientist", roleName: "Principal Investigator" });
    expect(screen.getByTestId("access-banner")).toBeInTheDocument();
    expect(screen.getByText(/Committee members only/)).toBeInTheDocument();
  });

  test("hides the notice for a committee-eligible persona", async () => {
    await renderWithActingAs({ personnelId: 1, name: "Dr. Priya Nair", roleName: "Attending Veterinarian" });
    expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument();
  });

  test("hides the notice for office staff even when not on the voter list", async () => {
    await renderWithActingAs({ personnelId: 99, name: "Dr. Coordinator", roleName: "IACUC Coordinator" });
    expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument();
  });
});
