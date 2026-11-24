/**
 * Sound for /portfolio (the room story): a real mechanical-keyboard typing loop that is
 * audible only while the hero's hands are on the keys, over quiet background
 * music that dips a little while he types and fades away as the story leaves
 * the room, and a riser that the scroll steers into the dive through the clock.
 *
 * Browsers only allow audio after a user gesture (a click, tap or key press;
 * scrolling does not count), so the context is created on the first one, as
 * on lusion.co. The viewer's on/off choice is remembered per browser.
 */
const TYPING_URL = '/audio/portfolio-room/typing.m4a';
const MUSIC_URL = '/audio/portfolio-room/music.m4a';
const RISER_URL = '/audio/portfolio-room/riser.m4a';
// The dive's whoosh (kept as "riser"): on. With it off, setRiser() does
// nothing.
const RISER_ON = true;
const TICK_URL = '/audio/portfolio-room/tick.wav';
// The wall clock's tick: a travel alarm clock's woody tock (mab, Freesound),
// a semitone down for a bigger clock, with a touch of weight and a room.
const TICK_RATE = 0.94,
  TICK_GAIN = 0.42,
  SPIN_GAP = 0.075; // s between rewinding ticks at the most (~13 a second)
const PAGE_URL = '/audio/portfolio-room/page.wav';
// The year counter's page turn: a thin page (Flem0527, Freesound), lifting
// for PAGE_PEAK s before it flaps over.
const PAGE_GAIN = 0.3,
  PAGE_PEAK = 0.2;
const PREF_KEY = 'portfolio-room-sound';
// The dive's whoosh: the last 1.4 s of a riser, one swell from silence to
// its cut (build_riser.py), the camera sucked into the dial with it. It
// starts as the scroll enters the dive and is timed to cut as the dial
// fills the screen.
const RISE_FROM = 0.66, // rewind progress where it starts
  RISE_TO = 0.87, // ... and where it should cut (dial filling the screen)
  // Into chapter 2 the same whoosh comes last, after the year's page turns:
  // from the card, cut as the mail ends and the meeting room appears.
  MAIL_RISE_FROM = 0.84,
  MAIL_RISE_TO = 1,
  RISE_START = 0, // s into the buffer to start from
  RISE_PEAK = 1.38, // s into the buffer of the cut
  RISER_GAIN = 0.2;
// The music is mastered loud and the typing is sparse clicks, so the music
// sits well under it: lower while typing, a little up otherwise.
const MUSIC_TYPING = 0.07,
  MUSIC_IDLE = 0.12;
// Chapter 1's song (ZephiraMusic's "Lofi Pop"), mastered about 5 dB quieter
// than the room's: bright and light, it comes up with the chapter's card.
const SCHOOL_MUSIC_URL = '/audio/portfolio-room/school-music.m4a',
  SCHOOL_MUSIC = 0.17;
// Chapter 2's song ("Lofi Focus" by ZephiraMusic, Pixabay; about as loud
// as chapter 1's): it comes up with the chapter's card from its start; held
// muffled and a little lower while he thinks it over (a held breath),
// opening as he writes. (2026-10-13: it replaced leberch's "Interstellar",
// and with it the crossfade to that track's big hit as he finished.)
const OFFICE_MUSIC_URL = '/audio/portfolio-room/office-music.m4a',
  OFFICE_MUSIC = 0.17;
// Chapter 4's song ("Lofi Study Session" by Alex Morgan, Pixabay; the
// user's pick, 2026-11-22): it comes up as the flight comes out of the white
// over BYU and plays on over the valley and through Bridge's office.
// Mastered 4.4 dB louder than chapter 2's (RMS -12.8 dB against -17.2), so
// it is set that much lower to sit as loud.
const BRIDGE_MUSIC_URL = '/audio/portfolio-room/bridge-music.m4a',
  BRIDGE_MUSIC = 0.1;
// The ending's ("Christmas Jazz" by AtlasAudio, Pixabay; the user's pick,
// 2026-11-22): it comes up as the white lifts off his room at Christmas.
// RMS -14.4 dB, so a little lower than chapter 2's too.
const END_MUSIC_URL = '/audio/portfolio-room/end-music.m4a',
  END_MUSIC = 0.124;

