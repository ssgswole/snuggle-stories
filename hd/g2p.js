/* Snuggle Stories: English text → phonemes for the on-device storyteller voice.
   No espeak at runtime: pronunciations come from a word list built ahead of time (lexicon.txt, context.json),
   with a small letter-to-sound fallback for words it has never seen (e.g. unusual names). */
(function (root) {
  "use strict";
  var PUN = /[,.!?;:]/;
  var VOWEL_START = /^[ˈˌ]?[aeiouæɑɒɔəɛɜɪʊʌɐ]/;
  var ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  var TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function numWords(n) {
    n = +n; if (!isFinite(n) || n < 0 || n > 999999) return String(n).split("").map(function (d) { return ONES[+d] || ""; }).join(" ");
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
    if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + numWords(n % 100) : "");
    return numWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? (n % 1000 < 100 ? " and " : " ") + numWords(n % 1000) : "");
  }

  function G2P(lexiconText, context) {
    this.lex = lexiconText;
    var offs = [0];                                   // start of each line, for binary search
    for (var i = 0; i < lexiconText.length; i++) if (lexiconText.charCodeAt(i) === 10 && i + 1 < lexiconText.length) offs.push(i + 1);
    this.offs = offs;
    this.ctx = context.words || {};
    this.pairs = {};
    var self = this; (context.pairs || []).forEach(function (p) { self.pairs[p] = 1; });
  }
  G2P.prototype.lookup = function (w) {
    var lo = 0, hi = this.offs.length - 1, s = this.lex;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1, a = this.offs[mid], tab = s.indexOf("\t", a), key = s.slice(a, tab);
      if (key === w) { var end = s.indexOf("\n", tab); return s.slice(tab + 1, end < 0 ? s.length : end); }
      if (key < w) lo = mid + 1; else hi = mid - 1;
    }
    return null;
  };
  G2P.prototype.tokens = function (text) {
    text = String(text).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/(\d),(\d{3})/g, "$1$2")
      .replace(/\d+/g, function (d) { return " " + numWords(d) + " "; });
    var out = [];
    text.split(/\s+/).forEach(function (t) {
      var core = t.replace(/^['"(\[]+|['")\]]+$/g, "");
      var m = core.match(/^(.*?)([,.!?;:]*)$/), w = m[1].replace(/^['"]+|['"]+$/g, ""), p = m[2];
      if (/[A-Za-z0-9\u00C0-\u024F]/.test(w)) out.push([w.toLowerCase(), p]);
      else if (out.length && p) out[out.length - 1][1] += p;
      else if (out.length && /[—–-]/.test(t)) out[out.length - 1][1] += out[out.length - 1][1] ? "" : ",";
    });
    var merged = [];
    for (var i = 0; i < out.length; i++) {
      if (i + 1 < out.length && !out[i][1] && this.pairs[out[i][0] + " " + out[i + 1][0]]) {
        merged.push([out[i][0] + " " + out[i + 1][0], out[i + 1][1]]); i++;
      } else merged.push(out[i]);
    }
    return merged;
  };
  // Pronunciation of one word. nextVowel: the next word starts with a vowel sound (espeak links e.g. "the" → "ðɪ").
  G2P.prototype.word = function (w, nextVowel) {
    var c = this.ctx[w];
    if (c) return nextVowel && c[1] ? c[1] : c[0];
    var p = this.lookup(w);
    if (p) return p;
    var plain = w.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (plain !== w) return this.word(plain, nextVowel);
    if (w.indexOf("-") > 0) { var self = this; return w.split("-").filter(Boolean).map(function (x) { return self.word(x, false).replace(/^ˈ/, "ˌ"); }).join("").replace(/^ˌ/, "ˈ"); }
    if (/'s$/.test(w)) { var b = this.word(w.slice(0, -2), false); return b + (/[szʃʒ]$|tʃ$|dʒ$/.test(b) ? "ɪz" : /[ptkfθ]$/.test(b) ? "s" : "z"); }
    if (/s$/.test(w) && w.length > 3 && this.lookup(w.slice(0, -1))) { var b2 = this.lookup(w.slice(0, -1)); return b2 + (/[ptkfθ]$/.test(b2) ? "s" : "z"); }
    // Compound of two known words (moonbeam → moon + beam)
    for (var k = 3; k <= w.length - 3; k++) {
      var a = this.lookup(w.slice(0, k)), z = a && this.lookup(w.slice(k));
      if (a && z) return a + z.replace(/ˈ/g, "ˌ");
    }
    return letterToSound(w);
  };
  G2P.prototype.phonemize = function (text) {
    var toks = this.tokens(text), self = this;
    var forms = toks.map(function (t) { return self.word(t[0], false); });
    var parts = toks.map(function (t, i) {
      var nv = !t[1] && i + 1 < toks.length && VOWEL_START.test(forms[i + 1]);
      var f = nv ? self.word(t[0], true) : forms[i];
      var p = t[1].replace(/[^,.!?;:]/g, "");
      if (p.length > 1) p = /\?/.test(p) ? "?" : /!/.test(p) ? "!" : p.charAt(p.length - 1);
      return f + p;
    });
    var s = parts.join(" ");
    if (s && !PUN.test(s.charAt(s.length - 1))) s += ".";
    return s;
  };
  G2P.prototype.ids = function (phonemes, idMap) {
    var ids = [].concat(idMap["^"], idMap["_"]);
    Array.from(phonemes.normalize("NFD")).forEach(function (ch) {
      var v = idMap[ch]; if (!v) return;
      for (var i = 0; i < v.length; i++) ids.push(v[i]);
      ids.push.apply(ids, idMap["_"]);
    });
    ids.push.apply(ids, idMap["$"]);
    return ids;
  };

  /* Letter-to-sound fallback for unseen words (rough, British-style espeak symbols to match the voices). */
  var RULES = [
    ["tch", "tʃ"], ["sch", "sk"], ["igh", "aɪ"], ["eigh", "eɪ"], ["ough", "ɔː"], ["augh", "ɔː"],
    ["ch", "tʃ"], ["sh", "ʃ"], ["th", "θ"], ["ph", "f"], ["wh", "w"], ["ck", "k"], ["ng", "ŋ"], ["qu", "kw"], ["kn", "n"], ["wr", "ɹ"],
    ["ee", "iː"], ["ea", "iː"], ["oo", "uː"], ["ai", "eɪ"], ["ay", "eɪ"], ["ey", "eɪ"], ["oa", "əʊ"], ["ow", "aʊ"], ["ou", "aʊ"],
    ["oi", "ɔɪ"], ["oy", "ɔɪ"], ["au", "ɔː"], ["aw", "ɔː"], ["ie", "iː"], ["ue", "uː"], ["ew", "uː"], ["ar", "ɑː"], ["or", "ɔː"],
    ["er", "ɜː"], ["ir", "ɜː"], ["ur", "ɜː"], ["ll", "l"], ["ss", "s"], ["tt", "t"], ["nn", "n"], ["mm", "m"], ["pp", "p"], ["dd", "d"],
    ["bb", "b"], ["ff", "f"], ["gg", "ɡ"], ["zz", "z"], ["rr", "ɹ"], ["ce", "s"], ["ci", "s"], ["cy", "s"], ["ge", "dʒ"], ["gi", "dʒ"],
    ["a", "a"], ["e", "ɛ"], ["i", "ɪ"], ["o", "ɒ"], ["u", "ʌ"], ["y", "i"], ["b", "b"], ["c", "k"], ["d", "d"], ["f", "f"], ["g", "ɡ"],
    ["h", "h"], ["j", "dʒ"], ["k", "k"], ["l", "l"], ["m", "m"], ["n", "n"], ["p", "p"], ["q", "k"], ["r", "ɹ"], ["s", "s"], ["t", "t"],
    ["v", "v"], ["w", "w"], ["x", "ks"], ["z", "z"]
  ];
  var VOWEL_PH = /^(iː|uː|eɪ|aɪ|əʊ|aʊ|ɔɪ|ɔː|ɑː|ɜː|a|ɛ|ɪ|ɒ|ʌ|i|ə)/;
  function letterToSound(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return "";
    // magic e: name, Jake → long vowel
    var magic = w.match(/^(.*?)([aeiou])([bcdfgklmnprstvz])e$/);
    var out = [], i = 0, stressed = false;
    var src = magic ? magic[1] + magic[2] + magic[3] : w;
    while (i < src.length) {
      var hit = null;
      for (var r = 0; r < RULES.length; r++) if (src.substr(i, RULES[r][0].length) === RULES[r][0]) { hit = RULES[r]; break; }
      var ph = hit ? hit[1] : "";
      if (magic && i === magic[1].length) ph = { a: "eɪ", e: "iː", i: "aɪ", o: "əʊ", u: "uː" }[magic[2]];
      if (src[i] === "y") ph = i === 0 || /[aeiou]/.test(src[i + 1] || "") ? "j" : i === src.length - 1 && src.length > 2 ? "i" : "ɪ";
      if (i === src.length - 1 && src[i] === "a" && src.length > 2) ph = "ə";
      if (!stressed && VOWEL_PH.test(ph)) { ph = "ˈ" + ph; stressed = true; }
      out.push(ph); i += hit ? hit[0].length : 1;
    }
    return out.join("");
  }

  G2P.letterToSound = letterToSound;
  G2P.numWords = numWords;
  if (typeof module !== "undefined" && module.exports) module.exports = G2P;
  root.SnuggleG2P = G2P;
})(typeof self !== "undefined" ? self : this);
