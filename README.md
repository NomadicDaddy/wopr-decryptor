# WOPR Decryptor

[![npm version](https://badge.fury.io/js/wopr-decryptor.svg)](https://www.npmjs.com/package/wopr-decryptor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Retro, WarGames-inspired decryption/countdown counter with a CRT feel. Pure ESM, framework-agnostic, customizable, and controllable via a small API.

## ✨ Features

- 🎮 **WarGames-inspired** retro terminal aesthetic
- 🎨 **Fully customizable** - colors, timing, UI elements
- 🔊 **Audio effects** - authentic beeps and bloops
- ⏰ **Countdown mode** - solve by specific date/time
- 🎯 **Character sets** - alphanumeric or custom glyphs
- 📱 **Framework-agnostic** - works with React, Vue, vanilla JS, etc.
- 🎪 **Interactive demos** included
- 📦 **Zero dependencies** - pure TypeScript/JavaScript

## 🎮 Demo

- **[Live Demos](https://nomadicdaddy.github.io/wopr-decryptor)**

## 📦 Install

```bash
npm i wopr-decryptor
```

## Usage

```javascript
import { WOPRDecryptor } from 'wopr-decryptor';
import 'wopr-decryptor/dist/styles.css';

const wopr = new WOPRDecryptor({
	container: document.getElementById('app'),
	codes: ['CPE-1704-TKS', 'DEFCON-1'],
	direction: 'random', // 'ltr', 'rtl', or 'random'
	cycles: 0, // 0 = infinite loop through codes
	timing: {
		durationMs: 10000,
		tickInterval: 70,
		// Optional: solve by specific date/time
		// endDateTime: '2025-12-31 23:59:59',
	},
	audio: {
		enabled: true,
		volume: 0.12,
	},
	ui: {
		blinkOnSolved: true, // Blink effect when code is solved
	},
});

wopr.on('complete', (code) => {
	console.log('Decrypted:', code);
});

wopr.start();
```

### Options

#### Core Options

- **`codes`**: Array of code strings to decrypt
- **`charset`**: Character set to use for scrambling (default: A-Z, 0-9)
- **`direction`**: `'ltr' | 'rtl' | 'random'` - Character lock sequence direction
    - `'ltr'` (default): Locks characters from left to right
    - `'rtl'`: Locks characters from right to left
    - `'random'`: Locks characters in random order
- **`cycles`**: Number of times to loop through codes (default: 0)
    - `0`: Infinite loop
    - `1-N`: Loop that many times then stop

#### Timing Options

- **`timing.durationMs`**: Total duration of the decryption animation (ms)
- **`timing.tickInterval`**: Time between character scrambles (ms)
- **`timing.startDateTime`**: When to start (Date or string)
- **`timing.endDateTime`**: When to complete solving (Date or string)
    - When set, `durationMs` is calculated automatically
    - Useful for countdown timers that solve at specific times

#### UI Options

- **`ui.showHeader`**: Show header with title
- **`ui.showFooter`**: Show footer with checksum
- **`ui.showProgress`**: Show progress bar
- **`ui.showOverlay`**: Show initial overlay button
- **`ui.showBackground`**: Show retro background effects (default: true)
- **`ui.blinkOnSolved`**: Blink effect when code is solved (default: false)
- **`ui.blinkDuration`**: Duration of blink effect in seconds (0 = blink forever, default: 3)
- **`ui.showCycles`**: Show cycles counter in UI (default: true)
- **`ui.title`**: Custom title text

#### Audio Options

- **`audio.enabled`**: Enable/disable sound effects
- **`audio.volume`**: Volume level (0-1)
- **`audio.tickFreq`**: Frequency for tick sounds (Hz)
- **`audio.lockFreqStart`**: Starting frequency for lock sounds (Hz)
- **`audio.lockFreqStep`**: Frequency increment per lock (Hz)

#### Other Options

- **`probability.enabled`**: Show probability percentage
- **`probability.base`**: Starting probability %
- **`probability.max`**: Ending probability %
- **`stream.enabled`**: Show intercept buffer stream
- **`stream.lines`**: Number of stream lines
- **`stream.width`**: Width of stream lines

See `example.html` for a basic example and `demo.html` for an interactive configuration playground.

## 🎯 API

### Methods

- **`start()`** - Start the decryption animation
- **`stop()`** - Stop the animation
- **`reset()`** - Reset to the first code
- **`next()`** - Move to the next code
- **`destroy()`** - Clean up and remove all elements

### Events

```javascript
wopr.on('tick', () => {
	/* Called on each character scramble */
});
wopr.on('lock', (index, char) => {
	/* Called when a character locks */
});
wopr.on('complete', (code) => {
	/* Called when code is fully solved */
});
wopr.on('render', (state) => {
	/* Called on each render */
});
```

## 🛠️ Development

### Build the project

```bash
npm run build
```

### Preview the build

```bash
npm run preview
```

This will build the project and start a dev server at `http://localhost:3000`. Open `example.html` to see the decryptor in action.

### Watch mode

```bash
npm run dev
```

Watches and rebuilds TypeScript files on change.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT © [Phillip Beazley](https://github.com/NomadicDaddy)

See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Inspired by the 1983 film **WarGames** and the WOPR computer system.

---

**Made with 💚 by [NomadicDaddy](https://github.com/NomadicDaddy)**
