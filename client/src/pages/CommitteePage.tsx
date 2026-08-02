import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, Gavel, PawPrint, ThumbsUp, ThumbsDown, PauseCircle, PenLine, type LucideIcon } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { api } from "../api";
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

interface ProtocolVoteCardProps {
  protocol: CommitteeProtocol;
  voters: Voter[];
  onVoted: () => void;
}

function ProtocolVoteCard({ protocol, voters, onVoted }: ProtocolVoteCardProps) {
  const [voterId, setVoterId] = useState<string>(String(voters[0]?.id ?? ""));
  const [vote, setVote] = useState("Approve");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!voterId && voters.length > 0) setVoterId(String(voters[0].id));
  }, [voters]);

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
        <StatusBadge status={protocol.status} />
      </div>

      <div className="px-4 py-3 border-b border-gray-100">
        <VoteBar counts={protocol.counts} totalVotes={protocol.totalVotes} />
      </div>

      <form onSubmit={submit} className="px-4 py-3 space-y-2">
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
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {protocol.votes.map((v, i) => (
            <div key={i} className="px-4 py-2 text-[12px] text-gray-600 flex items-center justify-between">
              <span><span className="font-medium text-gray-800">{v.voter_name}</span> ({v.role_name}) voted <span className="font-medium">{v.vote}</span>{v.comment ? ` — "${v.comment}"` : ""}</span>
            </div>
          ))}
        </div>
      )}
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
      <div className="bg-[#032D60] text-white px-4 py-2 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-[14px] hover:opacity-90">
          <LayoutGrid size={16} />
          IACUC Protocols
        </Link>
        <div className="flex items-center gap-5 text-[13px] text-gray-200 ml-4">
          <Link to="/" className="hover:text-white">Protocols</Link>
          <span className="text-white border-b-2 border-white pb-2 -mb-2 pt-2">Committee</span>
          <Link to="/admin" className="hover:text-white">Admin</Link>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <Gavel size={18} className="text-[#0176D3]" />
          <h1 className="text-xl font-semibold text-gray-900">Full Committee Review</h1>
        </div>
        <p className="text-[13px] text-gray-500 mt-1">
          Protocols currently in Veterinary or IACUC Review. Committee-eligible personnel can
          cast an FCR vote below — votes cast by the same person again will update, not duplicate.
        </p>
      </div>

      <div className="p-4 space-y-4">
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
