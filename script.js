/* ---------------- PARTICLES ---------------- */

function createParticles() {
  const container = document.getElementById("particles");
  const count = 50;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");

    const size = Math.random() * 3 + 1;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}vw`;
    p.style.top = `${Math.random() * 100}vh`;

    p.style.animationDuration = `${Math.random() * 20 + 10}s`;
    container.appendChild(p);
  }
}
createParticles();

/* ---------------- MAGNETIC BUTTONS ---------------- */

function initMagneticButtons() {
  document.querySelectorAll(".magnetic").forEach(btn => {
    btn.addEventListener("mousemove", e => {
      const rect = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - rect.left - rect.width / 2) * 0.2}px, 
                                       ${(e.clientY - rect.top - rect.height / 2) * 0.2}px)`;
    });
    btn.addEventListener("mouseleave", () => btn.style.transform = "translate(0,0)");
  });
}
initMagneticButtons();

/* ---------------- FILE HANDLING ---------------- */

const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const textArea = document.getElementById("textArea");
const zipFilesList = document.getElementById("zipFilesList");
const summaryLenLabel = document.getElementById("summaryLenLabel");
const summaryLength = document.getElementById("summaryLength");

summaryLength.addEventListener("input", () => {
  summaryLenLabel.textContent = summaryLength.value;
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) {
    fileName.textContent = "No file chosen";
    return;
  }

  fileName.textContent = file.name;
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) {
    textArea.value = (await file.text()).replace(/^\uFEFF/, "");
    return;
  }

  if (name.endsWith(".zip")) {
    if (typeof JSZip === "undefined") {
      alert("JSZip not loaded. Make sure you have internet access to load the CDN.");
      return;
    }
    const zip = new JSZip();
    const data = await zip.loadAsync(file);

    let combined = "";
    let list = "<strong>Files Extracted:</strong><br>";

    for (const filename of Object.keys(data.files)) {
      const entry = data.files[filename];
      const lower = filename.toLowerCase();

      if (!entry.dir && (lower.endsWith(".txt") || lower.endsWith(".html"))) {
        let content = await entry.async("string");
        combined += "\n" + content.replace(/^\uFEFF/, "");
        list += `• ${filename}<br>`;
      }
    }

    zipFilesList.innerHTML = list;
    textArea.value = combined;
  }
});

/* ---------------- SAMPLE LOADER ---------------- */

document.getElementById("loadSample").addEventListener("click", () => {
  const sample = `12/11/2025, 09:00 - Alice: Hey, can you send the report?
12/11/2025, 09:05 - Bob: I'll finish it by 5pm.
12/11/2025, 09:10 - Alice: Also, we need to book the meeting room.
12/11/2025, 09:12 - Carol: Media omitted
12/11/2025, 09:20 - Bob: Sent the draft.
12/11/2025, 09:30 - Alice: Need to fix the budget numbers. Urgent.
12/11/2025, 10:00 - Dave: I'll handle the slides.`;

  textArea.value = sample;
});

/* ---------------- CHAT CLEANER ---------------- */

function cleanWhatsAppChat(raw) {
  // Support multiple timestamp formats (basic)
  let output = [];

  raw.split("\n").forEach(line => {
    if (!line) return;
    if (line.includes("Media omitted")) return;

    // Standard whatsapp style: dd/mm/yy, hh:mm - Name: message
    const match = line.match(/^\d{1,2}\/\d{1,2}\/\d{2,4},.*? - .*?: (.*)$/);
    if (match) {
      output.push(match[1]);
      return;
    }

    // Some exported logs use: [12/11/2025, 09:00:00] Name: message
    const alt = line.match(/^\[?\d{1,2}\/\d{1,2}\/\d{2,4}.*?\]?\s*.*?:\s*(.*)$/);
    if (alt) {
      output.push(alt[1]);
      return;
    }

    // fallback: treat the line as text if it's not a timestamp line
    output.push(line);
  });

  // join with newlines for action detection, but summarizer uses single string
  return output.join("\n");
}

/* ---------------- LOCAL SUMMARIZATION LOGIC ---------------- */

function tokenizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[0-9]/g, ' ')
    .replace(/[_\W]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function generateSummary(text, sentencesCount = 3) {
  // Split into sentences (simple)
  const sentences = text.match(/[^.!?]+[.!?]|\n+|.+$/g) || [text];

  // Build word frequency (ignore short words)
  const words = tokenizeWords(text);
  const freq = {};
  words.forEach(w => {
    if (w.length < 3) return;
    freq[w] = (freq[w] || 0) + 1;
  });

  // Score sentences
  const sentenceScores = sentences.map(s => {
    let score = 0;
    const sWords = tokenizeWords(s);
    sWords.forEach(w => {
      if (freq[w]) score += freq[w];
    });
    return { sentence: s.trim(), score };
  });

  sentenceScores.sort((a, b) => b.score - a.score);

  // If there are fewer sentences than requested, return what we have
  const chosen = sentenceScores.slice(0, sentencesCount).map(s => s.sentence).filter(Boolean);

  // If summarizer found nothing useful, fallback to first n sentences
  if (chosen.length === 0) {
    return (sentences.slice(0, sentencesCount).map(s => s.trim()));
  }

  return chosen;
}

function extractKeywords(text, max = 8) {
  const words = tokenizeWords(text);
  const freq = {};
  const stopwords = new Set([
    "the","and","for","that","this","with","from","are","was","but","have","not","you","your","they","their","will","can","all","what","when","which","how","who","our","has","had","were","been","would","there","here"
  ]);

  words.forEach(w => {
    if (w.length < 4) return;
    if (stopwords.has(w)) return;
    freq[w] = (freq[w] || 0) + 1;
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(e => e[0]);
}

function extractActionItems(text, max = 8) {
  // Look for lines containing actionable verbs / keywords
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const actions = [];

  const actionRegex = /\b(do|need|fix|send|make|complete|finish|urgent|asap|please|assign|follow up|follow-up|review|call|meet|schedule|book)\b/i;

  for (const line of lines) {
    if (actions.length >= max) break;
    if (actionRegex.test(line)) {
      actions.push(line);
    }
  }

  return actions;
}

/* ---------------- ANALYZE ---------------- */

document.getElementById("analyzeBtn").addEventListener("click", () => {
  let raw = textArea.value.trim();
  if (!raw) return alert("Please upload or paste chat text first.");

  const cleaned = cleanWhatsAppChat(raw) || raw;
  const summaryLen = Number(document.getElementById("summaryLength").value) || 3;

  const summary = generateSummary(cleaned.replace(/\n+/g, " "), summaryLen);
  const keywords = extractKeywords(cleaned);
  const actions = extractActionItems(cleaned);

  renderResult({
    summary,
    keywords,
    action_items: actions
  });
});

/* ---------------- RENDER ---------------- */

function renderResult(data) {
  // Summary
  const summaryHtml = Array.isArray(data.summary)
    ? data.summary.map(s => `<p>${escapeHtml(s)}</p>`).join("")
    : `<p>${escapeHtml(data.summary)}</p>`;

  document.getElementById("summaryOutput").innerHTML = summaryHtml;

  // Keywords
  document.getElementById("keywordsOutput").innerHTML =
    (data.keywords.length > 0)
      ? data.keywords.map(w => `<span class="tag">${escapeHtml(w)}</span>`).join("")
      : `<p class="placeholder-text">No keywords found.</p>`;

  // Action items
  const statsDiv = document.getElementById("statsOutput");
  const statsHeader = statsDiv.parentElement.querySelector("h2");
  if (statsHeader) statsHeader.innerHTML = '<span class="icon">📋</span> Action Items';

  if (data.action_items && data.action_items.length > 0) {
    statsDiv.innerHTML = data.action_items.map(a => `• ${escapeHtml(a)}`).join("<br>");
  } else {
    statsDiv.innerHTML = "No specific action items detected.";
  }

  document.getElementById("downloadBtn").disabled = false;
}

/* ---------------- DOWNLOAD ---------------- */

document.getElementById("downloadBtn").onclick = () => {
  const text = Array.from(document.getElementById("summaryOutput").querySelectorAll("p"))
    .map(p => p.innerText).join("\n\n");

  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "summary.txt";
  a.click();
};

/* ---------------- UTILITIES ---------------- */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
