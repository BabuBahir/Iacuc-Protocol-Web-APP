import React from "react";

const STATUS_STYLES = {
  "IACUC Review": "bg-[#FAEEDA] text-[#854F0B]",
  "Veterinary Review": "bg-[#FAEEDA] text-[#854F0B]",
  Approved: "bg-[#EAF3DE] text-[#3B6D11]",
  Active: "bg-[#E6F1FB] text-[#185FA5]",
  Draft: "bg-gray-100 text-gray-600",
  Submitted: "bg-gray-100 text-gray-600",
  "Expiring soon": "bg-[#FCEBEB] text-[#A32D2D]",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
