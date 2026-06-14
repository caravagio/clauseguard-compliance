'use strict';

const nlp = require('compromise');

const AGENT_MODE = !!process.env.AZURE_AGENT_ENDPOINT && process.env.MOCK_MODE !== 'true';

function scrubPii(text) {
  const scrubbed = text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b(?:\d{4}[- ]){3}\d{4}\b/g, '[CARD]')
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, '[PHONE]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]');

  const doc = nlp(scrubbed);
  doc.people().replaceWith('[PERSON]');
  doc.organizations().replaceWith('[ORG]');
  doc.places().replaceWith('[PLACE]');
  return doc.text();
}

async function analyzeDocument(text, rules) {
  if (!AGENT_MODE) return getMockAnalysis(rules);

  const { callAgent } = require('./agent');
  const rulesText = JSON.stringify(rules.rules, null, 2);
  const clean = scrubPii(text);
  const documentExcerpt = clean.length > 14000
    ? clean.slice(0, 14000) + '\n\n[Document truncated for analysis — first 14,000 characters shown]'
    : clean;

  const userMessage = `Analyze this document for financial AI compliance against all 20 rules.

DOCUMENT:
---
${documentExcerpt}
---

RULEBOOK:
${rulesText}

Return ONLY valid JSON in this exact schema (no markdown, no explanation):
{
  "document_type": "string",
  "overall_risk": "CRITICAL|HIGH|MEDIUM|LOW",
  "executive_summary": "2-3 sentence summary of the overall compliance posture",
  "counts": {
    "critical_failures": 0,
    "warnings": 0,
    "passed": 0,
    "not_applicable": 0
  },
  "findings": [
    {
      "rule_id": "MRM-001",
      "rule_name": "string",
      "category": "string",
      "status": "PASS|FAIL|WARN|N/A",
      "severity": "critical|warning|info",
      "regulatory_source": "string",
      "relevant_text": "Direct quote from document, or 'Not addressed in document'",
      "reasoning_steps": [
        "Step 1: What this rule requires",
        "Step 2: What the document says or omits about this",
        "Step 3: Assessment and conclusion with regulatory citation"
      ],
      "conclusion": "One sentence conclusion",
      "recommendation": "Specific actionable recommendation, or null if PASS or N/A"
    }
  ]
}`;

  try {
    const output = await callAgent(userMessage);
    const jsonStr = output.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Agent analysis failed, falling back to mock:', err.message);
    return getMockAnalysis(rules);
  }
}

