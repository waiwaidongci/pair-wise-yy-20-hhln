// 存取：本地读写与旧数据迁移。写法规则不懂，交给 Archive。
const Store = (() => {
  const storageKey = "wxyy-4-luogujing-grid";
  const steps = 16;

  function defaultState() {
    return {
      pieceName: "出场锣鼓-慢起",
      bpm: 96,
      loop: "",
      notes: [],
      pattern: Archive.instruments.map((instrument) => Array.from({ length: steps }, (_, index) => index % 4 === 0 ? instrument.token : "")),
      saved: [],
      archive: Archive.emptyArchive()
    };
  }

  function load() {
    let state = null;
    try {
      state = JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch {
      state = null;
    }
    if (!state) return defaultState();
    // 老数据没有写法档案，从正字开始。
    state.archive = Archive.ensureArchive(state.archive);
    state.notes = Array.isArray(state.notes) ? state.notes : [];
    state.saved = Array.isArray(state.saved) ? state.saved : [];
    return state;
  }

  function save(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  return { steps, load, save };
})();
