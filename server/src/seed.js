import "dotenv/config";
import { db } from "./db.js";

const protocols = [
  { id: "IACUC-2026-0142", title: "Neurobehavioral Effects of Chronic Stress in C57BL/6 Mice", pi: "Dr. Elena Marsh", species: "Mouse", status: "IACUC Review", animals: 240, pain_category: "Category D", submitted: "2026-06-30", expires: null, pi_proxy: "Sam Whitfield", ptm_member: "Dr. Priya Nair", protocol_type: "Research", anesthesia_required: 1, housing: "Group-housed 5/cage in ventilated cages on a 12:12 light cycle.", disposal: "Carbon dioxide euthanasia; carcasses incinerated per SOP.", npg: "None", research_steps: ["Habituate mice to handling for 7 days.", "Deliver corticosterone in drinking water for 21 days with daily restraint sessions.", "Collect brains and adrenals after euthanasia for histology and qPCR."] },
  { id: "IACUC-2026-0139", title: "Cardiac Regeneration Following Induced Myocardial Infarction", pi: "Dr. Raj Patel", species: "Rat", status: "Approved", animals: 80, pain_category: "Category C", submitted: "2026-06-12", expires: "2029-06-12" },
  { id: "IACUC-2025-0098", title: "Vaccine Efficacy Trial for Avian Influenza Strains", pi: "Dr. Wen Liu", species: "Chicken", status: "Active", animals: 150, pain_category: "Category B", submitted: "2025-01-08", expires: "2026-08-04" },
  { id: "IACUC-2025-0091", title: "Longitudinal Study of Diet-Induced Obesity in Zebrafish", pi: "Dr. Sofia Ramos", species: "Zebrafish", status: "Expiring soon", animals: 500, pain_category: "Category B", submitted: "2025-02-02", expires: "2026-09-01" },
  { id: "IACUC-2026-0021", title: "Wound Healing Comparison Across Rabbit Breeds", pi: "Dr. Marcus Chen", species: "Rabbit", status: "Draft", animals: 60, pain_category: "Category C", submitted: null, expires: null },
  { id: "IACUC-2025-0064", title: "Behavioral Enrichment Impact on Non-Human Primate Welfare", pi: "Dr. Amara Osei", species: "Macaque", status: "Active", animals: 24, pain_category: "Category B", submitted: "2025-11-20", expires: "2027-11-20" },
  { id: "IACUC-2026-0150", title: "Deep Brain Stimulation in a Rat Model of Parkinson's Disease", pi: "Dr. Priya Nair", species: "Rat", status: "IACUC Review", animals: 120, pain_category: "Category D", submitted: "2026-05-10", expires: null },
  { id: "IACUC-2026-0147", title: "Adoptive Cell Therapy Against Murine Melanoma", pi: "Dr. Harold Kim", species: "Mouse", status: "Veterinary Review", animals: 200, pain_category: "Category D", submitted: "2026-06-01", expires: null },
  { id: "IACUC-2025-0102", title: "Environmental Enrichment and Social Behavior in Domestic Pigs", pi: "Dr. Marcus Chen", species: "Pig", status: "Active", animals: 36, pain_category: "Category C", submitted: "2025-03-15", expires: "2028-03-15" },
  { id: "IACUC-2026-0155", title: "Corneal Transplantation Techniques in Rabbits", pi: "Dr. Wen Liu", species: "Rabbit", status: "Submitted", animals: 60, pain_category: "Category C", submitted: "2026-07-20", expires: null },
  { id: "IACUC-2026-0158", title: "Genetic Basis of Spontaneous Seizures in Zebrafish", pi: "Dr. Amara Osei", species: "Zebrafish", status: "Draft", animals: 800, pain_category: "Category B", submitted: null, expires: null, protocol_type: "Breeding", anesthesia_required: 0, housing: "Recirculating aquatic system, 28°C, density ≤5 fish/L.", disposal: "Tricaine overdose followed by incineration.", npg: "None", research_steps: ["Maintain mutant and wild-type lines.", "Score seizure behavior from video recordings.", "Genotype offspring via fin-clip PCR."] },
  { id: "IACUC-2024-0023", title: "Toxicological Screening of Novel Compounds in Sprague-Dawley Rats", pi: "Dr. Raj Patel", species: "Rat", status: "Active", animals: 150, pain_category: "Category E", submitted: "2024-09-10", expires: "2027-09-10" },
];

