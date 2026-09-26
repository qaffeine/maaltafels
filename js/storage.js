// Local persistence. Everything stays in this browser (localStorage).
(function (root) {
  'use strict';

  var KEY = 'maaltafels.v1';
  var memory = null; // fallback when localStorage is unavailable

  function empty() {
    return { profiles: [], currentId: null };
  }

  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* private mode or blocked storage */ }
    return memory || empty();
  }

  function save(data) {
    memory = data;
    try {
      root.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* keep in memory only */ }
  }

  function newProfile(name, avatar) {
    return {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      avatar: avatar,
      settings: { sound: true, mc: true },
      lastSelection: [2],
      stats: {},
      stars: {},
      testPassed: {},
      played: {},
      records: {},
      streak: null,
      daily: {},
      totalCorrect: 0,
      rounds: 0
    };
  }

  root.Store = { load: load, save: save, newProfile: newProfile };
})(this);
