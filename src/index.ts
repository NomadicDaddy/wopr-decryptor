/* eslint-disable no-console */

export type AudioOptions = {
	enabled?: boolean;
	volume?: number; // 0..1
	type?: OscillatorType;
	tickFreq?: number;
	lockFreqStart?: number;
	lockFreqStep?: number;
};

export type ProbabilityOptions = {
	enabled?: boolean;
	base?: number; // start %
	max?: number; // end %
};

export type StreamOptions = {
	enabled?: boolean;
	lines?: number;
	width?: number;
	prefixCycle?: string[];
};

export type UIOptions = {
	showHeader?: boolean;
	showFooter?: boolean;
	showProgress?: boolean;
	showOverlay?: boolean;
	showBackground?: boolean;
	overlayText?: string;
	title?: string;
	blinkOnSolved?: boolean;
	blinkDuration?: number; // seconds to blink (0 = forever)
	showCycles?: boolean;
};

export type TimingOptions = {
	durationMs?: number; // total time to lock code
	tickInterval?: number; // ms between scramble ticks
	startDateTime?: Date | string; // when to start (auto-calculated if endDateTime set)
	endDateTime?: Date | string; // when to complete solving
};

export type WOPROptions = {
	container: HTMLElement;
	codes?: string[];
	charset?: string;
	direction?: 'ltr' | 'rtl' | 'random'; // lock direction
	cycles?: number; // 0 = infinite, 1-N = that many cycles
	colors?: Partial<Record<string, string>>; // CSS var overrides
	audio?: AudioOptions;
	probability?: ProbabilityOptions;
	stream?: StreamOptions;
	ui?: UIOptions;
	timing?: TimingOptions;
};

export type WOPREvents = {
	progress: (p: number) => void;
	tick: (cycles: number) => void;
	lock: (index: number, char: string) => void;
	complete: (code: string) => void;
	render: (text: string) => void;
};

type ListenerMap = {
	[K in keyof WOPREvents]: Set<WOPREvents[K]>;
};

const DEFAULT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const DEFAULTS = {
	codes: ['CPE1704TKS'],
	charset: DEFAULT_CHARSET,
	direction: 'ltr' as const,
	cycles: 0,
	timing: { durationMs: 12000, tickInterval: 70 },
	audio: {
		enabled: true,
		volume: 0.12,
		type: 'square' as OscillatorType,
		tickFreq: 180,
		lockFreqStart: 900,
		lockFreqStep: 12,
	},
	probability: { enabled: true, base: 2.3, max: 99.9 },
	stream: {
		enabled: true,
		lines: 20,
		width: 22,
		prefixCycle: ['INTCPT ', 'SIGMA  ', 'FRAME  '],
	},
	ui: {
		showHeader: true,
		showFooter: true,
		showProgress: true,
		showOverlay: false,
		showBackground: true,
		overlayText: 'INITIATE DECRYPTION',
		title: 'TARGET: LAUNCH CODES',
		blinkOnSolved: false,
		blinkDuration: 3,
		showCycles: true,
	},
};

function clamp(n: number, a: number, b: number) {
	return Math.max(a, Math.min(b, n));
}

function pad(n: number, size: number) {
	return String(n).padStart(size, '0');
}

