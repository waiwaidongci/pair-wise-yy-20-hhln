// 页面：渲染、交互与播放。写法规则归 Archive（整理），本地读写归 Store（存取）。
const instruments = Archive.instruments;
const steps = Store.steps;
const state = Store.load();

let timer = null;
let playhead = 0;
let audioContext = null;

const grid = document.querySelector("#grid");
const savedList = document.querySelector("#savedList");
const structure = document.querySelector("#structure");
const notesList = document.querySelector("#notesList");
const pieceName = document.querySelector("#pieceName");
const bpmInput = document.querySelector("#bpmInput");
const loopSelect = document.querySelector("#loopSelect");
const noteInput = document.querySelector("#noteInput");
const archivePanel = document.querySelector("#archivePanel");
const archiveMessage = document.querySelector("#archiveMessage");

function save() {
  Store.save(state);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function showArchiveMessage(text) {
  archiveMessage.textContent = text;
}

function syncFields() {
  pieceName.value = state.pieceName;
  bpmInput.value = state.bpm;
  loopSelect.value = state.loop;
}

function beatLabel(index) {
  const measure = Math.floor(index / 4) + 1;
  const beat = (index % 4) + 1;
  return `${measure}-${beat}`;
}

function renderArchive() {
  archivePanel.innerHTML = instruments.map((instrument) => {
    const aliases = state.archive.aliases[instrument.name];
    const current = Archive.currentSpelling(state.archive, instrument.name);
    const options = [instrument.token, ...aliases].map((word) => `
      <option value="${escapeHtml(word)}" ${word === current ? "selected" : ""}>${escapeHtml(word)}${word === instrument.token ? "（正字）" : ""}</option>
    `).join("");
    const chips = aliases.length ? aliases.map((word) => `
      <span class="alias-chip">${escapeHtml(word)}<button type="button" data-remove-alias data-instrument="${escapeHtml(instrument.name)}" data-word="${escapeHtml(word)}" title="移除该写法">×</button></span>
    `).join("") : '<span class="alias-empty">暂无地方写法</span>';
    return `
      <section class="archive-card">
        <h3>${instrument.name}<small>正字 ${instrument.token}</small></h3>
        <label>当前叫法
          <select data-spelling="${escapeHtml(instrument.name)}">${options}</select>
        </label>
        <div class="alias-list">${chips}</div>
        <div class="alias-add">
          <input data-alias-input="${escapeHtml(instrument.name)}" placeholder="地方写法，如：匡">
          <button type="button" data-add-alias="${escapeHtml(instrument.name)}">登记</button>
        </div>
      </section>
    `;
  }).join("");
}

function renderGrid() {
  const header = ['<div class="label-cell">乐器</div>'];
  for (let i = 0; i < steps; i += 1) {
    header.push(`<div class="beat-cell">${beatLabel(i)}</div>`);
  }

  const rows = instruments.flatMap((instrument, rowIndex) => {
    // 谱面内部始终存正字，显示时换算成当前叫法。
    const spoken = Archive.currentSpelling(state.archive, instrument.name);
    const row = [`<div class="label-cell">${instrument.name}</div>`];
    for (let step = 0; step < steps; step += 1) {
      const value = state.pattern[rowIndex][step];
      row.push(`<button class="cell ${value ? "filled" : ""}" type="button" data-row="${rowIndex}" data-step="${step}">${value ? escapeHtml(spoken) : ""}</button>`);
    }
    return row;
  });

  grid.innerHTML = [...header, ...rows].join("");
}

function previewLine(pattern) {
  return instruments.map((instrument, rowIndex) => {
    const row = Array.isArray(pattern?.[rowIndex]) ? pattern[rowIndex] : [];
    return Array.from({ length: 4 }, (_, step) => (row[step] ? Archive.currentSpelling(state.archive, instrument.name) : "·")).join(" ");
  }).join("／");
}

function renderSidebars() {
  const filledByMeasure = [0, 1, 2, 3].map((measure) => {
    const start = measure * 4;
    const count = state.pattern.flatMap((row) => row.slice(start, start + 4)).filter(Boolean).length;
    return { measure: measure + 1, count };
  });
  structure.innerHTML = filledByMeasure.map((item) => `
    <div class="structure-row"><span>第${item.measure}小节</span><strong>${item.count}个口令</strong></div>
  `).join("");

  // 批注里的口令字也按当前叫法显示。
  notesList.innerHTML = state.notes.length ? state.notes.map((note) => `
    <article class="note"><p>${escapeHtml(Archive.renderText(state.archive, note))}</p></article>
  `).join("") : "<p>暂无批注。</p>";

  savedList.innerHTML = state.saved.length ? state.saved.map((item) => `
    <button class="saved-item" type="button" data-load="${item.id}">
      <strong>${escapeHtml(item.name)}</strong><br>
      <span>${item.bpm}BPM · ${item.notes.length}条批注 · ${item.spellings ? "载入恢复当时叫法" : "老方案从正字开始"}</span>
      <span class="saved-preview" title="前四拍口令，按当前叫法显示">${escapeHtml(previewLine(item.pattern))}</span>
    </button>
  `).join("") : "<p>还没有保存方案。</p>";
}

function render() {
  syncFields();
  renderArchive();
  renderGrid();
  renderSidebars();
}

function playSound(instrument) {
  audioContext ||= new AudioContext();
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.frequency.value = instrument.freq;
  osc.type = instrument.name === "鼓" ? "sine" : "square";
  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
  osc.connect(gain).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + 0.09);
}

