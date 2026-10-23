/* Snuggle Stories: on-device storyteller voice (Piper VITS model via ONNX Runtime Web, WebAssembly, 1 thread).
   Runs in a Web Worker so the page stays smooth. Story text never leaves the device: the worker only reads
   files the grown-up downloaded once (voice model, pronunciation list, runtime) from this device's storage. */
import * as ort from "./ort.wasm.bundle.min.mjs";
import "./g2p.js";
import { readFile } from "./hd-store.mjs";

let session = null, cfg = null, g2p = null, voiceId = null, busy = Promise.resolve();

async function text(url) { return new TextDecoder().decode(await readFile(url)); }

async function init(msg) {
  const t0 = performance.now();
  if (!g2p) {
    const [lex, ctx] = await Promise.all([text(msg.base + "lexicon.txt"), text(msg.base + "context.json")]);
    g2p = new self.SnuggleG2P(lex, JSON.parse(ctx));
  }
  if (session && voiceId === msg.voice) return { ms: 0 };
  if (session) { try { await session.release(); } catch (e) {} session = null; }
  ort.env.wasm.numThreads = 1;                 // no SharedArrayBuffer on GitHub Pages / iOS home-screen apps
  ort.env.wasm.simd = true;
  ort.env.wasm.proxy = false;
  if (!ort.env.wasm.wasmBinary) ort.env.wasm.wasmBinary = await readFile(msg.base + "ort-wasm-simd-threaded.wasm");
  cfg = JSON.parse(await text(msg.base + "voices/" + msg.voice + ".json"));
  let model = await readFile(msg.base + "voices/" + msg.voice + ".onnx");
  session = await ort.InferenceSession.create(new Uint8Array(model), {
    executionProviders: ["wasm"], graphOptimizationLevel: "all",
    enableCpuMemArena: false, enableMemPattern: false, executionMode: "sequential"
  });
  model = null;
  voiceId = msg.voice;
  return { ms: Math.round(performance.now() - t0) };
}

async function synth(msg) {
  if (!session) throw new Error("not-ready");
  const t0 = performance.now();
  const phon = g2p.phonemize(msg.text);
  const ids = g2p.ids(phon, cfg.phoneme_id_map);
  const inf = cfg.inference || {};
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale ?? 0.667, msg.lengthScale || 1, inf.noise_w ?? 0.8]), [3])
  };
  const out = await session.run(feeds);
  const audio = out[session.outputNames[0]].data;
  for (const k in feeds) feeds[k].dispose?.();
  // Peak-normalise like Piper does, with a short fade so sentences never click.
  let peak = 0.01;
  for (let i = 0; i < audio.length; i++) { const a = Math.abs(audio[i]); if (a > peak) peak = a; }
  const gain = 0.9 / peak, pcm = new Float32Array(audio.length), fade = 220;
  for (let i = 0; i < audio.length; i++) {
    const f = i < fade ? i / fade : (audio.length - i < fade ? (audio.length - i) / fade : 1);
    pcm[i] = audio[i] * gain * f;
  }
  out[session.outputNames[0]].dispose?.();
  return { pcm, sampleRate: cfg.audio.sample_rate, phonemes: phon, ms: Math.round(performance.now() - t0) };
}

self.onmessage = (e) => {
  const msg = e.data;
  busy = busy.then(async () => {
    try {
      if (msg.type === "init") self.postMessage({ id: msg.id, ok: true, result: await init(msg) });
      else if (msg.type === "synth") {
        const r = await synth(msg);
        self.postMessage({ id: msg.id, ok: true, result: r }, [r.pcm.buffer]);
      } else if (msg.type === "phonemize") self.postMessage({ id: msg.id, ok: true, result: g2p.phonemize(msg.text) });
    } catch (err) {
      self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) });
    }
  });
};
self.postMessage({ type: "hello" });
