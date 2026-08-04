import "dotenv/config";
import { db } from "./db.js";

const protocols = [
  { id: "IACUC-2026-0142", title: "Neurobehavioral Effects of Chronic Stress in C57BL/6 Mice", pi: "Dr. Elena Marsh", species: "Mouse", status: "IACUC Review", animals: 240, pain_category: "Category D", submitted: "2026-06-30", expires: null, review_method: "DMR", pi_proxy: "Sam Whitfield", ptm_member: "Dr. Priya Nair", protocol_type: "Research", anesthesia_required: 1, housing: "Group-housed 5/cage in ventilated cages on a 12:12 light cycle.", disposal: "Carbon dioxide euthanasia; carcasses incinerated per SOP.", npg: "None", research_steps: ["Habituate mice to handling for 7 days.", "Deliver corticosterone in drinking water for 21 days with daily restraint sessions.", "Collect brains and adrenals after euthanasia for histology and qPCR."], purpose_summary: "Study how chronic psychological stress changes the brain circuits that control anxiety and memory, using mice as a model to guide better treatments for stress-related psychiatric illness.", harm_benefit_analysis: "Animals undergo 21 days of daily restraint and corticosterone exposure — mild, reversible distress. The benefit is identifying stress-driven neuroendocrine mechanisms that could lead to new psychiatric interventions, which justifies the discomfort over current alternatives.", scientific_summary: "Characterize the neurobehavioral consequences of chronic stress in adult male C57BL/6 mice. Specific aims: (1) quantify anxiety-like behavior and spatial memory after 21 days of restraint plus corticosterone; (2) measure HPA-axis output via corticosterone and adrenal mass; (3) correlate hippocampal gene expression by qPCR with behavioral outcomes." },
  { id: "IACUC-2026-0139", title: "Cardiac Regeneration Following Induced Myocardial Infarction", pi: "Dr. Raj Patel", species: "Rat", status: "Approved", animals: 80, pain_category: "Category C", submitted: "2026-06-12", expires: "2029-06-12", pi_proxy: "Sam Whitfield", ptm_member: "Dr. Harold Kim", protocol_type: "Research", anesthesia_required: 1, housing: "Standard rat housing, 2/cage, corncob bedding, 12:12 light cycle, environmental enrichment provided.", disposal: "Sodium pentobarbital overdose followed by necropsy; carcasses incinerated per institutional SOP.", npg: "None", research_steps: ["Induce myocardial infarction by permanent LAD ligation under isoflurane anesthesia.", "Monitor animals with telemetry and echocardiography at 1, 4, and 8 weeks.", "Harvest hearts for histology and gene expression analysis."], purpose_summary: "Test whether the adult mammalian heart can regenerate after a heart attack when treated with candidate regenerative therapies.", harm_benefit_analysis: "Survival cardiac surgery with analgesia causes transient post-operative discomfort. The benefit is evaluating cardiac regeneration strategies that could reduce disability and death after human heart attacks.", scientific_summary: "Assess cardiac regeneration after permanent coronary ligation in rats. Aims: (1) quantify infarct size and scar remodeling by histology; (2) measure ejection fraction by echocardiography; (3) profile cell-cycle gene expression in border-zone myocardium." },
  { id: "IACUC-2025-0098", title: "Vaccine Efficacy Trial for Avian Influenza Strains", pi: "Dr. Wen Liu", species: "Chicken", status: "Active", animals: 150, pain_category: "Category B", submitted: "2025-01-08", expires: "2026-08-04" },
  { id: "IACUC-2025-0091", title: "Longitudinal Study of Diet-Induced Obesity in Zebrafish", pi: "Dr. Sofia Ramos", species: "Zebrafish", status: "Expiring soon", animals: 500, pain_category: "Category B", submitted: "2025-02-02", expires: "2026-09-01" },
  { id: "IACUC-2026-0021", title: "Wound Healing Comparison Across Rabbit Breeds", pi: "Dr. Marcus Chen", species: "Rabbit", status: "Draft", animals: 60, pain_category: "Category C", submitted: null, expires: null },
  { id: "IACUC-2025-0064", title: "Behavioral Enrichment Impact on Non-Human Primate Welfare", pi: "Dr. Amara Osei", species: "Macaque", status: "Active", animals: 24, pain_category: "Category B", submitted: "2025-11-20", expires: "2027-11-20" },
  { id: "IACUC-2026-0150", title: "Deep Brain Stimulation in a Rat Model of Parkinson's Disease", pi: "Dr. Priya Nair", species: "Rat", status: "IACUC Review", animals: 120, pain_category: "Category D", submitted: "2026-05-10", expires: null, review_method: "FCR", pi_proxy: "Dr. Elena Marsh", ptm_member: "Dr. Harold Kim", protocol_type: "Research", anesthesia_required: 1, housing: "Rat housing, 2/cage, enriched with nesting material and a red hut.", disposal: "Pentobarbital overdose, tissue harvested for histology, remaining carcass incinerated.", npg: "None", research_steps: ["Stereotaxically implant bilateral DBS electrodes into the subthalamic nucleus.", "Deliver 4 weeks of high-frequency stimulation with weekly motor scoring.", "Assess dopamine neuron survival and gliosis by immunohistochemistry."], purpose_summary: "Determine whether deep brain stimulation improves motor symptoms and slows disease progression in a rat model of Parkinson's disease.", harm_benefit_analysis: "Animals undergo survival stereotaxic surgery and brief restraint during stimulation sessions. The study informs DBS target refinement that could improve quality of life for Parkinson's patients.", scientific_summary: "Model Parkinsonian motor impairment via 6-OHDA lesion and test continuous DBS of the subthalamic nucleus. Aims: (1) motor function on cylinder and rotarod tests; (2) TH+ cell survival in the substantia nigra; (3) electrode-evoked field responses. Data will refine clinical DBS parameter selection." },
  { id: "IACUC-2026-0147", title: "Adoptive Cell Therapy Against Murine Melanoma", pi: "Dr. Harold Kim", species: "Mouse", status: "Veterinary Review", animals: 200, pain_category: "Category D", submitted: "2026-06-01", expires: null, review_method: "FCR", pi_proxy: "Sam Whitfield", ptm_member: "Dr. Priya Nair", protocol_type: "Research", anesthesia_required: 1, housing: "Immunodeficient mice housed in sterile ventilated cages with autoclaved feed and bedding.", disposal: "CO2 euthanasia followed by cervical dislocation; carcasses incinerated.", npg: "None", research_steps: ["Inject B16-F10 melanoma cells subcutaneously and allow tumors to establish.", "Administer CAR-T cells intravenously in the treatment arm.", "Monitor tumor burden by caliper and ultrasound; collect tumors and spleen for flow cytometry."], purpose_summary: "Test whether engineered immune cells (CAR-T) can eliminate established melanoma tumors in a mouse model of the disease.", harm_benefit_analysis: "Tumor-bearing mice experience the disease burden inherent to a cancer model, with humane endpoints capping tumor size. The benefit is informing next-generation adoptive cell therapies for melanoma patients.", scientific_summary: "Evaluate CAR-T cell efficacy against established subcutaneous B16-F10 melanoma in NOD scid gamma mice. Aims: (1) tumor growth kinetics; (2) CAR-T persistence and infiltration by flow cytometry; (3) survival analysis. Positive results would support progression to syngeneic models." },
  { id: "IACUC-2025-0102", title: "Environmental Enrichment and Social Behavior in Domestic Pigs", pi: "Dr. Marcus Chen", species: "Pig", status: "Active", animals: 36, pain_category: "Category C", submitted: "2025-03-15", expires: "2028-03-15" },
  { id: "IACUC-2026-0155", title: "Corneal Transplantation Techniques in Rabbits", pi: "Dr. Wen Liu", species: "Rabbit", status: "Submitted", animals: 60, pain_category: "Category C", submitted: "2026-07-20", expires: null, pi_proxy: "Dr. Amara Osei", ptm_member: "Dr. Harold Kim", protocol_type: "Research", anesthesia_required: 1, housing: "Rabbits individually housed in standard caging with ad libitum food and water, enriched with chew toys.", disposal: "Euthanized with pentobarbital; corneas harvested, carcasses incinerated.", npg: "None", research_steps: ["Perform penetrating keratoplasty with donor corneal grafts.", "Score graft clarity, vascularization, and rejection weekly for 8 weeks.", "Collect corneas for histologic assessment of graft survival."], purpose_summary: "Compare corneal graft survival between standard and modified transplantation techniques to reduce graft rejection in humans.", harm_benefit_analysis: "Animals undergo survival corneal surgery under anesthesia with post-operative analgesia. The benefit is improving corneal transplant outcomes, which restore sight in thousands of patients each year.", scientific_summary: "Penetrating keratoplasty in New Zealand White rabbits comparing suture versus sutureless graft apposition. Aims: (1) graft clarity score; (2) corneal neovascularization index; (3) histologic graft rejection at 8 weeks." },
  { id: "IACUC-2026-0158", title: "Genetic Basis of Spontaneous Seizures in Zebrafish", pi: "Dr. Amara Osei", species: "Zebrafish", status: "Draft", animals: 800, pain_category: "Category B", submitted: null, expires: null, pi_proxy: "Dr. Wen Liu", ptm_member: "Dr. Priya Nair", protocol_type: "Breeding", anesthesia_required: 0, housing: "Recirculating aquatic system, 28°C, density ≤5 fish/L.", disposal: "Tricaine overdose followed by incineration.", npg: "None", research_steps: ["Maintain mutant and wild-type lines.", "Score seizure behavior from video recordings.", "Genotype offspring via fin-clip PCR."], purpose_summary: "Identify the genetic mutations that cause spontaneous seizures in a zebrafish line, providing a screening platform for epilepsy therapies.", harm_benefit_analysis: "Zebrafish are a high-throughput vertebrate model; larval seizure scoring is non-invasive. The benefit is a rapid pre-clinical screen for antiseizure compounds.", scientific_summary: "Characterize spontaneous seizure phenotypes in a novel zebrafish mutant line. Aims: (1) confirm heritability by cross and fin-clip genotyping; (2) score seizure-like behavior from video; (3) localize candidate genes by whole-exome sequencing." },
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
  "Xenopus", "Gerbil", "Bovine",
];

