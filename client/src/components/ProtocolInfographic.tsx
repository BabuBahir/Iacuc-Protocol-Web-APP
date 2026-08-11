import React, { useState } from "react";
import {
  Check, Info, Syringe, Shield, Users, Activity,
  Scale, Clock, MapPin, User, AlertCircle, ChevronRight,
  FlaskConical, HeartPulse, Mouse
} from "lucide-react";
import type { ProtocolDetail, ResearchStep, ProtocolPersonnelEntry } from "../types";

interface ProtocolInfographicProps {
  protocol: ProtocolDetail;
  personnel?: Record<string, ProtocolPersonnelEntry>;
}

const PAIN_COLORS: Record<string, string> = {
  "Category B": "bg-emerald-500",
  "Category C": "bg-emerald-600",
  "Category D": "bg-amber-500",
  "Category E": "bg-rose-600",
};

const PAIN_BG: Record<string, string> = {
  "Category B": "bg-emerald-50",
  "Category C": "bg-emerald-50",
  "Category D": "bg-amber-50",
  "Category E": "bg-rose-50",
};

const PAIN_TEXT: Record<string, string> = {
  "Category B": "text-emerald-700",
  "Category C": "text-emerald-800",
  "Category D": "text-amber-700",
  "Category E": "text-rose-700",
};

