# BelajarBareng AI

Chatbot tutor berbasis **Gemini API** untuk pelajar SMA/SMK dan mahasiswa tahun pertama di Indonesia. Bela, tutor AI-nya, menjelaskan materi bertahap dengan contoh sehari-hari, lalu bisa membuat kuis untuk mengetes pemahaman.

## Use case

- **Target pengguna:** pelajar SMA/SMK dan mahasiswa awal yang butuh teman belajar yang bisa diakses kapan saja.
- **Cara membantu:** menjelaskan konsep dengan bahasa yang mudah, membimbing soal langkah demi langkah, dan membuat kuis pilihan ganda.

## Fitur

- **Pilihan mata pelajaran:** Umum, Matematika, Fisika, Kimia, Biologi, Bahasa Inggris, Informatika.
- **Pilihan jenjang:** SMA/SMK atau mahasiswa tahun pertama.
- **Gaya bahasa:** santai atau formal.
- **Memory:** riwayat percakapan dikirim ulang ke model (20 pesan terakhir) dan disimpan di browser, jadi percakapan tetap ada setelah halaman dimuat ulang.
- **Kuis:** tombol "Buat kuis dari topik ini" membuat 3 soal pilihan ganda tanpa kunci jawaban, lalu Bela membahas setelah kamu menjawab.

## Konfigurasi model

| Parameter | Nilai | Alasan |
|---|---|---|
| `systemInstruction` | persona "Bela" + aturan mengajar | menjaga gaya dan topik jawaban |
| `temperature` | 0.4 | penjelasan lebih konsisten dan akurat |
| `topP` | 0.9 | variasi kata tetap wajar |
| Model | `gemini-2.5-flash` (bisa diganti lewat `.env`) | cepat dan hemat |

## Teknologi

Node.js, Express, `@google/genai`, HTML/CSS/JavaScript biasa (tanpa framework).

## Cara menjalankan

1. Pastikan Node.js 18 atau lebih baru sudah terpasang.
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Salin `.env.example` menjadi `.env`, lalu isi `GEMINI_API_KEY` (dari https://aistudio.google.com/apikey).
4. Jalankan server:
   ```bash
   npm start
   ```
5. Buka http://localhost:3000.

## Struktur folder

```
belajarbareng-ai/
├── server.js          # server Express + pemanggilan Gemini API
├── package.json
├── .env.example
└── public/
    ├── index.html
    ├── style.css
    └── app.js         # logika chat, memory, kuis
```

## Screenshot

Tambahkan screenshot di folder `screenshots/` lalu tautkan di sini:

![Tampilan awal](screenshots/01-tampilan-awal.png)
![Contoh percakapan](screenshots/02-percakapan.png)
![Kuis](screenshots/03-kuis.png)

## Keamanan

API key hanya dipakai di server dan tidak pernah dikirim ke browser. File `.env` sudah masuk `.gitignore`, jadi jangan di-commit.