// is_committee = 1 means this role is eligible to cast an FCR vote
const roles = [
  { name: "Principal Investigator", is_committee: 0 },
  { name: "Co-Investigator", is_committee: 0 },
  { name: "Lab Technician", is_committee: 0 },
  { name: "Research Assistant", is_committee: 0 },
  { name: "Postdoctoral Fellow", is_committee: 0 },
  { name: "Veterinary Technician", is_committee: 0 },
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
  { name: "Dr. Hana Sato", email: "h.sato@university.edu", role: "Postdoctoral Fellow" },
  { name: "Tom Nguyen", email: "t.nguyen@university.edu", role: "Research Assistant" },
  { name: "Ben Foster", email: "b.foster@university.edu", role: "Veterinary Technician" },
  { name: "Maya Patel", email: "maya.patel@university.edu", role: "IACUC Coordinator" },
];

// ---- personnel compliance (Domain C): CITI-style training + OHSP clearance ----
//
// Fixture design drives the e2e/css compliance story:
//  - Elena Marsh & Sam Whitfield (both on 0142) are fully compliant → green.
//  - Raj Patel (also on 0142) has no records → amber. So 0142 shows both
//    states on the detail page's Personnel panel.
//  - Marcus Chen (PI of 0021) has current training but OHSP Pending → amber.
//  - Jordan Blake has lapsed (expired) training → amber.
//  - Everyone else stays unseeded (No records / Pending) so the admin page
//    has a spread of statuses to show.
const trainingSeed = {
  "Dr. Elena Marsh": [
    { course: "Working with the IACUC", completed_date: "2025-01-15", expires_date: "2028-01-15" },
    { course: "Refinement of Rodent Handling", completed_date: "2025-03-02", expires_date: null },
  ],
  "Sam Whitfield": [
    { course: "Rodent Surgery Techniques", completed_date: "2025-02-01", expires_date: "2028-02-01" },
  ],
  "Dr. Priya Nair": [
    { course: "Attending Veterinarian Program", completed_date: "2024-06-01", expires_date: "2027-06-01" },
  ],
  "Dr. Harold Kim": [
    { course: "IACUC Chair Training", completed_date: "2025-03-01", expires_date: "2028-03-01" },
  ],
  "Dr. Sofia Ramos": [
    { course: "Committee Member Refresher", completed_date: "2025-05-01", expires_date: "2028-05-01" },
  ],
  "Dr. Marcus Chen": [
    { course: "Committee Member Refresher", completed_date: "2024-01-01", expires_date: "2027-01-01" },
  ],
  "Jordan Blake": [
    { course: "Non-Affiliated Member Training", completed_date: "2021-01-01", expires_date: "2024-01-01" },
  ],
};

