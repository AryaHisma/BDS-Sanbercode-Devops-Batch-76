import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Inisialisasi Database SQLite
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Error membuka database SQLite", err);
  else console.log("Database SQLite terhubung.");
});

// Buat tabel jika belum ada
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT,
      size TEXT,
      date TEXT,
      path TEXT,
      text TEXT,
      summary TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS search_cache (
      query TEXT,
      doc_id TEXT,
      snippet TEXT,
      ai_summary TEXT,
      model TEXT,
      PRIMARY KEY (query, doc_id, model)
    )
  `);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Batas maksimal 5 MB
});

// API Key Anda yang disimpan di backend (mengambil dari file .env)
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Fungsi untuk berinteraksi dengan Groq API
async function generateGroqSummary(prompt) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      }
      return "Format respons Groq tidak dikenali.";
    }
    const errorData = await response.json();
    console.error("Groq API Error:", errorData);
    return "Gagal menghubungi Groq API. Pastikan API Key valid.";
  } catch (err) {
    console.error("Groq request error:", err);
    return "Terjadi kesalahan koneksi ke Groq API.";
  }
}

// Endpoint Upload
app.post('/api/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
  }

  try {
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    // VALIDASI NAMA FILE SAMA
    const checkDuplicate = () => new Promise((resolve, reject) => {
      db.get('SELECT id FROM documents WHERE name = ?', [originalName], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const duplicate = await checkDuplicate();
    if (duplicate) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({ error: 'Dokumen dengan nama ini sudah pernah diunggah.' });
    }

    const dataBuffer = fs.readFileSync(filePath);
    
    // Parse teks dari PDF
    const data = await pdfParse(dataBuffer);
    const text = data.text;

    const doc = {
      id: req.file.filename,
      name: originalName,
      size: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
      date: new Date().toLocaleString('id-ID'),
      path: filePath,
      text: text 
    };

    db.run(
      `INSERT INTO documents (id, name, size, date, path, text, summary) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [doc.id, doc.name, doc.size, doc.date, doc.path, doc.text, 'Memproses AI Summary...'],
      function(err) {
        if (err) {
          console.error("Gagal menyimpan dokumen ke DB", err.message);
          if (!res.headersSent) res.status(500).json({ error: 'Gagal menyimpan ke database' });
          return;
        }

        res.json({ 
          message: 'File berhasil diunggah. Sedang diproses AI di latar belakang...', 
          document: { id: doc.id, name: doc.name, size: doc.size, date: doc.date, summary: 'Memproses AI Summary...' } 
        });

        (async () => {
          try {
            const prompt = `Tolong berikan ringkasan singkat (maksimal 3 kalimat) dalam Bahasa Indonesia tentang apa isi dokumen berikut secara umum:\n\n${text.substring(0, 3000)}`;
            const summary = await generateGroqSummary(prompt); 

            db.run(`UPDATE documents SET summary = ? WHERE id = ?`, [summary, doc.id]);
          } catch (e) {
            console.error("Groq background error:", e);
            db.run(`UPDATE documents SET summary = ? WHERE id = ?`, ['Gagal menghubungi Groq', doc.id]);
          }
        })();
      }
    );

  } catch (error) {
    console.error('Error memproses PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Gagal memproses file PDF' });
    }
  }
});

// Endpoint untuk mendapatkan daftar dokumen
app.get('/api/documents', (req, res) => {
  db.all(`SELECT id, name, size, date, summary FROM documents ORDER BY date DESC`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Endpoint untuk menghapus dokumen
app.delete('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT path FROM documents WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      if (fs.existsSync(row.path)) fs.unlinkSync(row.path);
      
      db.run(`DELETE FROM documents WHERE id = ?`, id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(`DELETE FROM search_cache WHERE doc_id = ?`, id);
        
        res.json({ message: 'Dokumen dihapus' });
      });
    } else {
      res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }
  });
});

// Endpoint untuk mengunduh dokumen
app.get('/api/documents/:id/download', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT path, name FROM documents WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row && fs.existsSync(row.path)) {
      res.download(row.path, row.name);
    } else {
      res.status(404).json({ error: 'File tidak ditemukan' });
    }
  });
});

// Endpoint untuk mencari dokumen
app.post('/api/search', async (req, res) => {
  const { query, model = 'groq' } = req.body;
  if (!query) return res.status(400).json({ error: 'Kata kunci pencarian diperlukan' });

  db.all(`SELECT id, name, text FROM documents WHERE text LIKE ? COLLATE NOCASE`, [`%${query}%`], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const results = [];
    
    for (const doc of rows) {
      const index = doc.text.toLowerCase().indexOf(query.toLowerCase());
      const start = Math.max(0, index - 150);
      const end = Math.min(doc.text.length, index + query.length + 150);
      let snippet = doc.text.substring(start, end).replace(/\n/g, ' ');

      const getCache = () => new Promise((resolve) => {
         db.get(`SELECT ai_summary FROM search_cache WHERE query = ? AND doc_id = ? AND model = ?`, [query.toLowerCase(), doc.id, model], (err, row) => {
           resolve(row ? row.ai_summary : null);
         });
      });

      let aiSummary = await getCache();

      if (!aiSummary) {
        const prompt = `Tolong berikan ringkasan singkat dalam Bahasa Indonesia (maksimal 2 kalimat) tentang informasi apa yang dikatakan oleh teks berikut terkait dengan kata kunci "${query}".\n\nTeks PDF:\n${snippet}`;
        aiSummary = await generateGroqSummary(prompt);
        
        db.run(`INSERT OR REPLACE INTO search_cache (query, doc_id, snippet, ai_summary, model) VALUES (?, ?, ?, ?, ?)`, 
          [query.toLowerCase(), doc.id, snippet, aiSummary, model]
        );
      }

      results.push({
        id: doc.id,
        name: doc.name,
        snippet: snippet,
        aiSummary: aiSummary
      });
    }

    res.json({ results });
  });
});

app.listen(PORT, () => {
  console.log(`Backend server berjalan dengan Database SQLite di http://localhost:${PORT}`);
});
