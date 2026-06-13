'use strict';

const MOCK_MODE = !process.env.AZURE_OPENAI_ENDPOINT || process.env.MOCK_MODE === 'true';

function getClient() {
  const { AzureOpenAI } = require('openai');
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_KEY,
    apiVersion: '2024-02-01',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  });
}

function buildRulebookContext(rules) {
  return rules.rules
    .map(
      (r) =>
        `**${r.id} — ${r.rule_name}** [${r.category}] [Severity: ${r.severity}]\n` +
        `Description: ${r.description}\n` +
        `Violation trigger: ${r.violation_trigger}\n` +
        `Regulatory source: ${r.regulatory_source}`
    )
    .join('\n\n');
}

async function answerQuestion(question, rules) {
  if (MOCK_MODE) return getMockAnswer(question, rules);

  const client = getClient();
  const rulebookContext = buildRulebookContext(rules);

  const systemPrompt = `You are ClauseGuard's compliance knowledge assistant. You answer questions about financial AI regulations.

STRICT RULES:
1. Answer ONLY from the rulebook provided below — never use knowledge outside it
2. Always cite specific rule IDs (e.g., MRM-001) and regulatory sources in your answers
3. If a question is outside the scope of this rulebook, say so clearly and list what topics you can help with
4. Format answers with rule citations using **RULE-ID — Rule Name** format
5. Be precise and complete — quote descriptions when relevant

COMPLIANCE RULEBOOK:
${rulebookContext}`;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    temperature: 0.1,
  });

  return {
    question,
    answer: response.choices[0].message.content,
    mode: 'Azure OpenAI',
  };
}

