// OpenAPI 3.0 description of every implemented endpoint, served by
// swagger-ui-express at /api-docs (and raw at /api-docs/spec.json).
// Grouped by the same tags as the README's API reference. The "Planned /
// future endpoints" in README are intentionally absent — the spec only
// documents endpoints that actually exist.

const REF = name => ({ $ref: `#/components/schemas/${name}` });

const json = (schema, description) => ({
  description,
  content: { "application/json": { schema } },
});

const ok = description => ({ 200: json({ type: "object", properties: { ok: { type: "boolean" } } }, description) });

const notFound = () => ({
  404: json(REF("Error"), "Protocol or resource not found"),
});

const protocolIdParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Protocol number, e.g. IACUC-2026-0142",
};

const numericPathParam = (name, description) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "integer" },
  description,
});

const errorResponses = {
  400: json(REF("Error"), "Bad request — missing/unknown field or invalid enum"),
  404: json(REF("Error"), "Resource not found"),
  409: json(REF("Error"), "Conflict (e.g. duplicate id)"),
  403: json(REF("Error"), "Forbidden (e.g. voter not committee-eligible)"),
};

const schemas = {
  Error: {
    type: "object",
    properties: { error: { type: "string" } },
  },

  ResearchStep: {
    type: "object",
    required: ["description"],
    properties: {
      description: { type: "string" },
      duration: { type: "string", description: "e.g. 7 days, ~30 min" },
      frequency: {
        type: "string",
        enum: ["Once", "Daily", "Weekly", "Monthly", "As needed", "Continuous"],
      },
      species: { type: "string" },
      pain_category: { type: "string", enum: ["Category A", "Category B", "Category C", "Category D", "Category E"] },
      anesthesia: { type: "string", enum: ["Yes", "No"] },
      location: { type: "string" },
      personnel: { type: "string" },
      notes: { type: "string" },
    },
  },

  Protocol: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      pi: { type: "string" },
      pi_proxy: { type: ["string", "null"] },
      ptm_member: { type: ["string", "null"] },
      protocol_type: {
        type: ["string", "null"],
        enum: ["Research", "Teaching", "Breeding", "Animal care / maintenance", "Other", null],
      },
      species: { type: ["string", "null"] },
      status: { type: "string" },
      animals: { type: ["integer", "null"] },
      pain_category: { type: ["string", "null"], enum: ["Category A", "Category B", "Category C", "Category D", "Category E", null] },
      anesthesia_required: { type: ["integer", "null"], enum: [0, 1] },
      housing: { type: ["string", "null"] },
      disposal: { type: ["string", "null"] },
      npg: { type: ["string", "null"], description: "Non-pharmaceutical-grade compounds, or null when not used" },
      research_steps: { type: "array", items: REF("ResearchStep") },
      purpose_summary: { type: ["string", "null"] },
      harm_benefit_analysis: { type: ["string", "null"] },
      scientific_summary: { type: ["string", "null"] },
      review_method: { type: ["string", "null"], enum: ["FCR", "DMR", null] },
      submitted: { type: ["string", "null"], format: "date" },
      expires: { type: ["string", "null"], format: "date" },
    },
  },

  ProtocolDetail: {
    allOf: [
      REF("Protocol"),
      {
        type: "object",
        properties: {
          stages: { type: "array", items: { type: "string" } },
          related: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
        },
      },
    ],
  },

  ProtocolInput: {
    type: "object",
    required: ["id", "title", "pi"],
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      pi: { type: "string" },
      pi_proxy: { type: ["string", "null"] },
      ptm_member: { type: ["string", "null"] },
      protocol_type: { type: ["string", "null"] },
      species: { type: ["string", "null"] },
      animals: { type: ["integer", "null"] },
      pain_category: { type: ["string", "null"] },
      anesthesia_required: { type: ["boolean", "integer", "null"] },
      housing: { type: ["string", "null"] },
      disposal: { type: ["string", "null"] },
      npg: { type: ["string", "null"] },
      research_steps: { type: "array", items: REF("ResearchStep") },
      purpose_summary: { type: ["string", "null"] },
      harm_benefit_analysis: { type: ["string", "null"] },
      scientific_summary: { type: ["string", "null"] },
    },
  },

  ProtocolUpdate: {
    type: "object",
    properties: {
      title: { type: "string" },
      pi: { type: "string" },
      pi_proxy: { type: ["string", "null"] },
      ptm_member: { type: ["string", "null"] },
      protocol_type: { type: ["string", "null"] },
      species: { type: ["string", "null"] },
      status: { type: "string" },
      animals: { type: ["integer", "null"] },
      pain_category: { type: ["string", "null"] },
      anesthesia_required: { type: ["integer", "null"] },
      housing: { type: ["string", "null"] },
      disposal: { type: ["string", "null"] },
      npg: { type: ["string", "null"] },
      research_steps: { type: "array", items: REF("ResearchStep") },
      submitted: { type: ["string", "null"], format: "date" },
      expires: { type: ["string", "null"], format: "date" },
      purpose_summary: { type: ["string", "null"] },
      harm_benefit_analysis: { type: ["string", "null"] },
      scientific_summary: { type: ["string", "null"] },
    },
  },

  Summary: {
    type: "object",
    properties: {
      active: { type: "integer" },
      pendingReview: { type: "integer" },
      expiringSoon: { type: "integer" },
      approvedThisQuarter: { type: "integer" },
    },
  },

  // ---- Appendix A ----

  Procedure: {
    type: "object",
    properties: {
      procedure_key: { type: "string" },
      label: { type: "string" },
      checked: { type: "boolean" },
      description: { type: "string" },
      surgical_description: { type: "string" },
      aseptic_preparation: { type: "string" },
      analgesia_level: { type: "string", enum: ["", "None", "Mild", "Moderate", "Profound"] },
      postop_care: { type: "string" },
    },
  },

  ProceduresBody: {
    type: "object",
    required: ["procedures"],
    properties: { procedures: { type: "array", items: REF("Procedure") } },
  },

  Drug: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      reason_for_use: { type: ["string", "null"] },
      drug: { type: "string" },
      dose: { type: ["string", "null"] },
      route: { type: ["string", "null"] },
      duration: { type: ["string", "null"] },
    },
  },

  DrugInput: {
    type: "object",
    required: ["drug"],
    properties: {
      reason_for_use: { type: "string" },
      drug: { type: "string" },
      dose: { type: "string" },
      route: { type: "string" },
      duration: { type: "string" },
    },
  },

  AnimalUseRow: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      species_strain: { type: "string" },
      sex: { type: ["string", "null"] },
      approximate_age: { type: ["string", "null"] },
      max_count: { type: ["integer", "null"] },
    },
  },

  AnimalUseInput: {
    type: "object",
    required: ["species_strain"],
    properties: {
      species_strain: { type: "string" },
      sex: { type: "string" },
      approximate_age: { type: "string" },
      max_count: { type: "integer" },
    },
  },

  Experiment: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      name: { type: "string" },
      description: { type: ["string", "null"] },
      multiple_surgical_events: { type: ["integer", "null"], enum: [0, 1] },
      humane_endpoints: { type: ["string", "null"] },
      persistent_clinical_signs_justification: { type: ["string", "null"] },
      monitoring_plan: { type: ["string", "null"] },
      husbandry_exceptions: { type: ["string", "null"] },
    },
  },

  ExperimentInput: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      multiple_surgical_events: { type: "boolean" },
      humane_endpoints: { type: "string" },
      persistent_clinical_signs_justification: { type: "string" },
      monitoring_plan: { type: "string" },
      husbandry_exceptions: { type: "string" },
    },
  },

  RrrEntry: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      rrr_type: { type: "string", enum: ["replacement", "refinement", "reduction"] },
      method: { type: "string" },
      explanation: { type: ["string", "null"] },
    },
  },

  RrrInput: {
    type: "object",
    required: ["rrr_type", "method"],
    properties: {
      rrr_type: { type: "string", enum: ["replacement", "refinement", "reduction"] },
      method: { type: "string" },
      explanation: { type: "string" },
    },
  },

  Alternatives: {
    type: "object",
    properties: {
      protocol_id: { type: "string" },
      lit_databases: { type: ["string", "null"] },
      lit_years_from: { type: ["string", "null"] },
      lit_years_to: { type: ["string", "null"] },
      lit_search_date: { type: ["string", "null"], format: "date" },
      lit_keywords: { type: ["string", "null"] },
      lit_summary: { type: ["string", "null"] },
      colleague_name: { type: ["string", "null"] },
      colleague_date: { type: ["string", "null"], format: "date" },
      colleague_notes: { type: ["string", "null"] },
      av_consult_date: { type: ["string", "null"], format: "date" },
      av_consultation_required: { type: "boolean", description: "Derived server-side from the pain category (D/E)" },
    },
  },

  ValidationSection: {
    type: "object",
    properties: {
      complete: { type: "boolean" },
      missing: { type: "array", items: { type: "string" } },
    },
  },

  Validation: {
    type: "object",
    properties: {
      overall: { type: "boolean" },
      avRequired: { type: "boolean" },
      sections: {
        type: "object",
        properties: {
          summaries: REF("ValidationSection"),
          procedures: REF("ValidationSection"),
          drugs: REF("ValidationSection"),
          animal_use: REF("ValidationSection"),
          experiments: REF("ValidationSection"),
          alternatives: REF("ValidationSection"),
        },
      },
    },
  },

  // ---- animal usage register ----

  AnimalUsageTransaction: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      transaction_date: { type: "string", format: "date" },
      species_strain: { type: "string" },
      pain_level: { type: ["string", "null"], enum: ["B", "C", "D", "E", null] },
      quantity: { type: "integer" },
      type: { type: "string", enum: ["order", "use"] },
      procedure_key: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
    },
  },

  AnimalUsageInput: {
    type: "object",
    required: ["transaction_date", "species_strain", "quantity"],
    properties: {
      transaction_date: { type: "string", format: "date" },
      species_strain: { type: "string" },
      pain_level: { type: "string", enum: ["B", "C", "D", "E"] },
      quantity: { type: "integer", exclusiveMinimum: 0 },
      type: { type: "string", enum: ["order", "use"] },
      procedure_key: { type: "string" },
      notes: { type: "string" },
    },
  },

  SpeciesTally: {
    type: "object",
    properties: {
      species_strain: { type: "string" },
      allowance: { type: "integer" },
      ordered: { type: "integer" },
      used: { type: "integer" },
      remaining: { type: "integer" },
      over_allowance: { type: "boolean" },
    },
  },

  UsageTallyRow: {
    type: "object",
    properties: { count: { type: "integer" } },
    additionalProperties: true,
  },

  AnimalUsageLedger: {
    type: "object",
    properties: {
      transactions: { type: "array", items: REF("AnimalUsageTransaction") },
      by_species: { type: "array", items: REF("SpeciesTally") },
      by_pain_category: { type: "array", items: REF("UsageTallyRow") },
      by_procedure: { type: "array", items: REF("UsageTallyRow") },
    },
  },

  // ---- admin ----

  Species: {
    type: "object",
    properties: { id: { type: "integer" }, name: { type: "string" } },
  },

  SpeciesInput: {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string" } },
  },

  Role: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      is_committee: { type: "integer", enum: [0, 1] },
    },
  },

  RoleInput: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string" },
      is_committee: { type: "integer", enum: [0, 1] },
    },
  },

  Personnel: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      email: { type: ["string", "null"] },
      role_id: { type: "integer" },
      role_name: { type: "string" },
      is_committee: { type: "integer", enum: [0, 1] },
    },
  },

  PersonnelInput: {
    type: "object",
    required: ["name", "role_id"],
    properties: {
      name: { type: "string" },
      email: { type: ["string", "null"] },
      role_id: { type: "integer" },
    },
  },

  // ---- committee / review workflow ----

  Vote: {
    type: "object",
    properties: {
      vote: { type: "string", enum: ["Approve", "Request Modifications", "Table", "Withhold Approval"] },
      comment: { type: ["string", "null"] },
      voter_name: { type: "string" },
      role_name: { type: "string" },
      voted_at: { type: "string", format: "date-time" },
    },
  },

  Tally: {
    type: "object",
    properties: {
      votes: { type: "array", items: REF("Vote") },
      counts: { type: "object", additionalProperties: { type: "integer" } },
      totalVotes: { type: "integer" },
    },
  },

  Assignment: {
    type: "object",
    properties: {
      role: { type: "string", enum: ["Primary Reviewer", "Secondary Reviewer", "Designated Member"] },
      assigned_at: { type: "string", format: "date-time" },
      personnel_id: { type: "integer" },
      reviewer_name: { type: "string" },
    },
  },

  ReviewComment: {
    type: "object",
    properties: {
      id: { type: "integer" },
      section: {
        type: "string",
        enum: ["overall", "summaries", "procedures", "drugs", "animal_use", "experiments", "alternatives"],
      },
      comment: { type: "string" },
      created_at: { type: "string", format: "date-time" },
      personnel_id: { type: "integer" },
      commenter_name: { type: "string" },
    },
  },

  CommitteeProtocol: {
    allOf: [
      REF("Protocol"),
      {
        type: "object",
        properties: {
          votes: { type: "array", items: REF("Vote") },
          counts: { type: "object", additionalProperties: { type: "integer" } },
          totalVotes: { type: "integer" },
          assignments: { type: "array", items: REF("Assignment") },
          comments: { type: "array", items: REF("ReviewComment") },
        },
      },
    ],
  },

  Voter: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      role_name: { type: "string" },
    },
  },

  VoteInput: {
    type: "object",
    required: ["personnel_id", "vote"],
    properties: {
      personnel_id: { type: "integer" },
      vote: { type: "string", enum: ["Approve", "Request Modifications", "Table", "Withhold Approval"] },
      comment: { type: "string" },
    },
  },

  AssignmentInput: {
    type: "object",
    required: ["personnel_id", "role"],
    properties: {
      personnel_id: { type: "integer" },
      role: { type: "string", enum: ["Primary Reviewer", "Secondary Reviewer", "Designated Member"] },
    },
  },

  CommentInput: {
    type: "object",
    required: ["personnel_id", "section", "comment"],
    properties: {
      personnel_id: { type: "integer" },
      section: {
        type: "string",
        enum: ["overall", "summaries", "procedures", "drugs", "animal_use", "experiments", "alternatives"],
      },
      comment: { type: "string" },
    },
  },

  ReviewMethodInput: {
    type: "object",
    required: ["review_method"],
    properties: { review_method: { type: "string", enum: ["FCR", "DMR"] } },
  },

  // ---- personnel compliance ----

  ComplianceStatus: {
    type: "object",
    properties: {
      training_status: { type: "string", enum: ["Current", "Expired", "No records"] },
      ohsp_status: { type: "string", enum: ["Pending", "Cleared", "Denied"] },
      compliant: { type: "boolean" },
    },
  },

  PersonnelCompliance: {
    allOf: [
      { type: "object", properties: { id: { type: "integer" }, name: { type: "string" }, role_name: { type: "string" } } },
      REF("ComplianceStatus"),
    ],
  },

  TrainingRecord: {
    type: "object",
    properties: {
      id: { type: "integer" },
      personnel_id: { type: "integer" },
      course: { type: "string" },
      completed_date: { type: "string", format: "date" },
      expires_date: { type: ["string", "null"], format: "date" },
      status: { type: "string", enum: ["Current", "Expired"] },
    },
  },

  TrainingInput: {
    type: "object",
    required: ["course", "completed_date"],
    properties: {
      course: { type: "string" },
      completed_date: { type: "string", format: "date" },
      expires_date: { type: "string", format: "date" },
    },
  },

  TrainingResponse: {
    type: "object",
    properties: {
      personnel: {
        type: "object",
        properties: { id: { type: "integer" }, name: { type: "string" }, role_name: { type: "string" } },
      },
      courses: { type: "array", items: REF("TrainingRecord") },
      overall_status: { type: "string", enum: ["Current", "Expired", "No records"] },
    },
  },

  OhspRecord: {
    type: "object",
    properties: {
      personnel_id: { type: "integer" },
      status: { type: "string", enum: ["Pending", "Cleared", "Denied"] },
      reviewed_date: { type: ["string", "null"], format: "date" },
      notes: { type: ["string", "null"] },
    },
  },

  OhspInput: {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["Pending", "Cleared", "Denied"] },
      reviewed_date: { type: "string", format: "date" },
      notes: { type: "string" },
    },
  },

  ProtocolPersonnelEntry: {
    type: "object",
    properties: {
      label: { type: "string" },
      name: { type: "string" },
      role: { type: "string" },
      personnel_id: { type: ["integer", "null"] },
      compliance: { type: ["object", "null"], description: "Null when the person has no matching profile" },
    },
  },

  ProtocolPersonnel: {
    type: "object",
    properties: {
      protocol_id: { type: "string" },
      personnel: { type: "array", items: REF("ProtocolPersonnelEntry") },
      all_compliant: { type: "boolean" },
    },
  },

  // ---- Domain F: facilities & semi-annual inspections ----

  Facility: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      type: { type: "string", enum: ["Housing Room", "Lab", "Surgical Suite"] },
      species: { type: ["string", "null"], description: "Species housed/used there (comma-separated)" },
      created_at: { type: "string", format: "date-time" },
    },
  },

  FacilityInput: {
    type: "object",
    required: ["name", "type"],
    properties: {
      name: { type: "string" },
      type: { type: "string", enum: ["Housing Room", "Lab", "Surgical Suite"] },
      species: { type: "string" },
    },
  },

  Deficiency: {
    type: "object",
    properties: {
      id: { type: "integer" },
      inspection_id: { type: "integer" },
      severity: { type: "string", enum: ["Minor", "Major"] },
      description: { type: "string" },
      remediation_deadline: { type: ["string", "null"], format: "date" },
      remediated_at: { type: ["string", "null"], format: "date-time" },
    },
  },

  DeficiencyInput: {
    type: "object",
    required: ["severity", "description"],
    properties: {
      severity: { type: "string", enum: ["Minor", "Major"] },
      description: { type: "string" },
      remediation_deadline: { type: "string", format: "date" },
    },
  },

  Inspection: {
    type: "object",
    properties: {
      id: { type: "integer" },
      facility_id: { type: "integer" },
      facility_name: { type: ["string", "null"] },
      inspection_date: { type: "string", format: "date" },
      report: { type: ["string", "null"] },
      result: { type: "string", enum: ["Pending", "Pass", "Fail", "Re-inspection required"] },
      created_at: { type: "string", format: "date-time" },
    },
  },

  InspectionDetail: {
    allOf: [
      REF("Inspection"),
      { type: "object", properties: { deficiencies: { type: "array", items: REF("Deficiency") } } },
    ],
  },

  InspectionInput: {
    type: "object",
    required: ["facility_id", "inspection_date"],
    properties: {
      facility_id: { type: "integer" },
      inspection_date: { type: "string", format: "date" },
      report: { type: "string" },
      result: { type: "string", enum: ["Pending", "Pass", "Fail", "Re-inspection required"] },
    },
  },

  // ---- Domain E: PAM & incident reporting ----

  Incident: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: ["string", "null"] },
      type: { type: "string", enum: ["Adverse Event", "Deviation", "Noncompliance", "Unanticipated Problem"] },
      description: { type: "string" },
      severity: { type: "string", enum: ["Minor", "Major", "Immediate"] },
      status: { type: "string", enum: ["Open", "CAPA", "Closed"] },
      corrective_action: { type: ["string", "null"], description: "The CAPA plan" },
      closed_at: { type: ["string", "null"], format: "date-time" },
      reported_by: { type: ["integer", "null"] },
      reported_by_name: { type: ["string", "null"] },
      assigned_to: { type: ["integer", "null"] },
      assigned_to_name: { type: ["string", "null"] },
      created_at: { type: "string", format: "date-time" },
    },
  },

  IncidentInput: {
    type: "object",
    required: ["type", "description"],
    properties: {
      protocol_id: { type: "string" },
      type: { type: "string", enum: ["Adverse Event", "Deviation", "Noncompliance", "Unanticipated Problem"] },
      description: { type: "string" },
      severity: { type: "string", enum: ["Minor", "Major", "Immediate"] },
      reported_by: { type: "integer", description: "personnel_id" },
      assigned_to: { type: "integer", description: "personnel_id" },
    },
  },

  IncidentUpdate: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["Open", "CAPA", "Closed"] },
      corrective_action: { type: ["string", "null"], description: "Required before an incident can move to CAPA/Closed" },
      assigned_to: { type: ["integer", "null"], description: "personnel_id" },
    },
  },

  PamAudit: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      audit_date: { type: "string", format: "date" },
      auditor_id: { type: ["integer", "null"] },
      auditor_name: { type: ["string", "null"] },
      site_visits: { type: ["string", "null"] },
      findings: { type: ["string", "null"] },
      report: { type: ["string", "null"] },
      created_at: { type: "string", format: "date-time" },
    },
  },

  PamAuditInput: {
    type: "object",
    required: ["audit_date"],
    properties: {
      audit_date: { type: "string", format: "date" },
      auditor_id: { type: "integer" },
      site_visits: { type: "string" },
      findings: { type: "string" },
      report: { type: "string" },
    },
  },

  // ---- Domain B: amendments & annual renewals ----

  AmendmentChange: {
    type: "object",
    properties: {
      id: { type: "integer" },
      amendment_id: { type: "integer" },
      section: { type: "string", enum: ["summaries", "procedures", "drugs", "animal_use", "experiments", "alternatives", "research_plan"] },
      field: { type: "string" },
      previous_value: { type: ["string", "null"] },
      new_value: { type: ["string", "null"] },
      created_at: { type: "string", format: "date-time" },
    },
  },

  AmendmentChangeInput: {
    type: "object",
    required: ["section", "field"],
    properties: {
      section: { type: "string", enum: ["summaries", "procedures", "drugs", "animal_use", "experiments", "alternatives", "research_plan"] },
      field: { type: "string" },
      previous_value: { type: "string" },
      new_value: { type: "string" },
    },
  },

  Amendment: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      reason: { type: "string", description: "Reason for Change — required when starting an amendment" },
      status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
      created_at: { type: "string", format: "date-time" },
      changes: { type: "array", items: REF("AmendmentChange") },
    },
  },

  AmendmentInput: {
    type: "object",
    required: ["reason"],
    properties: { reason: { type: "string" } },
  },

  AmendmentDecision: {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["Approved", "Rejected"] },
      expiration_date: { type: "string", format: "date", description: "Used when approving; defaults to +365 days" },
    },
  },

  ProtocolVersion: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      version_number: { type: "string", description: "Zero-padded, e.g. '0001'" },
      source: { type: "string", enum: ["New Document", "Amendment Document", "De Novo Document"] },
      approved_date: { type: ["string", "null"], format: "date" },
      expiration_date: { type: ["string", "null"], format: "date" },
      version_date: { type: "string", format: "date-time" },
    },
  },

  Renewal: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      type: { type: "string", enum: ["Continuing Review", "De Novo Review"] },
      status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
      submitted_date: { type: "string", format: "date-time" },
      decision_date: { type: ["string", "null"], format: "date" },
      approved_until: { type: ["string", "null"], format: "date" },
    },
  },

  RenewalInput: {
    type: "object",
    required: ["type"],
    properties: { type: { type: "string", enum: ["Continuing Review", "De Novo Review"] } },
  },

  RenewalDecision: {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["Approved", "Rejected"] },
      approved_until: { type: "string", format: "date", description: "Required when approving" },
    },
  },

  ProtocolTransfer: {
    type: "object",
    properties: {
      id: { type: "integer" },
      protocol_id: { type: "string" },
      protocol_title: { type: ["string", "null"] },
      from_pi: { type: "string", description: "Snapshot of the protocol PI at request time" },
      to_personnel_id: { type: "integer" },
      to_name: { type: ["string", "null"] },
      reason: { type: "string" },
      status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
      created_at: { type: "string", format: "date-time" },
      decision_date: { type: ["string", "null"], format: "date" },
    },
  },

  TransferInput: {
    type: "object",
    required: ["to_personnel_id", "reason"],
    properties: {
      to_personnel_id: { type: "integer" },
      reason: { type: "string", description: "Reason for transfer — required" },
    },
  },

  TransferBulkInput: {
    type: "object",
    required: ["protocol_ids", "to_personnel_id", "reason"],
    properties: {
      protocol_ids: { type: "array", items: { type: "string" }, description: "One or more protocol numbers" },
      to_personnel_id: { type: "integer" },
      reason: { type: "string" },
    },
  },

  TransferDecision: {
    type: "object",
    required: ["status"],
    properties: { status: { type: "string", enum: ["Approved", "Rejected"] } },
  },

  AuditEntry: {
    type: "object",
    properties: {
      id: { type: "integer" },
      action: { type: "string", description: "e.g. protocol.updated, vote.cast, transfer.approved" },
      entity_type: { type: "string" },
      entity_id: { type: ["string", "null"] },
      actor: { type: "string", default: "system", description: "Best-effort person name; 'system' when no identity was carried by the request" },
      actor_key: { type: ["string", "null"], description: "Reserved for auth identity (Roadmap item 4)" },
      details: { type: ["object", "null"], description: "Changed-field map, e.g. { status: [\"IACUC Review\", \"Approved\"] }" },
      provenance: { type: "string", enum: ["human", "ai", "system"] },
      created_at: { type: "string", format: "date-time" },
    },
  },
};

