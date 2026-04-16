# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-04-16

### Fixed

- Corrected character lock progression to use consistent animation timing
- Replaced unsafe code rendering with text-based rendering to avoid HTML injection from user-provided codes
- Hardened scheduled timing parsing and empty code validation
- Preserved nested runtime options correctly when calling `setOptions()`
- Stopped demo pages from depending on private internal instance state

### Changed

- Updated README usage docs for the exported stylesheet path and documented the `progress` event
- Switched the repository lockfile to `bun.lock`

## [1.0.1] - 2025-10-03

### Added

- Toggle for retro background effects with default enabled state

## [1.0.0] - 2025-01-02

### Added

- Initial release of WOPR Decryptor
- Core decryption/countdown animation engine
- Customizable character sets (alphanumeric, matrix glyphs, custom)
- Direction modes: left-to-right, right-to-left, random
- Audio effects with customizable frequencies and volume
- Probability counter display
- Stream/intercept buffer visualization
- Progress bar
- Cycles counter with show/hide option
- Countdown mode with `endDateTime` support
- Blink effect on solved with configurable duration (0 = forever)
- Full TypeScript support with type definitions
- Event system (tick, lock, complete, render)
- API methods: start, stop, reset, next, destroy
- Three demo pages: interactive playground, full example, minimal
- Framework-agnostic design (works with any JS framework)
- Zero runtime dependencies
- CRT-style scanline and phosphor effects
- Responsive design
- Keyboard controls in examples

### Features

- ⚙️ Highly customizable UI (header, footer, progress, overlay, title)
- 🎨 Retro terminal aesthetic with green phosphor glow
- 🔊 Authentic retro audio beeps
- ⏰ Countdown timer mode
- 🎯 Custom character sets
- 📱 Mobile-friendly
- 🎮 Interactive demos included

[1.0.3]: https://github.com/NomadicDaddy/wopr-decryptor/releases/tag/v1.0.3
[1.0.0]: https://github.com/NomadicDaddy/wopr-decryptor/releases/tag/v1.0.0
