const STORAGE_KEY = "belajarbareng:v1";
const DEFAULTS = { subject: "umum", level: "sma", style: "santai" };

const SUBJECT_LABEL = {
  umum: "pelajaran yang kamu pilih",
  matematika: "Matematika",
  fisika: "Fisika",
  kimia: "Kimia",
  biologi: "Biologi",
  inggris: "Bahasa Inggris",
  informatika: "Informatika",
};

const STARTERS = [
  "Jelaskan hukum Newton II dengan contoh sehari-hari",
  "Apa bedanya mitosis dan meiosis?",
  "Bantu aku paham konsep limit fungsi",
];

const $ = (selector) => document.querySelector(selector);
const thread = $("#thread");
const composer = $("#composer");
const input = $("#input");
const sendBtn = $("#sendBtn");
const quizBtn = $("#quizBtn");
const clearBtn = $("#clearBtn");
const subjectEl = $("#subject");
const levelEl = $("#level");

// ---------- State & memory (disimpan di browser) ----------

const state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      return {
        history: Array.isArray(saved.history) ? saved.history : [],
        settings: { ...DEFAULTS, ...saved.settings },
      };
    }
  } catch {
    /* abaikan data rusak */
  }
  return { history: [], settings: { ...DEFAULTS } };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* penyimpanan penuh atau diblokir: aplikasi tetap jalan */
  }
}

// ---------- Rendering ----------

function renderMarkdown(text) {
  if (window.marked && window.DOMPurify) {
    return DOMPurify.sanitize(marked.parse(text, { breaks: true }));
  }
  const p = document.createElement("p");
  p.textContent = text;
  return p.outerHTML;
}

function createMessage(role, text, { error = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}${error ? " error" : ""}`;

  const who = document.createElement("div");
  who.className = "who";
  who.textContent = role === "user" ? "Kamu" : "Bela";

  const body = document.createElement("div");
  body.className = "body";
  if (role === "bot") body.innerHTML = renderMarkdown(text);
  else body.textContent = text;

  wrap.append(who, body);
  return wrap;
}

function scrollToBottom() {
  thread.scrollTop = thread.scrollHeight;
}

function showEmptyState() {
  const box = document.createElement("div");
  box.className = "empty";
  box.innerHTML = `
    <h2>Mau belajar apa hari ini?</h2>
    <p>Pilih mata pelajaran di samping, lalu tanyakan apa saja. Bela akan menjelaskan bertahap dan bisa membuat kuis untuk mengetes pemahamanmu.</p>
    <div class="chips"></div>`;
  const chips = box.querySelector(".chips");
  STARTERS.forEach((text) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = text;
    chip.addEventListener("click", () => sendMessage(text));
    chips.append(chip);
  });
  thread.replaceChildren(box);
}

function renderAll() {
  if (state.history.length === 0) {
    showEmptyState();
    return;
  }
  thread.replaceChildren(
    ...state.history.map((m) => createMessage(m.role, m.text))
  );
  scrollToBottom();
}

function showTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot typing";
  wrap.innerHTML = `<div class="who">Bela</div><div class="body" role="status" aria-label="Bela sedang mengetik"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  thread.append(wrap);
  scrollToBottom();
  return wrap;
}

// ---------- Kirim pesan ----------

let busy = false;

function setBusy(value) {
  busy = value;
  sendBtn.disabled = value;
  quizBtn.disabled = value;
  sendBtn.textContent = value ? "Menunggu..." : "Kirim";
}

async function sendMessage(text) {
  const message = text.trim();
  if (!message || busy) return;

  // Hapus tampilan awal bila masih ada
  if (state.history.length === 0) thread.replaceChildren();

  const userBubble = createMessage("user", message);
  thread.append(userBubble);
  const typing = showTyping();
  input.value = "";
  autosize();
  setBusy(true);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: state.history,
        settings: state.settings,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Terjadi kesalahan. Coba lagi.");

    typing.remove();
    state.history.push({ role: "user", text: message });
    state.history.push({ role: "bot", text: data.reply });
    saveState();
    thread.append(createMessage("bot", data.reply));
  } catch (err) {
    typing.remove();
    userBubble.remove();
    input.value = message; // kembalikan teks supaya bisa dikirim ulang
    autosize();
    const text =
      err instanceof TypeError
        ? "Tidak bisa terhubung ke server. Pastikan server masih berjalan, lalu kirim ulang."
        : err.message;
    thread.append(createMessage("bot", text, { error: true }));
  } finally {
    setBusy(false);
    scrollToBottom();
    input.focus();
  }
}

// ---------- Kontrol ----------

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendMessage(input.value);
  }
});

function autosize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}
input.addEventListener("input", autosize);

quizBtn.addEventListener("click", () => {
  const prompt =
    state.history.length === 0
      ? `Buatkan kuis 3 soal pilihan ganda tentang ${SUBJECT_LABEL[state.settings.subject]}. Tampilkan soalnya saja tanpa kunci jawaban, lalu tunggu jawabanku.`
      : "Buatkan kuis 3 soal pilihan ganda tentang topik yang baru kita bahas. Tampilkan soalnya saja tanpa kunci jawaban, lalu tunggu jawabanku sebelum membahas.";
  sendMessage(prompt);
});

clearBtn.addEventListener("click", () => {
  if (state.history.length && !confirm("Hapus percakapan ini dan mulai dari awal?")) return;
  state.history = [];
  saveState();
  renderAll();
});

subjectEl.addEventListener("change", () => {
  state.settings.subject = subjectEl.value;
  saveState();
});

levelEl.addEventListener("change", () => {
  state.settings.level = levelEl.value;
  saveState();
});

document.querySelectorAll('input[name="style"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    state.settings.style = radio.value;
    saveState();
  });
});

// ---------- Mulai ----------

subjectEl.value = state.settings.subject;
levelEl.value = state.settings.level;
const styleRadio = document.querySelector(`input[name="style"][value="${state.settings.style}"]`);
if (styleRadio) styleRadio.checked = true;

renderAll();
