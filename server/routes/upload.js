// File import: upload a .txt, .md or .docx file → it becomes a new editable document.
import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import { marked } from 'marked';
import path from 'node:path';
import { cleanHtml, escapeHtml } from '../sanitize.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx'];

// Files are held in memory only (never written to disk) and discarded after conversion.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, SUPPORTED_EXTENSIONS.includes(ext));
  },
});

function textToHtml(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function convert(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.docx') {
    // .docx is a ZIP archive: check the "PK" magic bytes, not just the extension.
    if (file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) throw new Error('Not a valid .docx file');
    const { value } = await mammoth.convertToHtml({ buffer: file.buffer });
    return value;
  }
  const text = file.buffer.toString('utf8');
  if (ext === '.md') return marked.parse(text, { async: false });
  return textToHtml(text);
}

export function uploadRoutes(db) {
  const r = Router();

  r.post('/', (req, res, next) => {
    upload.single('file')(req, res, async (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large (max 5 MB)' });
      if (err) return next(err);
      if (!req.file) {
        return res.status(400).json({ error: `Unsupported file. Please upload one of: ${SUPPORTED_EXTENSIONS.join(', ')}` });
      }
      let html;
      try {
        html = cleanHtml(await convert(req.file));
      } catch {
        return res.status(422).json({ error: 'Could not read this file. Is it a valid document?' });
      }
      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname)).slice(0, 200) || 'Imported document';
      try {
        const { rows } = await db.query(
          `INSERT INTO documents (owner_id, title, content_html) VALUES ($1, $2, $3) RETURNING id, title`,
          [req.user.id, baseName, html],
        );
        res.status(201).json({ document: rows[0] });
      } catch (e) {
        next(e);
      }
    });
  });

  return r;
}
