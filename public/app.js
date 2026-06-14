'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let allRules = [];
let currentFindings = [];
let selectedFile = null;
let pasteVisible = false;

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadRules();
  await loadStatus();
  setupDragDrop();
  setupFileInput();
});

async function loadRules() {
  try {
    const res = await fetch('/api/rules');
    const data = await res.json();
    allRules = data.rules || [];
    renderRulebook(data);
  } catch (e) {
    console.error('Failed to load rules:', e);
  }
}

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const { mode } = await res.json();
    const badge = document.getElementById('modeBadge');
    if (mode === 'azure') {
      badge.textContent = 'Azure OpenAI';
      badge.classList.add('live');
    } else {
      badge.textContent = 'Mock Mode';
    }
  } catch (_) {}
}

// ── Tab switching ──────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => {
    const isTarget = c.id === `tab-${name}`;
    c.classList.toggle('active', isTarget);
    c.classList.toggle('hidden', !isTarget);
  });
}

// ── Sidebar Rulebook ───────────────────────────────────────────────────────
function renderRulebook(data) {
  const container = document.getElementById('rulebook');
  const categories = data.categories || [];
  const rules = data.rules || [];

  const categoryIcons = {
    'Model Risk Management': '🔬',
    'Explainability & Transparency': '🔍',
    'Fair Lending & Bias': '⚖',
    'Data Governance': '🗄',
    'Third-Party AI Risk': '🔗',
    'Audit & Accountability': '📋',
  };

  container.innerHTML = categories.map(cat => {
    const catRules = rules.filter(r => r.category === cat);
    return `
      <div class="rule-category-group">
        <div class="category-header" onclick="toggleCategory(this)">
          <span class="category-chevron">▶</span>
          <span class="category-name">${categoryIcons[cat] || '•'} ${cat}</span>
          <span class="category-count">${catRules.length}</span>
        </div>
        <div class="rule-items">
          ${catRules.map(r => `
            <div class="rule-item" onclick="showRuleModal('${r.id}')">
              <div class="rule-sev-dot ${r.severity}"></div>
              <div class="rule-item-id">${r.id}</div>
              <div class="rule-item-name">${r.rule_name}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function toggleCategory(header) {
  const chevron = header.querySelector('.category-chevron');
  const items = header.nextElementSibling;
  const isOpen = items.classList.toggle('open');
  chevron.classList.toggle('open', isOpen);
}

// ── Rule Modal ─────────────────────────────────────────────────────────────
function showRuleModal(ruleId) {
  const rule = allRules.find(r => r.id === ruleId);
  if (!rule) return;

  document.getElementById('modalCategory').textContent = rule.category;
  document.getElementById('modalId').textContent = rule.id;
  document.getElementById('modalTitle').textContent = rule.rule_name;
  document.getElementById('modalDescription').textContent = rule.description;
  document.getElementById('modalSource').textContent = rule.regulatory_source;
  document.getElementById('modalTrigger').textContent = rule.violation_trigger;

  const sevBadge = document.getElementById('modalSeverity');
  const sevColors = { critical: '#dc2626', warning: '#d97706', info: '#2563eb' };
  sevBadge.innerHTML = `<span class="sev-badge ${rule.severity}" style="background:${rule.severity==='critical'?'#fee2e2':rule.severity==='warning'?'#fef3c7':'#dbeafe'};color:${sevColors[rule.severity]}">${rule.severity.toUpperCase()}</span>`;

  document.getElementById('ruleModal').classList.remove('hidden');
}

function closeRuleModal() {
  document.getElementById('ruleModal').classList.add('hidden');
}
function closeModal(e) {
  if (e.target.id === 'ruleModal') closeRuleModal();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRuleModal(); });

// ── File Upload ────────────────────────────────────────────────────────────
function setupFileInput() {
  const input = document.getElementById('fileInput');
  input.addEventListener('change', e => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  });
  document.getElementById('uploadArea').addEventListener('click', () => input.click());
}

function setupDragDrop() {
  const area = document.getElementById('uploadArea');
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragging'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragging'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });
}

function setFile(file) {
  selectedFile = file;
  const area = document.getElementById('uploadArea');
  area.classList.add('has-file');
  document.getElementById('uploadFilename').textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  document.getElementById('uploadIcon') && (document.getElementById('uploadIcon').textContent = '✅');
}