const relatedItems = [
  // IACUC-2026-0142 — keep exactly as-is: Personnel (3), Attachments (2)
  { protocol_id: "IACUC-2026-0142", list_name: "Personnel", label: "Dr. Elena Marsh — PI" },
  { protocol_id: "IACUC-2026-0142", list_name: "Personnel", label: "Dr. Raj Patel — Co-I" },
  { protocol_id: "IACUC-2026-0142", list_name: "Personnel", label: "Sam Whitfield — Lab tech" },
  { protocol_id: "IACUC-2026-0142", list_name: "Amendments", label: "AM-01 — Add second mouse strain (Pending)" },
  { protocol_id: "IACUC-2026-0142", list_name: "Approval history", label: "Submitted — Jun 30, 2026" },
  { protocol_id: "IACUC-2026-0142", list_name: "Approval history", label: "Vet pre-review passed — Jul 5, 2026" },
  { protocol_id: "IACUC-2026-0142", list_name: "Approval history", label: "Assigned to full committee — Jul 10, 2026" },
  { protocol_id: "IACUC-2026-0142", list_name: "Attachments", label: "Protocol_Narrative_v3.pdf" },
  { protocol_id: "IACUC-2026-0142", list_name: "Attachments", label: "Statistical_Justification.pdf" },

  // IACUC-2026-0139
  { protocol_id: "IACUC-2026-0139", list_name: "Personnel", label: "Dr. Raj Patel — PI" },
  { protocol_id: "IACUC-2026-0139", list_name: "Personnel", label: "Dr. Priya Nair — Veterinary consultant" },
  { protocol_id: "IACUC-2026-0139", list_name: "Approval history", label: "Approved by full committee — Jun 18, 2026" },
  { protocol_id: "IACUC-2026-0139", list_name: "Approval history", label: "Amendment 0002 — ischemia model duration — Jul 22, 2026" },
  { protocol_id: "IACUC-2026-0139", list_name: "Attachments", label: "Surgical_Protocol_SOP.pdf" },

  // IACUC-2025-0098
  { protocol_id: "IACUC-2025-0098", list_name: "Personnel", label: "Dr. Wen Liu — PI" },
  { protocol_id: "IACUC-2025-0098", list_name: "Personnel", label: "Sam Whitfield — Husbandry" },
  { protocol_id: "IACUC-2025-0098", list_name: "Approval history", label: "Approved — Jan 15, 2025" },
  { protocol_id: "IACUC-2025-0098", list_name: "Attachments", label: "Vaccine_Strain_Matrix.xlsx" },

  // IACUC-2025-0091
  { protocol_id: "IACUC-2025-0091", list_name: "Personnel", label: "Dr. Sofia Ramos — PI" },
  { protocol_id: "IACUC-2025-0091", list_name: "Amendments", label: "AM-03 — Extend study to 12 months (Approved)" },
  { protocol_id: "IACUC-2025-0091", list_name: "Approval history", label: "Approved — Feb 9, 2025" },
  { protocol_id: "IACUC-2025-0091", list_name: "Approval history", label: "Flagged for 60-day expiration reminder — Jul 10, 2026" },

  // IACUC-2026-0021
  { protocol_id: "IACUC-2026-0021", list_name: "Personnel", label: "Dr. Marcus Chen — PI" },
  { protocol_id: "IACUC-2026-0021", list_name: "Personnel", label: "Dr. Wen Liu — Co-I" },

  // IACUC-2025-0064
  { protocol_id: "IACUC-2025-0064", list_name: "Personnel", label: "Dr. Amara Osei — PI" },
  { protocol_id: "IACUC-2025-0064", list_name: "Personnel", label: "Dr. Priya Nair — Veterinary consultant" },
  { protocol_id: "IACUC-2025-0064", list_name: "Personnel", label: "Jordan Blake — Behavior observer" },
  { protocol_id: "IACUC-2025-0064", list_name: "Approval history", label: "Approved — Nov 25, 2025" },
  { protocol_id: "IACUC-2025-0064", list_name: "Attachments", label: "Enrichment_Daily_Checklist.pdf" },

  // IACUC-2026-0150
  { protocol_id: "IACUC-2026-0150", list_name: "Personnel", label: "Dr. Priya Nair — PI" },
  { protocol_id: "IACUC-2026-0150", list_name: "Personnel", label: "Sam Whitfield — Surgical support" },
  { protocol_id: "IACUC-2026-0150", list_name: "Amendments", label: "AM-01 — Add DBS lead verification step (Pending)" },
  { protocol_id: "IACUC-2026-0150", list_name: "Approval history", label: "Submitted — May 10, 2026" },
  { protocol_id: "IACUC-2026-0150", list_name: "Approval history", label: "Assigned to full committee — May 18, 2026" },
  { protocol_id: "IACUC-2026-0150", list_name: "Attachments", label: "DBS_Coordinate_Maps.pdf" },

  // IACUC-2026-0147
  { protocol_id: "IACUC-2026-0147", list_name: "Personnel", label: "Dr. Harold Kim — PI" },
  { protocol_id: "IACUC-2026-0147", list_name: "Personnel", label: "Dr. Elena Marsh — Co-I" },
  { protocol_id: "IACUC-2026-0147", list_name: "Approval history", label: "Submitted — Jun 1, 2026" },
  { protocol_id: "IACUC-2026-0147", list_name: "Approval history", label: "Vet pre-review in progress — Jul 1, 2026" },

  // IACUC-2025-0102
  { protocol_id: "IACUC-2025-0102", list_name: "Personnel", label: "Dr. Marcus Chen — PI" },
  { protocol_id: "IACUC-2025-0102", list_name: "Personnel", label: "Jordan Blake — Behavior observer" },
  { protocol_id: "IACUC-2025-0102", list_name: "Approval history", label: "Approved — Mar 22, 2025" },

  // IACUC-2026-0155
  { protocol_id: "IACUC-2026-0155", list_name: "Personnel", label: "Dr. Wen Liu — PI" },
  { protocol_id: "IACUC-2026-0155", list_name: "Approval history", label: "Submitted — Jul 20, 2026" },

  // IACUC-2026-0158
  { protocol_id: "IACUC-2026-0158", list_name: "Personnel", label: "Dr. Amara Osei — PI" },

  // IACUC-2024-0023
  { protocol_id: "IACUC-2024-0023", list_name: "Personnel", label: "Dr. Raj Patel — PI" },
  { protocol_id: "IACUC-2024-0023", list_name: "Personnel", label: "Dr. Priya Nair — Veterinary consultant" },
  { protocol_id: "IACUC-2024-0023", list_name: "Amendments", label: "AM-04 — Reduce compound doses (Approved)" },
  { protocol_id: "IACUC-2024-0023", list_name: "Approval history", label: "Approved — Sep 17, 2024" },
];

