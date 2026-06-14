'use strict';

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { analyzeDocument } = require('./src/analyzer');
const { answerQuestion } = require('./src/qa');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith('.txt'));
  },
});

const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules', 'compliance-rules.json'), 'utf8'));

const MOCK_MODE = !process.env.AZURE_OPENAI_ENDPOINT || process.env.MOCK_MODE === 'true';

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/rules', (req, res) => res.json(rules));

app.get('/api/status', (req, res) => res.json({ mode: MOCK_MODE ? 'mock' : 'azure', version: rules.version }));

app.post('/api/analyze', upload.single('document'), async (req, res) => {
  try {
    let text = '';

    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const parsed = await pdfParse(req.file.buffer);
        text = parsed.text;
      } else {
        text = req.file.buffer.toString('utf8');
      }
    } else if (req.body && req.body.text) {
      text = req.body.text;
    } else {
      return res.status(400).json({ error: 'No document provided. Upload a PDF/TXT file or paste text.' });
    }

    text = text.trim();
    if (text.length < 50) {
      return res.status(400).json({ error: 'Document is too short to analyze. Please provide a more complete document.' });
    }

    const result = await analyzeDocument(text, rules);
    res.json(result);
  } catch (err) {
    console.error('Analysis error:', err.message);
    if (err.message && err.message.includes('pdf')) {
      return res.status(422).json({ error: 'Could not parse PDF. Try copying and pasting the document text instead.' });
    }
    res.status(500).json({ error: `Analysis failed: ${err.message}` });
  }
});

app.post('/api/ask', express.json(), async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'No question provided.' });
    }
    if (question.length > 1000) {
      return res.status(400).json({ error: 'Question too long. Please keep questions under 1000 characters.' });
    }
    const answer = await answerQuestion(question.trim(), rules);
    res.json(answer);
  } catch (err) {
    console.error('Q&A error:', err.message);
    res.status(500).json({ error: `Q&A failed: ${err.message}` });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 15MB.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🛡  ClauseGuard Compliance running at http://localhost:${PORT}`);
  console.log(`   Mode: ${MOCK_MODE ? '📋 Mock (realistic sample findings)' : '☁️  Azure OpenAI — ' + process.env.AZURE_OPENAI_DEPLOYMENT}`);
  console.log(`   Rules loaded: ${rules.rules.length} rules across ${rules.categories.length} categories\n`);
});
