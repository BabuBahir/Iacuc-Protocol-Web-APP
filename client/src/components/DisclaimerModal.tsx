export default function DisclaimerModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[15px] font-semibold text-gray-900">Educational Demo — Not for Live Use</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close disclaimer"
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="text-[16px] leading-none">&#10005;</span>
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-[12px] text-gray-700 leading-relaxed list-disc pl-4">
          <li>
            This is a <strong> demonstration</strong> of IACUC workflow
            concepts — not a real compliance system.
          </li>
          <li>
            Do not enter real animal, personnel, or research data. All data shown is synthetic
            sample data, and no animals are or were involved.
          </li>
          <li>
            It provides no legal, regulatory, or compliance advice and creates no institutional
            record.
          </li>
          <li>
            The software is provided "as is" with no warranty. The authors accept no liability for
            any use of, or reliance on, the software or its output.
          </li>
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full bg-[#0176D3] text-white rounded px-4 py-2 text-[13px] font-medium hover:bg-[#0169b8]"
        >
          I understand
        </button>
      </div>
    </div>
  );
}