const species = [
  "Mouse", "Rat", "Rabbit", "Guinea pig", "Zebrafish", "Chicken",
  "Macaque", "Sheep", "Pig", "Dog", "Cat", "Ferret", "Goat", "Hamster",
];

// is_committee = 1 means this role is eligible to cast an FCR vote
const roles = [
  { name: "Principal Investigator", is_committee: 0 },
  { name: "Co-Investigator", is_committee: 0 },
  { name: "Lab Technician", is_committee: 0 },
  { name: "Attending Veterinarian", is_committee: 1 },
  { name: "IACUC Chair", is_committee: 1 },
  { name: "Committee Member", is_committee: 1 },
  { name: "Non-Affiliated Member", is_committee: 1 },
  { name: "Non-Scientist Member", is_committee: 1 },
  { name: "IACUC Coordinator", is_committee: 0 },
];

const personnel = [
  { name: "Dr. Elena Marsh", email: "e.marsh@university.edu", role: "Principal Investigator" },
  { name: "Dr. Raj Patel", email: "r.patel@university.edu", role: "Co-Investigator" },
  { name: "Sam Whitfield", email: "s.whitfield@university.edu", role: "Lab Technician" },
  { name: "Dr. Priya Nair", email: "p.nair@university.edu", role: "Attending Veterinarian" },
  { name: "Dr. Harold Kim", email: "h.kim@university.edu", role: "IACUC Chair" },
  { name: "Dr. Sofia Ramos", email: "s.ramos@university.edu", role: "Committee Member" },
  { name: "Dr. Marcus Chen", email: "m.chen@university.edu", role: "Committee Member" },
  { name: "Jordan Blake", email: "j.blake@community.org", role: "Non-Affiliated Member" },
  { name: "Dr. Amara Osei", email: "a.osei@university.edu", role: "Non-Scientist Member" },
];

// ---- Appendix A content tables (procedures / drugs / animal use / alternatives) ----