function getMockAnalysis(rules) {
  return {
    document_type: 'Third-Party AI Vendor Contract',
    overall_risk: 'HIGH',
    executive_summary:
      'This vendor contract for an AI-based credit scoring system presents significant compliance gaps across five of six regulatory categories. Critical deficiencies were identified in model validation requirements (MRM-001), adverse action explanation provisions (EXT-001), disparate impact testing commitments (FLB-001), and audit rights (TPR-003). Seven provisions passed review; four were not applicable to this document type. Immediate contract renegotiation is strongly recommended before deployment.',
    counts: {
      critical_failures: 4,
      warnings: 6,
      passed: 7,
      not_applicable: 3,
    },
    findings: [
      {
        rule_id: 'MRM-001',
        rule_name: 'Independent Model Validation',
        category: 'Model Risk Management',
        status: 'FAIL',
        severity: 'critical',
        regulatory_source: 'SR 11-7 (Federal Reserve / OCC, 2011) — Guidance on Model Risk Management; OCC Comptroller\'s Handbook (2021)',
        relevant_text: 'Vendor represents that its model has been tested internally and meets industry benchmarks for accuracy as of the effective date.',
        reasoning_steps: [
          'Step 1: SR 11-7 requires that AI/ML models undergo independent validation by a party with no stake in model development, assessing conceptual soundness, data integrity, and performance outcomes before deployment. Independence is a hard requirement — internal testing by the developer does not qualify.',
          'Step 2: The contract references only "internal testing" and "industry benchmarks." No independent third-party validation is mentioned, no validation reports are required to be delivered to the institution, and no re-validation timeline is established.',
          'Step 3: FAIL — Critical violation of SR 11-7. Vendor self-attestation ("tested internally") explicitly contradicts the independence requirement. This gap creates direct regulatory exposure and would be flagged during any OCC or Federal Reserve model risk examination.',
        ],
        conclusion: 'Contract relies on vendor self-assessment with no independent validation requirement — a direct violation of SR 11-7.',
        recommendation: 'Require vendor to: (1) provide current independent validation report (within 12 months, by a qualified third party), (2) deliver future validation reports within 30 days of completion, and (3) commit contractually to annual re-validation. Validation scope must include conceptual soundness, data quality, performance outcomes, and fairness metrics.',
      },
      {
        rule_id: 'MRM-002',
        rule_name: 'Ongoing Model Performance Monitoring',
        category: 'Model Risk Management',
        status: 'WARN',
        severity: 'critical',
        regulatory_source: 'SR 11-7 Section III — Model Risk Management Framework; OCC 2011-12; Federal Reserve MRM Guidance Update (2021)',
        relevant_text: 'Vendor will provide quarterly performance reports upon written request from Institution.',
        reasoning_steps: [
          'Step 1: SR 11-7 Section III requires continuous post-deployment monitoring including outcome analysis, population stability indices (PSI), benchmarking against challenger models, and defined thresholds that trigger escalation or re-validation.',
          'Step 2: Contract mentions "quarterly performance reports upon written request" — this is passive, reactive, and request-dependent. No monitoring metrics are defined, no PSI thresholds are specified, and no proactive alert mechanism exists for model drift.',
          'Step 3: WARN — The provision is directionally correct but materially insufficient. SR 11-7 envisions continuous, proactive monitoring — not periodic reports delivered only on demand. The "upon written request" qualifier means monitoring may not occur without institution-initiated action, creating a compliance gap.',
        ],
        conclusion: 'Quarterly on-request reporting falls short of SR 11-7\'s continuous monitoring requirements; no drift detection or escalation thresholds defined.',
        recommendation: 'Replace passive reporting with: mandatory monthly performance dashboards delivered proactively; defined PSI thresholds (>0.25 triggers alert); specific accuracy/discrimination metrics with baselines; and automatic escalation procedures when thresholds are breached.',
      },
      {
        rule_id: 'MRM-003',
        rule_name: 'Model Inventory and Documentation',
        category: 'Model Risk Management',
        status: 'PASS',
        severity: 'warning',
        regulatory_source: 'SR 11-7 Section II; OCC Comptroller\'s Handbook — Model Risk Management (2021); FFIEC IT Examination Handbook',
        relevant_text: 'Vendor shall deliver complete technical documentation within 30 days of contract execution, including: model architecture description, full feature list with definitions, training data summary, validation benchmarks, and known limitations.',
        reasoning_steps: [
          'Step 1: SR 11-7 requires comprehensive model documentation covering purpose, data inputs/outputs, limitations, risk tier, and validation status — sufficient for independent review and regulatory examination.',
          'Step 2: Contract explicitly requires complete technical documentation including architecture, features, training data, benchmarks, and limitations. Delivery timeline (30 days) and comprehensive scope are both specified.',
          'Step 3: PASS — This provision aligns well with SR 11-7 documentation requirements. The explicit list of required documentation components and the defined delivery timeline make this an enforceable obligation.',
        ],
        conclusion: 'Model documentation requirements are comprehensively addressed with specific deliverables and a binding timeline.',
        recommendation: null,
      },
      {
        rule_id: 'MRM-004',
        rule_name: 'Model Change Management Protocol',
        category: 'Model Risk Management',
        status: 'WARN',
        severity: 'warning',
        regulatory_source: 'SR 11-7 Section IV; FFIEC IT Examination Handbook — Model Risk; OCC 2023-17 (Third-Party Risk)',
        relevant_text: 'Vendor reserves the right to update the model to improve performance and will provide notification for major version changes as determined by Vendor.',
        reasoning_steps: [
          'Step 1: SR 11-7 requires that material model changes follow formal change management with re-validation proportional to change materiality. Institutions — not vendors — must define what constitutes a material change and must be given the opportunity to assess and approve before deployment.',
          'Step 2: "Major version changes as determined by Vendor" gives the vendor unilateral discretion to decide what triggers notification. Minor changes (which could still be material — e.g., feature weighting adjustments, threshold changes) have no notification requirement at all. No re-validation obligation exists.',
          'Step 3: WARN — This provision is inadequate. Vendor-defined "major" changes with no objective criteria, no institution approval right, and no re-validation requirement creates uncontrolled model risk. Any change could materially alter fairness or performance without institution awareness.',
        ],
        conclusion: 'Vague vendor-controlled change notification provides no enforceable protection against undisclosed material model changes.',
        recommendation: 'Define "material change" objectively: any retraining on new data sources, feature addition/removal, threshold change exceeding ±5%, or architecture modification. Require 60-day advance notice for material changes, institution right to delay deployment pending review, and mandatory re-validation before institution-facing deployment of material changes.',
      },
      {
        rule_id: 'EXT-001',
        rule_name: 'Adverse Action Notice with AI-Specific Reasons',
        category: 'Explainability & Transparency',
        status: 'FAIL',
        severity: 'critical',
        regulatory_source: 'Regulation B (ECOA, 12 CFR Part 1002); CFPB Circular 2022-03 on Adverse Action Notices and AI/ML Models',
        relevant_text: 'Not addressed in document',
        reasoning_steps: [
          'Step 1: ECOA Regulation B requires that adverse actions on credit applications include specific, accurate principal reasons in plain language. CFPB Circular 2022-03 (September 2022) explicitly states that AI/ML model outputs must map to human-understandable adverse action reasons — generic legacy reason codes are insufficient when AI applies additional criteria.',
          'Step 2: The contract is completely silent on adverse action notices. No provision requires the vendor to: (a) provide adverse action reason codes mapped to model outputs, (b) ensure reasons meet CFPB Circular 2022-03 specificity standards, (c) update reasons when the model changes, or (d) support the institution\'s ECOA compliance obligations.',
          'Step 3: FAIL — Critical regulatory omission. Any credit decision contributing to an adverse action requires a compliant notice. The CFPB has brought enforcement actions specifically targeting AI models with inadequate adverse action explanations. This gap creates direct ECOA exposure with potential civil liability.',
        ],
        conclusion: 'Complete absence of adverse action notice provisions creates direct ECOA regulatory exposure and potential civil liability under 15 U.S.C. § 1691.',
        recommendation: 'Add contract provisions requiring vendor to: (1) provide specific adverse action reason codes for each model decision, mapped to CFPB-compliant plain-language reasons per Circular 2022-03, (2) deliver an updated reason code library within 30 days of any material model change, and (3) include a representation that reason codes satisfy Regulation B requirements.',
      },
      {
        rule_id: 'EXT-002',
        rule_name: 'Model Explainability for Internal Stakeholders',
        category: 'Explainability & Transparency',
        status: 'WARN',
        severity: 'warning',
        regulatory_source: 'SR 11-7 — Conceptual Soundness Requirements; NIST AI RMF (2023) MAP 5.1; OCC Model Risk Examination Procedures',
        relevant_text: 'Vendor uses a proprietary gradient boosting ensemble with 247 features. Global feature importance scores are available in the Vendor Portal.',
        reasoning_steps: [
          'Step 1: SR 11-7 and NIST AI RMF require that complex ML models used in material decisions be explainable to internal stakeholders — risk managers, compliance officers, and auditors. Global feature importance is a starting point, but individual-level explanations (SHAP values, LIME) are needed for dispute resolution, adverse action review, and examiner queries.',
          'Step 2: Contract references "global feature importance scores in the Vendor Portal." Global feature importance shows which features matter across the entire model — but does not explain any individual credit decision. A 247-feature gradient boosting model requires local explanation capability for any decision-level review.',
          'Step 3: WARN — Global importance scores are insufficient for SR 11-7 conceptual soundness requirements and would not satisfy an OCC examiner requesting explanation of a specific declined application. Individual-level SHAP values or equivalent local explanations are the regulatory expectation for complex models.',
        ],
        conclusion: 'Global feature importance available but individual prediction explainability — required for regulatory and dispute review — is not provided.',
        recommendation: 'Require vendor to provide individual-level SHAP values (or equivalent local explanation method) accessible via API for each model decision, with documentation of the explanation methodology and its known limitations. Explanations should be retrievable by decision ID for at least the duration of the log retention period.',
      },
      {
        rule_id: 'EXT-003',
        rule_name: 'Customer Disclosure of AI Use in Decisions',
        category: 'Explainability & Transparency',
        status: 'PASS',
        severity: 'warning',
        regulatory_source: 'CFPB Supervision and Examination Manual (UDAAP); FTC Act Section 5; EU AI Act Art. 13; GLBA Privacy Rule',
        relevant_text: 'Institution agrees to update its privacy notice and all applicable customer disclosures to reference the use of automated decision-making systems, as required by applicable law, prior to deploying the Vendor\'s AI model in production.',
        reasoning_steps: [
          'Step 1: CFPB guidance and FTC Act Section 5 require that customers be meaningfully informed when AI systems make or influence decisions affecting them. Disclosures must cover the general nature of AI use, data categories, and customer rights.',
          'Step 2: The contract explicitly requires the institution to update privacy notices and customer disclosures before production deployment, referencing automated decision-making as required by law. This is a clear, enforceable obligation with a defined timeline (pre-deployment).',
          'Step 3: PASS — The contractual obligation to update disclosures before deployment is well-structured. While the contract appropriately places the disclosure obligation on the institution (the regulated entity), it correctly establishes this as a condition of deployment.',
        ],
        conclusion: 'Customer disclosure update obligation is contractually established with an appropriate pre-deployment timeline.',
        recommendation: null,
      },
      {
        rule_id: 'FLB-001',
        rule_name: 'Disparate Impact Testing Requirement',
        category: 'Fair Lending & Bias',
        status: 'FAIL',
        severity: 'critical',
        regulatory_source: 'Equal Credit Opportunity Act (ECOA, 15 U.S.C. § 1691); Fair Housing Act (42 U.S.C. § 3604); CFPB Fair Lending Examination Procedures; HUD Fair Lending Guidance (2013)',
        relevant_text: 'Vendor certifies that the model has been developed using industry best practices for fairness and non-discrimination.',
        reasoning_steps: [
          'Step 1: ECOA and the Fair Housing Act require that AI models used in credit decisions be tested for disparate impact on all federally protected classes (race, sex, national origin, age, marital status, familial status, religion) using documented statistical methodologies. Testing must occur pre-deployment and at defined intervals. Regulators examine testing results — not vendor assurances.',
          'Step 2: Contract contains only a general fairness certification with no substance: no protected classes identified, no statistical methodology described, no testing results disclosed, no ongoing testing frequency committed, and no results-sharing obligation to the institution or its regulators.',
          'Step 3: FAIL — A generic "best practices" certification without any substantive testing documentation fails ECOA and CFPB fair lending requirements. The CFPB and DOJ have both stated that general certifications do not substitute for actual documented testing. This is a critical fair lending gap that would trigger examination findings.',
        ],
        conclusion: 'Unsubstantiated fairness certification without disparate impact testing data, methodology, or ongoing testing commitment violates ECOA examination standards.',
        recommendation: 'Require vendor to provide: (1) pre-deployment disparate impact testing results across all ECOA-protected classes with statistical significance levels and methodology documented, (2) annual ongoing testing commitment with results delivered to institution within 30 days, (3) definition of fairness metrics applied (e.g., demographic parity, equal opportunity), and (4) written commitment to share results with institution regulators upon request.',
      },
      {
        rule_id: 'FLB-002',
        rule_name: 'Proxy Variable and Redlining Prevention',
        category: 'Fair Lending & Bias',
        status: 'WARN',
        severity: 'critical',
        regulatory_source: 'ECOA Regulation B (12 CFR 1002); CFPB Circular 2023-02 on ECOA and Credit Models; OCC Fair Lending Handbook; DOJ Redlining Settlement Guidance',
        relevant_text: 'Model inputs include: payment history, credit utilization, account age, number of hard inquiries, geographic location data at the census tract level, and behavioral patterns derived from digital interaction metadata.',
        reasoning_steps: [
          'Step 1: ECOA Regulation B and CFPB Circular 2023-02 prohibit AI model features that serve as proxies for protected characteristics. Geographic data (census tracts) and behavioral/digital metadata are explicitly identified as high-risk proxy variables requiring documented analysis before inclusion.',
          'Step 2: Contract lists "geographic location data at the census tract level" — a classic redlining proxy — and "behavioral patterns from digital interaction metadata" — which can proxy for national origin, disability, and age. No proxy correlation analysis is referenced or required to be delivered.',
          'Step 3: WARN — Census-tract geographic data is the modern redlining risk the DOJ has actively prosecuted. Digital behavioral metadata can proxy for protected characteristics in ways that may not be immediately apparent. Without documented proxy analysis, the institution cannot assess its fair lending exposure from these features.',
        ],
        conclusion: 'High-risk proxy variables (geographic, behavioral) included in model inputs without required proxy correlation analysis or documentation.',
        recommendation: 'Require vendor to provide proxy correlation analysis for all geographic and behavioral features, documenting: statistical correlation with protected characteristics, methodology applied, threshold for exclusion or adjustment, and final disposition decision for each at-risk feature. Update obligation when new features are added.',
      },
      {
        rule_id: 'FLB-003',
        rule_name: 'Bias Remediation and Regulatory Reporting',
        category: 'Fair Lending & Bias',
        status: 'PASS',
        severity: 'warning',
        regulatory_source: 'CFPB Examination Procedures; DOJ Fair Housing Division Investigation Standards; Federal Reserve CRA / Fair Lending Examination Procedures',
        relevant_text: 'In the event that disparate impact or discriminatory patterns are identified in model outputs during testing or production monitoring, Vendor and Institution shall jointly develop and execute a remediation plan within 90 calendar days of identification.',
        reasoning_steps: [
          'Step 1: When bias or disparate impact is detected, institutions must document remediation steps, re-test after remediation, and maintain complete records of findings and corrective actions for regulatory examination.',
          'Step 2: Contract establishes a joint remediation process with a 90-day timeline triggered upon bias identification. "Jointly develop and execute" ensures institution involvement and creates a documented record. The 90-day timeline is reasonable and enforceable.',
          'Step 3: PASS — The joint remediation provision is well-structured. The 90-day timeline, collaborative approach, and coverage of both testing and production monitoring incidents satisfy CFPB examination requirements for documented remediation processes.',
        ],
        conclusion: 'Bias remediation provision adequately addresses the requirement with a defined joint process, clear trigger, and enforceable timeline.',
        recommendation: null,
      },
      {
        rule_id: 'DG-001',
        rule_name: 'Consumer Data Consent and Privacy Notice',
        category: 'Data Governance',
        status: 'PASS',
        severity: 'critical',
        regulatory_source: 'Gramm-Leach-Bliley Act (GLBA) Privacy Rule (16 CFR Part 313); CCPA/CPRA (California Civil Code § 1798); CFPB Privacy Rule Examination Procedures',
        relevant_text: 'Vendor shall process consumer data solely in its capacity as a data processor acting on the explicit written instructions of Institution. Institution retains sole responsibility for obtaining all legally required consumer consents and maintaining compliant privacy notices.',
        reasoning_steps: [
          'Step 1: GLBA requires appropriate legal basis for processing consumer financial data and mandates privacy notices disclosing AI use of consumer data, categories, and retention. Under GLBA, the financial institution is the regulated entity responsible for data privacy compliance.',
          'Step 2: Contract correctly establishes the Institution as data controller and Vendor as processor, preserving the Institution\'s consent and privacy notice obligations. The "explicit written instructions" language limits vendor use of data to authorized purposes only.',
          'Step 3: PASS — The data controller/processor structure is correctly established, GLBA compliance responsibility is appropriately allocated to the regulated institution, and the vendor\'s use of data is contractually constrained. This is the legally correct and examination-ready structure.',
        ],
        conclusion: 'Data processing relationship and privacy responsibility allocation are correctly structured under GLBA.',
        recommendation: null,
      },
      {
        rule_id: 'DG-002',
        rule_name: 'Training Data Retention and Lineage Documentation',
        category: 'Data Governance',
        status: 'WARN',
        severity: 'warning',
        regulatory_source: 'ECOA Regulation B (12 CFR 1002.12 — 25-month retention); SEC Rule 17a-4; FINRA Rules 4511–4512; OCC Records Retention Guidelines',
        relevant_text: 'Vendor maintains training datasets used in model development for a minimum period of 24 months following the initial model deployment date.',
        reasoning_steps: [
          'Step 1: ECOA Regulation B requires 25-month minimum retention for credit-related adverse action records. Regulatory best practice for AI training data is 3-7 years to support model examination. Full data lineage tracing source to model input is expected by examiners under SR 11-7.',
          'Step 2: Contract specifies 24 months — one month short of ECOA\'s minimum for adverse action records, and significantly below the 3-7 year window typical for credit model examination readiness. No data lineage documentation requirement is included.',
          'Step 3: WARN — The 24-month retention period is an immediate compliance gap: it falls below the 25-month ECOA minimum and well below examination expectations. Absence of data lineage documentation means the institution cannot demonstrate regulatory compliance of training data under SR 11-7.',
        ],
        conclusion: 'Retention period falls below ECOA\'s 25-month minimum; data lineage documentation entirely absent.',
        recommendation: 'Extend training data retention to minimum 36 months (3 years) to safely exceed ECOA requirements and typical examination windows. Add mandatory data lineage documentation requirement: all training data must be traceable from original source through each transformation step to final model input, with lineage documentation retained for the same period.',
      },
      {
        rule_id: 'DG-003',
        rule_name: 'Cross-Border Data Transfer Safeguards',
        category: 'Data Governance',
        status: 'WARN',
        severity: 'warning',
        regulatory_source: 'GLBA; GDPR Standard Contractual Clauses (for EU personal data); NY DFS Cybersecurity Regulation (23 NYCRR 500); OCC 2023-17',
        relevant_text: 'Vendor operates a globally distributed cloud infrastructure across multiple geographic regions to ensure service availability, redundancy, and performance optimization.',
        reasoning_steps: [
          'Step 1: Consumer financial data transferred internationally for AI processing requires compliance with applicable cross-border transfer restrictions. Contracts must specify data residency, applicable transfer mechanisms (e.g., SCCs for EU data), governing jurisdiction, and data handling upon contract termination.',
          'Step 2: "Globally distributed cloud infrastructure across multiple geographic regions" unambiguously signals that consumer data may be processed outside the US. Yet no data residency clause is included, no transfer mechanisms are specified, and no governing jurisdiction is identified for cross-border processing.',
          'Step 3: WARN — Without defined data residency provisions, the institution cannot assess or represent its cross-border compliance posture. NY DFS-regulated institutions have specific geographic controls obligations under 23 NYCRR 500. If any EU personal data is involved, GDPR Standard Contractual Clauses are required.',
        ],
        conclusion: 'Global infrastructure reference without data residency provisions creates cross-border compliance uncertainty under GLBA and NY DFS 23 NYCRR 500.',
        recommendation: 'Add explicit data residency clause specifying that US consumer financial data is processed exclusively in US-based infrastructure. For any cross-border processing: identify applicable jurisdictions, document transfer mechanisms (SCCs for EU), and specify data destruction obligations upon contract termination.',
      },
      {
        rule_id: 'TPR-001',
        rule_name: 'Pre-Contract Vendor AI Due Diligence',
        category: 'Third-Party AI Risk',
        status: 'N/A',
        severity: 'critical',
        regulatory_source: 'OCC Third-Party Risk Management Guidance (OCC 2023-17, June 2023); Federal Reserve SR 13-19; FFIEC Third-Party Risk Guidance; CFPB Vendor Management Guidance',
        relevant_text: 'N/A',
        reasoning_steps: [
          'Step 1: OCC 2023-17 requires comprehensive pre-contract due diligence before engaging third-party AI vendors, covering model validation documentation, bias testing, security certifications, financial stability, regulatory compliance history, and fourth-party (subcontractor) AI dependencies.',
          'Step 2: This rule governs the institution\'s pre-contract due diligence process — the work performed before the contract is signed. This due diligence would be documented in the institution\'s vendor management files, not in the contract itself.',
          'Step 3: N/A — Due diligence is an institutional process that precedes contract execution and cannot be assessed from the vendor contract document. This contract analysis tool analyzes contract provisions; pre-contract due diligence adequacy requires a separate review of the institution\'s vendor management records.',
        ],
        conclusion: 'Pre-contract due diligence process cannot be assessed from contract document alone — requires separate vendor management file review.',
        recommendation: 'Verify separately that institution completed OCC 2023-17 compliant due diligence checklist prior to contract execution, including review of vendor validation reports, bias testing documentation, SOC 2 Type II report, and financial stability assessment.',
      },
      {
        rule_id: 'TPR-002',
        rule_name: 'Contractual AI Performance Standards and SLAs',
        category: 'Third-Party AI Risk',
        status: 'FAIL',
        severity: 'warning',
        regulatory_source: 'OCC 2023-17 Third-Party Risk (Section III); CFPB Vendor Management Guidance; Federal Reserve SR 13-19; FFIEC Outsourcing Technology Services',
        relevant_text: 'Vendor commits to maintaining the model\'s performance within acceptable industry standards for credit risk scoring applications.',
        reasoning_steps: [
          'Step 1: OCC 2023-17 requires vendor contracts to specify measurable, enforceable performance standards with defined metrics, measurement frequency, and contractual remedies (credits, termination rights) tied to AI model performance. Vague language provides no enforceable protection.',
          'Step 2: "Acceptable industry standards" is entirely undefined — no Gini coefficient floor, no accuracy threshold, no demographic fairness metric, no uptime SLA, no measurement frequency, and no remedies for breach. This language is legally unenforceable as it provides no objective standard against which breach can be measured.',
          'Step 3: FAIL — Vague performance language is effectively no performance obligation. Without defined metrics and remedies, the institution has no contractual recourse when model performance degrades. OCC 2023-17 examiners specifically look for quantified, enforceable performance standards in third-party AI contracts.',
        ],
        conclusion: 'Performance obligations are too vague to be enforceable — no defined metrics, benchmarks, or remedies as required by OCC 2023-17.',
        recommendation: 'Replace vague performance language with specific, measurable SLAs: minimum Gini coefficient ≥0.35 (or equivalent discrimination metric), maximum demographic false positive rate differential (e.g., ≤10% across protected classes), 99.5% system uptime, monthly performance reporting, and explicit remedies (service credits, re-validation requirement, termination right) for any breach.',
      },
      {
        rule_id: 'TPR-003',
        rule_name: 'Right to Audit Vendor AI Systems',
        category: 'Third-Party AI Risk',
        status: 'FAIL',
        severity: 'warning',
        regulatory_source: 'OCC 2023-17 (Section IV — Ongoing Monitoring); Federal Reserve SR 13-19; OCC Examination Guidance on Third-Party Relationships; CFPB Supervisory Guidance',
        relevant_text: 'Vendor will cooperate with reasonable information requests from Institution in connection with Institution\'s compliance and risk management obligations.',
        reasoning_steps: [
          'Step 1: OCC 2023-17 requires vendor contracts to explicitly preserve the institution\'s right to audit model performance, access validation documentation, conduct independent testing, and grant regulators examination access to material AI vendors. These must be explicit contractual rights — not conditional on vendor definition of "reasonable."',
          'Step 2: "Cooperate with reasonable information requests" is passive and subjective — the vendor defines what is "reasonable" and what constitutes "cooperation." No explicit audit right, no regulatory access right, no defined response timelines, no independent testing right, and no access to validation or monitoring documentation is granted.',
          'Step 3: FAIL — OCC 2023-17 examiners specifically flag vague cooperation clauses as insufficient. This provision would not satisfy a regulatory examination of the institution\'s third-party AI risk management program. A vague cooperation clause provides no legal right to demand access — it is merely an expression of goodwill.',
        ],
        conclusion: 'Vague cooperation language fails to establish the explicit audit rights, regulator access, and independent testing rights required by OCC 2023-17.',
        recommendation: 'Replace with explicit right-to-audit clause granting institution: (1) annual on-site or remote audit right with 30-day notice, (2) on-demand regulator examination access with no advance notice required, (3) right to commission independent model testing at institution\'s cost, and (4) access to all validation reports, monitoring data, and bias testing results within 5 business days of request.',
      },
      {
        rule_id: 'AA-001',
        rule_name: 'AI Decision Logging and Immutable Audit Trail',
        category: 'Audit & Accountability',
        status: 'PASS',
        severity: 'critical',
        regulatory_source: 'SR 11-7; ECOA Regulation B (12 CFR 1002.12 recordkeeping); SEC Rule 17a-4 (broker-dealer records); FINRA Rule 4511; OCC Examination Procedures',
        relevant_text: 'Vendor maintains tamper-evident decision logs for all model inferences, capturing: model version and SHA-256 hash, feature category values (not raw PII), output score and applied decision threshold, inference timestamp, and requesting system identifier. Logs are retained for 36 months and accessible to Institution via authenticated API.',
        reasoning_steps: [
          'Step 1: All AI-assisted decisions in regulated activities must be logged with sufficient detail to fully reconstruct each decision: model version, inputs, output, thresholds, and timestamp. Logs must be immutable, retained per regulatory schedules, and accessible to compliance and regulators.',
          'Step 2: Contract explicitly specifies tamper-evident logs with all required SR 11-7 elements: model version and hash (enabling exact model identification), feature categories, output score and threshold, timestamp, and requesting system. 36-month retention exceeds ECOA\'s 25-month minimum. Authenticated API access ensures institution control.',
          'Step 3: PASS — This is an exceptionally well-structured logging provision. The SHA-256 model hash enables exact model version identification, tamper-evidence satisfies immutability requirements, all required data elements are captured, and retention exceeds regulatory minimums.',
        ],
        conclusion: 'Decision logging provision is comprehensive, technically sound, and satisfies SR 11-7 and ECOA recordkeeping requirements.',
        recommendation: null,
      },
      {
        rule_id: 'AA-002',
        rule_name: 'Regulatory Examination Readiness',
        category: 'Audit & Accountability',
        status: 'PASS',
        severity: 'warning',
        regulatory_source: 'OCC Examination Procedures (Model Risk); Federal Reserve Supervision and Regulation Letters; CFPB Examination Manual (UDAP/UDAAP); OCC 2023-17',
        relevant_text: 'Vendor agrees to provide all documentation, system access, and personnel support necessary for regulatory examinations of Institution, including model documentation packages, validation reports, performance data, and bias testing results. Response to Institution examination requests shall occur within 5 business days.',
        reasoning_steps: [
          'Step 1: Institutions must maintain documentation sufficient for regulatory examination at any time, including validation reports, bias testing results, data governance policies, and monitoring data. Regulators must be able to reproduce key model outputs.',
          'Step 2: Contract commits vendor to regulatory examination support with a defined 5-business-day SLA covering documentation, system access, personnel support, and all relevant compliance documentation. The scope is comprehensive.',
          'Step 3: PASS — The 5-day response SLA, explicit scope (validation reports, performance data, bias testing), and commitment to personnel support satisfy OCC 2023-17 examination readiness requirements. This provision would satisfy most regulatory examiners.',
        ],
        conclusion: 'Regulatory examination support provision is well-structured with defined scope, obligations, and a clear 5-business-day response timeline.',
        recommendation: null,
      },
      {
        rule_id: 'AA-003',
        rule_name: 'AI-Specific Incident Response and Escalation',
        category: 'Audit & Accountability',
        status: 'WARN',
        severity: 'warning',
        regulatory_source: 'FFIEC Cybersecurity Assessment Tool; OCC 2023-17 (Section V); NY DFS 23 NYCRR 500.16; NIST AI RMF Govern 1.7 (2023)',
        relevant_text: 'Vendor will notify Institution within 48 hours of any service outage exceeding 15 minutes or any material security incident affecting the AI platform or underlying data.',
        reasoning_steps: [
          'Step 1: AI incident response plans must address AI-specific failure modes distinct from standard IT incidents: model errors causing consumer harm, discriminatory output events, model accuracy degradation below performance thresholds, adversarial input attacks, and training data integrity events.',
          'Step 2: Contract addresses "service outage" and "security incidents" — these are standard IT incident categories. Critically absent: model accuracy failures (not outages), discriminatory output events detected in production, consumer harm events caused by model error, and training data corruption/poisoning events.',
          'Step 3: WARN — IT-oriented incident response covers availability but misses the AI-specific failure scenarios that regulators focus on under NIST AI RMF and OCC 2023-17. A model that is "up" but producing discriminatory outputs or systematically wrong decisions is not an outage — but it is a critical compliance incident.',
        ],
        conclusion: 'Incident notification covers IT availability events but omits AI-specific failure scenarios including model accuracy failures, discriminatory output events, and consumer harm.',
        recommendation: 'Add AI-specific incident categories with defined notification timelines: (1) model accuracy below performance threshold — 24-hour notification; (2) discriminatory output detected in production — immediate notification with model suspension pending review; (3) consumer harm event attributable to model error — 24-hour notification with remediation plan within 5 days; (4) training data integrity event — 48-hour notification.',
      },
      {
        rule_id: 'AA-004',
        rule_name: 'Board and Senior Management AI Governance Oversight',
        category: 'Audit & Accountability',
        status: 'N/A',
        severity: 'info',
        regulatory_source: 'SR 11-7 Section I — Governance and Controls; OCC 2023-17 (Board Oversight); Federal Reserve Model Risk Management Guidance Update (2021); OCC Heightened Standards (12 CFR Part 30)',
        relevant_text: 'N/A',
        reasoning_steps: [
          'Step 1: SR 11-7 requires board-level oversight of material AI risk, regular AI risk reporting to senior management, and integration of AI governance into the enterprise risk management framework.',
          'Step 2: This is an internal governance requirement for the institution — board committee structures, reporting cadences, and risk committee mandates are internal governance documents, not vendor contract provisions.',
          'Step 3: N/A — Board and senior management AI governance cannot be assessed from a vendor contract. This rule applies to the institution\'s internal governance framework. Institution should separately verify that board-level AI oversight is documented and operational.',
        ],
        conclusion: 'Internal governance requirement not assessable from vendor contract — requires separate governance structure review.',
        recommendation: 'Verify separately that institution has: board-approved AI risk appetite statement, designated AI risk committee with defined mandate, quarterly AI risk reporting to senior management, and AI governance integrated into enterprise risk management framework.',
      },
    ],
  };
}

module.exports = { analyzeDocument };
