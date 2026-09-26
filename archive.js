// 整理：锣鼓口令写法档案。每件乐器一个正字，可登记多个地方写法；
// 同一个词全档只归一件乐器。这里只管规则，不碰页面和本地存取。
const Archive = (() => {
  const instruments = [
    { name: "大锣", token: "仓", freq: 180 },
    { name: "鼓", token: "冬", freq: 120 },
    { name: "钹", token: "才", freq: 360 },
    { name: "小锣", token: "台", freq: 520 }
  ];

  function emptyArchive() {
    return {
      aliases: Object.fromEntries(instruments.map((instrument) => [instrument.name, []])),
      spellings: Object.fromEntries(instruments.map((instrument) => [instrument.name, instrument.token]))
    };
  }

  function hasInstrument(archive, instrumentName) {
    return Array.isArray(archive.aliases[instrumentName]);
  }

  // 同一个词只归一件乐器：先查各件乐器的正字，再查已登记的地方写法。
  function findOwner(archive, word) {
    const byToken = instruments.find((instrument) => instrument.token === word);
    if (byToken) return { name: byToken.name, kind: "正字" };
    const byAlias = instruments.find((instrument) => (archive.aliases[instrument.name] || []).includes(word));
    return byAlias ? { name: byAlias.name, kind: "写法" } : null;
  }

  function ownsWord(archive, instrumentName, word) {
    const owner = findOwner(archive, word);
    return Boolean(owner) && owner.name === instrumentName;
  }

  // 登记地方写法。撞车时原样退回旧档案并指出占用乐器，由页面宣布本次修改作废。
  function addAlias(archive, instrumentName, rawWord) {
    const word = String(rawWord || "").trim();
    if (!word) return { ok: false, reason: "empty" };
    if (!hasInstrument(archive, instrumentName)) return { ok: false, reason: "unknown" };
    const owner = findOwner(archive, word);
    if (owner) return { ok: false, reason: "taken", word, owner };
    const aliases = { ...archive.aliases, [instrumentName]: [...archive.aliases[instrumentName], word] };
    return { ok: true, word, archive: { ...archive, aliases } };
  }

  // 移除写法；若它正是当前叫法，落回正字。
  function removeAlias(archive, instrumentName, word) {
    if (!hasInstrument(archive, instrumentName)) return archive;
    const aliases = {
      ...archive.aliases,
      [instrumentName]: archive.aliases[instrumentName].filter((item) => item !== word)
    };
    const spellings = { ...archive.spellings };
    if (spellings[instrumentName] === word) {
      spellings[instrumentName] = instruments.find((instrument) => instrument.name === instrumentName).token;
    }
    return { ...archive, aliases, spellings };
  }

  // 切换当前叫法，只接受正字或已登记的写法。
  function setSpelling(archive, instrumentName, word) {
    if (!ownsWord(archive, instrumentName, word)) return archive;
    return { ...archive, spellings: { ...archive.spellings, [instrumentName]: word } };
  }

  function currentSpelling(archive, instrumentName) {
    return archive.spellings[instrumentName]
      || instruments.find((instrument) => instrument.name === instrumentName)?.token
      || "";
  }

  // 载入方案时恢复叫法：方案没存档案就从正字开始；存了的词如今不在档案里也落回正字。
  function restoreSpellings(archive, snapshot) {
    const spellings = Object.fromEntries(instruments.map((instrument) => {
      const word = snapshot?.[instrument.name];
      return [instrument.name, word && ownsWord(archive, instrument.name, word) ? word : instrument.token];
    }));
    return { ...archive, spellings };
  }

  // 旧数据没有档案时从正字补齐；已有的词逐个过查重，保证全档仍然一词一主。
  function ensureArchive(archive) {
    const fresh = emptyArchive();
    if (!archive) return fresh;
    instruments.forEach((instrument) => {
      const list = Array.isArray(archive.aliases?.[instrument.name]) ? archive.aliases[instrument.name] : [];
      list.forEach((raw) => {
        const word = String(raw || "").trim();
        if (word && !findOwner(fresh, word)) fresh.aliases[instrument.name].push(word);
      });
    });
    instruments.forEach((instrument) => {
      const word = archive.spellings?.[instrument.name];
      if (word && ownsWord(fresh, instrument.name, word)) fresh.spellings[instrument.name] = word;
    });
    return fresh;
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // 把文本里任何已知写法（正字或地方写法）换算成当前叫法，谱面、批注、已存方案共用。
  function renderText(archive, text) {
    const map = new Map();
    instruments.forEach((instrument) => {
      const current = currentSpelling(archive, instrument.name);
      map.set(instrument.token, current);
      (archive.aliases[instrument.name] || []).forEach((alias) => map.set(alias, current));
    });
    const words = [...map.keys()].filter((word) => map.get(word) !== word).sort((a, b) => b.length - a.length);
    if (!words.length) return String(text);
    return String(text).replace(new RegExp(words.map(escapeRegExp).join("|"), "g"), (hit) => map.get(hit));
  }

  return {
    instruments,
    emptyArchive,
    ensureArchive,
    findOwner,
    addAlias,
    removeAlias,
    setSpelling,
    currentSpelling,
    restoreSpellings,
    renderText
  };
})();