const proceduresSeed = {
  "IACUC-2026-0142": [
    { key: "breeding", checked: 1, description: "C57BL/6 breeding pairs maintained for timed litters used in chronic stress cohorts." },
    { key: "animal_id", checked: 1, description: "Ear punch for identification; no additional marking needed for group-housed mice." },
    { key: "injections", checked: 1, description: "Subcutaneous saline injections once daily for 21 days." },
    { key: "exposure_substance", checked: 1, description: "Corticosterone in drinking water at 25 mg/L for the stress paradigm." },
    { key: "pain_distress", checked: 1, description: "Cage restraint 2h/day for 21 days; monitored twice daily for distress score." },
    { key: "tissue_collection", checked: 1, description: "Brain and adrenal glands collected after carbon dioxide euthanasia." },
    { key: "special_diets", checked: 1, description: "Standard chow ad libitum; no food restriction." },
  ],
  "IACUC-2026-0139": [
    { key: "anesthesia", checked: 1, description: "Isoflurane 1.5–2% in oxygen for survival surgery." },
    { key: "non_survival_surgery", checked: 1, description: "Terminal LAD occlusion under anesthesia for infarction induction." },
    { key: "survival_surgery", checked: 1, description: "Left anterior descending coronary artery ligation via thoracotomy." },
    { key: "tissue_collection", checked: 1, description: "Hearts harvested for histology and gene expression at 1, 4, and 8 weeks." },
    { key: "illness_endpoint", checked: 1, description: "Humane endpoint if >30% body weight loss or signs of heart failure." },
  ],
  "IACUC-2025-0098": [
    { key: "animal_id", checked: 1, description: "Wing band numbering for flock identification." },
    { key: "injections", checked: 1, description: "Intramuscular vaccine and placebo injections into the breast muscle." },
    { key: "exposure_substance", checked: 1, description: "Inactivated H5N8 avian influenza strains." },
    { key: "blood_collection", checked: 1, description: "Wing vein blood collection (≤1 mL) every 14 days." },
  ],
  "IACUC-2025-0091": [
    { key: "special_diets", checked: 1, description: "High-fat diet (60% kcal from fat) for 12 months." },
    { key: "tissue_collection", checked: 1, description: "Liver, adipose, and gut tissue collected at terminal timepoints." },
  ],
  "IACUC-2026-0021": [
    { key: "anesthesia", checked: 1, description: "Ketamine/xylazine for wound closure procedures." },
    { key: "non_survival_surgery", checked: 1, description: "Full-thickness excisional wounds created and photographed." },
    { key: "survival_surgery", checked: 1, description: "Wound creation with dressings; sutures removed at day 14." },
  ],
  "IACUC-2025-0064": [
    { key: "animal_id", checked: 1, description: "Existing microchip tattoos; no new ID method." },
    { key: "pain_distress", checked: 0, description: "" },
    { key: "tissue_collection", checked: 1, description: "Saliva and fecal samples only; no terminal tissue collection." },
  ],
  "IACUC-2026-0150": [
    { key: "anesthesia", checked: 1, description: "Isoflurane 2% for stereotaxic surgery." },
    { key: "survival_surgery", checked: 1, description: "Bilateral deep brain stimulation electrode implantation into the subthalamic nucleus." },
    { key: "prolonged_restraint", checked: 1, description: "Rats briefly restrained in a holding tube during stimulation sessions." },
    { key: "illness_endpoint", checked: 1, description: "Endpoints: severe post-operative neurological deficit or infection unresponsive to treatment." },
  ],
  "IACUC-2026-0147": [
    { key: "injections", checked: 1, description: "Subcutaneous tumor cell injection; IV adoptive cell transfer." },
    { key: "exposure_substance", checked: 1, description: "CAR-T cells; NOD scid gamma mice." },
    { key: "tissue_collection", checked: 1, description: "Tumor and spleen collected for flow cytometry." },
    { key: "illness_endpoint", checked: 1, description: "Tumor volume >2000 mm3 or ulceration triggers euthanasia." },
  ],
  "IACUC-2025-0102": [
    { key: "animal_id", checked: 1, description: "Ear tags applied at weaning." },
  ],
  "IACUC-2026-0155": [
    { key: "anesthesia", checked: 1, description: "Ketamine/dexmedetomidine for corneal grafting." },
    { key: "survival_surgery", checked: 1, description: "Penetrating keratoplasty with donor grafts." },
    { key: "tissue_collection", checked: 1, description: "Corneas collected for histology at study end." },
  ],
  "IACUC-2026-0158": [
    { key: "breeding", checked: 1, description: "Zebrafish lines carrying seizure-associated mutations." },
    { key: "animal_id", checked: 1, description: "PTU treatment; fin clip genotyping with agarose wells." },
  ],
  "IACUC-2024-0023": [
    { key: "exposure_substance", checked: 1, description: "12 novel investigational compounds by oral gavage." },
    { key: "pain_distress", checked: 1, description: "Potential GI distress; monitoring and humane endpoints in place." },
    { key: "special_diets", checked: 1, description: "Fasting 12h prior to dosing only." },
  ],
};

