import React, { useEffect, useState } from "react";
import {
  Gavel,
  PawPrint,
  ThumbsUp,
  ThumbsDown,
  PauseCircle,
  PenLine,
  UserRoundCheck,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import AccessBanner from "../components/AccessBanner";
import StatusBadge from "../components/StatusBadge";
import { api } from "../api";
import {
  ASSIGNMENT_ROLES,
  REVIEW_METHODS,
  REVIEW_SECTIONS,
  REVIEW_SECTION_LABELS,
} from "../types";
import type { CommitteeProtocol, Voter } from "../types";

interface VoteOption {
  value: string;
  icon: LucideIcon;
  tint: string;
}

const VOTE_OPTIONS: VoteOption[] = [
  { value: "Approve", icon: ThumbsUp, tint: "text-[#3B6D11]" },
  { value: "Request Modifications", icon: PenLine, tint: "text-[#854F0B]" },
  { value: "Table", icon: PauseCircle, tint: "text-gray-600" },
  { value: "Withhold Approval", icon: ThumbsDown, tint: "text-[#A32D2D]" },
];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function VoteBar({ counts, totalVotes }: { counts: Record<string, number>; totalVotes: number }) {
  if (totalVotes === 0) {
    return <div className="text-[12px] text-gray-400">No votes cast yet.</div>;
  }
  return (
    <div className="space-y-1.5">
      {VOTE_OPTIONS.map(({ value, icon: Icon, tint }) => {
        const count = counts[value] || 0;
        const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
        return (
          <div key={value} className="flex items-center gap-2 text-[12px]">
            <Icon size={13} className={`${tint} shrink-0`} />
            <span className="w-40 shrink-0 text-gray-600">{value}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#0176D3]" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 text-right text-gray-500 shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function AssignReviewers({
  protocol,
  voters,
  onChanged,
}: {
  protocol: CommitteeProtocol;
  voters: Voter[];
  onChanged: () => void;
}) {
  const [personnelId, setPersonnelId] = useState<string>(String(voters[0]?.id ?? ""));
  const [role, setRole] = useState<string>(ASSIGNMENT_ROLES[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!personnelId && voters.length > 0) setPersonnelId(String(voters[0].id));
  }, [voters]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personnelId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.assignReviewer(protocol.id, { personnel_id: Number(personnelId), role: role as never });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-700 mb-2">
        <UserRoundCheck size={13} className="text-[#0176D3]" />
        Reviewer assignments
      </div>
      {protocol.assignments.length === 0 && (
        <div className="text-[12px] text-gray-400 mb-2">No reviewers assigned yet.</div>
      )}
      <ul className="space-y-1 mb-2">
        {protocol.assignments.map((a, i) => (
          <li key={i} className="text-[12px] text-gray-600">
            <span className="font-medium text-gray-800">{a.reviewer_name}</span>
            <span className="text-[#3B6D11] bg-[#EBF5E3] rounded px-1.5 py-0.5 ml-1.5 text-[11px]">
              {a.role}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <select
          value={personnelId}
          onChange={e => setPersonnelId(e.target.value)}
          aria-label="Assignee"
          className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        >
          {voters.map(v => <option key={v.id} value={v.id}>{v.name} — {v.role_name}</option>)}
          {voters.length === 0 && <option value="">No committee-eligible personnel</option>}
        </select>
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          aria-label="Assignment role"
          className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        >
          {ASSIGNMENT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          disabled={submitting || voters.length === 0}
          className="px-3 py-1.5 rounded border border-[#0176D3] text-[#0176D3] text-[13px] font-medium hover:bg-[#EBF5FC] disabled:opacity-50"
        >
          {submitting ? "Assigning…" : "Assign"}
        </button>
        {error && <div className="text-[12px] text-red-600 w-full">{error}</div>}
      </form>
    </div>
  );
}

function SectionComments({
  protocol,
  voters,
  onChanged,
}: {
  protocol: CommitteeProtocol;
  voters: Voter[];
  onChanged: () => void;
}) {
  const [personnelId, setPersonnelId] = useState<string>(String(voters[0]?.id ?? ""));
  const [section, setSection] = useState<string>(REVIEW_SECTIONS[0]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!personnelId && voters.length > 0) setPersonnelId(String(voters[0].id));
  }, [voters]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personnelId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.postComment(protocol.id, {
        personnel_id: Number(personnelId),
        section: section as never,
        comment: comment.trim(),
      });
      setComment("");
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-700 mb-2">
        <MessageSquareText size={13} className="text-[#0176D3]" />
        Section comments
      </div>
      {protocol.comments.length === 0 && (
        <div className="text-[12px] text-gray-400 mb-2">No section comments yet.</div>
      )}
      <ul className="space-y-1.5 mb-2">
        {protocol.comments.map(c => (
          <li key={c.id} className="text-[12px] text-gray-600">
            <span className="text-[#854F0B] bg-[#FBF0DF] rounded px-1.5 py-0.5 text-[11px] mr-1.5">
              {REVIEW_SECTION_LABELS[c.section]}
            </span>
            <span className="font-medium text-gray-800">{c.commenter_name}:</span> {c.comment}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={personnelId}
            onChange={e => setPersonnelId(e.target.value)}
            aria-label="Commenter"
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            {voters.map(v => <option key={v.id} value={v.id}>{v.name} — {v.role_name}</option>)}
            {voters.length === 0 && <option value="">No committee-eligible personnel</option>}
          </select>
          <select
            value={section}
            onChange={e => setSection(e.target.value)}
            aria-label="Comment section"
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            {REVIEW_SECTIONS.map(s => <option key={s} value={s}>{REVIEW_SECTION_LABELS[s]}</option>)}
          </select>
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Add section feedback…"
          rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        {error && <div className="text-[12px] text-red-600">{error}</div>}
        <button
          disabled={submitting || voters.length === 0 || comment.trim() === ""}
          className="px-3 py-1.5 rounded border border-[#854F0B] text-[#854F0B] text-[13px] font-medium hover:bg-[#FBF0DF] disabled:opacity-50"
        >
          {submitting ? "Posting…" : "Add comment"}
        </button>
      </form>
    </div>
  );
}

interface ProtocolVoteCardProps {
  protocol: CommitteeProtocol;
  voters: Voter[];
  onVoted: () => void;
}

function ProtocolVoteCard({ protocol, voters, onVoted }: ProtocolVoteCardProps) {
  const [voterId, setVoterId] = useState<string>(String(voters[0]?.id ?? ""));
  const [vote, setVote] = useState("Approve");
  const [comment, setComment] = useState("");
  const [method, setMethod] = useState<string>(protocol.review_method ?? "FCR");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!voterId && voters.length > 0) setVoterId(String(voters[0].id));
  }, [voters]);

  const changeMethod = async (value: string) => {
    setMethod(value);
    try {
      await api.setReviewMethod(protocol.id, value as never);
      onVoted();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.castVote(protocol.id, { personnel_id: Number(voterId), vote, comment: comment.trim() || null });
      setComment("");
      onVoted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[#0176D3] font-medium text-[13px]">
            <PawPrint size={13} className="text-gray-400" />
            {protocol.id}
          </div>
          <div className="text-gray-800 text-[13px] mt-0.5">{protocol.title}</div>
          <div className="text-gray-500 text-[12px] mt-0.5">{protocol.pi} · {protocol.species}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={protocol.status} />
          <select
            value={method}
            onChange={e => changeMethod(e.target.value)}
            aria-label="Review method"
            title="Review method: full committee (FCR) or designated member (DMR)"
            className={`rounded px-2 py-1 text-[11px] font-medium outline-none focus:ring-1 focus:ring-[#0176D3] ${
              method === "DMR"
                ? "bg-[#EBF5FC] text-[#0176D3] border border-[#9BCDF5]"
                : "bg-[#F3F4F6] text-gray-700 border border-gray-200"
            }`}
          >
            {REVIEW_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-gray-100">
        <VoteBar counts={protocol.counts} totalVotes={protocol.totalVotes} />
      </div>

      <form onSubmit={submit} className="px-4 py-3 space-y-2 border-b border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={voterId}
            onChange={e => setVoterId(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            {voters.map(v => <option key={v.id} value={v.id}>{v.name} — {v.role_name}</option>)}
            {voters.length === 0 && <option value="">No committee-eligible personnel</option>}
          </select>
          <select
            value={vote}
            onChange={e => setVote(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
          >
            {VOTE_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.value}</option>)}
          </select>
        </div>
        <input
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Comment (optional)"
          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-[13px] outline-none focus:border-[#0176D3]"
        />
        {error && <div className="text-[12px] text-red-600">{error}</div>}
        <button
          disabled={submitting || voters.length === 0}
          className="px-3 py-1.5 rounded bg-[#0176D3] text-white text-[13px] font-medium hover:bg-[#0b5cab] disabled:opacity-50"
        >
          {submitting ? "Casting vote…" : "Cast vote"}
        </button>
      </form>

      {protocol.votes.length > 0 && (
        <div className="border-b border-gray-100 divide-y divide-gray-100">
          {protocol.votes.map((v, i) => (
            <div key={i} className="px-4 py-2 text-[12px] text-gray-600">
              <span className="font-medium text-gray-800">{v.voter_name}</span> ({v.role_name}) voted{" "}
              <span className="font-medium">{v.vote}</span>
              {v.comment ? ` — "${v.comment}"` : ""}
            </div>
          ))}
        </div>
      )}

      <AssignReviewers protocol={protocol} voters={voters} onChanged={onVoted} />
      <SectionComments protocol={protocol} voters={voters} onChanged={onVoted} />
    </div>
  );
}

export default function CommitteePage() {
  const [protocols, setProtocols] = useState<CommitteeProtocol[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.listCommitteeProtocols(), api.listVoters()])
      .then(([p, v]) => { setProtocols(p); setVoters(v); setError(null); })
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <AppHeader active="committee" />

      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <Gavel size={18} className="text-[#0176D3]" />
          <h1 className="text-xl font-semibold text-gray-900">Full Committee Review</h1>
        </div>
        <p className="text-[13px] text-gray-500 mt-1">
          Protocols currently in Veterinary or IACUC Review. Pick the review method (full committee
          FCR or designated member DMR), assign reviewers, leave section-specific comments, and cast
          a vote — votes cast by the same person again will update, not duplicate.
        </p>
      </div>

      <div className="p-4 space-y-4">
        <AccessBanner mode="committee" committeePersonnelIds={voters.map(v => v.id)} />
        {loading && <div className="text-gray-400 text-[13px]">Loading…</div>}
        {error && <div className="text-red-600 text-[13px]">Couldn't load committee data: {error}</div>}
        {!loading && protocols.length === 0 && !error && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-400 text-[13px]">
            No protocols are currently in committee review.
          </div>
        )}
        {protocols.map(p => (
          <ProtocolVoteCard key={p.id} protocol={p} voters={voters} onVoted={load} />
        ))}
      </div>
    </div>
  );
}
