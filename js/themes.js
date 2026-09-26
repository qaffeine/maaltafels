// Visual worlds. Game logic is identical; only names, emoji and texts differ.
(function (root) {
  'use strict';

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // "de giraf", "het konijn"
  function the(item) {
    return item.article + ' ' + item.name;
  }

  var zoo = {
    id: 'zoo',
    label: 'Zoo',
    icon: '🦁',
    title: 'Maaltafel-zoo',
    mascot: '🐵',
    world: 'zoo',
    worldTitle: 'Jouw zoo',
    backLabel: 'Naar de zoo',
    items: {
      1: { emoji: '🐭', name: 'muis', article: 'de', food: '🧀' },
      2: { emoji: '🐰', name: 'konijn', article: 'het', food: '🥕' },
      3: { emoji: '🐸', name: 'kikker', article: 'de', food: '🪰' },
      4: { emoji: '🐢', name: 'schildpad', article: 'de', food: '🥬' },
      5: { emoji: '🦊', name: 'vos', article: 'de', food: '🫐' },
      6: { emoji: '🐧', name: 'pinguïn', article: 'de', food: '🐟' },
      7: { emoji: '🦒', name: 'giraf', article: 'de', food: '🌿' },
      8: { emoji: '🐙', name: 'octopus', article: 'de', food: '🦐' },
      9: { emoji: '🦁', name: 'leeuw', article: 'de', food: '🍖' },
      10: { emoji: '🐘', name: 'olifant', article: 'de', food: '🍉' }
    },
    badge: function (t, stars) {
      return stars === 3 ? '👑' : stars === 2 ? this.items[t].food : stars === 0 ? '💤' : '';
    },
    welcome: function (name) {
      return 'Welkom in de zoo, ' + name + '! De dieren slapen nog. Speel een spel om ze wakker te maken.';
    },
    tapTip: 'Tik op een dier om zijn tafel te oefenen.',
    helpTip: function (name) { return 'Goed bezig, ' + name + '! Welk dier help je vandaag?'; },
    allDone: 'Wauw, alle dieren hebben een kroon! Je bent een echte maaltafel-kampioen.',
    starMsg: function (t, s) {
      return cap(the(this.items[t])) + ' van tafel ' + t + ' krijgt ster ' + s + '!';
    },
    manyStars: function (n) { return n + ' dieren kregen een nieuwe ster!'; },
    testPassed: function (t) { return '👑 Toets geslaagd! ' + cap(the(this.items[t])) + ' krijgt een kroon.'; }
  };

  var city = {
    id: 'city',
    label: 'Stad',
    icon: '🏗️',
    title: 'Maaltafel-stad',
    mascot: '👷',
    world: 'stad',
    worldTitle: 'Jouw stad',
    backLabel: 'Naar de stad',
    items: {
      1: { emoji: '🏠', name: 'huisje', article: 'het' },
      2: { emoji: '🏪', name: 'winkel', article: 'de' },
      3: { emoji: '🏫', name: 'school', article: 'de' },
      4: { emoji: '🏥', name: 'ziekenhuis', article: 'het' },
      5: { emoji: '🚉', name: 'station', article: 'het' },
      6: { emoji: '🏛️', name: 'museum', article: 'het' },
      7: { emoji: '🏟️', name: 'stadion', article: 'het' },
      8: { emoji: '🎡', name: 'pretpark', article: 'het' },
      9: { emoji: '🏰', name: 'kasteel', article: 'het' },
      10: { emoji: '🗼', name: 'toren', article: 'de' }
    },
    // 0 building site, 1 foundation, 2 walls, 3 finished
    badge: function (t, stars) {
      return ['🚧', '🏗️', '🧱', '🎉'][stars];
    },
    welcome: function (name) {
      return 'Welkom in je stad, ' + name + '! Alles is nog een bouwterrein. Speel een spel om te beginnen bouwen.';
    },
    tapTip: 'Tik op een gebouw om zijn tafel te oefenen.',
    helpTip: function (name) { return 'Goed bezig, ' + name + '! Wat bouwen we vandaag?'; },
    allDone: 'Wauw, je hele stad is af! Je bent een echte maaltafel-bouwmeester.',
    starMsg: function (t, s) {
      var it = this.items[t];
      if (s === 1) return 'De bouw van ' + the(it) + ' van tafel ' + t + ' is begonnen!';
      if (s === 2) return 'De muren van ' + the(it) + ' van tafel ' + t + ' staan!';
      return cap(the(it)) + ' van tafel ' + t + ' is af!';
    },
    manyStars: function (n) { return n + ' gebouwen zijn verder gebouwd!'; },
    testPassed: function (t) { return '🎉 Toets geslaagd! ' + cap(the(this.items[t])) + ' is helemaal af.'; }
  };

  root.Themes = {
    list: [zoo, city],
    get: function (id) { return id === 'city' ? city : zoo; }
  };
})(this);