export default function ProtocolInfographic({ protocol, personnel = {} }: ProtocolInfographicProps) {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  const stageIndex = Math.max(protocol.stages.indexOf(protocol.status), 0);
  
  // Calculate Pain Distribution
  const painCounts: Record<string, number> = {};
  protocol.research_steps.forEach(step => {
    painCounts[step.pain_category] = (painCounts[step.pain_category] || 0) + 1;
  });
  const totalSteps = protocol.research_steps.length;

  // Calculate Personnel Readiness
  const personnelEntries = Object.values(personnel);
  const compliantCount = personnelEntries.filter(p => p.compliance.compliant).length;
  const readinessScore = personnelEntries.length > 0 
    ? Math.round((compliantCount / personnelEntries.length) * 100) 
    : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
      {/* 1. Workflow Header */}
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Activity size={16} className="text-[#0176D3]" />
            Protocol Lifecycle
          </h3>
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Review Pipeline</span>
        </div>
        <div className="flex items-center">
          {protocol.stages.map((stage, i) => {
            const isDone = i < stageIndex;
            const isActive = i === stageIndex;
            return (
              <React.Fragment key={stage}>
                <div className="relative flex flex-col items-center group cursor-help">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${isDone ? "bg-[#97C459] border-[#97C459] text-white" : 
                      isActive ? "bg-white border-[#0176D3] text-[#0176D3] ring-4 ring-blue-50" : 
                      "bg-white border-gray-200 text-gray-400"}
                  `}>
                    {isDone ? <Check size={16} strokeWidth={3} /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </div>
                  <span className={`
                    absolute -bottom-6 whitespace-nowrap text-[10px] font-bold uppercase tracking-tighter transition-colors
                    ${isActive ? "text-[#0176D3]" : isDone ? "text-gray-700" : "text-gray-400"}
                  `}>
                    {stage}
                  </span>
                  
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 bg-gray-900 text-white text-[11px] p-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
                    <p className="font-bold mb-1">{stage}</p>
                    <p className="text-gray-300 leading-tight">
                      {stage === "Veterinary Review" ? "Focused on animal welfare, pain mitigation, and clinical oversight." :
                       stage === "IACUC Review" ? "Comprehensive ethical review by the institutional committee." :
                       `Protocol stage: ${stage.toLowerCase()}.`}
                    </p>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </div>
                {i < protocol.stages.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < stageIndex ? "bg-[#97C459]" : "bg-gray-200"}`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="h-6"></div> {/* Spacer for absolute labels */}
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 2. Species & Animals Card */}
        <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-full border-2 border-blue-200 flex items-center justify-center text-blue-600 shadow-inner">
            <Mouse size={32} strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Animal Subjects</div>
            <div className="text-2xl font-black text-gray-900">{protocol.animals || 0}</div>
            <div className="text-sm font-semibold text-gray-600 capitalize">{protocol.species || "Unspecified"}</div>
          </div>
        </div>

        {/* 3. Pain Distribution Card */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex justify-between">
            <span>Pain Categories</span>
            <Shield size={12} className="text-amber-500" />
          </div>
          <div className="flex h-4 w-full rounded-full overflow-hidden bg-gray-200 mb-3 shadow-inner">
            {Object.entries(painCounts).map(([cat, count]) => (
              <div 
                key={cat} 
                className={`${PAIN_COLORS[cat] || "bg-gray-400"} transition-all`} 
                style={{ width: `${(count / totalSteps) * 100}%` }}
                title={`${cat}: ${count} steps`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(painCounts).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${PAIN_COLORS[cat] || "bg-gray-400"}`}></div>
                <span className="text-[11px] font-bold text-gray-700">{cat} ({count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Personnel Readiness Score */}
        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest">Team Readiness</div>
              <div className="text-2xl font-black text-emerald-900">{readinessScore}%</div>
              <div className="text-[11px] font-medium text-emerald-700">Credentialed Personnel</div>
            </div>
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-emerald-100" />
                <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray={126} strokeDashoffset={126 - (126 * readinessScore) / 100} className="text-emerald-600" />
              </svg>
              <Users size={14} className="absolute text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Study Timeline (Gantt-lite) */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2">
            <Clock size={14} className="text-blue-500" />
            Research Plan Timeline
          </h4>
          <span className="text-[10px] text-gray-400">Click steps for details</span>
        </div>
        
        <div className="space-y-3">
          {protocol.research_steps.map((step, i) => {
            const isSelected = selectedStep === i;
            return (
              <div key={i} className="relative">
                <button 
                  onClick={() => setSelectedStep(isSelected ? null : i)}
                  className={`
                    w-full text-left p-3 rounded-lg border transition-all flex items-center gap-4
                    ${isSelected ? "bg-white border-blue-400 ring-2 ring-blue-50 shadow-md translate-x-1" : "bg-white border-gray-100 hover:border-gray-300 shadow-sm hover:shadow"}
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded shadow-sm flex items-center justify-center shrink-0 font-bold text-sm
                    ${PAIN_BG[step.pain_category] || "bg-gray-100"} ${PAIN_TEXT[step.pain_category] || "text-gray-600"}
                  `}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gray-900 truncate">{step.description}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock size={11} /> {step.duration} · {step.frequency}
                      </div>
                      {step.anesthesia === "Yes" && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-600 font-bold">
                          <Syringe size={11} /> Anesthesia
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin size={11} /> {step.location}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-gray-300 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                </button>

                {isSelected && (
                  <div className="mt-2 ml-12 p-4 bg-gray-50 border border-gray-200 rounded-lg animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Personnel Responsible</div>
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-700">
                          <User size={12} className="text-gray-400" /> {step.personnel}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Species/Strain</div>
                        <div className="text-[12px] font-semibold text-gray-700">{step.species}</div>
                      </div>
                      {step.notes && (
                        <div className="sm:col-span-2">
                          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Procedure Notes</div>
                          <div className="text-[12px] text-gray-600 leading-relaxed italic border-l-2 border-gray-200 pl-3">{step.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Harm-Benefit Balance Card */}
      <div className="bg-gray-900 p-6 text-white">
        <div className="flex items-center gap-2 mb-6">
          <Scale size={18} className="text-amber-400" />
          <h4 className="text-xs font-black uppercase tracking-widest">Ethical Harm–Benefit Justification</h4>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
          {/* Vertical Divider for Desktop */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2"></div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertCircle size={16} />
              <span className="text-[11px] font-black uppercase tracking-wider">Welfare Impact (Harm)</span>
            </div>
            <p className="text-[13px] text-gray-300 leading-relaxed italic">
              {protocol.harm_benefit_analysis || "The animal usage in this study is justified by the scientific outcomes expected..."}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <div className="bg-rose-950/40 border border-rose-900/50 px-2 py-1 rounded text-[10px] font-bold text-rose-300">
                {protocol.animals} Subjects
              </div>
              <div className="bg-rose-950/40 border border-rose-900/50 px-2 py-1 rounded text-[10px] font-bold text-rose-300">
                {protocol.pain_category} (Max)
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <FlaskConical size={16} />
              <span className="text-[11px] font-black uppercase tracking-wider">Scientific Contribution (Benefit)</span>
            </div>
            <p className="text-[13px] text-gray-300 leading-relaxed">
              <span className="text-white font-bold block mb-1">Lay Purpose:</span>
              {protocol.purpose_summary || "This study aims to advance our understanding of..."}
            </p>
            <div className="bg-emerald-950/40 border border-emerald-900/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <HeartPulse size={14} className="text-emerald-400" />
                <span className="text-[11px] font-bold text-emerald-300">Clinical/Scientific Significance</span>
              </div>
              <p className="text-[12px] text-gray-400 leading-snug">
                {protocol.scientific_summary?.substring(0, 150)}...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
