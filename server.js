import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// Batas agar request tidak membengkak
const MAX_HISTORY = 20; // jumlah pesan terakhir yang dikirim sebagai "memory"
const MAX_MESSAGE_CHARS = 2000;

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "GEMINI_API_KEY belum diisi. Salin .env.example menjadi .env lalu isi API key kamu."
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Coba ulang otomatis saat server Gemini sedang sibuk (503)
const RETRY_DELAYS_MS = [1000, 2500, 5000];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(params) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      if (err?.status !== 503 || attempt >= RETRY_DELAYS_MS.length) throw err;
      console.warn(`Gemini sibuk (503), mencoba lagi (${attempt + 1}/${RETRY_DELAYS_MS.length})...`);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Parameter kreatif: persona, gaya bahasa, mata pelajaran, jenjang ----------

const SUBJECTS = {
  umum: "Umum (semua mata pelajaran)",
  matematika: "Matematika",
  fisika: "Fisika",
  kimia: "Kimia",
  biologi: "Biologi",
  inggris: "Bahasa Inggris",
  informatika: "Informatika dan pemrograman dasar",
};

const STYLES = {
  santai:
    "Santai dan ramah, seperti kakak kelas yang sabar. Boleh pakai sapaan 'kamu' dan sesekali kata sehari-hari, tetap sopan.",
  formal:
    "Formal dan rapi, seperti guru. Gunakan bahasa Indonesia baku dan istilah yang tepat.",
};

const LEVELS = {
  sma: "SMA/SMK",
  kuliah: "Mahasiswa tahun pertama",
};

function buildSystemInstruction({ subject, style, level }) {
  return `Kamu adalah "Bela", tutor AI di aplikasi BelajarBareng AI untuk pelajar dan mahasiswa Indonesia.

Mata pelajaran fokus: ${SUBJECTS[subject]}.
Jenjang pengguna: ${LEVELS[level]}.
Gaya bahasa: ${STYLES[style]}

Aturan:
- Jawab dalam bahasa Indonesia.
- Jelaskan bertahap: gambaran singkat, contoh dari kehidupan sehari-hari, lalu rangkuman satu atau dua kalimat.
- Untuk soal hitungan atau tugas, bimbing langkah demi langkah dan ajak pengguna mencoba langkah berikutnya sebelum memberi jawaban akhir, kecuali pengguna langsung meminta jawabannya.
- Jangan pakai LaTeX. Tulis rumus dengan teks biasa atau simbol unicode (contoh: F = m × a, x²).
- Jika pertanyaan di luar topik belajar, jawab singkat lalu arahkan kembali ke belajar.
- Jika tidak yakin, katakan dengan jujur dan jangan mengarang fakta.
- Jawaban ringkas (sekitar 200 kata) kecuali diminta lebih panjang. Gunakan Markdown ringan: daftar dan **teks tebal**.
- Saat diminta kuis: buat soal pilihan ganda A sampai D, jangan tampilkan kunci jawaban sampai pengguna menjawab. Setelah pengguna menjawab, beri umpan balik dan penjelasan.`;
}

// ---------- Endpoint ----------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

app.post("/api/chat", async (req, res) => {
  const { message, history = [], settings = {} } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Pesan tidak boleh kosong." });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res
      .status(400)
      .json({ error: `Pesan terlalu panjang (maksimal ${MAX_MESSAGE_CHARS} karakter).` });
  }

  const s = settings && typeof settings === "object" ? settings : {};
  const subject = Object.hasOwn(SUBJECTS, s.subject) ? s.subject : "umum";
  const style = Object.hasOwn(STYLES, s.style) ? s.style : "santai";
  const level = Object.hasOwn(LEVELS, s.level) ? s.level : "sma";

  // Memory: riwayat percakapan dikirim ulang di setiap request
  let past = (Array.isArray(history) ? history : [])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "bot") &&
        typeof m.text === "string" &&
        m.text.trim()
    )
    .slice(-MAX_HISTORY);

  // Gemini mengharuskan percakapan diawali pesan dari user
  while (past.length && past[0].role !== "user") past.shift();

  const contents = [
    ...past.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text.slice(0, 4000) }],
    })),
    { role: "user", parts: [{ text: message.trim() }] },
  ];

  try {
    const response = await generateWithRetry({
      model: MODEL,
      contents,
      config: {
        systemInstruction: buildSystemInstruction({ subject, style, level }),
        temperature: 0.4, // rendah supaya penjelasan konsisten dan akurat
        topP: 0.9,
      },
    });

    const reply = response.text?.trim();
    if (!reply) {
      return res.status(502).json({
        error: "Bela belum bisa menjawab itu. Coba tulis ulang pertanyaannya.",
      });
    }
    res.json({ reply });
  } catch (err) {
    console.error("Gemini error:", err?.status, err?.message);
    if (err?.status === 429) {
      return res.status(429).json({
        error: "Terlalu banyak permintaan atau kuota habis. Tunggu sebentar lalu coba lagi.",
      });
    }
    if (err?.status === 503) {
      return res.status(503).json({
        error: "Server Gemini sedang sibuk. Tunggu beberapa detik lalu kirim ulang.",
      });
    }
    res.status(500).json({
      error: "Server gagal menghubungi Gemini. Periksa API key dan koneksi internet.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`BelajarBareng AI berjalan di http://localhost:${PORT} (model: ${MODEL})`);
});