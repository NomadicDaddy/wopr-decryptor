// src/index.ts
var DEFAULT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
var DEFAULTS = {
	codes: ['CPE-1704-TKS'],
	charset: DEFAULT_CHARSET,
	direction: 'ltr',
	cycles: 0,
	timing: { durationMs: 12e3, tickInterval: 70 },
	audio: {
		enabled: true,
		volume: 0.12,
		type: 'square',
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
function clamp(n, a, b) {
	return Math.max(a, Math.min(b, n));
}
function pad(n, size) {
	return String(n).padStart(size, '0');
}
var WOPRDecryptor = class {
	opts;
	listeners = {};
	root;
	codeEl;
	barEl;
	probEl;
	cyclesEl;
	streamWrap;
	checksumEl;
	overlayEl;
	bgToggleEl;
	ctx;
	master;
	raf = 0;
	running = false;
	startTs = 0;
	cycles = 0;
	codes;
	codeIdx = 0;
	template = [];
	state = [];
	locked = [];
	dynamicIdx = [];
	lockOrder = [];
	completedCycles = 0;
	constructor(userOptions) {
		if (!userOptions?.container) {
			throw new Error('container is required');
		}
		const o = this.mergeOptions(userOptions);
		this.opts = o;
		this.codes = [...o.codes];
		this.root = this.buildRoot(o);
		o.container.appendChild(this.root);
		this.mountUI(o);
		this.prepareCode(this.codes[this.codeIdx]);
		this.render();
		this.updateBackgroundVisibility();
		if (o.ui.showOverlay) {
			this.installOverlay(o.ui.overlayText || DEFAULTS.ui.overlayText);
		}
	}
	// Public API
	on(type, cb) {
		if (!this.listeners[type]) {
			this.listeners[type] = /* @__PURE__ */ new Set();
		}
		this.listeners[type].add(cb);
		return () => this.off(type, cb);
	}
	off(type, cb) {
		this.listeners[type]?.delete(cb);
	}
	start() {
		if (this.running) return;
		this.running = true;
		this.startTs = 0;
		this.cycles = 0;
		this.raf = requestAnimationFrame((t) => this.loop(t));
		this.resumeAudio();
	}
	stop() {
		this.running = false;
		cancelAnimationFrame(this.raf);
	}
	reset() {
		this.stop();
		this.cycles = 0;
		this.completedCycles = 0;
		this.prepareCode(this.codes[this.codeIdx]);
		this.updateHud(0);
		this.render();
	}
	next(loop = true) {
		this.codeIdx++;
		if (this.codeIdx >= this.codes.length) {
			this.codeIdx = loop ? 0 : this.codes.length - 1;
		}
		this.reset();
	}
	setCodes(codes, reset = true) {
		this.codes = [...codes];
		this.codeIdx = 0;
		if (reset) this.reset();
	}
	setOptions(patch) {
		this.opts = this.mergeOptions({ ...this.opts, ...patch });
		this.applyColors(this.opts.colors, this.root);
		this.updateBackgroundVisibility();
	}
	// Public API for background toggle
	toggleBackground() {
		this.opts.ui.showBackground = !this.opts.ui.showBackground;
		this.updateBackgroundVisibility();
	}
	updateBackgroundVisibility() {
		const enabled = this.opts.ui.showBackground ? 1 : 0;
		this.root.style.setProperty('--wopr-bg-enabled', enabled.toString());
		this.root.style.setProperty(
			'--wopr-bg-gradient',
			this.opts.ui.showBackground ? 'linear-gradient(var(--wopr-bg), #000)' : 'transparent'
		);
		if (this.bgToggleEl) {
			this.bgToggleEl.textContent = this.opts.ui.showBackground ? '\u{1F3A8} HIDE BG' : '\u{1F3A8} SHOW BG';
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
	emit(type, ...args) {
		this.listeners[type]?.forEach((fn) => {
			fn(...args);
		});
	}
	mergeOptions(o) {
		const timing = { ...DEFAULTS.timing, ...(o.timing || {}) };
		if (timing.endDateTime) {
			const endDate = timing.endDateTime instanceof Date ? timing.endDateTime : new Date(timing.endDateTime);
			const startDate = timing.startDateTime
				? timing.startDateTime instanceof Date
					? timing.startDateTime
					: new Date(timing.startDateTime)
				: /* @__PURE__ */ new Date();
			timing.durationMs = endDate.getTime() - startDate.getTime();
			if (timing.durationMs <= 0) {
				console.warn('endDateTime must be after startDateTime, using default duration');
				timing.durationMs = DEFAULTS.timing.durationMs;
			}
		}
		return {
			container: o.container,
			codes: o.codes && o.codes.length ? o.codes : DEFAULTS.codes,
			charset: o.charset || DEFAULTS.charset,
			direction: o.direction || DEFAULTS.direction,
			cycles: o.cycles !== void 0 ? o.cycles : DEFAULTS.cycles,
			colors: o.colors || {},
			audio: { ...DEFAULTS.audio, ...(o.audio || {}) },
			probability: { ...DEFAULTS.probability, ...(o.probability || {}) },
			stream: { ...DEFAULTS.stream, ...(o.stream || {}) },
			ui: { ...DEFAULTS.ui, ...(o.ui || {}) },
			timing,
		};
	}
	buildRoot(o) {
		const root = document.createElement('div');
		root.className = 'wopr-root';
		this.applyColors(o.colors, root);
		return root;
	}
	applyColors(vars, el) {
		for (const [k, v] of Object.entries(vars || {})) {
			if (v !== void 0) el.style.setProperty(`--${k}`, v);
		}
	}
	el(tag, className, text) {
		const d = document.createElement(tag);
		if (className) d.className = className;
		if (text != null) d.textContent = text;
		return d;
	}
	mountUI(o) {
		if (o.ui.showHeader) {
			const header = this.el('div', 'wopr-header');
			const left = this.el('div', '', 'WOPR // DECRYPTION ROUTINE ');
			const sim = this.el('span', 'wopr-muted', '[ SIMULATION ]');
			left.appendChild(sim);
			const bgToggle = this.el(
				'button',
				'wopr-btn wopr-bg-toggle',
				o.ui.showBackground ? '\u{1F3A8} HIDE BG' : '\u{1F3A8} SHOW BG'
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
			const copy = this.el('small', '', '\xA9 1983 WOPR SIM.');
			footer.appendChild(cs);
			footer.appendChild(copy);
			this.root.appendChild(footer);
		}
	}
	installOverlay(text) {
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
	prepareCode(finalCode) {
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
	prepareLockOrder() {
		const len = this.dynamicIdx.length;
		if (this.opts.direction === 'random') {
			const indices = Array.from({ length: len }, (_, i) => i);
			for (let i = len - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[indices[i], indices[j]] = [indices[j], indices[i]];
			}
			this.lockOrder = indices;
		} else if (this.opts.direction === 'rtl') {
			this.lockOrder = Array.from({ length: len }, (_, i) => len - 1 - i);
		} else {
			this.lockOrder = Array.from({ length: len }, (_, i) => i);
		}
	}
	randChar() {
		const s = this.opts.charset || DEFAULT_CHARSET;
		const i = Math.floor(Math.random() * s.length);
		return s[i];
	}
	updateCyclers() {
		for (let i = 0; i < this.state.length; i++) {
			const tpl = this.template[i];
			if (!/[A-Z0-9\-]/.test(tpl)) continue;
			if (!this.locked[i] && /[A-Z0-9]/.test(tpl)) {
				this.state[i] = this.randChar();
			}
		}
	}
	render() {
		const s = this.state.join('');
		this.codeEl.innerHTML = s + '<span class="wopr-cursor" aria-hidden="true"></span>';
		this.emit('render', s);
	}
	fmtProb(p) {
		return p.toFixed(1).padStart(4, '0') + '%';
	}
	checksum() {
		const a = ((Math.sin(this.cycles * 0.013) * 5e3 + 5e3) | 0).toString().padStart(4, '0');
		const b = ((Math.cos(this.cycles * 9e-3) * 5e3 + 5e3) | 0).toString().padStart(4, '0');
		return `${a}.${b}`;
	}
	updateHud(progress) {
		if (this.barEl) this.barEl.style.width = `${Math.round(progress * 100)}%`;
		if (this.probEl && this.opts.probability.enabled) {
			const p = this.opts.probability;
			const cur = p.base + (p.max - p.base) * progress;
			this.probEl.textContent = this.fmtProb(cur);
		}
		if (this.cyclesEl) this.cyclesEl.textContent = pad(this.cycles, 6);
		if (this.checksumEl) this.checksumEl.textContent = this.checksum();
	}
	loop(ts) {
		if (!this.running) return;
		if (!this.startTs) this.startTs = ts;
		const { durationMs, tickInterval } = this.opts.timing;
		const elapsed = ts - this.startTs;
		const progress = clamp(elapsed / durationMs, 0, 1);
		this.updateHud(progress);
		const shouldTick = !this._lastTick || ts - this._lastTick >= tickInterval;
		if (shouldTick) {
			this._lastTick = ts;
			this.cycles++;
			this.emit('tick', this.cycles);
			this.updateCyclers();
			this.updateStream();
			this.beepTick();
		}
		const toLock = Math.floor(progress * this.dynamicIdx.length);
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
	_lastTick = 0;
	finish() {
		for (let i = 0; i < this.state.length; i++) {
			this.state[i] = this.template[i];
			this.locked[i] = true;
		}
		this.updateHud(1);
		this.render();
		this.running = false;
		this.completedCycles++;
		if (this.opts.ui.blinkOnSolved) {
			this.applyBlinkEffect();
		}
		this.emit('complete', this.codes[this.codeIdx]);
		const maxCycles = this.opts.cycles;
		if (maxCycles === 0 || this.completedCycles < maxCycles) {
			setTimeout(() => {
				this.next();
				this.start();
			}, 2e3);
		}
	}
	applyBlinkEffect() {
		if (!this.codeEl) return;
		const originalClass = this.codeEl.className;
		this.codeEl.classList.add('wopr-blink');
		const duration = this.opts.ui.blinkDuration || 3;
		if (duration > 0) {
			setTimeout(() => {
				if (this.codeEl) {
					this.codeEl.className = originalClass;
				}
			}, duration * 1e3);
		}
	}
	// Stream
	lines = [];
	initStream(host) {
		if (!this.opts.stream.enabled || !host) return;
		this.lines = [];
		host.innerHTML = '';
		const n = this.opts.stream.lines;
		for (let i = 0; i < n; i++) {
			const div = this.el('div', 'wopr-line');
			host.appendChild(div);
			this.lines.push(div);
		}
	}
	fillRandom(len) {
		let s = '';
		for (let i = 0; i < len; i++) s += this.randChar();
		return s;
	}
	updateStream() {
		if (!this.opts.stream.enabled || !this.streamWrap) return;
		const width = this.opts.stream.width;
		const cycle = this.opts.stream.prefixCycle;
		for (let i = 0; i < this.lines.length; i++) {
			const prefix = cycle[i % cycle.length] || '';
			const payload = this.fillRandom(width);
			this.lines[i].textContent = prefix + payload;
		}
	}
	// Audio
	ensureAudio() {
		if (!this.opts.audio.enabled) return;
		if (this.ctx) return;
		const Ctor = window.AudioContext || window.webkitAudioContext;
		if (!Ctor) return;
		this.ctx = new Ctor();
		if (this.ctx) {
			this.master = this.ctx.createGain();
			if (this.master) {
				this.master.gain.value = this.opts.audio.volume;
				this.master.connect(this.ctx.destination);
			}
		}
	}
	async resumeAudio() {
		if (!this.opts.audio.enabled) return;
		this.ensureAudio();
		try {
			if (this.ctx && this.ctx.state === 'suspended') {
				await this.ctx.resume();
			}
		} catch {}
	}
	beep(freq, ms = 60, type = 'square', gain = 1) {
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
		amp.gain.linearRampToValueAtTime(g, t + 5e-3);
		amp.gain.exponentialRampToValueAtTime(1e-4, t + ms / 1e3);
		osc.start(t);
		osc.stop(t + ms / 1e3 + 0.02);
	}
	beepTick() {
		if (!this.opts.audio.enabled) return;
		this.beep(this.opts.audio.tickFreq, 25, this.opts.audio.type, 0.08);
	}
	beepLock(k) {
		if (!this.opts.audio.enabled) return;
		const f = this.opts.audio.lockFreqStart + k * this.opts.audio.lockFreqStep;
		this.beep(f, 50, this.opts.audio.type, 0.18);
	}
};
export { WOPRDecryptor };