const drugsSeed = {
  "IACUC-2026-0142": [
    { reason_for_use: "Anesthesia", drug: "Isoflurane", dose: "1–2% in oxygen", route: "Inhalation", duration: "5–10 min" },
    { reason_for_use: "Analgesia", drug: "Buprenorphine", dose: "0.05 mg/kg", route: "SC", duration: "q8h × 48h" },
    { reason_for_use: "Euthanasia", drug: "Carbon dioxide", dose: "Gradual fill", route: "Inhalation", duration: "Until loss of respiration" },
  ],
  "IACUC-2026-0139": [
    { reason_for_use: "Anesthesia", drug: "Isoflurane", dose: "1.5–2%", route: "Inhalation", duration: "30 min" },
    { reason_for_use: "Analgesia", drug: "Meloxicam", dose: "1 mg/kg", route: "SC", duration: "q24h × 3 days" },
    { reason_for_use: "Euthanasia", drug: "Pentobarbital", dose: "150 mg/kg", route: "IP", duration: "Single dose" },
  ],
  "IACUC-2025-0098": [
    { reason_for_use: "Vaccination", drug: "Inactivated H5N8 antigen", dose: "0.5 mL", route: "IM", duration: "Single dose + boost" },
    { reason_for_use: "Analgesia", drug: "Meloxicam", dose: "0.5 mg/kg", route: "PO", duration: "q24h × 3 days" },
  ],
  "IACUC-2026-0021": [
    { reason_for_use: "Anesthesia", drug: "Ketamine/Xylazine", dose: "35/5 mg/kg", route: "IM", duration: "30–40 min" },
    { reason_for_use: "Analgesia", drug: "Buprenorphine SR", dose: "0.1 mg/kg", route: "SC", duration: "72h" },
  ],
  "IACUC-2025-0064": [
    { reason_for_use: "Anesthesia", drug: "Ketamine", dose: "10 mg/kg", route: "IM", duration: "Sedation for exams" },
  ],
  "IACUC-2026-0150": [
    { reason_for_use: "Anesthesia", drug: "Isoflurane", dose: "2%", route: "Inhalation", duration: "45 min" },
    { reason_for_use: "Analgesia", drug: "Buprenorphine SR", dose: "0.65 mg/kg", route: "SC", duration: "72h" },
    { reason_for_use: "Euthanasia", drug: "Pentobarbital", dose: "150 mg/kg", route: "IP", duration: "Single dose" },
  ],
  "IACUC-2026-0147": [
    { reason_for_use: "Tumor induction", drug: "B16-F10 melanoma cells", dose: "1×10^6 cells", route: "SC", duration: "Single injection" },
    { reason_for_use: "Anesthesia", drug: "Isoflurane", dose: "1–2%", route: "Inhalation", duration: "10 min" },
  ],
  "IACUC-2025-0102": [
    { reason_for_use: "Analgesia", drug: "Flunixin meglumine", dose: "2.2 mg/kg", route: "IM", duration: "q24h × 3 days" },
  ],
  "IACUC-2026-0155": [
    { reason_for_use: "Anesthesia", drug: "Ketamine/Dexmedetomidine", dose: "30/0.05 mg/kg", route: "IM", duration: "60 min" },
    { reason_for_use: "Analgesia", drug: "Buprenorphine", dose: "0.05 mg/kg", route: "SC", duration: "q12h × 72h" },
  ],
  "IACUC-2024-0023": [
    { reason_for_use: "Test compound dosing", drug: "Novel compounds 1–12", dose: "10–100 mg/kg", route: "PO", duration: "Daily × 28 days" },
    { reason_for_use: "Euthanasia", drug: "Carbon dioxide", dose: "Gradual fill", route: "Inhalation", duration: "Until loss of respiration" },
  ],
};

