import { useNavigate, Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import ProtocolForm from "../components/ProtocolForm";
import { api } from "../api";
import type { ProtocolFormValues } from "../types";

export default function CreatePage() {
  const navigate = useNavigate();

  const submit = async (values: ProtocolFormValues) => {
    const created = await api.createProtocol(values);
    navigate(`/protocols/${created.id}`);
  };

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 text-[12px] text-[#0176D3] flex items-center gap-1">
        <Link to="/" className="flex items-center gap-1 hover:underline">
          <ChevronLeft size={14} />IACUC Protocols
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">New protocol</span>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">New protocol</h1>

        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-2.5 border-b border-gray-100 font-semibold text-gray-800 text-sm">
            IACUC Protocol Application
          </div>
          <ProtocolForm
            initialValues={{}}
            showProtocolNumber
            submitLabel="Create protocol"
            onCancel={() => navigate("/")}
            onSubmit={submit}
          />
        </div>
      </div>
    </div>
  );
}