function parseDateValue(value?: Date | string) {
	if (!value) return undefined;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

export class WOPRDecryptor {
	private opts: Required<WOPROptions>;
	private listeners: Partial<ListenerMap> = {};
	private root: HTMLElement;
	private codeEl!: HTMLElement;
	private barEl?: HTMLElement;
	private probEl?: HTMLElement;
	private cyclesEl?: HTMLElement;
	private streamWrap?: HTMLElement;
	private checksumEl?: HTMLElement;
	private overlayEl?: HTMLElement;
	private bgToggleEl?: HTMLElement;

	private ctx?: AudioContext;
	private master?: GainNode;

	private raf = 0;
	private running = false;
	private startTs = 0;
	private cycles = 0;

	private codes: string[];
	private codeIdx = 0;
	private template: string[] = [];
	private state: string[] = [];
	private locked: boolean[] = [];
	private dynamicIdx: number[] = [];
	private lockOrder: number[] = [];
	private completedCycles = 0;
	private restartTimer = 0;

	constructor(userOptions: WOPROptions) {
		if (!userOptions?.container) {
			throw new Error('container is required');
		}

		// Deep-ish merge with defaults
		const o = this.mergeOptions(userOptions);
		this.opts = o;

		this.codes = [...o.codes];

		this.root = this.buildRoot(o);
		o.container.appendChild(this.root);
		this.mountUI(o);

		this.prepareCode(this.codes[this.codeIdx]);
		this.render();
		this.updateBackgroundVisibility(); // Initialize background visibility

		if (o.ui.showOverlay) {
			this.installOverlay(o.ui.overlayText || DEFAULTS.ui.overlayText);
		}
	}

	// Public API
	on<K extends keyof WOPREvents>(type: K, cb: WOPREvents[K]) {
		if (!this.listeners[type]) {
			(this.listeners as any)[type] = new Set();
		}
		(this.listeners[type] as Set<WOPREvents[K]>).add(cb);
		return () => this.off(type, cb);
	}

	off<K extends keyof WOPREvents>(type: K, cb: WOPREvents[K]) {
		this.listeners[type]?.delete(cb);
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.startTs = 0;
		this.cycles = 0;
		this._lastTick = 0;
		this.raf = requestAnimationFrame((t) => this.loop(t));
		this.resumeAudio();
	}

	stop() {
		this.running = false;
		cancelAnimationFrame(this.raf);
		if (this.restartTimer) {
			window.clearTimeout(this.restartTimer);
			this.restartTimer = 0;
		}
	}

	reset() {
		this.loadCurrentCode();
	}

	next(loop = true) {
		this.advanceCode(loop);
	}

	setCodes(codes: string[], reset = true) {
		if (!codes.length) {
			throw new Error('codes must contain at least one code');
		}
		this.codes = [...codes];
		this.codeIdx = 0;
		if (reset) this.reset();
	}

	setOptions(patch: Partial<WOPROptions>) {
		const nextOptions: WOPROptions = {
			container: patch.container ?? this.opts.container,
			codes: patch.codes ?? this.opts.codes,
			charset: patch.charset ?? this.opts.charset,
			direction: patch.direction ?? this.opts.direction,
			cycles: patch.cycles ?? this.opts.cycles,
			colors: { ...this.opts.colors, ...(patch.colors || {}) },
			audio: { ...this.opts.audio, ...(patch.audio || {}) },
			probability: { ...this.opts.probability, ...(patch.probability || {}) },
			stream: { ...this.opts.stream, ...(patch.stream || {}) },
			ui: { ...this.opts.ui, ...(patch.ui || {}) },
			timing: { ...this.opts.timing, ...(patch.timing || {}) },
		};

		this.opts = this.mergeOptions(nextOptions);
		this.codes = [...this.opts.codes];
		if (this.codeIdx >= this.codes.length) {
			this.codeIdx = 0;
		}

		if (patch.codes || patch.charset || patch.direction || patch.timing) {
			this.loadCurrentCode();
		}
		// Apply color overrides immediately
		this.applyColors(this.opts.colors, this.root);
		// Update background visibility
		this.updateBackgroundVisibility();
		if (this.master) {
			this.master.gain.value = this.opts.audio.volume!;
		}
	}

	private loadCurrentCode(resetCycleCount = true) {
		this.stop();
		this.cycles = 0;
		this.startTs = 0;
		this._lastTick = 0;
		if (resetCycleCount) {
			this.completedCycles = 0;
		}
		this.prepareCode(this.codes[this.codeIdx]);
		this.updateHud(0);
		this.render();
	}

	private advanceCode(loop = true, resetCycleCount = true) {
		this.codeIdx++;
		if (this.codeIdx >= this.codes.length) {
			this.codeIdx = loop ? 0 : this.codes.length - 1;
		}
		this.loadCurrentCode(resetCycleCount);
	}

	// Public API for background toggle
	toggleBackground() {
		this.opts.ui.showBackground = !this.opts.ui.showBackground;
		this.updateBackgroundVisibility();
	}

	private updateBackgroundVisibility() {
		// Update CSS variables for background visibility
		const enabled = this.opts.ui.showBackground ? 1 : 0;
		this.root.style.setProperty('--wopr-bg-enabled', enabled.toString());
		this.root.style.setProperty(
			'--wopr-bg-gradient',
			this.opts.ui.showBackground ? 'linear-gradient(var(--wopr-bg), #000)' : 'transparent'
		);

		// Update button text
		if (this.bgToggleEl) {
			this.bgToggleEl.textContent = this.opts.ui.showBackground ? '🎨 HIDE BG' : '🎨 SHOW BG';
		}
	}

	destroy() {
		this.stop();
		if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
		try {
			this.ctx?.close();
		} catch {}
	}

	// Internals
	private emit<K extends keyof WOPREvents>(type: K, ...args: Parameters<WOPREvents[K]>) {
		this.listeners[type]?.forEach((fn) => {
			// @ts-expect-error variadic
			fn(...args);
		});
	}

	private mergeOptions(o: WOPROptions): Required<WOPROptions> {
		const timing = { ...DEFAULTS.timing, ...(o.timing || {}) };

		// Calculate durationMs from startDateTime/endDateTime if provided
		const startDate = parseDateValue(timing.startDateTime);
		const endDate = parseDateValue(timing.endDateTime);

		if (timing.startDateTime && !startDate) {
			console.warn('Invalid startDateTime, ignoring scheduled start');
			timing.startDateTime = undefined;
		}

		if (timing.endDateTime && !endDate) {
			console.warn('Invalid endDateTime, using default duration');
			timing.endDateTime = undefined;
		}

		if (endDate) {
			const resolvedStartDate = startDate || new Date();
			const durationMs = endDate.getTime() - resolvedStartDate.getTime();
			if (durationMs <= 0) {
				console.warn('endDateTime must be after startDateTime, using default duration');
				timing.startDateTime = undefined;
				timing.endDateTime = undefined;
				timing.durationMs = DEFAULTS.timing.durationMs;
			} else {
				timing.startDateTime = resolvedStartDate;
				timing.endDateTime = endDate;
				timing.durationMs = durationMs;
			}
		}

		if (!Number.isFinite(timing.durationMs) || timing.durationMs! <= 0) {
			timing.durationMs = DEFAULTS.timing.durationMs;
		}

		if (!Number.isFinite(timing.tickInterval) || timing.tickInterval! <= 0) {
			timing.tickInterval = DEFAULTS.timing.tickInterval;
		}

		return {
			container: o.container,
			codes: o.codes && o.codes.length ? o.codes : DEFAULTS.codes,
			charset: o.charset || DEFAULTS.charset,
			direction: o.direction || DEFAULTS.direction,
			cycles: o.cycles !== undefined ? o.cycles : DEFAULTS.cycles,
			colors: o.colors || {},
			audio: { ...DEFAULTS.audio, ...(o.audio || {}) },
			probability: { ...DEFAULTS.probability, ...(o.probability || {}) },
			stream: { ...DEFAULTS.stream, ...(o.stream || {}) },
			ui: { ...DEFAULTS.ui, ...(o.ui || {}) },
			timing,
		};
	}

	private buildRoot(o: Required<WOPROptions>) {
		const root = document.createElement('div');
		root.className = 'wopr-root';
		this.applyColors(o.colors, root);
		return root;
	}

	private applyColors(vars: Partial<Record<string, string>>, el: HTMLElement) {
		for (const [k, v] of Object.entries(vars || {})) {
			if (v !== undefined) el.style.setProperty(`--${k}`, v);
		}
	}

	private el(tag: string, className?: string, text?: string) {
		const d = document.createElement(tag);
		if (className) d.className = className;
		if (text != null) d.textContent = text;
		return d;
	}

	private mountUI(o: Required<WOPROptions>) {
		if (o.ui.showHeader) {
			const header = this.el('div', 'wopr-header');
			const left = this.el('div', '', 'WOPR // DECRYPTION ROUTINE ');
			const sim = this.el('span', 'wopr-muted', '[ SIMULATION ]');
			left.appendChild(sim);

			// Add background toggle button
			const bgToggle = this.el(
				'button',
				'wopr-btn wopr-bg-toggle',
				o.ui.showBackground ? '🎨 HIDE BG' : '🎨 SHOW BG'
			);
			bgToggle.style.fontSize = '10px';
			bgToggle.style.padding = '4px 8px';
			bgToggle.style.marginRight = '8px';
			bgToggle.addEventListener('click', () => {
				this.toggleBackground();
			});
			this.bgToggleEl = bgToggle;

			const right = this.el('div', '', 'NORAD PROCESSOR GRID');
			right.insertBefore(bgToggle, right.firstChild);
			header.appendChild(left);
			header.appendChild(right);
			this.root.appendChild(header);
		}

		const grid = this.el('div', 'wopr-grid');
		const main = this.el('div', 'wopr-main');
		const side = this.el('div', 'wopr-side');

		const title = this.el('div', 'wopr-title', this.opts.ui.title || '');
		this.codeEl = this.el('div', 'wopr-code');

		main.appendChild(title);
		main.appendChild(this.codeEl);

		if (this.opts.ui.showProgress) {
			const prog = this.el('div', 'wopr-progress');
			this.barEl = this.el('div', 'wopr-bar');
			prog.appendChild(this.barEl);
			main.appendChild(prog);
		}

		const hud = this.el('div', 'wopr-header');

		if (this.opts.ui.showCycles) {
			const cycles = this.el('div', '', 'CYCLES: ');
			this.cyclesEl = this.el('span', 'wopr-muted', '000000');
			cycles.appendChild(this.cyclesEl);
			hud.appendChild(cycles);
		}

		if (this.opts.probability.enabled) {
			const prob = this.el('div', '', 'PROBABILITY: ');
			this.probEl = this.el('span', 'wopr-muted', '00.0%');
			prob.appendChild(this.probEl);
			hud.appendChild(prob);
		}

		if (this.opts.ui.showCycles || this.opts.probability.enabled) {
			main.appendChild(hud);
		}

		if (this.opts.stream.enabled) {
			const t = this.el('div', 'wopr-title', 'TRAFFIC: INTERCEPT BUFFER');
			this.streamWrap = this.el('div', 'wopr-stream');
			side.appendChild(t);
			side.appendChild(this.streamWrap);
			this.initStream(this.streamWrap);
			this.updateStream();
		}

		grid.appendChild(main);
		grid.appendChild(side);
		this.root.appendChild(grid);

		if (this.opts.ui.showFooter) {
			const footer = this.el('div', 'wopr-footer');
			const cs = this.el('div', '', 'CHECKSUM: ');
			this.checksumEl = this.el('span', 'wopr-muted', '0000.0000');
			cs.appendChild(this.checksumEl);
			const copy = this.el('small', '', '© 1983 WOPR SIM.');
			footer.appendChild(cs);
			footer.appendChild(copy);
			this.root.appendChild(footer);
		}
	}

	private installOverlay(text: string) {
		this.overlayEl = this.el('div', 'wopr-overlay');
		const btn = this.el('button', 'wopr-btn', text);
		btn.addEventListener('click', () => {
			this.overlayEl?.remove();
			this.start();
		});
		this.overlayEl.addEventListener('click', (e) => {
			if (e.target === this.overlayEl) {
				this.overlayEl.remove();
				this.start();
			}
		});
		this.overlayEl.appendChild(btn);
		this.root.appendChild(this.overlayEl);
	}

	private prepareCode(finalCode: string) {
		const t = finalCode.split('');
		const dynamicIdx = t
			.map((ch, i) => ({ ch, i }))
			.filter((o) => /[A-Z0-9]/.test(o.ch))
			.map((o) => o.i);

		this.template = t;
		this.dynamicIdx = dynamicIdx;
		this.locked = new Array(t.length).fill(false);
		this.state = t.map((ch) => (/[A-Z0-9]/.test(ch) ? '_' : ch));
		this.prepareLockOrder();
	}

	private prepareLockOrder() {
		const len = this.dynamicIdx.length;
		if (this.opts.direction === 'random') {
			// Fisher-Yates shuffle
			const indices = Array.from({ length: len }, (_, i) => i);
			for (let i = len - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[indices[i], indices[j]] = [indices[j], indices[i]];
			}
			this.lockOrder = indices;
		} else if (this.opts.direction === 'rtl') {
			this.lockOrder = Array.from({ length: len }, (_, i) => len - 1 - i);
		} else {
			// ltr (default)
			this.lockOrder = Array.from({ length: len }, (_, i) => i);
		}
	}

	private randChar() {
		const s = this.opts.charset || DEFAULT_CHARSET;
		const i = Math.floor(Math.random() * s.length);
		return s[i];
	}

	private updateCyclers() {
		for (let i = 0; i < this.state.length; i++) {
			const tpl = this.template[i];
			if (!/[A-Z0-9\-]/.test(tpl)) continue;
			if (!this.locked[i] && /[A-Z0-9]/.test(tpl)) {
				this.state[i] = this.randChar();
			}
		}
	}

	private render() {
		const s = this.state.join('');
		this.codeEl.textContent = s;
		const cursor = this.el('span', 'wopr-cursor');
		cursor.setAttribute('aria-hidden', 'true');
		this.codeEl.appendChild(cursor);
		this.emit('render', s);
	}

	private fmtProb(p: number) {
		return p.toFixed(1).padStart(4, '0') + '%';
	}

	private checksum() {
		const a = ((Math.sin(this.cycles * 0.013) * 5000 + 5000) | 0).toString().padStart(4, '0');
		const b = ((Math.cos(this.cycles * 0.009) * 5000 + 5000) | 0).toString().padStart(4, '0');
		return `${a}.${b}`;
	}

	private updateHud(progress: number) {
		if (this.barEl) this.barEl.style.width = `${Math.round(progress * 100)}%`;
		if (this.probEl && this.opts.probability.enabled) {
			const p = this.opts.probability;
			const cur = p.base! + (p.max! - p.base!) * progress;
			this.probEl.textContent = this.fmtProb(cur);
		}
		if (this.cyclesEl) this.cyclesEl.textContent = pad(this.cycles, 6);
		if (this.checksumEl) this.checksumEl.textContent = this.checksum();
	}

	private calculateProgress(frameTs: number) {
		const startDate = parseDateValue(this.opts.timing.startDateTime);
		const endDate = parseDateValue(this.opts.timing.endDateTime);

		if (startDate && endDate) {
			const totalTime = endDate.getTime() - startDate.getTime();
			if (totalTime > 0) {
				return clamp((Date.now() - startDate.getTime()) / totalTime, 0, 1);
			}
		}

		if (!this.startTs) this.startTs = frameTs;
		const elapsed = frameTs - this.startTs;
		return clamp(elapsed / this.opts.timing.durationMs!, 0, 1);
	}

	private loop(ts: number) {
		if (!this.running) return;

		const { tickInterval } = this.opts.timing;
		const progress = this.calculateProgress(ts);
		this.updateHud(progress);
		this.emit('progress', progress);

		// Character cycle tick
		const shouldTick = !this._lastTick || ts - this._lastTick >= tickInterval!;
		if (shouldTick) {
			this._lastTick = ts;
			this.cycles++;
			this.emit('tick', this.cycles);
			this.updateCyclers();
			this.updateStream();
			this.beepTick();
		}

		// Locking progression
		const toLock = this.calculateDigitsToSolve(progress);

		for (let k = 0; k < toLock; k++) {
			const orderIndex = this.lockOrder[k];
			const idx = this.dynamicIdx[orderIndex];
			if (!this.locked[idx]) {
				this.locked[idx] = true;
				this.state[idx] = this.template[idx];
				this.beepLock(k);
				this.emit('lock', idx, this.template[idx]);
			}
		}

		this.render();

		if (progress >= 1) {
			this.finish();
			return;
		}

		this.raf = requestAnimationFrame((t) => this.loop(t));
	}

	private _lastTick = 0;

	private finish() {
		for (let i = 0; i < this.state.length; i++) {
			this.state[i] = this.template[i];
			this.locked[i] = true;
		}
		this.updateHud(1);
		this.render();
		this.running = false;
		this.completedCycles++;

		// Apply blink effect if enabled
		if (this.opts.ui.blinkOnSolved) {
			this.applyBlinkEffect();
		}

		this.emit('complete', this.codes[this.codeIdx]);

		// Handle cycle logic
		const maxCycles = this.opts.cycles;
		if (maxCycles === 0 || this.completedCycles < maxCycles) {
			// Continue cycling
			this.restartTimer = window.setTimeout(() => {
				this.restartTimer = 0;
				this.advanceCode(true, false);
				this.start();
			}, 2000);
		}
	}

	private applyBlinkEffect() {
		if (!this.codeEl) return;
		const originalClass = this.codeEl.className;
		this.codeEl.classList.add('wopr-blink');
		const duration = this.opts.ui.blinkDuration || 3;
		if (duration > 0) {
			setTimeout(() => {
				if (this.codeEl) {
					this.codeEl.className = originalClass;
				}
			}, duration * 1000);
		}
		// If duration is 0, blink forever (don't remove class)
	}

	// Stream
	private lines: HTMLElement[] = [];

	private initStream(host?: HTMLElement) {
		if (!this.opts.stream.enabled || !host) return;
		this.lines = [];
		host.innerHTML = '';
		const n = this.opts.stream.lines!;
		for (let i = 0; i < n; i++) {
			const div = this.el('div', 'wopr-line');
			host.appendChild(div);
			this.lines.push(div);
		}
	}

	private fillRandom(len: number) {
		let s = '';
		for (let i = 0; i < len; i++) s += this.randChar();
		return s;
	}

	private updateStream() {
		if (!this.opts.stream.enabled || !this.streamWrap) return;
		const width = this.opts.stream.width!;
		const cycle = this.opts.stream.prefixCycle!;
		for (let i = 0; i < this.lines.length; i++) {
			const prefix = cycle[i % cycle.length] || '';
			const payload = this.fillRandom(width);
			this.lines[i].textContent = prefix + payload;
		}
	}

	// Audio
	private ensureAudio() {
		if (!this.opts.audio.enabled) return;
		if (this.ctx) return;
		const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
		if (!Ctor) return;
		this.ctx = new Ctor();
		if (this.ctx) {
			this.master = this.ctx.createGain();
			if (this.master) {
				this.master.gain.value = this.opts.audio.volume!;
				this.master.connect(this.ctx.destination);
			}
		}
	}

	private async resumeAudio() {
		if (!this.opts.audio.enabled) return;
		this.ensureAudio();
		try {
			if (this.ctx && this.ctx.state === 'suspended') {
				await this.ctx.resume();
			}
		} catch {}
	}

	private beep(freq: number, ms = 60, type: OscillatorType = 'square', gain = 1) {
		if (!this.ctx || !this.master || !this.opts.audio.enabled) return;
		const osc = this.ctx.createOscillator();
		const amp = this.ctx.createGain();
		amp.gain.value = 0;
		amp.connect(this.master);
		osc.type = type;
		osc.frequency.value = freq;
		osc.connect(amp);

		const t = this.ctx.currentTime;
		const g = clamp(gain, 0, 1);
		amp.gain.setValueAtTime(0, t);
		amp.gain.linearRampToValueAtTime(g, t + 0.005);
		amp.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
		osc.start(t);
		osc.stop(t + ms / 1000 + 0.02);
	}

	private beepTick() {
		if (!this.opts.audio.enabled) return;
		this.beep(this.opts.audio.tickFreq!, 25, this.opts.audio.type, 0.08);
	}

	private beepLock(k: number) {
		if (!this.opts.audio.enabled) return;
		const f = this.opts.audio.lockFreqStart! + k * this.opts.audio.lockFreqStep!;
		this.beep(f, 50, this.opts.audio.type, 0.18);
	}

	private calculateDigitsToSolve(progress: number): number {
		return Math.floor(clamp(progress, 0, 1) * this.dynamicIdx.length);
	}
}