const animalUseSeed = {
  "IACUC-2026-0142": [
    { species_strain: "Mouse / C57BL/6", sex: "Male", approx_age: "8–10 weeks", max_count: 240 },
  ],
  "IACUC-2026-0139": [
    { species_strain: "Rat / Sprague-Dawley", sex: "Both", approx_age: "10–12 weeks", max_count: 80 },
  ],
  "IACUC-2025-0098": [
    { species_strain: "Chicken / White Leghorn", sex: "Both", approx_age: "4–6 weeks", max_count: 150 },
  ],
  "IACUC-2025-0091": [
    { species_strain: "Zebrafish / AB strain", sex: "Both", approx_age: "3 months at start", max_count: 500 },
  ],
  "IACUC-2026-0021": [
    { species_strain: "Rabbit / New Zealand White", sex: "Female", approx_age: "12–16 weeks", max_count: 60 },
  ],
  "IACUC-2025-0064": [
    { species_strain: "Macaque / M. mulatta", sex: "Both", approx_age: "4–8 years", max_count: 24 },
  ],
  "IACUC-2026-0150": [
    { species_strain: "Rat / Long-Evans", sex: "Male", approx_age: "12 weeks", max_count: 120 },
  ],
  "IACUC-2026-0147": [
    { species_strain: "Mouse / NOD.Cg-Prkdcscid", sex: "Both", approx_age: "6–8 weeks", max_count: 200 },
  ],
  "IACUC-2025-0102": [
    { species_strain: "Pig / Yorkshire cross", sex: "Both", approx_age: "8–10 weeks", max_count: 36 },
  ],
  "IACUC-2026-0155": [
    { species_strain: "Rabbit / New Zealand White", sex: "Both", approx_age: "16–20 weeks", max_count: 60 },
  ],
  "IACUC-2026-0158": [
    { species_strain: "Zebrafish / mutant line", sex: "Both", approx_age: "Larvae to adult", max_count: 800 },
  ],
  "IACUC-2024-0023": [
    { species_strain: "Rat / Sprague-Dawley", sex: "Both", approx_age: "8 weeks", max_count: 150 },
  ],
};

const alternativesSeed = {
  "IACUC-2026-0142": {
    replacement_text: "In-vitro organotypic hippocampal slice cultures were used to screen stressors before any in-vivo work.",
    refinement_text: "Refined restraint tubes and habituation reduce distress; group housing maintained where possible.",
    reduction_text: "Sample size powered at 0.9 with 2-sided alpha 0.05; pooled tissue samples minimize animal numbers.",
    lit_databases: "PubMed, Web of Science",
    lit_years_from: "2015",
    lit_years_to: "2026",
    lit_search_date: "2026-06-20",
    lit_keywords: "chronic stress, corticosterone, mouse, restraint",
    lit_summary: "Review of 3R alternatives confirmed no non-animal model reproduces the neuroendocrine phenotype.",
    colleague_name: "Dr. Priya Nair",
    colleague_date: "2026-06-22",
    colleague_notes: "Confirmed restraint duration within welfare guidelines.",
    av_consult_date: "2026-06-23",
  },
  "IACUC-2026-0139": {
    replacement_text: "Langendorff isolated heart perfusion used for preliminary pharmacology.",
    refinement_text: "Post-operative analgesia and continuous telemetry monitoring reduce pain and distress.",
    reduction_text: "Endpoint histology uses serial sections from the same animals, reducing total numbers.",
    lit_databases: "PubMed, Embase",
    lit_years_from: "2018",
    lit_years_to: "2026",
    lit_search_date: "2026-06-01",
    lit_keywords: "myocardial infarction, cardiac regeneration, rodent model",
    lit_summary: "No in-silico or in-vitro model replicates chronic post-infarct remodeling.",
    colleague_name: null,
    colleague_date: null,
    colleague_notes: null,
    av_consult_date: null,
  },
  "IACUC-2025-0098": {
    replacement_text: "Pseudotyped virus neutralization assays replace live challenge where possible.",
    refinement_text: "Use of inactivated rather than live strains reduces shedding risk.",
    reduction_text: "Statistical design reduces flock size vs. prior trials.",
    lit_databases: "PubMed, AGRICOLA",
    lit_years_from: "2019",
    lit_years_to: "2026",
    lit_search_date: "2025-01-02",
    lit_keywords: "avian influenza, vaccine efficacy, poultry",
    lit_summary: "Mandatory live-animal challenge retained to satisfy regulatory efficacy endpoints.",
    colleague_name: null,
    colleague_date: null,
    colleague_notes: null,
    av_consult_date: null,
  },
  "IACUC-2025-0091": {
    replacement_text: "Cell culture models of adipogenesis used for initial diet screening.",
    refinement_text: "Cohort housing and enrichment reduce stress.",
    reduction_text: "Longitudinal sampling from the same cohort avoids separate groups.",
    lit_databases: "PubMed",
    lit_years_from: "2016",
    lit_years_to: "2026",
    lit_search_date: "2025-01-20",
    lit_keywords: "diet-induced obesity, zebrafish, metabolism",
    lit_summary: "Zebrafish chosen for metabolic parallelism and high throughput.",
    colleague_name: null,
    colleague_date: null,
    colleague_notes: null,
    av_consult_date: null,
  },
  "IACUC-2026-0150": {
    replacement_text: "Computational models of the basal ganglia guide electrode targeting before surgery.",
    refinement_text: "Wireless stimulation and minimal handling reduce stress.",
    reduction_text: "Within-subject design halves the number of animals required.",
    lit_databases: "PubMed, IEEE Xplore",
    lit_years_from: "2017",
    lit_years_to: "2026",
    lit_search_date: "2026-04-28",
    lit_keywords: "deep brain stimulation, Parkinson, rat",
    lit_summary: "No non-animal system reproduces the circuit-level response to DBS.",
    colleague_name: "Dr. Harold Kim",
    colleague_date: "2026-05-02",
    colleague_notes: "Endorsed refinement of stimulation parameters.",
    av_consult_date: "2026-05-05",
  },
  "IACUC-2026-0147": {
    replacement_text: "Co-culture assays used for initial CAR-T potency testing.",
    refinement_text: "Ultrasound imaging tracks tumor burden without surgery.",
    reduction_text: "Tumor burden measured non-invasively to reuse animals across timepoints.",
    lit_databases: "PubMed, Scopus",
    lit_years_from: "2018",
    lit_years_to: "2026",
    lit_search_date: "2026-05-20",
    lit_keywords: "adoptive cell therapy, melanoma, immunodeficient mouse",
    lit_summary: "In-vivo tumor model required for efficacy and toxicity assessment.",
    colleague_name: "Dr. Priya Nair",
    colleague_date: "2026-05-28",
    colleague_notes: "Approved tumor size endpoint of 2000 mm3.",
    av_consult_date: "2026-05-29",
  },
  "IACUC-2024-0023": {
    replacement_text: "In-vitro toxicity panels (HepG2) pre-screen compounds before in-vivo dosing.",
    refinement_text: "Feeding tube gavage under brief restraint; blood drawn from warmed tail vein.",
    reduction_text: "Dose-response uses shared control groups across compounds.",
    lit_databases: "PubMed, TOXNET",
    lit_years_from: "2014",
    lit_years_to: "2026",
    lit_search_date: "2024-08-30",
    lit_keywords: "toxicology, novel compounds, rat",
    lit_summary: "Regulatory 28-day repeated-dose study cannot be fully replaced in silico.",
    colleague_name: "Dr. Priya Nair",
    colleague_date: "2024-09-02",
    colleague_notes: "GI distress monitoring plan reviewed.",
    av_consult_date: "2024-09-03",
  },
};