// ── Paste Toggle ───────────────────────────────────────────────────────────
function togglePaste() {
  pasteVisible = !pasteVisible;
  document.getElementById('pasteText').classList.toggle('hidden', !pasteVisible);
  document.getElementById('togglePaste').textContent = pasteVisible ? 'Hide text input' : 'Show text input';
}

// ── Sample Contract ────────────────────────────────────────────────────────
function loadSample() {
  const sample = `ARTIFICIAL INTELLIGENCE MODEL SERVICES AGREEMENT

This Agreement is entered into between FinTech Vendor Corp ("Vendor") and Regional Community Bank ("Institution").

1. AI MODEL SERVICES
Vendor provides an AI-based credit risk scoring model ("the Model") for use in Institution's consumer loan underwriting process. The Model uses a proprietary gradient boosting ensemble with 247 input features including payment history, credit utilization, account age, number of hard inquiries, geographic location data at the census tract level, and behavioral patterns derived from digital interaction metadata.

2. MODEL DEVELOPMENT AND TESTING
Vendor represents that its model has been tested internally and meets industry benchmarks for accuracy as of the effective date. Vendor uses a proprietary gradient boosting ensemble. Global feature importance scores are available in the Vendor Portal.

3. PERFORMANCE AND UPDATES
Vendor will provide quarterly performance reports upon written request from Institution. Vendor commits to maintaining the model's performance within acceptable industry standards for credit risk scoring applications. Vendor reserves the right to update the model to improve performance and will provide notification for major version changes as determined by Vendor.

4. DOCUMENTATION
Vendor shall deliver complete technical documentation within 30 days of contract execution, including: model architecture description, full feature list with definitions, training data summary, validation benchmarks, and known limitations.

5. FAIRNESS AND NON-DISCRIMINATION
Vendor certifies that the model has been developed using industry best practices for fairness and non-discrimination. In the event that disparate impact or discriminatory patterns are identified in model outputs during testing or production monitoring, Vendor and Institution shall jointly develop and execute a remediation plan within 90 calendar days of identification.

6. DATA PROCESSING
Vendor shall process consumer data solely in its capacity as a data processor acting on the explicit written instructions of Institution. Institution retains sole responsibility for obtaining all legally required consumer consents and maintaining compliant privacy notices. Vendor maintains training datasets used in model development for a minimum period of 24 months following the initial model deployment date. Vendor operates a globally distributed cloud infrastructure across multiple geographic regions to ensure service availability, redundancy, and performance optimization.

7. CUSTOMER DISCLOSURES
Institution agrees to update its privacy notice and all applicable customer disclosures to reference the use of automated decision-making systems, as required by applicable law, prior to deploying the Vendor's AI model in production.

8. AUDIT AND REGULATORY ACCESS
Vendor will cooperate with reasonable information requests from Institution in connection with Institution's compliance and risk management obligations. Vendor agrees to provide all documentation, system access, and personnel support necessary for regulatory examinations of Institution, including model documentation packages, validation reports, performance data, and bias testing results. Response to Institution examination requests shall occur within 5 business days.

9. INCIDENT NOTIFICATION
Vendor will notify Institution within 48 hours of any service outage exceeding 15 minutes or any material security incident affecting the AI platform or underlying data.

10. DECISION LOGGING
Vendor maintains tamper-evident decision logs for all model inferences, capturing: model version and SHA-256 hash, feature category values (not raw PII), output score and applied decision threshold, inference timestamp, and requesting system identifier. Logs are retained for 36 months and accessible to Institution via authenticated API.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date written below.`;

  if (!pasteVisible) togglePaste();
  document.getElementById('pasteText').value = sample;
}

// ── Clear ──────────────────────────────────────────────────────────────────
function clearAnalysis() {
  selectedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('pasteText').value = '';
  document.getElementById('uploadFilename').textContent = '';
  document.getElementById('uploadArea').classList.remove('has-file');
  document.getElementById('analysisResults').classList.add('hidden');
  document.getElementById('analyzeError').classList.add('hidden');
  currentFindings = [];
}

