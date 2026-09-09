const state = {
  levels: [],
  currentLevel: 1,
  histories: {},
  solved: new Set(JSON.parse(localStorage.getItem("gandalfSolved") || "[]")),
};

const el = (id) => document.getElementById(id);

function saveProgress() {
  localStorage.setItem("gandalfSolved", JSON.stringify([...state.solved]));
}

function maxUnlockedLevel() {
  let unlocked = 1;
  for (let i = 1; i <= state.levels.length; i += 1) {
    if (state.solved.has(i)) unlocked = Math.max(unlocked, i + 1);
  }
  return Math.min(unlocked, state.levels.length || 1);
}

function getHistory(level) {
  if (!state.histories[level]) state.histories[level] = [];
  return state.histories[level];
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function renderLevels() {
  const list = el("levelList");
  list.innerHTML = "";
  const maxUnlocked = maxUnlockedLevel();

  state.levels.forEach((level) => {
    const solved = state.solved.has(level.id);
    const locked = level.id > maxUnlocked;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-card ${state.currentLevel === level.id ? "active" : ""} ${solved ? "solved" : ""}`;
    button.disabled = locked;
    button.innerHTML = `
      <span class="level-number">${solved ? "✓" : level.id}</span>
      <span><strong>${escapeHtml(level.title)}</strong><small>${escapeHtml(level.slug)}</small></span>
      ${locked ? '<span class="lock">🔒</span>' : ""}
    `;
    button.addEventListener("click", () => selectLevel(level.id));
    list.appendChild(button);
  });

  el("progressLabel").textContent = `${state.solved.size}/${state.levels.length}`;
}

function renderCurrentLevel() {
  const level = state.levels.find((item) => item.id === state.currentLevel);
  if (!level) return;
  el("levelSlug").textContent = `NIVEAU ${level.id} · ${level.slug}`;
  el("levelTitle").textContent = level.title;
  el("levelDescription").textContent = level.description;
  const solved = state.solved.has(level.id);
  el("levelStatus").textContent = solved ? "Réussi" : "En cours";
  el("levelStatus").className = `status-pill ${solved ? "success" : ""}`;
  el("guessFeedback").textContent = "";
  renderChat();
  renderLevels();
}

function renderChat() {
  const chat = el("chat");
  const history = getHistory(state.currentLevel);
  chat.innerHTML = "";

  if (history.length === 0) {
    chat.innerHTML = `
      <div class="welcome-card">
        <div class="wizard">🧙‍♂️</div>
        <div><strong>Gandalf attend ton prompt.</strong><p>Essaie d'abord une demande simple, puis expérimente les techniques de prompt injection.</p></div>
      </div>`;
    return;
  }

  history.forEach((msg) => {
    const bubble = document.createElement("div");
    bubble.className = `message ${msg.role}`;
    bubble.innerHTML = `<span class="message-role">${msg.role === "user" ? "TOI" : "GANDALF"}</span><div>${escapeHtml(msg.content)}</div>`;
    chat.appendChild(bubble);
  });
  chat.scrollTop = chat.scrollHeight;
}

function selectLevel(levelId) {
  if (levelId > maxUnlockedLevel()) return;
  state.currentLevel = levelId;
  renderCurrentLevel();
  el("promptInput").focus();
}

function errorMessage(detail, fallback) {
  if (typeof detail === "string" && detail) return detail;
  if (detail && typeof detail === "object") {
    const parts = [];
    if (detail.message) parts.push(detail.message);
    if (detail.request_id) parts.push(`request_id=${detail.request_id}`);
    if (detail.rate_limits && Object.keys(detail.rate_limits).length) {
      const headers = Object.entries(detail.rate_limits)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");
      parts.push(headers);
    }
    if (parts.length) return parts.join(" · ");
  }
  return fallback;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(errorMessage(data.detail, `HTTP ${response.status}`));
    error.status = response.status;
    error.details = data.detail;
    throw error;
  }
  return data;
}

async function sendPrompt(event) {
  event.preventDefault();
  const input = el("promptInput");
  const message = input.value.trim();
  if (!message) return;

  const level = state.currentLevel;
  const history = getHistory(level);
  const previousHistory = history.slice(-12).map(({ role, content }) => ({ role, content }));
  history.push({ role: "user", content: message });
  input.value = "";
  renderChat();

  el("sendButton").disabled = true;
  el("sendButton").textContent = "…";
  try {
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ level, message, history: previousHistory }),
    });
    history.push({ role: "assistant", content: data.reply });
  } catch (error) {
    const prefix = error.status ? `Erreur HTTP ${error.status}` : "Erreur";
    history.push({ role: "assistant", content: `${prefix} : ${error.message}` });
  } finally {
    el("sendButton").disabled = false;
    el("sendButton").textContent = "Envoyer";
    renderChat();
    input.focus();
  }
}

async function submitGuess(event) {
  event.preventDefault();
  const guess = el("guessInput").value.trim();
  if (!guess) return;

  try {
    const data = await api("/api/guess", {
      method: "POST",
      body: JSON.stringify({ level: state.currentLevel, guess }),
    });
    el("guessFeedback").textContent = data.message;
    el("guessFeedback").className = `feedback ${data.correct ? "success" : "error"}`;
    if (data.correct) {
      state.solved.add(state.currentLevel);
      saveProgress();
      el("guessInput").value = "";
      renderCurrentLevel();
      const next = Math.min(state.currentLevel + 1, state.levels.length);
      if (next !== state.currentLevel) {
        setTimeout(() => selectLevel(next), 450);
      }
    }
  } catch (error) {
    el("guessFeedback").textContent = error.message;
    el("guessFeedback").className = "feedback error";
  }
}

async function resetGame() {
  try {
    await api("/api/reset", { method: "POST", body: "{}" });
    state.solved.clear();
    state.histories = {};
    state.currentLevel = 1;
    saveProgress();
    renderCurrentLevel();
  } catch (error) {
    alert(`Impossible de réinitialiser : ${error.message}`);
  }
}

async function init() {
  try {
    const [levels, config] = await Promise.all([api("/api/levels"), api("/api/config")]);
    state.levels = levels;
    if (!config.configured) {
      const banner = el("configBanner");
      banner.classList.remove("hidden");
      banner.innerHTML = "⚠️ <strong>Clé Mistral absente.</strong> Copie <code>.env.example</code> vers <code>.env</code>, renseigne <code>MISTRAL_API_KEY</code>, puis redémarre le serveur.";
    }
    renderCurrentLevel();
  } catch (error) {
    el("configBanner").classList.remove("hidden");
    el("configBanner").textContent = `Erreur d'initialisation : ${error.message}`;
  }
}

el("promptForm").addEventListener("submit", sendPrompt);
el("guessForm").addEventListener("submit", submitGuess);
el("resetButton").addEventListener("click", resetGame);

init();