// FCR votes — only for review protocols other than IACUC-2026-0142, which the
// e2e committee spec relies on being vote-free ("No votes cast yet.").
const votesSeed = [
  { protocol_id: "IACUC-2026-0150", voter: "Dr. Harold Kim", vote: "Approve", comment: "Surgical plan is well documented.", voted_at: "2026-06-02 09:00:00" },
  { protocol_id: "IACUC-2026-0150", voter: "Dr. Sofia Ramos", vote: "Request Modifications", comment: "Please add a pain-scoring rubric.", voted_at: "2026-06-05 14:30:00" },
  { protocol_id: "IACUC-2026-0150", voter: "Jordan Blake", vote: "Approve", comment: null, voted_at: "2026-06-06 11:15:00" },
  { protocol_id: "IACUC-2026-0147", voter: "Dr. Marcus Chen", vote: "Table", comment: "Awaiting additional viral-shedding data.", voted_at: "2026-06-15 16:00:00" },
  { protocol_id: "IACUC-2026-0147", voter: "Dr. Amara Osei", vote: "Approve", comment: "Enrichment plan looks strong.", voted_at: "2026-06-16 10:45:00" },
];

const insertProtocol = db.prepare(`
  INSERT INTO protocols (
    id, title, pi, species, status, animals, pain_category, submitted, expires,
    pi_proxy, ptm_member, protocol_type, anesthesia_required, housing, disposal, npg, research_steps
  )
  VALUES (
    @id, @title, @pi, @species, @status, @animals, @pain_category, @submitted, @expires,
    @pi_proxy, @ptm_member, @protocol_type, @anesthesia_required, @housing, @disposal, @npg, @research_steps
  )
`);

const insertRelated = db.prepare(`
  INSERT INTO related_items (protocol_id, list_name, label) VALUES (?, ?, ?)
`);

const insertSpecies = db.prepare(`INSERT OR IGNORE INTO species (name) VALUES (?)`);
const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (name, is_committee) VALUES (?, ?)`);
const getRoleId = db.prepare(`SELECT id FROM roles WHERE name = ?`);
const insertPersonnel = db.prepare(`
  INSERT INTO personnel (name, email, role_id) VALUES (?, ?, ?)