/** A song of its own: its player, its level, whether it is wanted. */
type Song = {
  song: HTMLAudioElement;
  out: GainNode;
  in: number;
  level: number;
  silentSince: number;
};

export function soundPreferred() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

function rememberSound(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked (private mode): the choice lasts for this visit only.
  }
}

/** A small, soft room for the clock: 0.35 s of decaying stereo noise. */
function smallRoom(ctx: AudioContext) {
  const n = Math.round(ctx.sampleRate * 0.35),
    ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += (Math.random() * 2 - 1 - lp) * 0.35; // darker than white noise
      d[i] = lp * Math.exp(-i / (ctx.sampleRate * 0.07));
    }
  }
  return ir;
}

export class RoomAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private typing: GainNode | null = null;
  private music: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private muffle: BiquadFilterNode | null = null;
  private lastMuffle = -1;
  private source: AudioBufferSourceNode | null = null;
  private riserBuffer: AudioBuffer | null = null;
  // One whoosh per transition (the rewind, the mail): the one playing, armed
  // (re-armed once scrolled back above it), the transition's progress per
  // second (smoothed), and when and where it last was.
  private whooshes = {
    rewind: this.whooshState(),
    mail: this.whooshState(),
  };
  // Page turns outside the clock's path (into chapter 2): dry plus the
  // clock's small room, not through its dive low-pass.
  private pages: GainNode | null = null;
  // The wall clock: its own path (not through the muffle, so it stays clear
  // while the music goes under), with its own low-pass for the dive.
  private clock: GainNode | null = null;
  private clockTone: BiquadFilterNode | null = null;
  private tickBuffer: AudioBuffer | null = null;
  private nextSecond = 0; // the second (epoch ms) already scheduled
  private lastMark: number | null = null; // hour mark the hour hand last passed
  private nextSpinTick = 0; // context time before which no rewinding tick plays
  private markRate = 0; // hour marks the hands pass per second (smoothed)
  private lastFrame = 0; // context time of the last setClock call
  private duck: GainNode | null = null; // the ticks, dipped under a page turn
  private pageBuffer: AudioBuffer | null = null;
  private lastPage = 0; // context time of the last page turn
  private lastClock = -1;
  // Streamed rather than decoded: a three-minute song would take ~65 MB.
  private song: HTMLAudioElement | null = null;
  private typingLevel = 0;
  private lastTyping = -1;
  private lastMusic = -1;
  private musicOut = 0; // 0..1: the room's song fading away (the rewind)
  private schoolSong: HTMLAudioElement | null = null;
  private schoolMusic: GainNode | null = null;
  private schoolIn = 0; // 0..1: chapter 1's song coming up
  private lastSchool = -1;
  private schoolSilentSince = 0;
  // Chapter 2's song: its player, its tension low-pass and level.
  private office: {
    song: HTMLAudioElement;
    tone: BiquadFilterNode;
    out: GainNode;
    in: number;
    open: number;
    level: number;
    silentSince: number;
  } | null = null;
  // Chapter 4's song, and the ending's.
  private bridge: Song | null = null;
  private end: Song | null = null;
  private silentSince = 0;
  private disposed = false;
  enabled = soundPreferred();
  /** Called when playing starts or stops, for the toggle button. */
  onChange: ((playing: boolean) => void) | null = null;

  get playing() {
    return !!this.ctx && this.enabled && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture handler. */
  start() {
    if (this.disposed || !this.enabled) return;
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      // A low-pass on everything: open normally, closing down to a muffled,
      // underwater sound while the story rewinds to the next chapter.
      this.muffle = ctx.createBiquadFilter();
      this.muffle.type = 'lowpass';
      this.muffle.frequency.value = 20000;
      this.muffle.Q.value = 0.9;
      this.master.connect(this.muffle);
      this.muffle.connect(ctx.destination);
      // What the viewer hears, analysed for the speaker's spectrum display.
      // The mix is quiet, so the range sits low.
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.55;
      this.analyser.minDecibels = -92;
      this.analyser.maxDecibels = -22;
      this.muffle.connect(this.analyser);
      this.typing = ctx.createGain();
      this.typing.gain.value = 0;
      this.typing.connect(this.master);
      this.music = ctx.createGain();
      this.music.gain.value = 0;
      this.music.connect(this.master);
      const song = new Audio(MUSIC_URL);
      song.loop = true;
      ctx.createMediaElementSource(song).connect(this.music);
      this.song = song;
      this.schoolMusic = ctx.createGain();
      this.schoolMusic.gain.value = 0;
      this.schoolMusic.connect(this.master);
      const school = new Audio(SCHOOL_MUSIC_URL);
      school.loop = true;
      ctx.createMediaElementSource(school).connect(this.schoolMusic);
      this.schoolSong = school;
      const tone = ctx.createBiquadFilter(),
        out = ctx.createGain();
      tone.type = 'lowpass';
      tone.frequency.value = 20000;
      tone.Q.value = 0.7;
      out.gain.value = 0;
      tone.connect(out).connect(this.master);
      const officeSong = new Audio(OFFICE_MUSIC_URL);
      officeSong.loop = true;
      officeSong.preload = 'auto';
      ctx.createMediaElementSource(officeSong).connect(tone);
      this.office = {
        song: officeSong,
        tone,
        out,
        in: 0,
        open: 1,
        level: -1,
        silentSince: 0,
      };
      const own = (url: string): Song => {
        const out = ctx.createGain();
        out.gain.value = 0;
        out.connect(this.master!);
        const song = new Audio(url);
        song.loop = true;
        song.preload = 'auto';
        ctx.createMediaElementSource(song).connect(out);
        return { song, out, in: 0, level: -1, silentSince: 0 };
      };
      this.bridge = own(BRIDGE_MUSIC_URL);
      this.end = own(END_MUSIC_URL);
      // The clock: tick → a touch of weight around 700 Hz → low-pass (closes
      // in the dive) → dry, plus a small room.
      this.clock = ctx.createGain();
      this.clock.gain.value = 0;
      const body = ctx.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 700;
      body.Q.value = 0.8;
      body.gain.value = 2;
      this.clockTone = ctx.createBiquadFilter();
      this.clockTone.type = 'lowpass';
      this.clockTone.frequency.value = 18000;
      this.clockTone.Q.value = 0.7;
      const room = ctx.createConvolver(),
        wet = ctx.createGain();
      room.buffer = smallRoom(ctx);
      wet.gain.value = 0.22;
      this.duck = ctx.createGain();
      this.clock.connect(this.duck).connect(body).connect(this.clockTone);
      this.clockTone.connect(ctx.destination);
      this.clockTone.connect(room).connect(wet).connect(ctx.destination);
      this.pages = ctx.createGain();
      this.pages.connect(ctx.destination);
      this.pages.connect(room);
      ctx.onstatechange = () => this.onChange?.(this.playing);
      void this.load(ctx);
    }
    void this.ctx.resume();
    // Play inside the gesture (Safari), then fade the music in slowly.
    if (this.musicOut < 1) this.song?.play().catch(() => undefined);
    // Chapter 1's song is unlocked in the gesture too (silent until wanted).
    const school = this.schoolSong;
    if (school && school.paused)
      school
        .play()
        .then(() => {
          if (this.schoolIn <= 0) school.pause();
        })
        .catch(() => undefined);
    // And chapter 2's.
    const office = this.office;
    if (office && office.song.paused)
      office.song
        .play()
        .then(() => {
          if (office.in <= 0) office.song.pause();
        })
        .catch(() => undefined);
    // And chapter 4's, and the ending's.
    for (const own of [this.bridge, this.end])
      if (own && own.song.paused)
        own.song
          .play()
          .then(() => {
            if (own.in <= 0) own.song.pause();
          })
          .catch(() => undefined);
    this.lastMusic = this.musicLevel();
    this.music?.gain.setTargetAtTime(this.lastMusic, this.ctx.currentTime, 1.2);
  }

  private async load(ctx: AudioContext) {
    try {
      const data = await (await fetch(TYPING_URL)).arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);
      if (this.disposed || !this.typing) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.typing);
      src.start();
      this.source = src;
    } catch {
      // No typing sound is fine; the page works without it.
    }
    try {
      const data = await (await fetch(TICK_URL)).arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);
      if (!this.disposed) this.tickBuffer = buffer;
    } catch {
      // The clock is silent then.
    }
    try {
      const data = await (await fetch(PAGE_URL)).arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);
      if (!this.disposed) this.pageBuffer = buffer;
    } catch {
      // The years turn over silently then.
    }
    if (RISER_ON)
      try {
        const data = await (await fetch(RISER_URL)).arrayBuffer();
        const buffer = await ctx.decodeAudioData(data);
        if (!this.disposed) this.riserBuffer = buffer;
      } catch {
        // The rewind simply plays without its riser.
      }
  }

  private whooshState() {
    return {
      v: null as { src: AudioBufferSourceNode; gain: GainNode } | null,
      armed: true,
      speed: 0,
      at: 0,
      last: 0,
    };
  }

  /**
   * Per frame with the rewind's progress (0..1): the dive's whoosh. When the
   * scroll enters the dive (RISE_FROM) going forward, it plays once, at one
   * steady rate chosen from how fast the scroll is moving, so its cut lands
   * about when the dial fills the screen (RISE_TO). Steady on purpose: steering
   * its rate and level to the scroll every frame made a short sound surge
   * twice under a stepped mouse wheel. Scrolled back out of the dive, it fades
   * away; back above it, it re-arms. It skips the muffle, so it stays clear.
   */
  setRiser(r: number) {
    this.whoosh(this.whooshes.rewind, r, RISE_FROM, RISE_TO);
  }

  /** The same whoosh into chapter 2, as the camera closes in on the mail. */
  setMailRiser(m: number) {
    this.whoosh(this.whooshes.mail, m, MAIL_RISE_FROM, MAIL_RISE_TO);
  }

  private whoosh(
    w: ReturnType<RoomAudio['whooshState']>,
    r: number,
    from: number,
    to: number
  ) {
    const ctx = this.ctx,
      buffer = this.riserBuffer;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime,
      dt = now - w.at;
    if (dt > 0 && dt < 0.25)
      w.speed += ((r - w.last) / dt - w.speed) * Math.min(1, dt * 8);
    w.last = r;
    w.at = now;
    if (r < from - 0.03) {
      w.armed = true;
      if (w.v) this.stopWhoosh(w);
      return;
    }
    if (!buffer || !w.armed || r >= to) return;
    if (r < from || w.speed <= 0.01) return;
    w.armed = false;
    // Time left until the cut at this pace; the whoosh is played to fit it,
    // within a natural range of speeds.
    const left = (to - r) / w.speed,
      rate = Math.min(1.5, Math.max(0.75, (RISE_PEAK - RISE_START) / left)),
      src = ctx.createBufferSource(),
      gain = ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    gain.gain.value = RISER_GAIN;
    src.connect(gain).connect(ctx.destination);
    src.start(now, RISE_START);
    const v = { src, gain };
    src.onended = () => {
      if (w.v === v) w.v = null;
      gain.disconnect();
    };
    w.v = v;
  }

  /** After a jump (the chapter rail): no whoosh for the ground skipped. Each
   *  re-arms once the scroll is back before its window, as usual. */
  jumped() {
    for (const w of Object.values(this.whooshes)) {
      this.stopWhoosh(w);
      w.armed = false;
      w.speed = 0;
      w.at = 0;
    }
  }

  private stopWhoosh(w: ReturnType<RoomAudio['whooshState']>) {
    const v = w.v;
    if (!v || !this.ctx) return;
    const now = this.ctx.currentTime;
    v.gain.gain.setTargetAtTime(0, now, 0.06);
    try {
      v.src.stop(now + 0.4);
    } catch {
      // Already stopped.
    }
    w.v = null;
  }

  /**
   * Fills `out` (fftSize / 2 bins, 0..255) with the current spectrum and
   * returns the width of one bin in Hz, or 0 while silent.
   */
  spectrum(out: Uint8Array<ArrayBuffer>) {
    if (!this.analyser || !this.ctx || !this.playing) return 0;
    this.analyser.getByteFrequencyData(out);
    return this.ctx.sampleRate / this.analyser.fftSize;
  }

  private playTick(
    buffer: AudioBuffer,
    at: number,
    gain: number,
    rate: number
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.clock) return;
    const src = ctx.createBufferSource(),
      g = ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    g.gain.value = gain;
    src.connect(g).connect(this.clock);
    src.start(at);
    src.onended = () => g.disconnect();
  }

  /**
   * Per frame in the rewind: the wall clock, heard as he turns to it.
   * `level` 0..1 (look, out at the flash), `dive` 0..1 (the camera going into
   * the dial: the ticks go dull and far), `spin` 0..1 (the hands running back,
   * as in Clock.tsx).
   * - At rest it ticks once a second, scheduled to the second hand's step
   *   (each whole second of the real time, as the hand shows it).
   * - While the hands run back, it ticks each time the hour hand passes an
   *   hour (72 of them), so it speeds up and slows down with the hands. Never
   *   more than about 13 a second, loosely spaced, and softer the faster:
   *   an even stream of 40 a second fused into a harsh buzz (and a reversed
   *   tick, cut off sharp, made it rasp).
   */
  setClock(level: number, dive: number, spin: number) {
    const ctx = this.ctx;
    if (!ctx || !this.clock || !this.clockTone || ctx.state !== 'running')
      return;
    const now = ctx.currentTime,
      dt = Math.min(0.1, Math.max(0.008, now - this.lastFrame));
    this.lastFrame = now;
    if (Math.abs(level - this.lastClock) > 0.002) {
      this.lastClock = level;
      this.clock.gain.setTargetAtTime(level * TICK_GAIN, now, 0.12);
      this.clockTone.frequency.setTargetAtTime(
        18000 * (500 / 18000) ** dive,
        now,
        0.08
      );
    }
    if (level < 0.002 || !this.tickBuffer) {
      this.lastMark = null;
      return;
    }
    const ms = Date.now();
    if (spin <= 0 || spin >= 1) {
      this.lastMark = null;
      // The next second hand step, if it falls within the next 120 ms.
      const next = Math.ceil(ms / 1000) * 1000;
      if (next !== this.nextSecond && next - ms < 120) {
        this.nextSecond = next;
        this.playTick(this.tickBuffer, now + (next - ms) / 1000, 1, TICK_RATE);
      }
      return;
    }
    const d = new Date(ms),
      hours =
        d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 - 72 * spin,
      mark = Math.floor(hours);
    if (this.lastMark === null) this.lastMark = mark;
    const passed = Math.abs(mark - this.lastMark);
    this.lastMark = mark;
    this.markRate += (passed / dt - this.markRate) * Math.min(1, dt * 6);
    const at = now + 0.01;
    // Marks passed faster than the clock can tick are let go.
    if (!passed || at < this.nextSpinTick) return;
    const fast = Math.min(1, this.markRate / 30);
    this.nextSpinTick = at + SPIN_GAP * (0.8 + 0.4 * Math.random());
    this.playTick(
      this.tickBuffer,
      at,
      1 - 0.55 * fast,
      TICK_RATE * (1 + 0.05 * fast)
    );
  }

  /**
   * A year turns over on the counter (called as its digits start to move):
   * a page turn whose flap lands as they settle, through the clock's path
   * (its dive low-pass and room), the ticks dipping under it for a moment.
   * The last year, 2019, turns a little lower and heavier: arrived. At most
   * one every 0.12 s on a fast scroll.
   */
  flipPage(last: boolean, level?: number, leaf = false) {
    const ctx = this.ctx,
      // Into chapter 2 there is no clock: its own level, its own path.
      own = level !== undefined,
      lvl = own ? level : this.lastClock;
    if (
      !ctx ||
      ctx.state !== 'running' ||
      !this.pageBuffer ||
      !this.clockTone ||
      !this.duck ||
      !this.pages ||
      lvl < 0.05
    )
      return;
    const now = ctx.currentTime;
    // A leaf (a light page riffled between the years) may follow closer.
    if (now - this.lastPage < (leaf ? 0.06 : 0.12)) return;
    this.lastPage = now;
    const src = ctx.createBufferSource(),
      g = ctx.createGain();
    src.buffer = this.pageBuffer;
    src.playbackRate.value = last
      ? 0.86
      : leaf
        ? 1.08 + Math.random() * 0.12
        : 0.96 + Math.random() * 0.08;
    g.gain.value = PAGE_GAIN * lvl * (last ? 1.3 : leaf ? 0.55 : 1);
    src.connect(g).connect(own ? this.pages : this.clockTone);
    src.start(now);
    src.onended = () => g.disconnect();
    if (own) return;
    const flap = now + PAGE_PEAK / src.playbackRate.value;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setTargetAtTime(0.5, flap - 0.06, 0.02);
    this.duck.gain.setTargetAtTime(1, flap + 0.14, 0.06);
  }

  /** 0..1: how muffled the sound is (the rewind between chapters). */
  setMuffle(amount: number) {
    if (!this.ctx || !this.muffle || !this.master) return;
    if (Math.abs(amount - this.lastMuffle) < 0.004) return;
    this.lastMuffle = amount;
    const t = this.ctx.currentTime;
    this.muffle.frequency.setTargetAtTime(
      20000 * (380 / 20000) ** amount,
      t,
      0.06
    );
    this.master.gain.setTargetAtTime(1 - 0.25 * amount, t, 0.1);
  }

  private musicLevel() {
    return (
      (MUSIC_IDLE + (MUSIC_TYPING - MUSIC_IDLE) * this.typingLevel) *
      (1 - this.musicOut)
    );
  }

  /**
   * 0..1: fades the room's song away as the story leaves the room. Once it
   * has been silent for a moment the song pauses; scrolling back brings it
   * in again.
   */
  setMusicOut(amount: number) {
    if (!this.ctx || !this.music || !this.song) return;
    const now = this.ctx.currentTime;
    if (amount !== this.musicOut) {
      this.musicOut = amount;
      const level = this.musicLevel();
      if (Math.abs(level - this.lastMusic) > 0.001) {
        this.lastMusic = level;
        this.music.gain.setTargetAtTime(level, now, 0.15);
      }
    }
    if (amount < 1) {
      this.silentSince = now;
      if (this.song.paused && this.playing)
        this.song.play().catch(() => undefined);
    } else if (!this.song.paused && now - this.silentSince > 1.5) {
      this.song.pause();
    }
  }

  /**
   * 0..1: the school's song coming up with its card, chapter 1's and again
   * chapter 3's, back at BYU (through the muffle, so it surfaces as the sound
   * reopens). Coming up from silence it starts from its intro; once silent
   * for a moment it pauses.
   */
  setSchoolMusic(amount: number) {
    const ctx = this.ctx,
      song = this.schoolSong;
    if (!ctx || !this.schoolMusic || !song) return;
    const now = ctx.currentTime;
    // Coming up from silence (by this frame's level, not the last one set:
    // a fade could leave that a hair over 0, and the song then resumed
    // where it had paused instead of from its intro).
    if (this.schoolIn <= 0 && amount > 0 && song.paused) song.currentTime = 0;
    if (
      Math.abs(amount - this.lastSchool) > 0.002 ||
      (amount === 0 && this.lastSchool !== 0)
    ) {
      this.lastSchool = amount;
      this.schoolMusic.gain.setTargetAtTime(SCHOOL_MUSIC * amount, now, 0.25);
    }
    this.schoolIn = amount;
    if (amount > 0) {
      this.schoolSilentSince = now;
      if (song.paused && this.playing) song.play().catch(() => undefined);
    } else if (!song.paused && now - this.schoolSilentSince > 1.5) {
      song.pause();
    }
  }

  /**
   * Per frame, chapter 2's song: amount (0..1) brings it up with the card
   * (from its start, coming up from silence; paused once silent a moment);
   * open (0..1) lifts its tension low-pass and level as he writes.
   */
  setOfficeMusic(amount: number, open: number) {
    const ctx = this.ctx,
      o = this.office;
    if (!ctx || !o) return;
    const now = ctx.currentTime,
      el = o.song;
    if (o.in <= 0 && amount > 0 && el.paused) el.currentTime = 0;
    o.in = amount;
    o.open = open;
    const level = OFFICE_MUSIC * amount * (0.7 + 0.3 * open);
    if (Math.abs(level - o.level) > 0.001) {
      o.level = level;
      o.out.gain.setTargetAtTime(level, now, 0.25);
      o.tone.frequency.setTargetAtTime(2000 * (20000 / 2000) ** open, now, 0.3);
    }
    if (amount > 0) {
      o.silentSince = now;
      if (el.paused && this.playing) el.play().catch(() => undefined);
    } else if (now - o.silentSince > 1.5 && !el.paused) el.pause();
  }

  /**
   * Per frame, chapter 4's song: amount (0..1) brings it up over BYU as the
   * flight begins (from its start, coming up from silence; paused once
   * silent a moment), and it plays on through Bridge's office.
   */
  setBridgeMusic(amount: number) {
    this.drive(this.bridge, amount, BRIDGE_MUSIC);
  }

  /** Per frame, the ending's song: up as the white lifts off his room at
   *  Christmas (from its start, coming up from silence). */
  setEndMusic(amount: number) {
    this.drive(this.end, amount, END_MUSIC);
  }

  /** A song of its own, at `amount` of its `full` level: from its start
   *  when it comes up from silence; paused once silent a moment. */
  private drive(own: Song | null, amount: number, full: number) {
    const ctx = this.ctx;
    if (!ctx || !own) return;
    const now = ctx.currentTime,
      el = own.song;
    if (own.in <= 0 && amount > 0 && el.paused) el.currentTime = 0;
    own.in = amount;
    const level = full * amount;
    if (
      Math.abs(level - own.level) > 0.001 ||
      (amount === 0 && own.level !== 0)
    ) {
      own.level = level;
      own.out.gain.setTargetAtTime(level, now, 0.25);
    }
    if (amount > 0) {
      own.silentSince = now;
      if (el.paused && this.playing) el.play().catch(() => undefined);
    } else if (now - own.silentSince > 1.5 && !el.paused) el.pause();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    rememberSound(on);
    if (on) this.start();
    else {
      this.song?.pause();
      this.schoolSong?.pause();
      this.office?.song.pause();
      this.bridge?.song.pause();
      this.end?.song.pause();
      void this.ctx?.suspend();
    }
    this.onChange?.(this.playing);
  }

  /** Pause while the tab is hidden; resume if the viewer wants sound. */
  setVisible(visible: boolean) {
    if (!this.ctx) return;
    if (visible && this.enabled) {
      void this.ctx.resume();
      if (this.musicOut < 1) this.song?.play().catch(() => undefined);
      if (this.schoolIn > 0) this.schoolSong?.play().catch(() => undefined);
      const o = this.office;
      if (o && o.in > 0) o.song.play().catch(() => undefined);
      for (const own of [this.bridge, this.end])
        if (own && own.in > 0) own.song.play().catch(() => undefined);
    } else {
      this.song?.pause();
      this.schoolSong?.pause();
      this.office?.song.pause();
      this.bridge?.song.pause();
      this.end?.song.pause();
      void this.ctx.suspend();
    }
  }

  /**
   * Per frame: how much the hero is typing (0..1) and how close the camera is
   * to the keyboard (0..1). Smoothed so stops and starts are soft.
   */
  setTyping(level: number, near: number) {
    if (!this.ctx || !this.typing || !this.music) return;
    const t = this.ctx.currentTime,
      typing = level * (0.35 + 0.65 * near) * 0.8;
    this.typingLevel = level;
    // Only schedule when the target moves, not every frame.
    if (Math.abs(typing - this.lastTyping) > 0.002) {
      this.lastTyping = typing;
      this.typing.gain.setTargetAtTime(typing, t, 0.05);
    }
    const music = this.musicLevel();
    if (Math.abs(music - this.lastMusic) > 0.002) {
      this.lastMusic = music;
      // Slow swells with the typing; quicker while the song is leaving.
      this.music.gain.setTargetAtTime(music, t, this.musicOut > 0 ? 0.15 : 0.8);
    }
  }

  dispose() {
    this.disposed = true;
    this.onChange = null;
    this.stopWhoosh(this.whooshes.rewind);
    this.stopWhoosh(this.whooshes.mail);
    try {
      this.source?.stop();
    } catch {
      // Already stopped.
    }
    for (const el of [
      this.song,
      this.schoolSong,
      this.office?.song,
      this.bridge?.song,
      this.end?.song,
    ]) {
      if (!el) continue;
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    void this.ctx?.close();
    this.ctx = this.master = this.typing = this.music = this.source = null;
    this.clock = this.clockTone = this.pages = null;
    this.tickBuffer = this.pageBuffer = null;
    this.duck = null;
    this.analyser = this.muffle = null;
    this.riserBuffer = null;
    this.song = this.schoolSong = null;
    this.schoolMusic = null;
    this.office = null;
    this.bridge = this.end = null;
  }
}
