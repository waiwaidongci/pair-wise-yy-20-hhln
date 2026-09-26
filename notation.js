"use strict";

// 写法档案（整理）：只管正字、地方写法的登记、查重与叫法切换。
// 不读页面、不碰 localStorage，状态都装在 profile 里传来传去。
const Notation = (() => {
  function createProfile(instruments) {
    return {
      aliases: instruments.map(() => []),
      active: instruments.map((instrument) => instrument.token)
    };
  }

  // 老数据没有档案时从正字补一份；别名表缺行、带空串也一并修齐。
  function normalizeProfile(instruments, profile) {
    if (!profile || typeof profile !== "object") return createProfile(instruments);
    return {
      aliases: instruments.map((_, index) => {
        const list = Array.isArray(profile.aliases?.[index]) ? profile.aliases[index] : [];
        return [...new Set(list.map((word) => String(word).trim()).filter(Boolean))];
      }),
      active: instruments.map((instrument, index) => {
        const word = profile.active?.[index];
        return typeof word === "string" && word.trim() ? word.trim() : instrument.token;
      })
    };
  }

  // 一个词在全档案里的归属：某件乐器的正字，或某件乐器的地方写法。
  function findOwner(instruments, profile, word) {
    const canonicalIndex = instruments.findIndex((instrument) => instrument.token === word);
    if (canonicalIndex !== -1) return { index: canonicalIndex, kind: "正字" };
    const aliasIndex = profile.aliases.findIndex((list) => list.includes(word));
    if (aliasIndex !== -1) return { index: aliasIndex, kind: "地方写法" };
    return null;
  }

  // 登记地方写法。同一个词只归一件乐器，撞车则本次作废并返回占用者。
  function addAlias(instruments, profile, rowIndex, word) {
    const owner = findOwner(instruments, profile, word);
    if (owner) return { ok: false, owner };
    profile.aliases[rowIndex].push(word);
    return { ok: true };
  }

  function removeAlias(instruments, profile, rowIndex, word) {
    const list = profile.aliases[rowIndex];
    const at = list.indexOf(word);
    if (at === -1) return false;
    list.splice(at, 1);
    if (profile.active[rowIndex] === word) profile.active[rowIndex] = instruments[rowIndex].token;
    return true;
  }

  function knownWords(instruments, profile, rowIndex) {
    return [instruments[rowIndex].token, ...profile.aliases[rowIndex]];
  }

  function setActive(instruments, profile, rowIndex, word) {
    if (!knownWords(instruments, profile, rowIndex).includes(word)) return false;
    profile.active[rowIndex] = word;
    return true;
  }

  // 载入方案时恢复叫法：方案存了当时叫法就用它的，没存（老方案）就从正字开始。
  function restoreActive(instruments, profile, writings) {
    profile.active = instruments.map((instrument, index) => {
      const word = Array.isArray(writings) ? writings[index] : null;
      return typeof word === "string" && word.trim() ? word.trim() : instrument.token;
    });
  }

  function escapeRegExp(word) {
    return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // 批注、方案名里的口令字一律按当前叫法显示；播放不经过这里，仍按正字发声。
  function translateText(instruments, profile, text) {
    const map = new Map();
    instruments.forEach((instrument, index) => {
      knownWords(instruments, profile, index).forEach((word) => {
        if (word !== profile.active[index]) map.set(word, profile.active[index]);
      });
    });
    if (!map.size) return text;
    const pattern = [...map.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
    return String(text).replace(new RegExp(pattern, "g"), (word) => map.get(word));
  }

  return {
    createProfile,
    normalizeProfile,
    findOwner,
    addAlias,
    removeAlias,
    knownWords,
    setActive,
    restoreActive,
    translateText
  };
})();
