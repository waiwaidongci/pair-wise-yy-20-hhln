"use strict";

// 存取：只负责 localStorage 的读写和老数据补齐，不管整理规则、也不管页面。
const Store = (() => {
  const storageKey = "wxyy-4-luogujing-grid";

  function defaultState(instruments, steps) {
    return {
      pieceName: "出场锣鼓-慢起",
      bpm: 96,
      loop: "",
      notes: [],
      pattern: instruments.map((instrument) =>
        Array.from({ length: steps }, (_, index) => (index % 4 === 0 ? instrument.token : ""))
      ),
      saved: [],
      notation: Notation.createProfile(instruments)
    };
  }

  function load(instruments, steps) {
    let raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch {
      raw = null;
    }
    const state =
      raw && typeof raw === "object" ? { ...defaultState(instruments, steps), ...raw } : defaultState(instruments, steps);
    state.notation = Notation.normalizeProfile(instruments, state.notation);
    return state;
  }

  function save(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  return { load, save };
})();
