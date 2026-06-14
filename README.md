# ClauseGuard Compliance

AI compliance analysis for the financial sector. Upload a vendor contract, AI system description, or policy document and get a step-by-step reasoning report checked against 20 real financial AI regulations.

## Features

- **Document analysis** — Upload PDF/TXT or paste text; the agent checks every rule and shows pass/fail/warn with cited reasoning
- **Ask Regulations tab** — Chat assistant that answers questions strictly from the rulebook with rule ID citations
- **20-rule compliance rulebook** — Organized by category, browsable in the sidebar, each rule citable in findings
- **Azure OpenAI + mock mode** — Works out of the box with realistic sample findings; plug in Azure credentials for live analysis

## Compliance Categories

| Category | Rules | Key Regulations |
|---|---|---|
| Model Risk Management | MRM-001–004 | SR 11-7 (Federal Reserve / OCC) |
| Explainability & Transparency | EXT-001–003 | CFPB Circular 2022-03, NIST AI RMF |
| Fair Lending & Bias | FLB-001–003 | ECOA, Fair Housing Act, CFPB Circulars 2022-03 & 2023-02 |
| Data Governance | DG-001–003 | GLBA, CCPA/CPRA, NY DFS 23 NYCRR 500 |
| Third-Party AI Risk | TPR-001–003 | OCC 2023-17, Federal Reserve SR 13-19 |
| Audit & Accountability | AA-001–004 | SR 11-7, SEC Rule 17a-4, FINRA Rules 4511–4512 |

## Privacy & PII Handling

Before any document text is sent to the AI model, ClauseGuard runs a two-stage scrubbing pass to remove personal identifiers:

1. **Regex redaction** — structured PII is replaced with labelled tokens: `[SSN]`, `[CARD]`, `[PHONE]`, and `[EMAIL]`.
2. **NLP redaction** — [compromise](https://github.com/spencermountain/compromise) tags and replaces named entities: `[PERSON]` (individuals), `[ORG]` (companies), and `[PLACE]` (addresses and locations).

The scrubbed text is what reaches the AI model; the original document is never stored to disk. As a result, compliance findings will reference placeholder tokens rather than real names or identifiers when quoting contract text.

## Quick Start

```bash
# Install dependencies
npm install

# Run in mock mode (no credentials needed)
npm start
```

Open **http://localhost:3000**, click **"Load a sample contract"**, then **Analyze for Compliance** to see a full mock report.

## Azure OpenAI Setup

Copy `.env.example` to `.env` and fill in your credentials:

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

Then restart the server. The mode badge in the sidebar will switch from **Mock Mode** to **Azure OpenAI**.

## Project Structure

```
clauseguard/
├── server.js                  Express server + API routes
├── src/
│   ├── analyzer.js            Document analysis agent
│   └── qa.js                  Regulation Q&A agent
├── rules/
│   └── compliance-rules.json  20-rule compliance rulebook
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── .env.example
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/rules` | Returns the full compliance rulebook |
| GET | `/api/status` | Returns current mode (mock/azure) |
| POST | `/api/analyze` | Analyze a document (multipart file or JSON `{text}`) |
| POST | `/api/ask` | Ask a regulation question (JSON `{question}`) |

## Development

```bash
npm run dev   # nodemon auto-reload
```