const ohspSeed = {
  "Dr. Elena Marsh": { status: "Cleared", reviewed_date: "2026-01-10", notes: "Baseline health screening complete." },
  "Sam Whitfield": { status: "Cleared", reviewed_date: "2025-03-01", notes: null },
  "Dr. Priya Nair": { status: "Cleared", reviewed_date: "2024-06-15", notes: null },
  "Dr. Harold Kim": { status: "Cleared", reviewed_date: "2025-03-10", notes: null },
  "Dr. Sofia Ramos": { status: "Cleared", reviewed_date: "2025-05-10", notes: null },
  "Dr. Marcus Chen": { status: "Pending", reviewed_date: null, notes: "Awaiting annual health questionnaire." },
  "Jordan Blake": { status: "Cleared", reviewed_date: "2021-01-15", notes: null },
};

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
    { key: "non_survival_surgery", checked: 1, description: "Terminal LAD occlusion under anesthesia for infarction induction.",
      surgical_description: "Terminal left anterior descending coronary artery ligation under deep general anesthesia to induce myocardial infarction.",
      aseptic_preparation: "Surgical field clipped and disinfected with chlorhexidine; instruments autoclaved; surgeon gloved.",
      analgesia_level: "None" },
    { key: "survival_surgery", checked: 1, description: "Left anterior descending coronary artery ligation via thoracotomy.",
      surgical_description: "Left anterior descending coronary artery ligation via left thoracotomy for myocardial infarction induction.",
      aseptic_preparation: "Mice clipped, site prepped with alternating chlorhexidine and 70% ethanol; sterile instruments; aseptic technique.",
      analgesia_level: "Moderate",
      postop_care: "Monitored twice daily for 72 h post-op; buprenorphine q12h; LAMS consulted for weight loss > 20% or signs of heart failure." },
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
    { key: "survival_surgery", checked: 1, description: "Bilateral deep brain stimulation electrode implantation into the subthalamic nucleus.",
      surgical_description: "Bilateral deep brain stimulation electrode implantation into the subthalamic nucleus under stereotaxic guidance.",
      aseptic_preparation: "Scalp shaved and prepped with betadine; autoclaved stereotaxic instruments; sterile field maintained.",
      analgesia_level: "Mild",
      postop_care: "Rats checked daily for 7 days; meloxicam q24h × 3 days; staple removal at day 7." },
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
    { key: "survival_surgery", checked: 1, description: "Penetrating keratoplasty with donor grafts.",
      surgical_description: "Penetrating keratoplasty with donor corneal grafts under general anesthesia.",
      aseptic_preparation: "Ophthalmic site rinsed with sterile saline; instruments sterilized; aseptic draping.",
      analgesia_level: "Moderate",
      postop_care: "Monitored twice daily for 7 days; buprenorphine q12h × 72 h; topical antibiotic drops twice daily." },
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
  "IACUC-2026-0158": [
    { reason_for_use: "Anesthesia", drug: "Tricaine methanesulfonate (MS-222)", dose: "100 mg/L", route: "Bath immersion", duration: "5 min" },
    { reason_for_use: "Euthanasia", drug: "Tricaine methanesulfonate (MS-222)", dose: "250 mg/L", route: "Bath immersion", duration: "Until opercular movement ceases" },
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

// Animal usage register (the ledger of *actual* orders/uses against the
// approved allowance above). 0142 and 0158 stay under their allowance; 0021
// is deliberately seeded over its Rabbit allowance so the over-allowance flag
// has a fixture for tests.
const animalUsageSeed = {
  "IACUC-2026-0142": [
    { transaction_date: "2026-05-12", species_strain: "Mouse / C57BL/6", pain_level: "C", quantity: 60, type: "order", procedure_key: "injections", notes: "First cohort ordering" },
    { transaction_date: "2026-06-20", species_strain: "Mouse / C57BL/6", pain_level: "C", quantity: 55, type: "use", procedure_key: "injections", notes: "Cohort 1 on study" },
  ],
  "IACUC-2026-0158": [
    { transaction_date: "2026-07-02", species_strain: "Zebrafish / mutant line", pain_level: "B", quantity: 100, type: "order", procedure_key: null, notes: null },
  ],
  "IACUC-2026-0021": [
    { transaction_date: "2026-06-10", species_strain: "Rabbit / New Zealand White", pain_level: "D", quantity: 30, type: "order", procedure_key: "survival_surgery", notes: "Dressing change cohort" },
    { transaction_date: "2026-07-15", species_strain: "Rabbit / New Zealand White", pain_level: "D", quantity: 40, type: "use", procedure_key: "survival_surgery", notes: "Exceeds 60 allowance by 10" },
  ],
};

const experimentsSeed = {
  "IACUC-2026-0142": [
    {
      name: "Chronic restraint stress paradigm",
      description: "C57BL/6 mice are habituated, then exposed to 21 days of daily 2-hour restraint plus corticosterone in drinking water to model chronic psychological stress.",
      multiple_surgical_events: 0,
      humane_endpoints: "Euthanize if an animal loses >20% body weight, becomes moribund, or shows a distress score above 3 on the monitoring rubric.",
      persistent_clinical_signs_justification: null,
      monitoring_plan: "Animals checked twice daily for fur quality, posture, and responsiveness; LAMS consulted if any animal shows sustained clinical signs.",
      husbandry_exceptions: "Standard group housing maintained; no enrichment withdrawal.",
    },
  ],
  "IACUC-2026-0139": [
    {
      name: "Permanent coronary ligation",
      description: "LAD ligation via thoracotomy under isoflurane to induce myocardial infarction; telemetry and echocardiography at 1, 4, and 8 weeks.",
      multiple_surgical_events: 1,
      humane_endpoints: "Euthanize on >30% body weight loss or signs of heart failure (labored breathing, subcutaneous edema).",
      persistent_clinical_signs_justification: null,
      monitoring_plan: "Post-operative daily checks for 7 days, then weekly; surgical site inspected for infection; LAMS contacted for any unexpected clinical signs.",
      husbandry_exceptions: "Single housing during telemetry recording only.",
    },
  ],
  "IACUC-2026-0150": [
    {
      name: "Subthalamic nucleus DBS",
      description: "Bilateral electrodes stereotaxically implanted into the subthalamic nucleus after 6-OHDA lesion; 4 weeks of high-frequency stimulation with weekly motor scoring.",
      multiple_surgical_events: 0,
      humane_endpoints: "Euthanize on severe post-operative neurological deficit or infection unresponsive to treatment.",
      persistent_clinical_signs_justification: null,
      monitoring_plan: "Daily neurologic checks post-surgery; weekly cylinder and rotarod scoring during stimulation; LAMS consulted for any motor deficit.",
      husbandry_exceptions: null,
    },
  ],
  "IACUC-2026-0147": [
    {
      name: "Adoptive CAR-T therapy against B16-F10 melanoma",
      description: "NOD scid gamma mice receive subcutaneous B16-F10 injection, then CAR-T cells IV once tumors establish; tumor burden monitored by caliper and ultrasound.",
      multiple_surgical_events: 0,
      humane_endpoints: "Euthanize at tumor volume >2000 mm3, ulceration, or >20% body weight loss.",
      persistent_clinical_signs_justification: null,
      monitoring_plan: "Tumors measured twice weekly; mice checked daily for body condition; LAMS consulted on any clinical deterioration.",
      husbandry_exceptions: "Immunodeficient mice in sterile ventilated cages with autoclaved feed and bedding.",
    },
  ],
  "IACUC-2026-0155": [
    {
      name: "Penetrating keratoplasty comparison",
      description: "Rabbits undergo corneal grafting with suture or sutureless apposition; graft clarity, vascularization, and rejection scored weekly for 8 weeks.",
      multiple_surgical_events: 1,
      humane_endpoints: "Euthanize on severe graft rejection with corneal perforation or untreatable infection.",
      persistent_clinical_signs_justification: null,
      monitoring_plan: "Daily topical antibiotic and analgesic administration; weekly slit-lamp scoring; LAMS consulted for ocular complications.",
      husbandry_exceptions: null,
    },
  ],
  "IACUC-2026-0158": [
    {
      name: "Seizure phenotype characterization",
      description: "Zebrafish lines carrying seizure-associated mutations are maintained and seizure-like behavior scored from video; offspring genotyped by fin-clip PCR.",
      multiple_surgical_events: 0,
      humane_endpoints: "Larvae and adults euthanized on severe malformation or inability to feed; no painful endpoint anticipated.",
      persistent_clinical_signs_justification: null,
      monitoring_plan: "Daily tank checks for morbidity; water quality monitored; LAMS consulted for unexplained mortality.",
      husbandry_exceptions: null,
    },
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
  "IACUC-2026-0155": {
    replacement_text: "Ex-vivo corneal culture and computer simulation used for preliminary technique screening.",
    refinement_text: "Post-operative analgesia and topical antibiotics minimize discomfort and infection risk.",
    reduction_text: "Bilateral study design halves the number of recipient rabbits required.",
    lit_databases: "PubMed, Embase",
    lit_years_from: "2019",
    lit_years_to: "2026",
    lit_search_date: "2026-07-10",
    lit_keywords: "penetrating keratoplasty, corneal graft rejection, rabbit",
    lit_summary: "Rabbit model remains the accepted standard for corneal transplant research; no alternative reproduces graft-host biology.",
    colleague_name: null,
    colleague_date: null,
    colleague_notes: null,
    av_consult_date: null,
  },
  "IACUC-2026-0158": {
    replacement_text: "Cell-based seizure assays (in-vitro neuronal cultures) used to triage candidate genes before line generation.",
    refinement_text: "Larval video scoring is non-invasive and avoids handling stress in adults.",
    reduction_text: "Single breeding cohorts supply both experimental and control larvae, minimizing total fish used.",
    lit_databases: "PubMed, ZFIN",
    lit_years_from: "2018",
    lit_years_to: "2026",
    lit_search_date: "2026-03-15",
    lit_keywords: "zebrafish, seizure, epilepsy genetics, high-throughput screen",
    lit_summary: "Zebrafish chosen as the most humane high-throughput vertebrate model for genetic epilepsy screening.",
    colleague_name: null,
    colleague_date: null,
    colleague_notes: null,
    av_consult_date: null,
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

// Reviewer assignments per protocol. 0142 is the DMR protocol (a single
// designated member); 0150/0147 are FCR with primary/secondary reviewers.
// Assignments are NOT votes, so 0142 stays vote-free for the e2e committee spec.
const assignmentsSeed = {
  "IACUC-2026-0142": [
    { reviewer: "Dr. Sofia Ramos", role: "Designated Member" },
  ],
  "IACUC-2026-0150": [
    { reviewer: "Dr. Harold Kim", role: "Primary Reviewer" },
    { reviewer: "Dr. Priya Nair", role: "Secondary Reviewer" },
  ],
  "IACUC-2026-0147": [
    { reviewer: "Dr. Marcus Chen", role: "Primary Reviewer" },
    { reviewer: "Jordan Blake", role: "Secondary Reviewer" },
  ],
};

// Section-specific inline review comments (distinct from vote comments).
const commentsSeed = {
  "IACUC-2026-0142": [
    { commenter: "Dr. Sofia Ramos", section: "procedures", comment: "Please confirm the daily restraint duration is capped at 2 h." },
    { commenter: "Dr. Priya Nair", section: "overall", comment: "AV consult date is still missing for this Category D protocol." },
  ],
  "IACUC-2026-0150": [
    { commenter: "Dr. Harold Kim", section: "procedures", comment: "Add a fall-back targeting coordinate if the primary DBS lead placement is missed." },
    { commenter: "Dr. Marcus Chen", section: "drugs", comment: "Confirm buprenorphine dosing interval for the first 48 h post-op." },
  ],
  "IACUC-2026-0147": [
    { commenter: "Jordan Blake", section: "alternatives", comment: "The literature search should include a second database." },
    { commenter: "Dr. Amara Osei", section: "animal_use", comment: "Justify the 200-mouse cohort size with the power calculation." },
  ],
};

const insertProtocol = db.prepare(`
  INSERT INTO protocols (
    id, title, pi, species, status, animals, pain_category, submitted, expires,
    pi_proxy, ptm_member, protocol_type, anesthesia_required, housing, disposal, npg, research_steps,
    purpose_summary, harm_benefit_analysis, scientific_summary, review_method
  )
  VALUES (
    @id, @title, @pi, @species, @status, @animals, @pain_category, @submitted, @expires,
    @pi_proxy, @ptm_member, @protocol_type, @anesthesia_required, @housing, @disposal, @npg, @research_steps,
    @purpose_summary, @harm_benefit_analysis, @scientific_summary, @review_method
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
const insertTraining = db.prepare(`
  INSERT INTO personnel_training (personnel_id, course, completed_date, expires_date)
  VALUES (?, ?, ?, ?)
`);
const insertOhsp = db.prepare(`
  INSERT INTO personnel_ohsp (personnel_id, status, reviewed_date, notes)
  VALUES (?, ?, ?, ?)
`);

const insertProcedure = db.prepare(`
  INSERT INTO protocol_procedures (protocol_id, procedure_key, checked, description,
    surgical_description, aseptic_preparation, analgesia_level, postop_care)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertDrug = db.prepare(`
  INSERT INTO protocol_drugs (protocol_id, reason_for_use, drug, dose, route, duration)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertAnimalUse = db.prepare(`
  INSERT INTO protocol_animal_use (protocol_id, species_strain, sex, approx_age, max_count)
  VALUES (?, ?, ?, ?, ?)
`);
const insertExperiment = db.prepare(`
  INSERT INTO protocol_experiments (
    protocol_id, name, description, multiple_surgical_events,
    humane_endpoints, persistent_clinical_signs_justification,
    monitoring_plan, husbandry_exceptions
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAlternatives = db.prepare(`
  INSERT INTO protocol_alternatives (
    protocol_id, replacement_text, refinement_text, reduction_text,
    lit_databases, lit_years_from, lit_years_to, lit_search_date, lit_keywords, lit_summary,
    colleague_name, colleague_date, colleague_notes, av_consult_date
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
// The structured 3 Rs justifications are seeded from the same source data as
// the legacy replacement/refinement/reduction blobs above. The blobs remain in
// the DB for backward compatibility but are no longer read by the API.
const RRR_METHODS = {
  replacement: "Screening of non-animal models",
  refinement: "Welfare refinement of procedures",
  reduction: "Statistical and experimental design",
};
const insertRrrEntry = db.prepare(`
  INSERT INTO protocol_rrr_entries (protocol_id, rrr_type, method, explanation)
  VALUES (?, ?, ?, ?)
`);
const getPersonnelId = db.prepare(`SELECT id FROM personnel WHERE name = ?`);
const insertVote = db.prepare(`
  INSERT INTO protocol_votes (protocol_id, personnel_id, vote, comment, voted_at)
  VALUES (?, ?, ?, ?, ?)
`);
const insertUsage = db.prepare(`
  INSERT INTO animal_usage_transactions
    (protocol_id, transaction_date, species_strain, pain_level, quantity, type, procedure_key, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAssignment = db.prepare(`
  INSERT INTO protocol_review_assignments (protocol_id, personnel_id, role)
  VALUES (?, ?, ?)
`);
const insertComment = db.prepare(`
  INSERT INTO protocol_review_comments (protocol_id, personnel_id, section, comment)
  VALUES (?, ?, ?, ?)
`);

let procCount = 0, drugCount = 0, animalUseCount = 0, alternativesCount = 0, experimentCount = 0, rrrCount = 0, usageCount = 0, assignmentCount = 0, commentCount = 0, trainingCount = 0, ohspCount = 0;

db.exec("BEGIN");
try {
  db.exec("DELETE FROM protocol_votes; DELETE FROM protocol_procedures; DELETE FROM protocol_drugs;");
  db.exec("DELETE FROM protocol_animal_use; DELETE FROM protocol_alternatives;");
  db.exec("DELETE FROM protocol_experiments; DELETE FROM protocol_rrr_entries;");
  db.exec("DELETE FROM animal_usage_transactions;");
  db.exec("DELETE FROM protocol_review_comments; DELETE FROM protocol_review_assignments;");
  db.exec("DELETE FROM personnel_training; DELETE FROM personnel_ohsp;");
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
      purpose_summary: p.purpose_summary ?? null,
      harm_benefit_analysis: p.harm_benefit_analysis ?? null,
      scientific_summary: p.scientific_summary ?? null,
      review_method: p.review_method ?? null,
    });
  }
  for (const r of relatedItems) insertRelated.run(r.protocol_id, r.list_name, r.label);
  for (const s of species) insertSpecies.run(s);
  for (const r of roles) insertRole.run(r.name, r.is_committee ? 1 : 0);
  for (const p of personnel) {
    const role = getRoleId.get(p.role);
    insertPersonnel.run(p.name, p.email, role.id);
  }
  for (const [name, courses] of Object.entries(trainingSeed)) {
    const person = getPersonnelId.get(name);
    for (const c of courses) {
      insertTraining.run(person.id, c.course, c.completed_date, c.expires_date ?? null);
      trainingCount++;
    }
  }
  for (const [name, ohsp] of Object.entries(ohspSeed)) {
    const person = getPersonnelId.get(name);
    insertOhsp.run(person.id, ohsp.status, ohsp.reviewed_date, ohsp.notes);
    ohspCount++;
  }

  for (const [protocolId, rows] of Object.entries(proceduresSeed)) {
    for (const r of rows) {
      insertProcedure.run(
        protocolId, r.key, r.checked ? 1 : 0, r.description || null,
        r.surgical_description || null, r.aseptic_preparation || null,
        r.analgesia_level || null, r.postop_care || null
      );
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
  for (const [protocolId, rows] of Object.entries(experimentsSeed)) {
    for (const r of rows) {
      insertExperiment.run(
        protocolId,
        r.name,
        r.description,
        r.multiple_surgical_events ? 1 : 0,
        r.humane_endpoints,
        r.persistent_clinical_signs_justification,
        r.monitoring_plan,
        r.husbandry_exceptions,
      );
      experimentCount++;
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
    for (const [type, method] of Object.entries(RRR_METHODS)) {
      insertRrrEntry.run(protocolId, type, method, r[`${type}_text`]);
      rrrCount++;
    }
  }
  for (const v of votesSeed) {
    const voter = getPersonnelId.get(v.voter);
    insertVote.run(v.protocol_id, voter.id, v.vote, v.comment, v.voted_at);
  }
  for (const [protocolId, rows] of Object.entries(assignmentsSeed)) {
    for (const r of rows) {
      const reviewer = getPersonnelId.get(r.reviewer);
      insertAssignment.run(protocolId, reviewer.id, r.role);
      assignmentCount++;
    }
  }
  for (const [protocolId, rows] of Object.entries(commentsSeed)) {
    for (const r of rows) {
      const commenter = getPersonnelId.get(r.commenter);
      insertComment.run(protocolId, commenter.id, r.section, r.comment);
      commentCount++;
    }
  }
  for (const [protocolId, rows] of Object.entries(animalUsageSeed)) {
    for (const r of rows) {
      insertUsage.run(
        protocolId, r.transaction_date, r.species_strain, r.pain_level,
        r.quantity, r.type, r.procedure_key, r.notes,
      );
      usageCount++;
    }
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
  `${experimentCount} experiments, ${alternativesCount} alternatives rows, ${rrrCount} 3Rs entries, ${votesSeed.length} votes, ${usageCount} usage transactions, ${assignmentCount} assignments, ${commentCount} review comments, ${trainingCount} training records, ${ohspCount} OHSP clearances.`
);