// ── Analyze Document ───────────────────────────────────────────────────────
async function analyzeDocument() {
  const btn = document.getElementById('analyzeBtn');
  const text = document.getElementById('pasteText').value.trim();

  if (!selectedFile && !text) {
    showAnalyzeError('Please upload a document or paste text to analyze.');
    return;
  }

  setAnalyzeLoading(true);
  document.getElementById('analyzeError').classList.add('hidden');
  document.getElementById('analysisResults').classList.add('hidden');

  try {
    let body, headers = {};

    if (selectedFile) {
      const formData = new FormData();
      formData.append('document', selectedFile);
      body = formData;
    } else {
      body = JSON.stringify({ text });
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch('/api/analyze', { method: 'POST', body, headers });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Analysis failed');

    currentFindings = data.findings || [];
    renderResults(data);
    document.getElementById('analysisResults').classList.remove('hidden');
    document.getElementById('analysisResults').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    showAnalyzeError(err.message);
  } finally {
    setAnalyzeLoading(false);
  }
}

function setAnalyzeLoading(on) {
  const btn = document.getElementById('analyzeBtn');
  document.getElementById('analyzeBtnText').classList.toggle('hidden', on);
  document.getElementById('analyzeBtnSpinner').classList.toggle('hidden', !on);
  btn.disabled = on;
}

function showAnalyzeError(msg) {
  const box = document.getElementById('analyzeError');
  box.textContent = `⚠ ${msg}`;
  box.classList.remove('hidden');
}

// ── Render Results ─────────────────────────────────────────────────────────
function renderResults(data) {
  // Dashboard
  const riskEl = document.getElementById('riskLevel');
  riskEl.textContent = `${riskEmoji(data.overall_risk)} ${data.overall_risk} RISK`;
  riskEl.className = `risk-level ${data.overall_risk}`;
  document.getElementById('docType').textContent = data.document_type || 'Document';

  const counts = data.counts || {};
  document.getElementById('riskCounts').innerHTML = `
    <div class="count-item"><div class="count-num critical">${counts.critical_failures || 0}</div><div class="count-label">Critical</div></div>
    <div class="count-item"><div class="count-num warning">${counts.warnings || 0}</div><div class="count-label">Warnings</div></div>
    <div class="count-item"><div class="count-num passed">${counts.passed || 0}</div><div class="count-label">Passed</div></div>
    <div class="count-item"><div class="count-num na">${counts.not_applicable || 0}</div><div class="count-label">N/A</div></div>
  `;
  document.getElementById('execSummary').textContent = data.executive_summary || '';

  renderFindings(currentFindings);
}

function renderFindings(findings) {
  const list = document.getElementById('findingsList');
  if (!findings.length) {
    list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:32px">No findings match this filter.</div>';
    return;
  }

  list.innerHTML = `<div class="findings-list">${findings.map(renderFindingCard).join('')}</div>`;
}

function renderFindingCard(f) {
  const statusIcons = { FAIL: '❌', WARN: '⚠️', PASS: '✅', 'N/A': '⬜' };
  const icon = statusIcons[f.status] || '⬜';
  const displayStatus = f.status === 'N/A' ? 'N/A' : f.status;
  const cardClass = f.status === 'N/A' ? 'NA' : f.status;

  const steps = (f.reasoning_steps || []).map((s, i) => {
    const stepText = s.replace(/^Step \d+:\s*/i, '');
    return `<li class="reasoning-step"><div class="step-num">${i + 1}</div><div>${escHtml(stepText)}</div></li>`;
  }).join('');

  const evidence = f.relevant_text && f.relevant_text !== 'Not addressed in document'
    ? `<div class="finding-evidence">
        <div class="finding-evidence-label">Evidence from document</div>
        <div class="finding-evidence-quote">"${escHtml(f.relevant_text)}"</div>
       </div>`
    : `<div class="finding-evidence">
        <div class="finding-evidence-label">Evidence</div>
        <div style="color:var(--na-text)">Not addressed in document</div>
       </div>`;

  const recommendation = f.recommendation
    ? `<div class="finding-recommendation">
        <span class="rec-icon">💡</span>
        <div><strong>Recommendation:</strong> ${escHtml(f.recommendation)}</div>
       </div>`
    : '';

  return `
    <div class="finding-card ${cardClass}" id="card-${escId(f.rule_id)}">
      <div class="finding-header" onclick="toggleFinding('${escId(f.rule_id)}')">
        <div class="finding-status-icon">${icon}</div>
        <div class="finding-meta">
          <div class="finding-rule-id">${escHtml(f.rule_id)} · ${escHtml(f.category || '')}</div>
          <div class="finding-rule-name">${escHtml(f.rule_name)}</div>
          <div class="finding-category">${escHtml(f.regulatory_source || '')}</div>
        </div>
        <div class="finding-badges">
          <span class="status-badge ${f.status}">${displayStatus}</span>
          <span class="sev-badge ${f.severity || 'info'}">${(f.severity || 'info').toUpperCase()}</span>
          <span class="finding-chevron" id="chevron-${escId(f.rule_id)}">▼</span>
        </div>
      </div>
      <div class="finding-body" id="body-${escId(f.rule_id)}">
        ${evidence}
        <div class="reasoning-label">Step-by-step Reasoning</div>
        <ul class="reasoning-steps">${steps}</ul>
        <div class="finding-conclusion">🔎 ${escHtml(f.conclusion || '')}</div>
        ${recommendation}
        <div class="finding-reg-source">📚 Regulatory source: ${escHtml(f.regulatory_source || '')}</div>
      </div>
    </div>
  `;
}

function toggleFinding(id) {
  const body = document.getElementById(`body-${id}`);
  const chevron = document.getElementById(`chevron-${id}`);
  if (!body) return;
  const open = body.classList.toggle('open');
  if (chevron) chevron.classList.toggle('open', open);
}

// ── Filter Findings ────────────────────────────────────────────────────────
function filterFindings(filter, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const filtered = filter === 'all'
    ? currentFindings
    : currentFindings.filter(f => f.status === filter);

  renderFindings(filtered);
}

// ── Q&A ────────────────────────────────────────────────────────────────────
function askSuggested(q) {
  switchTab('ask');
  document.getElementById('questionInput').value = q;
  askQuestion();
}

function handleQuestionKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    askQuestion();
  }
}