const paths = {
  "/api/health": {
    get: {
      tags: ["Core protocol CRUD"],
      summary: "Liveness check",
      responses: { 200: json({ type: "object", properties: { ok: { type: "boolean" } } }, "ok: true") },
    },
  },

  "/api/protocols": {
    get: {
      tags: ["Core protocol CRUD"],
      summary: "List protocols, optional `?q=` search",
      parameters: [{
        name: "q",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Case-insensitive substring over id, title, pi, species, status",
      }],
      responses: { 200: json({ type: "array", items: REF("Protocol") }, "Protocol list") },
    },
    post: {
      tags: ["Core protocol CRUD"],
      summary: "Create a protocol (starts as Draft)",
      requestBody: json(REF("ProtocolInput"), "Protocol fields"),
      responses: {
        201: json(REF("Protocol"), "Created protocol"),
        400: json(REF("Error"), "id, title, and pi are required"),
        409: json(REF("Error"), "Duplicate protocol id"),
      },
    },
  },

  "/api/protocols/summary": {
    get: {
      tags: ["Core protocol CRUD"],
      summary: "Dashboard metric counts",
      responses: { 200: json(REF("Summary"), "Metric counts") },
    },
  },

  "/api/protocols/{id}": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Core protocol CRUD"],
      summary: "Single protocol + related items",
      responses: {
        200: json(REF("ProtocolDetail"), "Protocol with stages and related items"),
        ...notFound(),
      },
    },
    patch: {
      tags: ["Core protocol CRUD"],
      summary: "Update fields / advance workflow stage",
      description:
        "Transitioning `status` to \"Submitted\" is gated server-side by validateCompleteness — returns 400 with the validation payload unless every Appendix A section is complete.",
      requestBody: json(REF("ProtocolUpdate"), "Fields to update"),
      responses: {
        200: json(REF("Protocol"), "Updated protocol"),
        400: json(REF("Error"), "No updatable fields, or submit blocked with `validation` payload"),
        404: json(REF("Error"), "Protocol not found"),
      },
    },
    delete: {
      tags: ["Core protocol CRUD"],
      summary: "Delete a protocol",
      responses: {
        204: { description: "Deleted" },
        ...notFound(),
      },
    },
  },

  "/api/protocols/{id}/procedures": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "15-item procedures checklist (with surgery detail fields)",
      responses: { 200: json({ type: "array", items: REF("Procedure") }, "Procedures checklist"), ...notFound() },
    },
    put: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Replace the checklist for a protocol",
      requestBody: json(REF("ProceduresBody"), "Full checklist"),
      responses: { 200: ok("Saved"), 400: json(REF("Error"), "procedures must be an array"), ...notFound() },
    },
  },

  "/api/protocols/{id}/drugs": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Drug/dosing table",
      responses: { 200: json({ type: "array", items: REF("Drug") }, "Drug rows"), ...notFound() },
    },
    post: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Add a drug row",
      requestBody: json(REF("DrugInput"), "drug is required"),
      responses: { 201: json(REF("Drug"), "Created drug row"), 400: json(REF("Error"), "drug is required"), ...notFound() },
    },
  },

  "/api/protocols/{id}/drugs/{drugId}": {
    parameters: [protocolIdParam, numericPathParam("drugId", "Drug row id")],
    patch: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Update a drug row",
      requestBody: json(REF("DrugInput"), "Fields to update"),
      responses: { 200: json(REF("Drug"), "Updated drug row"), 400: json(REF("Error"), "No updatable fields"), ...notFound() },
    },
    delete: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Remove a drug row",
      responses: { 204: { description: "Deleted" }, ...notFound() },
    },
  },

  "/api/protocols/{id}/animal-use": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Planned animal-use table (species/strain/sex/age/count)",
      responses: { 200: json({ type: "array", items: REF("AnimalUseRow") }, "Planned use rows"), ...notFound() },
    },
    post: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Add an animal-use row",
      requestBody: json(REF("AnimalUseInput"), "species_strain is required"),
      responses: { 201: json(REF("AnimalUseRow"), "Created row"), 400: json(REF("Error"), "species_strain is required"), ...notFound() },
    },
  },

  "/api/protocols/{id}/animal-use/{rowId}": {
    parameters: [protocolIdParam, numericPathParam("rowId", "Animal-use row id")],
    patch: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Update an animal-use row",
      requestBody: json(REF("AnimalUseInput"), "Fields to update"),
      responses: { 200: json(REF("AnimalUseRow"), "Updated row"), ...notFound() },
    },
    delete: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Remove an animal-use row",
      responses: { 204: { description: "Deleted" }, ...notFound() },
    },
  },

  "/api/protocols/{id}/experiments": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Experiments (endpoints, monitoring, husbandry)",
      responses: { 200: json({ type: "array", items: REF("Experiment") }, "Experiment rows"), ...notFound() },
    },
    post: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Add an experiment",
      requestBody: json(REF("ExperimentInput"), "name is required"),
      responses: { 201: json(REF("Experiment"), "Created experiment"), 400: json(REF("Error"), "name is required"), ...notFound() },
    },
  },

  "/api/protocols/{id}/experiments/{expId}": {
    parameters: [protocolIdParam, numericPathParam("expId", "Experiment row id")],
    patch: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Update an experiment",
      requestBody: json(REF("ExperimentInput"), "Fields to update"),
      responses: { 200: json(REF("Experiment"), "Updated experiment"), 400: json(REF("Error"), "No updatable fields"), ...notFound() },
    },
    delete: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Remove an experiment",
      responses: { 204: { description: "Deleted" }, ...notFound() },
    },
  },

  "/api/protocols/{id}/rrr": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Structured 3 Rs justifications (Replacement/Refinement/Reduction)",
      responses: { 200: json({ type: "array", items: REF("RrrEntry") }, "3 Rs entries"), ...notFound() },
    },
    post: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Add a 3 Rs entry",
      requestBody: json(REF("RrrInput"), "rrr_type and method are required"),
      responses: { 201: json(REF("RrrEntry"), "Created entry"), 400: json(REF("Error"), "Invalid rrr_type or missing method"), ...notFound() },
    },
  },

  "/api/protocols/{id}/rrr/{entryId}": {
    parameters: [protocolIdParam, numericPathParam("entryId", "3 Rs entry id")],
    patch: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Update a 3 Rs entry",
      requestBody: json(REF("RrrInput"), "Fields to update"),
      responses: { 200: json(REF("RrrEntry"), "Updated entry"), 400: json(REF("Error"), "Invalid rrr_type"), ...notFound() },
    },
    delete: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Remove a 3 Rs entry",
      responses: { 204: { description: "Deleted" }, ...notFound() },
    },
  },

  "/api/protocols/{id}/alternatives": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "3 Rs & alternatives summary (literature search, colleague consult, AV consult)",
      responses: { 200: json(REF("Alternatives"), "Alternatives block"), ...notFound() },
    },
    patch: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Update the alternatives block",
      requestBody: json(
        { type: "object", properties: Object.fromEntries(
          ["lit_databases", "lit_years_from", "lit_years_to", "lit_search_date", "lit_keywords", "lit_summary",
            "colleague_name", "colleague_date", "colleague_notes", "av_consult_date"].map(f => [f, { type: "string" }])
        ) },
        "Any subset of the alternatives fields"
      ),
      responses: { 200: json(REF("Alternatives"), "Updated alternatives block"), 400: json(REF("Error"), "No updatable fields"), ...notFound() },
    },
  },

  "/api/protocols/{id}/validation": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Appendix A application content (per protocol)"],
      summary: "Per-section submission completeness + `overall`",
      responses: { 200: json(REF("Validation"), "Completeness check"), ...notFound() },
    },
  },

  "/api/protocols/{id}/animal-usage": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Animal usage register (the ledger)"],
      summary: "Per-species/pain-category/procedure tallies vs. the approved allowance",
      responses: { 200: json(REF("AnimalUsageLedger"), "Ledger + tallies"), ...notFound() },
    },
    post: {
      tags: ["Animal usage register (the ledger)"],
      summary: "Log an ordering/usage transaction",
      requestBody: json(REF("AnimalUsageInput"), "Validated ledger transaction"),
      responses: { 201: json(REF("AnimalUsageTransaction"), "Created transaction"), 400: json(REF("Error"), "Validation failure"), ...notFound() },
    },
  },

  "/api/admin/species": {
    get: {
      tags: ["Admin lookup lists"],
      summary: "List species",
      responses: { 200: json({ type: "array", items: REF("Species") }, "Species list") },
    },
    post: {
      tags: ["Admin lookup lists"],
      summary: "Create a species",
      requestBody: json(REF("SpeciesInput"), "name is required"),
      responses: { 201: json(REF("Species"), "Created species"), 400: json(REF("Error"), "name is required"), 409: json(REF("Error"), "Duplicate name") },
    },
  },

  "/api/admin/species/{id}": {
    parameters: [numericPathParam("id", "Species id")],
    delete: {
      tags: ["Admin lookup lists"],
      summary: "Delete a species (blocked if in use)",
      responses: { 204: { description: "Deleted" }, 400: json(REF("Error"), "In use by a protocol"), 404: json(REF("Error"), "Not found") },
    },
  },

  "/api/admin/roles": {
    get: {
      tags: ["Admin lookup lists"],
      summary: "List roles",
      responses: { 200: json({ type: "array", items: REF("Role") }, "Role list") },
    },
    post: {
      tags: ["Admin lookup lists"],
      summary: "Create a role",
      requestBody: json(REF("RoleInput"), "name is required"),
      responses: { 201: json(REF("Role"), "Created role"), 400: json(REF("Error"), "name is required"), 409: json(REF("Error"), "Duplicate name") },
    },
  },

  "/api/admin/roles/{id}": {
    parameters: [numericPathParam("id", "Role id")],
    delete: {
      tags: ["Admin lookup lists"],
      summary: "Delete a role",
      responses: { 204: { description: "Deleted" }, 400: json(REF("Error"), "In use by personnel"), 404: json(REF("Error"), "Not found") },
    },
  },

  "/api/admin/personnel": {
    get: {
      tags: ["Admin lookup lists"],
      summary: "List personnel",
      responses: { 200: json({ type: "array", items: REF("Personnel") }, "Personnel list") },
    },
    post: {
      tags: ["Admin lookup lists"],
      summary: "Create a personnel member",
      requestBody: json(REF("PersonnelInput"), "name and role_id are required"),
      responses: { 201: json(REF("Personnel"), "Created personnel"), 400: json(REF("Error"), "Validation failure") },
    },
  },

  "/api/admin/personnel/{id}": {
    parameters: [numericPathParam("id", "Personnel id")],
    delete: {
      tags: ["Admin lookup lists"],
      summary: "Delete a personnel member",
      responses: { 204: { description: "Deleted" }, 400: json(REF("Error"), "In use by a protocol"), 404: json(REF("Error"), "Not found") },
    },
  },

  "/api/committee/protocols": {
    get: {
      tags: ["Committee / review workflow"],
      summary: "Protocols in review, with votes/assignments/comments",
      responses: { 200: json({ type: "array", items: REF("CommitteeProtocol") }, "Review queue") },
    },
  },

  "/api/committee/voters": {
    get: {
      tags: ["Committee / review workflow"],
      summary: "Committee-eligible voters",
      responses: { 200: json({ type: "array", items: REF("Voter") }, "Voter list") },
    },
  },

  "/api/committee/protocols/{id}/votes": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Committee / review workflow"],
      summary: "Vote history + live tally for a protocol",
      responses: { 200: json(REF("Tally"), "Tally"), ...notFound() },
    },
    post: {
      tags: ["Committee / review workflow"],
      summary: "Cast a vote",
      requestBody: json(REF("VoteInput"), "personnel_id and vote are required"),
      responses: {
        201: json(REF("Tally"), "Updated tally"),
        400: json(REF("Error"), "Missing/invalid fields"),
        403: json(REF("Error"), "Voter role not eligible"),
        ...notFound(),
      },
    },
  },

  "/api/committee/protocols/{id}/reviews": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Committee / review workflow"],
      summary: "Full review history (votes + assignments + comments)",
      responses: { 200: json(REF("CommitteeProtocol"), "Full review history"), ...notFound() },
    },
    post: {
      tags: ["Committee / review workflow"],
      summary: "Submit a review (Approved / Modifications Required / Tabled)",
      requestBody: json(REF("VoteInput"), "Vote submission"),
      responses: { 201: json(REF("CommitteeProtocol"), "Updated review history"), 400: json(REF("Error"), "Missing/invalid fields"), ...notFound() },
    },
  },

  "/api/committee/protocols/{id}/comments": {
    parameters: [protocolIdParam],
    post: {
      tags: ["Committee / review workflow"],
      summary: "Add a section-specific review comment",
      requestBody: json(REF("CommentInput"), "personnel_id, section, and comment are required"),
      responses: { 201: json(REF("ReviewComment"), "Created comment"), 400: json(REF("Error"), "Validation failure"), ...notFound() },
    },
  },

  "/api/committee/protocols/{id}/assign": {
    parameters: [protocolIdParam],
    patch: {
      tags: ["Committee / review workflow"],
      summary: "Upsert a reviewer assignment (Primary/Secondary/Designated Member)",
      requestBody: json(REF("AssignmentInput"), "personnel_id and role are required"),
      responses: { 200: json(REF("Assignment"), "Assignment (upserted)"), 400: json(REF("Error"), "Validation failure"), ...notFound() },
    },
  },

  "/api/committee/protocols/{id}/review-method": {
    parameters: [protocolIdParam],
    patch: {
      tags: ["Committee / review workflow"],
      summary: "Set review method (`FCR` / `DMR`)",
      requestBody: json(REF("ReviewMethodInput"), "review_method is required"),
      responses: { 200: json(REF("Protocol"), "Updated protocol with review_method"), 400: json(REF("Error"), "Invalid review_method"), ...notFound() },
    },
  },

  "/api/personnel/compliance": {
    get: {
      tags: ["Personnel compliance (CITI training + OHSP clearance)"],
      summary: "All personnel with derived training/OHSP/compliant status",
      responses: { 200: json({ type: "array", items: REF("PersonnelCompliance") }, "Compliance list") },
    },
  },

  "/api/personnel/{id}/training": {
    parameters: [numericPathParam("id", "Personnel id")],
    get: {
      tags: ["Personnel compliance (CITI training + OHSP clearance)"],
      summary: "A person's training records + overall status",
      responses: { 200: json(REF("TrainingResponse"), "Training summary"), 404: json(REF("Error"), "Personnel not found") },
    },
    post: {
      tags: ["Personnel compliance (CITI training + OHSP clearance)"],
      summary: "Add a training record",
      requestBody: json(REF("TrainingInput"), "course and completed_date are required"),
      responses: { 201: json(REF("TrainingRecord"), "Created record"), 400: json(REF("Error"), "course/completed_date required"), 404: json(REF("Error"), "Personnel not found") },
    },
  },

  "/api/personnel/{id}/training/{trainingId}": {
    parameters: [numericPathParam("id", "Personnel id"), numericPathParam("trainingId", "Training record id")],
    patch: {
      tags: ["Personnel compliance (CITI training + OHSP clearance)"],
      summary: "Update a training record (e.g. extend an expiry)",
      requestBody: json(REF("TrainingInput"), "Any of course/completed_date/expires_date"),
      responses: { 200: json(REF("TrainingRecord"), "Updated record"), 400: json(REF("Error"), "Empty course/completed_date"), 404: json(REF("Error"), "Not found") },
    },
    delete: {
      tags: ["Personnel compliance (CITI training + OHSP clearance)"],
      summary: "Remove a training record",
      responses: { 204: { description: "Deleted" }, 404: json(REF("Error"), "Not found") },
    },
  },

  "/api/personnel/{id}/ohsp": {
    parameters: [numericPathParam("id", "Personnel id")],
    get: {
      tags: ["Personnel compliance (CITI training + OHSP clearance)"],
      summary: "OHSP clearance row (defaults to Pending)",
      responses: { 200: json(REF("OhspRecord"), "OHSP row"), 404: json(REF("Error"), "Personnel not found") },
    },
    post: {
      tags: ["Personnel compliance (CITI training + OHSP clearance)"],
      summary: "Upsert OHSP status (`Pending`/`Cleared`/`Denied`)",
      requestBody: json(REF("OhspInput"), "status is required"),
      responses: { 201: json(REF("OhspRecord"), "Upserted OHSP row"), 400: json(REF("Error"), "Invalid status"), 404: json(REF("Error"), "Personnel not found") },
    },
  },

  "/api/protocols/{id}/personnel": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Personnel compliance (CITI training + OHSP clearance)"],
      summary: "Per-listed-person compliance + `all_compliant` for a protocol",
      responses: { 200: json(REF("ProtocolPersonnel"), "Per-person compliance"), ...notFound() },
    },
  },

  // ---- Domain F: facilities & semi-annual inspections ----

  "/api/facilities": {
    get: {
      tags: ["Facilities & semi-annual inspections"],
      summary: "List facilities (housing rooms / labs / surgical suites)",
      responses: { 200: json({ type: "array", items: REF("Facility") }, "Facilities, sorted by name") },
    },
    post: {
      tags: ["Facilities & semi-annual inspections"],
      summary: "Add a facility",
      requestBody: json(REF("FacilityInput"), "name and type are required"),
      responses: { 201: json(REF("Facility"), "Created facility"), 400: json(REF("Error"), "Missing name or invalid type") },
    },
  },

  "/api/facilities/{id}": {
    parameters: [numericPathParam("id", "Facility id")],
    delete: {
      tags: ["Facilities & semi-annual inspections"],
      summary: "Delete a facility (cascades to its inspections + deficiencies)",
      responses: { 204: { description: "Deleted" }, 404: json(REF("Error"), "Facility not found") },
    },
  },

  "/api/inspections": {
    get: {
      tags: ["Facilities & semi-annual inspections"],
      summary: "List inspections (most recent first, with facility names)",
      responses: { 200: json({ type: "array", items: REF("Inspection") }, "Inspections") },
    },
    post: {
      tags: ["Facilities & semi-annual inspections"],
      summary: "Record a semi-annual inspection",
      requestBody: json(REF("InspectionInput"), "facility_id and inspection_date are required"),
      responses: { 201: json(REF("InspectionDetail"), "Created inspection (empty deficiencies)"), 400: json(REF("Error"), "Missing fields or unknown facility_id") },
    },
  },

  "/api/inspections/{id}": {
    parameters: [numericPathParam("id", "Inspection id")],
    get: {
      tags: ["Facilities & semi-annual inspections"],
      summary: "Inspection with its deficiencies",
      responses: { 200: json(REF("InspectionDetail"), "Inspection + deficiencies"), 404: json(REF("Error"), "Inspection not found") },
    },
  },

  "/api/inspections/{id}/deficiencies": {
    parameters: [numericPathParam("id", "Inspection id")],
    get: {
      tags: ["Facilities & semi-annual inspections"],
      summary: "List a deficiency set for an inspection",
      responses: { 200: json({ type: "array", items: REF("Deficiency") }, "Deficiencies, Major first"), 404: json(REF("Error"), "Inspection not found") },
    },
    post: {
      tags: ["Facilities & semi-annual inspections"],
      summary: "Record a deficiency on an inspection",
      requestBody: json(REF("DeficiencyInput"), "severity and description are required"),
      responses: { 201: json(REF("Deficiency"), "Created deficiency"), 400: json(REF("Error"), "Invalid severity or missing description"), 404: json(REF("Error"), "Inspection not found") },
    },
  },

  "/api/inspections/{id}/deficiencies/{defId}": {
    parameters: [numericPathParam("id", "Inspection id"), numericPathParam("defId", "Deficiency id")],
    patch: {
      tags: ["Facilities & semi-annual inspections"],
      summary: "Mark a deficiency remediated",
      responses: { 200: json(REF("Deficiency"), "Updated deficiency"), 400: json(REF("Error"), "Already remediated"), 404: json(REF("Error"), "Inspection or deficiency not found") },
    },
  },

  // ---- Domain E: PAM & incident reporting ----

  "/api/incidents": {
    get: {
      tags: ["Post-Approval Monitoring (PAM) & incidents"],
      summary: "List incidents (most recent first, with reporter/assignee names)",
      responses: { 200: json({ type: "array", items: REF("Incident") }, "Incidents") },
    },
    post: {
      tags: ["Post-Approval Monitoring (PAM) & incidents"],
      summary: "Report an adverse event / deviation / noncompliance",
      requestBody: json(REF("IncidentInput"), "type and description are required"),
      responses: { 201: json(REF("Incident"), "Created incident (status Open)"), 400: json(REF("Error"), "Invalid type/severity, missing description, or unknown protocol/personnel") },
    },
  },

  "/api/incidents/{id}": {
    parameters: [numericPathParam("id", "Incident id")],
    get: {
      tags: ["Post-Approval Monitoring (PAM) & incidents"],
      summary: "Incident detail with reporter/assignee names",
      responses: { 200: json(REF("Incident"), "Incident"), 404: json(REF("Error"), "Incident not found") },
    },
    patch: {
      tags: ["Post-Approval Monitoring (PAM) & incidents"],
      summary: "Log a CAPA and/or move the incident through Open → CAPA → Closed",
      description: "Closing requires a corrective_action (CAPA) recorded first.",
      requestBody: json(REF("IncidentUpdate"), "status / corrective_action / assigned_to"),
      responses: { 200: json(REF("Incident"), "Updated incident"), 400: json(REF("Error"), "Invalid status or CAPA missing"), 404: json(REF("Error"), "Incident not found") },
    },
  },

  "/api/pam-audits": {
    get: {
      tags: ["Post-Approval Monitoring (PAM) & incidents"],
      summary: "Every PAM site-visit audit across protocols (most recent first)",
      responses: { 200: json({ type: "array", items: REF("PamAudit") }, "PAM audits") },
    },
  },

  "/api/protocols/{id}/pam-audits": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Post-Approval Monitoring (PAM) & incidents"],
      summary: "PAM history + site-visit reports for a protocol",
      responses: { 200: json({ type: "array", items: REF("PamAudit") }, "PAM audits, most recent first"), ...notFound() },
    },
    post: {
      tags: ["Post-Approval Monitoring (PAM) & incidents"],
      summary: "Log a PAM site-visit audit for a protocol",
      requestBody: json(REF("PamAuditInput"), "audit_date is required"),
      responses: { 201: json(REF("PamAudit"), "Created audit"), 400: json(REF("Error"), "Missing audit_date or unknown auditor_id"), ...notFound() },
    },
  },

  // ---- Domain B: amendments & annual renewals ----

  "/api/protocols/{id}/amendments": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Amendments & annual renewals"],
      summary: "List amendments for a protocol (each with its field-level changes)",
      responses: { 200: json({ type: "array", items: REF("Amendment") }, "Amendments, most recent first"), ...notFound() },
    },
    post: {
      tags: ["Amendments & annual renewals"],
      summary: "Start an amendment (one in-flight per protocol; reason required)",
      responses: { 201: json(REF("Amendment"), "Created pending amendment"), 400: json(REF("Error"), "Reason required"), 409: json(REF("Error"), "Another amendment is already in flight"), ...notFound() },
    },
  },

  "/api/protocols/{id}/amendments/{amendmentId}": {
    parameters: [protocolIdParam, numericPathParam("amendmentId", "Amendment id")],
    get: {
      tags: ["Amendments & annual renewals"],
      summary: "Amendment detail with its changes",
      responses: { 200: json(REF("Amendment"), "Amendment + changes"), 404: json(REF("Error"), "Amendment not found"), ...notFound() },
    },
    patch: {
      tags: ["Amendments & annual renewals"],
      summary: "Approve (→ new protocol version) or reject a pending amendment",
      requestBody: json(REF("AmendmentDecision"), "status is required"),
      responses: { 200: json(REF("Amendment"), "Updated amendment"), 400: json(REF("Error"), "Invalid status or already decided"), 404: json(REF("Error"), "Amendment not found"), ...notFound() },
    },
  },

  "/api/protocols/{id}/amendments/{amendmentId}/changes": {
    parameters: [protocolIdParam, numericPathParam("amendmentId", "Amendment id")],
    post: {
      tags: ["Amendments & annual renewals"],
      summary: "Record one field-level change (diff snapshot) on a pending amendment",
      requestBody: json(REF("AmendmentChangeInput"), "section and field are required"),
      responses: { 201: json(REF("AmendmentChange"), "Created change"), 400: json(REF("Error"), "Missing fields or amendment already decided"), 404: json(REF("Error"), "Amendment not found"), ...notFound() },
    },
  },

  "/api/protocols/{id}/versions": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Amendments & annual renewals"],
      summary: "Protocol version lineage (0001, 0002, ...)",
      responses: { 200: json({ type: "array", items: REF("ProtocolVersion") }, "Versions, newest first"), ...notFound() },
    },
  },

  "/api/protocols/{id}/renewals": {
    parameters: [protocolIdParam],
    get: {
      tags: ["Amendments & annual renewals"],
      summary: "List continuing-review / de-novo-review events for a protocol",
      responses: { 200: json({ type: "array", items: REF("Renewal") }, "Renewals, most recent first"), ...notFound() },
    },
    post: {
      tags: ["Amendments & annual renewals"],
      summary: "Start a continuing review or de novo review (one in-flight per protocol)",
      requestBody: json(REF("RenewalInput"), "type is required"),
      responses: { 201: json(REF("Renewal"), "Created pending renewal"), 400: json(REF("Error"), "Invalid type"), 409: json(REF("Error"), "A renewal is already in flight"), ...notFound() },
    },
  },

  "/api/protocols/{id}/renewals/{renewalId}": {
    parameters: [protocolIdParam, numericPathParam("renewalId", "Renewal id")],
    patch: {
      tags: ["Amendments & annual renewals"],
      summary: "Approve (→ new protocol version + updated expiration) or reject a renewal",
      description: "Approving requires `approved_until` (the new expiration date).",
      requestBody: json(REF("RenewalDecision"), "status is required; approved_until required when approving"),
      responses: { 200: json(REF("Renewal"), "Updated renewal"), 400: json(REF("Error"), "Invalid status, already decided, or missing approved_until"), 404: json(REF("Error"), "Renewal not found"), ...notFound() },
    },
  },

  // ---- Transfer ownership ----

  "/api/transfers": {
    get: {
      tags: ["Transfer ownership"],
      summary: "Transfer ownership queue (all requests, newest first)",
      description: "Filter with ?status=Pending for the active IACUC-office queue.",
      parameters: [
        {
          name: "status",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
          description: "Filter by request status",
        },
      ],
      responses: { 200: json({ type: "array", items: REF("ProtocolTransfer") }, "Transfer requests, newest first"), 400: json(REF("Error"), "Invalid status") },
    },
    post: {
      tags: ["Transfer ownership"],
      summary: "Bulk-transfer request: create one pending transfer per protocol",
      requestBody: json(REF("TransferBulkInput"), "protocol_ids, to_personnel_id and reason are required"),
      responses: { 201: json({ type: "array", items: REF("ProtocolTransfer") }, "Created transfers"), 400: json(REF("Error"), "Invalid payload or unknown personnel"), 404: json(REF("Error"), "Protocol not found"), 409: json(REF("Error"), "A transfer is already pending for a protocol") },
    },
  },

  "/api/transfers/{transferId}": {
    parameters: [numericPathParam("transferId", "Transfer request id")],
    patch: {
      tags: ["Transfer ownership"],
      summary: "Approve (reassigns the protocol PI) or reject a pending transfer",
      requestBody: json(REF("TransferDecision"), "status is required"),
      responses: { 200: json(REF("ProtocolTransfer"), "Updated transfer"), 400: json(REF("Error"), "Invalid status or already decided"), 404: json(REF("Error"), "Transfer request not found") },
    },
  },

  "/api/protocols/{id}/transfers": {
    parameters: [protocolIdParam],
    post: {
      tags: ["Transfer ownership"],
      summary: "Request to transfer a single protocol to a new PI",
      requestBody: json(REF("TransferInput"), "to_personnel_id and reason are required"),
      responses: { 201: json(REF("ProtocolTransfer"), "Created pending transfer"), 400: json(REF("Error"), "Missing fields or unknown personnel"), 409: json(REF("Error"), "A transfer is already pending"), ...notFound() },
    },
  },

  "/api/audit": {
    get: {
      tags: ["Audit log"],
      summary: "Append-only audit trail of mutations (most recent first)",
      description:
        "Every successful write across the app logs an entry: what changed, when, and a best-effort actor. `actor`/`actor_key` resolve to a real person's name when the request carries identity (votes, comments, assignments, reporters, auditors) and to 'system' otherwise — real auth is Roadmap item 4.",
      parameters: [
        { name: "entity_type", in: "query", required: false, schema: { type: "string" }, description: "e.g. protocol, transfer, vote, species" },
        { name: "entity_id", in: "query", required: false, schema: { type: "string" }, description: "Row id to narrow by" },
        { name: "actor", in: "query", required: false, schema: { type: "string" }, description: "Substring match on the actor name" },
        { name: "action", in: "query", required: false, schema: { type: "string" }, description: "Substring match, e.g. protocol.updated, vote.cast" },
        { name: "provenance", in: "query", required: false, schema: { type: "string", enum: ["human", "ai", "system"] }, description: "Filter by content origin (AI-generated content is flagged per AGENTS.md §3.2)" },
        { name: "from", in: "query", required: false, schema: { type: "string", format: "date" }, description: "Inclusive start date (YYYY-MM-DD); must be paired with `to`" },
        { name: "to", in: "query", required: false, schema: { type: "string", format: "date" }, description: "Inclusive end date (YYYY-MM-DD); must be paired with `from`" },
        { name: "limit", in: "query", required: false, schema: { type: "integer", default: 100 }, description: "1–500" },
        { name: "offset", in: "query", required: false, schema: { type: "integer", default: 0 }, description: "Pagination offset" },
      ],
      responses: { 200: json({ type: "array", items: REF("AuditEntry") }, "Audit entries, newest first"), 400: json(REF("Error"), "Invalid limit/offset/provenance or unpaired date filter") },
    },
  },
};

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "IACUC Protocol Review App",
    version: "1.0.0",
    description:
      "API for IACUC protocol CRUD, the Appendix A application content, the animal usage register, admin lookup lists, the committee review workflow, personnel compliance, the facility & semi-annual inspection program, PAM & incident reporting, and amendments & annual renewals. Every endpoint documented here is implemented (see README for the full ✓/✗ status tables).",
  },
  servers: [{ url: process.env.API_BASE_URL || "http://localhost:4000", description: "Local dev server" }],
  tags: [
    { name: "Core protocol CRUD", description: "Dashboard list, detail, create, edit, delete" },
    { name: "Appendix A application content (per protocol)", description: "Procedures, drugs, animal-use, experiments, 3 Rs, alternatives, validation" },
    { name: "Animal usage register (the ledger)", description: "Actual ordering/usage transactions vs. the approved allowance" },
    { name: "Admin lookup lists", description: "Species / roles / personnel master data" },
    { name: "Committee / review workflow", description: "FCR/DMR votes, assignments, section comments, review method" },
    { name: "Personnel compliance (CITI training + OHSP clearance)", description: "Training records, OHSP status, per-protocol compliance" },
    { name: "Facilities & semi-annual inspections", description: "Housing rooms / labs / surgical suites and their deficiency tracking" },
    { name: "Post-Approval Monitoring (PAM) & incidents", description: "Adverse events / deviations with the Open → CAPA → Closed lifecycle, plus PAM site-visit audits" },
    { name: "Amendments & annual renewals", description: "Versioned amendments, protocol version lineage, continuing & de novo review" },
    { name: "Transfer ownership", description: "PI transfer requests with their own IACUC-office approval queue (single + bulk)" },
    { name: "Audit log", description: "Append-only trail of every mutation, with actor + provenance (Roadmap item 11)" },
  ],
  paths,
  components: { schemas },
};
