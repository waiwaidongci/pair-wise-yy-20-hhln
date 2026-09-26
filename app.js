"use strict";

// 页面：只管渲染和事件。写法规则找 Notation，读写找 Store。
const instruments = [
  { name: "大锣", token: "仓", freq: 180 },
  { name: "鼓", token: "冬", freq: 120 },
  { name: "钹", token: "才", freq: 360 },
  { name: "小锣", token: "台", freq: 520 }
];
const steps = 16;
const state = Store.load(instruments, steps);

let timer = null;
let playhead = 0;
let audioContext = null;
let notationMessage = "";

const grid = document.querySelector("#grid");
const savedList = document.querySelector("#savedList");
const structure = document.querySelector("#structure");
const notesList = document.querySelector("#notesList");
const notationPanel = document.querySelector("#notationPanel");
const pieceName = document.querySelector("#pieceName");
const bpmInput = document.querySelector("#bpmInput");
const loopSelect = document.querySelector("#loopSelect");
const noteInput = document.querySelector("#noteInput");

function save() {
  Store.save(state);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// 口令字按当前叫法显示，供批注、方案名等自由文本使用。
function shown(text) {
  return escapeHtml(Notation.translateText(instruments, state.notation, text));
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

function renderGrid() {
  const header = ['<div class="label-cell">乐器</div>'];
  for (let i = 0; i < steps; i += 1) {
    header.push(`<div class="beat-cell">${beatLabel(i)}</div>`);
  }

  const rows = instruments.flatMap((instrument, rowIndex) => {
    const current = state.notation.active[rowIndex];
    const row = [
      `<div class="label-cell">${instrument.name}<small>${escapeHtml(current)}</small></div>`
    ];
    for (let step = 0; step < steps; step += 1) {
      const filled = Boolean(state.pattern[rowIndex][step]);
      row.push(
        `<button class="cell ${filled ? "filled" : ""}" type="button" data-row="${rowIndex}" data-step="${step}">${
          filled ? escapeHtml(current) : ""
        }</button>`
      );
    }
    return row;
  });

  grid.innerHTML = [...header, ...rows].join("");
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

  notesList.innerHTML = state.notes.length ? state.notes.map((note) => `
    <article class="note"><p>${shown(note)}</p></article>
  `).join("") : "<p>暂无批注。</p>";

  savedList.innerHTML = state.saved.length ? state.saved.map((item) => `
    <button class="saved-item" type="button" data-load="${item.id}">
      <strong>${shown(item.name)}</strong><br><span>${item.bpm}BPM · ${item.notes.length}条批注</span>
    </button>
  `).join("") : "<p>还没有保存方案。</p>";
}

function renderNotation() {
  const rows = instruments.map((instrument, rowIndex) => {
    const chips = Notation.knownWords(instruments, state.notation, rowIndex).map((word) => {
      const isCanonical = word === instrument.token;
      const isActive = state.notation.active[rowIndex] === word;
      const remove = isCanonical ? "" : `<span class="chip-remove" data-remove-row="${rowIndex}" data-remove-word="${escapeHtml(word)}">×</span>`;
      return `<button class="chip ${isActive ? "active" : ""}" type="button" data-row="${rowIndex}" data-word="${escapeHtml(word)}">${escapeHtml(word)}${isCanonical ? '<em>正字</em>' : ""}${remove}</button>`;
    }).join("");
    return `
      <section class="notation-row">
        <header><strong>${instrument.name}</strong><span>正字「${instrument.token}」</span></header>
        <div class="chips">${chips}</div>
        <form class="alias-form" data-row="${rowIndex}">
          <input name="alias" placeholder="登记地方写法" maxlength="4" autocomplete="off">
          <button type="submit">登记</button>
        </form>
      </section>
    `;
  });

  notationPanel.innerHTML = `${rows.join("")}<p class="notation-msg">${escapeHtml(notationMessage)}</p>`;
}

function render() {
  syncFields();
  renderGrid();
  renderSidebars();
  renderNotation();
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
  instruments.forEach((instrument, rowIndex) => {
    if (state.pattern[rowIndex][playhead]) playSound(instrument);
  });
  playhead = playhead >= end ? start : playhead + 1;
}

grid.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const row = Number(cell.dataset.row);
  const step = Number(cell.dataset.step);
  state.pattern[row][step] = state.pattern[row][step] ? "" : instruments[row].token;
  save();
  render();
});

notationPanel.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-word]");
  if (remove) {
    event.stopPropagation();
    const rowIndex = Number(remove.dataset.removeRow);
    Notation.removeAlias(instruments, state.notation, rowIndex, remove.dataset.removeWord);
    notationMessage = "";
    save();
    render();
    return;
  }
  const chip = event.target.closest(".chip");
  if (!chip) return;
  Notation.setActive(instruments, state.notation, Number(chip.dataset.row), chip.dataset.word);
  notationMessage = "";
  save();
  render();
});

notationPanel.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target.closest(".alias-form");
  if (!form) return;
  const rowIndex = Number(form.dataset.row);
  const word = form.elements.alias.value.trim();
  if (!word) return;
  const result = Notation.addAlias(instruments, state.notation, rowIndex, word);
  if (!result.ok) {
    const owner = instruments[result.owner.index];
    notationMessage = `「${word}」已被${owner.name}的${result.owner.kind}占用，本次修改作废。`;
    renderNotation();
    return;
  }
  notationMessage = "";
  form.reset();
  save();
  render();
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
    writings: [...state.notation.active],
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
  Notation.restoreActive(instruments, state.notation, item.writings);
  notationMessage = "";
  save();
  render();
});

render();