`);

const insertProcedure = db.prepare(`
  INSERT INTO protocol_procedures (protocol_id, procedure_key, checked, description)
  VALUES (?, ?, ?, ?)
`);
const insertDrug = db.prepare(`
  INSERT INTO protocol_drugs (protocol_id, reason_for_use, drug, dose, route, duration)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertAnimalUse = db.prepare(`
  INSERT INTO protocol_animal_use (protocol_id, species_strain, sex, approx_age, max_count)
  VALUES (?, ?, ?, ?, ?)
`);
const insertAlternatives = db.prepare(`
  INSERT INTO protocol_alternatives (
    protocol_id, replacement_text, refinement_text, reduction_text,
    lit_databases, lit_years_from, lit_years_to, lit_search_date, lit_keywords, lit_summary,
    colleague_name, colleague_date, colleague_notes, av_consult_date
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getPersonnelId = db.prepare(`SELECT id FROM personnel WHERE name = ?`);
const insertVote = db.prepare(`
  INSERT INTO protocol_votes (protocol_id, personnel_id, vote, comment, voted_at)
  VALUES (?, ?, ?, ?, ?)
`);

let procCount = 0, drugCount = 0, animalUseCount = 0, alternativesCount = 0;

db.exec("BEGIN");
try {
  db.exec("DELETE FROM protocol_votes; DELETE FROM protocol_procedures; DELETE FROM protocol_drugs;");
  db.exec("DELETE FROM protocol_animal_use; DELETE FROM protocol_alternatives;");
  db.exec("DELETE FROM personnel; DELETE FROM roles; DELETE FROM species;");
  db.exec("DELETE FROM related_items; DELETE FROM protocols;");

  for (const p of protocols) {
    insertProtocol.run({
      id: p.id,
      title: p.title,
      pi: p.pi,
      species: p.species ?? null,
      status: p.status ?? "Draft",
      animals: p.animals ?? null,
      pain_category: p.pain_category ?? null,
      submitted: p.submitted ?? null,
      expires: p.expires ?? null,
      pi_proxy: p.pi_proxy ?? null,
      ptm_member: p.ptm_member ?? null,
      protocol_type: p.protocol_type ?? null,
      anesthesia_required: p.anesthesia_required ?? 0,
      housing: p.housing ?? null,
      disposal: p.disposal ?? null,
      npg: p.npg ?? null,
      research_steps: p.research_steps ? JSON.stringify(p.research_steps) : null,
    });
  }
  for (const r of relatedItems) insertRelated.run(r.protocol_id, r.list_name, r.label);
  for (const s of species) insertSpecies.run(s);
  for (const r of roles) insertRole.run(r.name, r.is_committee ? 1 : 0);
  for (const p of personnel) {
    const role = getRoleId.get(p.role);
    insertPersonnel.run(p.name, p.email, role.id);
  }

  for (const [protocolId, rows] of Object.entries(proceduresSeed)) {
    for (const r of rows) {
      insertProcedure.run(protocolId, r.key, r.checked ? 1 : 0, r.description || null);
      procCount++;
    }
  }
  for (const [protocolId, rows] of Object.entries(drugsSeed)) {
    for (const r of rows) {
      insertDrug.run(protocolId, r.reason_for_use, r.drug, r.dose, r.route, r.duration);
      drugCount++;
    }
  }
  for (const [protocolId, rows] of Object.entries(animalUseSeed)) {
    for (const r of rows) {
      insertAnimalUse.run(protocolId, r.species_strain, r.sex, r.approx_age, r.max_count);
      animalUseCount++;
    }
  }
  for (const [protocolId, r] of Object.entries(alternativesSeed)) {
    insertAlternatives.run(
      protocolId,
      r.replacement_text, r.refinement_text, r.reduction_text,
      r.lit_databases, r.lit_years_from, r.lit_years_to, r.lit_search_date,
      r.lit_keywords, r.lit_summary,
      r.colleague_name, r.colleague_date, r.colleague_notes, r.av_consult_date,
    );
    alternativesCount++;
  }
  for (const v of votesSeed) {
    const voter = getPersonnelId.get(v.voter);
    insertVote.run(v.protocol_id, voter.id, v.vote, v.comment, v.voted_at);
  }

  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

console.log(
  `Seeded ${protocols.length} protocols, ${relatedItems.length} related items, ` +
  `${species.length} species, ${roles.length} roles, ${personnel.length} personnel, ` +
  `${procCount} procedures, ${drugCount} drugs, ${animalUseCount} animal-use rows, ` +
  `${alternativesCount} alternatives rows, ${votesSeed.length} votes.`
);
