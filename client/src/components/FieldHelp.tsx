import { useState } from "react";
import { Info } from "lucide-react";

// Reusable "info icon" help affordance (issue #90). Renders an (i) glyph next
// to a form field label that reveals a tooltip with guidance on hover, focus,
// and click. Pure client-side and fully keyboard-accessible: the trigger is a
// real <button> (type="button" so it never submits the form), the tooltip text
// doubles as its aria-label, and the popup carries role="tooltip".
//
// Place this OUTSIDE the <label> element (e.g. in a flex row with the label) so
// the label's accessible name stays exactly the field's label text — nesting a
// button with an aria-label inside a label would concatenate into the label's
// name and break getByLabelText("Title")-style queries.
export default function FieldHelp({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative ml-1 inline-flex items-start"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={text}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center text-gray-400 hover:text-[#0176D3] focus:text-[#0176D3] focus:outline-none"
      >
        <Info size={12} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-1.5 w-64 -translate-x-1/2 rounded bg-gray-900 px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal leading-relaxed text-white shadow"
        >
          {text}
        </span>
      )}
    </span>
  );
}