function highlight(step) {
  document.querySelectorAll(".cell.playing").forEach((cell) => cell.classList.remove("playing"));
  document.querySelectorAll(`[data-step="${step}"]`).forEach((cell) => cell.classList.add("playing"));
}

function currentRange() {
  if (state.loop === "") return [0, steps - 1];
  const start = Number(state.loop) * 4;
  return [start, start + 3];
}

function tick() {
  const [start, end] = currentRange();
  if (playhead < start || playhead > end) playhead = start;
  highlight(playhead);
  // 播放按正字对应的乐器发声，叫法切换不影响声音。
  instruments.forEach((instrument, rowIndex) => {
    if (state.pattern[rowIndex][playhead]) playSound(instrument);
  });
  playhead = playhead >= end ? start : playhead + 1;
}

archivePanel.addEventListener("change", (event) => {
  const select = event.target.closest("[data-spelling]");
  if (!select) return;
  state.archive = Archive.setSpelling(state.archive, select.dataset.spelling, select.value);
  showArchiveMessage(`「${select.dataset.spelling}」现在显示为「${select.value}」，播放仍按正字发声。`);
  save();
  renderGrid();
  renderSidebars();
});

archivePanel.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-alias]");
  if (addButton) {
    const instrumentName = addButton.dataset.addAlias;
    const input = archivePanel.querySelector(`[data-alias-input="${instrumentName}"]`);
    const result = Archive.addAlias(state.archive, instrumentName, input.value);
    if (!result.ok) {
      // 撞车或空词：本次修改作废，指出占用乐器。
      showArchiveMessage(result.reason === "taken"
        ? `「${result.word}」已被「${result.owner.name}」占用（${result.owner.kind}），本次修改作废。`
        : "写法不能为空，本次修改作废。");
      return;
    }
    state.archive = result.archive;
    showArchiveMessage(`已登记：「${result.word}」归「${instrumentName}」。`);
    save();
    renderArchive();
    renderSidebars();
    return;
  }
  const removeButton = event.target.closest("[data-remove-alias]");
  if (removeButton) {
    state.archive = Archive.removeAlias(state.archive, removeButton.dataset.instrument, removeButton.dataset.word);
    showArchiveMessage(`已移除写法「${removeButton.dataset.word}」。`);
    save();
    renderArchive();
    renderGrid();
    renderSidebars();
  }
});

archivePanel.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const input = event.target.closest("[data-alias-input]");
  if (!input) return;
  archivePanel.querySelector(`[data-add-alias="${input.dataset.aliasInput}"]`)?.click();
});

grid.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const row = Number(cell.dataset.row);
  const step = Number(cell.dataset.step);
  // 落子始终写正字，叫法只是显示层。
  state.pattern[row][step] = state.pattern[row][step] ? "" : instruments[row].token;
  save();
  renderGrid();
  renderSidebars();
});

pieceName.addEventListener("input", () => {
  state.pieceName = pieceName.value;
  save();
});

bpmInput.addEventListener("input", () => {
  state.bpm = Number(bpmInput.value || 96);
  save();
  if (timer) {
    clearInterval(timer);
    timer = setInterval(tick, 60000 / state.bpm);
  }
});

loopSelect.addEventListener("change", () => {
  state.loop = loopSelect.value;
  playhead = currentRange()[0];
  save();
});

noteInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !noteInput.value.trim()) return;
  state.notes.unshift(noteInput.value.trim());
  noteInput.value = "";
  save();
  renderSidebars();
});

document.querySelector("#playBtn").addEventListener("click", () => {
  if (timer) clearInterval(timer);
  playhead = currentRange()[0];
  tick();
  timer = setInterval(tick, 60000 / state.bpm);
});

document.querySelector("#stopBtn").addEventListener("click", () => {
  clearInterval(timer);
  timer = null;
  document.querySelectorAll(".cell.playing").forEach((cell) => cell.classList.remove("playing"));
});

document.querySelector("#saveBtn").addEventListener("click", () => {
  state.saved.unshift({
    id: crypto.randomUUID(),
    name: state.pieceName || "未命名片段",
    bpm: state.bpm,
    loop: state.loop,
    notes: [...state.notes],
    pattern: state.pattern.map((row) => [...row]),
    // 记下保存时的叫法，载入时恢复。
    spellings: { ...state.archive.spellings },
    createdAt: new Date().toISOString()
  });
  save();
  renderSidebars();
});

savedList.addEventListener("click", (event) => {
  const id = event.target.closest("[data-load]")?.dataset.load;
  const item = state.saved.find((entry) => entry.id === id);
  if (!item) return;
  state.pieceName = item.name;
  state.bpm = item.bpm;
  state.loop = item.loop;
  state.notes = [...item.notes];
  state.pattern = item.pattern.map((row) => [...row]);
  // 新方案恢复当时叫法；老方案没档案，从正字开始。
  state.archive = Archive.restoreSpellings(state.archive, item.spellings);
  showArchiveMessage(item.spellings ? "已恢复方案保存时的叫法。" : "老方案没有写法档案，从正字开始。");
  save();
  render();
});

render();