async function askQuestion() {
  const input = document.getElementById('questionInput');
  const question = input.value.trim();
  if (!question) return;

  const chatEmpty = document.getElementById('chatEmpty');
  chatEmpty.style.display = 'none';

  appendUserMessage(question);
  input.value = '';

  setAskLoading(true);
  document.getElementById('askError').classList.add('hidden');

  const thinkingId = appendThinkingMessage();

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();

    removeMessage(thinkingId);

    if (!res.ok) throw new Error(data.error || 'Request failed');

    appendAgentMessage(data.answer, data.mode);

  } catch (err) {
    removeMessage(thinkingId);
    const errBox = document.getElementById('askError');
    errBox.textContent = `⚠ ${err.message}`;
    errBox.classList.remove('hidden');
  } finally {
    setAskLoading(false);
  }
}

function setAskLoading(on) {
  document.getElementById('askBtnText').classList.toggle('hidden', on);
  document.getElementById('askBtnSpinner').classList.toggle('hidden', !on);
  document.getElementById('askBtn').disabled = on;
}

function appendUserMessage(text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-message msg-user';
  div.innerHTML = `<div class="msg-bubble">${escHtml(text)}</div>`;
  container.appendChild(div);
  scrollChat();
}

function appendThinkingMessage() {
  const container = document.getElementById('chatMessages');
  const id = `thinking-${Date.now()}`;
  const div = document.createElement('div');
  div.className = 'chat-message msg-agent';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">⚖</div>
    <div class="msg-bubble" style="color:var(--text-muted);font-style:italic">
      Searching the rulebook<span class="thinking-dots">...</span>
    </div>`;
  container.appendChild(div);
  scrollChat();
  return id;
}

function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendAgentMessage(text, mode) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `
    <div class="msg-agent">
      <div class="msg-avatar">⚖</div>
      <div class="msg-bubble">${markdownToHtml(text)}</div>
    </div>
    <div class="msg-meta">ClauseGuard Compliance · ${mode || ''} · ${new Date().toLocaleTimeString()}</div>`;
  container.appendChild(div);
  scrollChat();
}

function scrollChat() {
  const container = document.getElementById('chatContainer');
  container.scrollTop = container.scrollHeight;
}

// ── Simple markdown renderer ───────────────────────────────────────────────
function markdownToHtml(text) {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Headers
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong style="font-size:15px">$1</strong>')
    // Bullet points (• or - or *)
    .replace(/^[•\-\*]\s+(.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    // Line breaks to paragraphs
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      if (p.startsWith('<ul>') || p.startsWith('<strong')) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escId(str) {
  return (str || '').replace(/[^a-zA-Z0-9-]/g, '-');
}

function riskEmoji(level) {
  return { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }[level] || '⚪';
}
