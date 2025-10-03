type AudioOptions = {
	enabled?: boolean;
	volume?: number;
	type?: OscillatorType;
	tickFreq?: number;
	lockFreqStart?: number;
	lockFreqStep?: number;
};
type ProbabilityOptions = {
	enabled?: boolean;
	base?: number;
	max?: number;
};
type StreamOptions = {
	enabled?: boolean;
	lines?: number;
	width?: number;
	prefixCycle?: string[];
};
type UIOptions = {
	showHeader?: boolean;
	showFooter?: boolean;
	showProgress?: boolean;
	showOverlay?: boolean;
	showBackground?: boolean;
	overlayText?: string;
	title?: string;
	blinkOnSolved?: boolean;
	blinkDuration?: number;
	showCycles?: boolean;
};
type TimingOptions = {
	durationMs?: number;
	tickInterval?: number;
	startDateTime?: Date | string;
	endDateTime?: Date | string;
};
type WOPROptions = {
	container: HTMLElement;
	codes?: string[];
	charset?: string;
	direction?: 'ltr' | 'rtl' | 'random';
	cycles?: number;
	colors?: Partial<Record<string, string>>;
	audio?: AudioOptions;
	probability?: ProbabilityOptions;
	stream?: StreamOptions;
	ui?: UIOptions;
	timing?: TimingOptions;
};
type WOPREvents = {
	progress: (p: number) => void;
	tick: (cycles: number) => void;
	lock: (index: number, char: string) => void;
	complete: (code: string) => void;
	render: (text: string) => void;
};
declare class WOPRDecryptor {
	private opts;
	private listeners;
	private root;
	private codeEl;
	private barEl?;
	private probEl?;
	private cyclesEl?;
	private streamWrap?;
	private checksumEl?;
	private overlayEl?;
	private bgToggleEl?;
	private ctx?;
	private master?;
	private raf;
	private running;
	private startTs;
	private cycles;
	private codes;
	private codeIdx;
	private template;
	private state;
	private locked;
	private dynamicIdx;
	private lockOrder;
	private completedCycles;
	constructor(userOptions: WOPROptions);
	on<K extends keyof WOPREvents>(type: K, cb: WOPREvents[K]): () => void;
	off<K extends keyof WOPREvents>(type: K, cb: WOPREvents[K]): void;
	start(): void;
	stop(): void;
	reset(): void;
	next(loop?: boolean): void;
	setCodes(codes: string[], reset?: boolean): void;
	setOptions(patch: Partial<WOPROptions>): void;
	toggleBackground(): void;
	private updateBackgroundVisibility;
	destroy(): void;
	private emit;
	private mergeOptions;
	private buildRoot;
	private applyColors;
	private el;
	private mountUI;
	private installOverlay;
	private prepareCode;
	private prepareLockOrder;
	private randChar;
	private updateCyclers;
	private render;
	private fmtProb;
	private checksum;
	private updateHud;
	private loop;
	private _lastTick;
	private finish;
	private applyBlinkEffect;
	private lines;
	private initStream;
	private fillRandom;
	private updateStream;
	private ensureAudio;
	private resumeAudio;
	private beep;
	private beepTick;
	private beepLock;
}

export {
	type AudioOptions,
	type ProbabilityOptions,
	type StreamOptions,
	type TimingOptions,
	type UIOptions,
	WOPRDecryptor,
	type WOPREvents,
	type WOPROptions,
};