function getMockAnswer(question, rules) {
  const q = question.toLowerCase();

  // Explainability / transparency questions
  if (q.includes('explainab') || q.includes('transparen') || q.includes('interpret')) {
    return {
      question,
      answer: `The ClauseGuard rulebook contains three rules governing explainability and transparency:

**EXT-001 — Adverse Action Notice with AI-Specific Reasons** *(Critical)*
When AI contributes to a credit adverse action, ECOA Regulation B and **CFPB Circular 2022-03** require specific, human-readable reasons in plain language — not generic legacy codes. The CFPB has explicitly stated that "black box" AI explanations do not satisfy Regulation B when the model applies criteria beyond a traditional scorecard.

**EXT-002 — Model Explainability for Internal Stakeholders** *(Warning)*
Complex ML models (neural networks, gradient boosting ensembles) used in material decisions must have documented post-hoc explanation methods — SHAP values, LIME, or equivalent. Global feature importance alone is insufficient; individual prediction explanations are required for dispute resolution, adverse action review, and regulatory examination queries. Required under **SR 11-7** conceptual soundness and **NIST AI RMF 2023 MAP 5.1**.

**EXT-003 — Customer Disclosure of AI Use in Decisions** *(Warning)*
Customers must be meaningfully informed when AI influences decisions affecting them. Disclosures must describe the nature of AI use, data categories, and customer rights. Required under **CFPB UDAAP supervision guidance** and **FTC Act Section 5**.

*Key regulatory sources: Regulation B (12 CFR Part 1002), CFPB Circular 2022-03, SR 11-7, NIST AI RMF (2023), FTC Act Section 5*`,
      mode: 'Mock Mode',
    };
  }

  // Vendor / third-party questions
  if (q.includes('vendor') || q.includes('third-party') || q.includes('third party') || q.includes('outsourc')) {
    return {
      question,
      answer: `The rulebook contains three rules specifically addressing third-party and vendor AI risk:

**TPR-001 — Pre-Contract Vendor AI Due Diligence** *(Critical)*
Before deploying any third-party AI in financial decisions, institutions must conduct comprehensive pre-contract due diligence covering: model validation documentation, independent bias testing results, security controls (SOC 2 Type II), financial stability, regulatory compliance history, and fourth-party (subcontractor) AI dependencies. Required under **OCC 2023-17** and **Federal Reserve SR 13-19**.

**TPR-002 — Contractual AI Performance Standards and SLAs** *(Warning)*
Vendor contracts must specify *measurable, enforceable* performance standards: minimum accuracy metrics (e.g., Gini coefficient), fairness metrics by demographic group, system uptime SLAs, model update notification timelines, and defined contractual remedies (credits, termination rights) for performance breaches. Vague language like "industry best practices" is not acceptable under **OCC 2023-17 Section III**.

**TPR-003 — Right to Audit Vendor AI Systems** *(Warning)*
Contracts must explicitly grant: (1) institution annual audit rights with 30-day notice, (2) on-demand regulator examination access, (3) right to commission independent model testing, and (4) access to all validation/monitoring documentation. Vague "cooperation" clauses do not satisfy **OCC 2023-17 Section IV**.

*Key regulatory sources: OCC 2023-17 (June 2023), Federal Reserve SR 13-19, FFIEC Outsourcing Technology Services, CFPB Vendor Management Guidance*`,
      mode: 'Mock Mode',
    };
  }

  // SR 11-7 specific question
  if (q.includes('sr 11-7') || q.includes('sr11-7') || q.includes('model risk management')) {
    return {
      question,
      answer: `**SR 11-7** is the foundational model risk management framework and the most-cited regulatory source in the ClauseGuard rulebook — referenced across 6 of 20 rules.

**What is SR 11-7?**
SR 11-7 is a 2011 joint supervisory letter issued by the **Federal Reserve** and **OCC** that established the comprehensive framework for managing model risk at financial institutions. A 2021 update extended its principles explicitly to AI/ML systems. It defines "model" broadly enough to encompass virtually all AI systems used in financial decisions.

**Rules derived from SR 11-7:**

• **MRM-001 — Independent Model Validation** *(Critical)*: Requires pre-deployment validation by a party independent from model development, covering conceptual soundness, data integrity, and outcomes.

• **MRM-002 — Ongoing Model Performance Monitoring** *(Critical)*: Section III requires continuous monitoring including population stability indices, outcome analysis, and benchmarking.

• **MRM-003 — Model Inventory and Documentation** *(Warning)*: Section II requires comprehensive model documentation sufficient for independent review and regulatory examination.

• **MRM-004 — Model Change Management Protocol** *(Warning)*: Section IV governs material model changes — requiring formal change management and proportional re-validation.

• **EXT-002 — Model Explainability for Internal Stakeholders** *(Warning)*: SR 11-7 conceptual soundness requirements extend to explainability for risk managers, compliance, and auditors.

• **AA-001 — AI Decision Logging and Immutable Audit Trail** *(Critical)*: SR 11-7 traceability requirements inform decision logging standards.

• **AA-004 — Board and Senior Management AI Governance Oversight** *(Info)*: Section I of SR 11-7 establishes board-level governance requirements.

*The OCC published a companion document (OCC 2011-12) and updated its Comptroller's Handbook in 2021 to reflect AI/ML-specific model risk considerations.*`,
      mode: 'Mock Mode',
    };
  }

  // Bias / fair lending / ECOA
  if (q.includes('bias') || q.includes('fair lend') || q.includes('disparate') || q.includes('ecoa') || q.includes('discriminat')) {
    return {
      question,
      answer: `The rulebook contains three rules addressing fair lending, bias prevention, and anti-discrimination:

**FLB-001 — Disparate Impact Testing Requirement** *(Critical)*
AI models used in credit, insurance, housing, or employment decisions must be statistically tested for disparate impact on all ECOA-protected classes: race, color, religion, national origin, sex, marital status, age, and familial status. Testing must occur *before* deployment and at defined intervals afterward. Documented statistical methodology and significance levels are required — general certifications are insufficient. Required under **ECOA (15 U.S.C. § 1691)**, **Fair Housing Act**, and **CFPB Fair Lending Examination Procedures**.

**FLB-002 — Proxy Variable and Redlining Prevention** *(Critical)*
AI models must not use features that proxy for protected characteristics. High-risk variables include: geographic data (zip codes, census tracts — redlining risk), digital behavioral metadata (can proxy national origin, disability, age), and purchasing patterns. All features must undergo documented proxy correlation analysis before inclusion. Required under **ECOA Regulation B** and **CFPB Circular 2023-02**.

**FLB-003 — Bias Remediation and Regulatory Reporting** *(Warning)*
When bias or disparate impact is detected, institutions must document remediation steps, re-test after remediation, and maintain complete records for examination. Significant findings may require regulatory notification. Required under **CFPB Examination Procedures** and **DOJ Fair Housing Division standards**.

*Key regulatory sources: ECOA (15 U.S.C. § 1691), Regulation B (12 CFR Part 1002), Fair Housing Act (42 U.S.C. § 3604), CFPB Circulars 2022-03 and 2023-02, HUD Fair Lending Guidance (2013)*`,
      mode: 'Mock Mode',
    };
  }

  // Data governance / privacy / retention
  if (q.includes('data') || q.includes('privacy') || q.includes('retention') || q.includes('consent') || q.includes('glba') || q.includes('gdpr')) {
    return {
      question,
      answer: `The rulebook addresses data governance through three rules:

**DG-001 — Consumer Data Consent and Privacy Notice** *(Critical)*
Personal consumer financial data used in AI training or inference requires appropriate legal basis under **GLBA**. Privacy notices must be updated to disclose: categories of data used in AI, types of decisions influenced, and consumer rights. California consumers have additional rights under **CCPA/CPRA**. The financial institution (not the AI vendor) bears responsibility for consumer consent and privacy notice compliance.

**DG-002 — Training Data Retention and Lineage Documentation** *(Warning)*
AI training datasets must be retained for at minimum 25 months under **Regulation B** (12 CFR 1002.12), with 3-7 years recommended for examination readiness. Full data lineage must trace data from original source through all transformation and preprocessing steps to final model input. Required under **ECOA Regulation B**, **SEC Rule 17a-4**, and **FINRA Rules 4511-4512**.

**DG-003 — Cross-Border Data Transfer Safeguards** *(Warning)*
Consumer financial data processed internationally must comply with transfer restrictions. Contracts must specify: exact data residency locations, transfer mechanisms (Standard Contractual Clauses for EU data), governing jurisdiction, and data handling on contract termination. NY DFS-regulated institutions have specific obligations under **23 NYCRR 500**. Multi-region cloud processing without defined residency clauses is a compliance risk.

*Key regulatory sources: GLBA Privacy Rule (16 CFR Part 313), CCPA/CPRA, Regulation B, SEC Rule 17a-4, FINRA Rules 4511-4512, NY DFS 23 NYCRR 500*`,
      mode: 'Mock Mode',
    };
  }

  // Audit / logging / accountability
  if (q.includes('audit') || q.includes('log') || q.includes('account') || q.includes('traceab') || q.includes('incident') || q.includes('board')) {
    return {
      question,
      answer: `The rulebook addresses audit, accountability, and governance through four rules:

**AA-001 — AI Decision Logging and Immutable Audit Trail** *(Critical)*
Every AI-assisted financial decision must be logged with: model version and cryptographic hash, input feature categories, output score and applied threshold, timestamp, and consuming system identifier. Logs must be tamper-evident, retained for regulatory minimums (25+ months), and accessible to compliance and regulators via authenticated means. Required under **SR 11-7**, **ECOA Regulation B**, **SEC Rule 17a-4**, and **FINRA Rule 4511**.

**AA-002 — Regulatory Examination Readiness** *(Warning)*
Documentation must be maintained to support regulatory examination at any time without advance preparation: validation reports (within 12 months), bias testing results, monitoring dashboards with historical data, and the ability to reproduce model outputs from logged inputs. Required under **OCC Examination Procedures** and **CFPB Examination Manual (UDAP/UDAAP)**.

**AA-003 — AI-Specific Incident Response and Escalation** *(Warning)*
Incident response must address AI-specific failures beyond standard IT outages: model accuracy degradation, discriminatory output events detected in production, consumer harm caused by model error, and training data integrity events. Escalation paths to senior management must have defined timelines. Required under **OCC 2023-17**, **NY DFS 23 NYCRR 500.16**, and **NIST AI RMF Govern 1.7**.

**AA-004 — Board and Senior Management AI Governance Oversight** *(Info)*
The board or a designated committee must have documented oversight of material AI risk, including approval of AI risk appetite. Quarterly AI risk reporting to senior management is the minimum cadence. AI governance must integrate into enterprise risk management. Required under **SR 11-7 Section I** and **OCC Heightened Standards (12 CFR Part 30)**.`,
      mode: 'Mock Mode',
    };
  }

  // Critical rules question
  if (q.includes('critical') || q.includes('most important') || q.includes('highest risk') || q.includes('severe')) {
    return {
      question,
      answer: `The rulebook designates **8 rules as Critical severity** — these represent the highest regulatory risk and are most likely to result in enforcement action:

**Model Risk Management:**
• **MRM-001** — Independent Model Validation (SR 11-7 pre-deployment validation requirement)
• **MRM-002** — Ongoing Model Performance Monitoring (SR 11-7 continuous monitoring)

**Explainability & Transparency:**
• **EXT-001** — Adverse Action Notice with AI-Specific Reasons (ECOA Regulation B / CFPB Circular 2022-03)

**Fair Lending & Bias:**
• **FLB-001** — Disparate Impact Testing Requirement (ECOA, Fair Housing Act)
• **FLB-002** — Proxy Variable and Redlining Prevention (ECOA Regulation B, CFPB Circular 2023-02)

**Data Governance:**
• **DG-001** — Consumer Data Consent and Privacy Notice (GLBA)

**Third-Party AI Risk:**
• **TPR-001** — Pre-Contract Vendor AI Due Diligence (OCC 2023-17)

**Audit & Accountability:**
• **AA-001** — AI Decision Logging and Immutable Audit Trail (SR 11-7, ECOA Regulation B)

These 8 rules address requirements where violation creates the highest regulatory exposure — including potential enforcement actions, civil money penalties, and reputational harm. MRM-001, EXT-001, and FLB-001 are the most commonly cited in regulatory examination findings.`,
      mode: 'Mock Mode',
    };
  }

  // Categories question
  if (q.includes('categor') || q.includes('what rules') || q.includes('what topics') || q.includes('what does') || q.includes('overview') || q.includes('summary')) {
    return {
      question,
      answer: `The ClauseGuard rulebook contains **20 rules across 6 regulatory categories**:

**1. Model Risk Management** (4 rules — MRM-001 to MRM-004)
Covers SR 11-7 requirements: independent model validation, ongoing performance monitoring, model inventory/documentation, and change management protocols.

**2. Explainability & Transparency** (3 rules — EXT-001 to EXT-003)
Covers ECOA adverse action notices, internal model interpretability, and customer disclosure of AI use in decisions.

**3. Fair Lending & Bias** (3 rules — FLB-001 to FLB-003)
Covers ECOA-required disparate impact testing, proxy variable prohibition, and bias remediation/reporting requirements.

**4. Data Governance** (3 rules — DG-001 to DG-003)
Covers GLBA consumer data consent, training data retention and lineage documentation, and cross-border data transfer safeguards.

**5. Third-Party AI Risk** (3 rules — TPR-001 to TPR-003)
Covers OCC 2023-17 vendor due diligence, contractual performance standards, and right-to-audit provisions.

**6. Audit & Accountability** (4 rules — AA-001 to AA-004)
Covers decision logging and audit trails, regulatory examination readiness, AI incident response, and board/senior management governance oversight.

Ask me about any category, specific rule, or regulatory source for detailed explanations.`,
      mode: 'Mock Mode',
    };
  }

  // Out-of-scope default
  return {
    question,
    answer: `I'm designed to answer questions specifically about the **20 financial AI compliance rules** in the ClauseGuard rulebook. Your question appears to be outside the scope of these rules, and I won't speculate beyond what the rulebook contains.

**What I can help you with:**

• **Model Risk Management** — SR 11-7 validation, monitoring, documentation, change management (MRM-001 to MRM-004)
• **Explainability & Transparency** — Adverse action notices, SHAP/LIME requirements, customer disclosures (EXT-001 to EXT-003)
• **Fair Lending & Bias** — ECOA disparate impact testing, proxy variables, bias remediation (FLB-001 to FLB-003)
• **Data Governance** — GLBA consent, data retention minimums, cross-border transfers (DG-001 to DG-003)
• **Third-Party AI Risk** — OCC 2023-17 vendor due diligence, SLAs, audit rights (TPR-001 to TPR-003)
• **Audit & Accountability** — Decision logging, examination readiness, incident response, board governance (AA-001 to AA-004)

Try asking: *"What are the explainability requirements?"*, *"What is SR 11-7?"*, *"What rules apply to vendor AI?"*, or *"What are the critical severity rules?"*`,
    mode: 'Mock Mode',
  };
}

module.exports = { answerQuestion };
