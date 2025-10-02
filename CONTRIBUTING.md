# Contributing to WOPR Decryptor

Thank you for your interest in contributing! 🎉

## Development Setup

1. **Clone the repository**

    ```bash
    git clone https://github.com/NomadicDaddy/wopr-decryptor.git
    cd wopr-decryptor
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Start development**
    ```bash
    npm run dev        # Watch mode for development
    npm run preview    # Build and preview demos
    ```

## Project Structure

```
wopr-decryptor/
├── src/
│   ├── index.ts      # Main TypeScript source
│   └── styles.css    # Component styles
├── dist/             # Built output (generated)
├── demo.html         # Interactive demo/playground
├── example.html      # Full-featured example
├── bare.html         # Minimal example
└── index.html        # Demo gallery
```

## Making Changes

1. **Create a branch**

    ```bash
    git checkout -b feature/your-feature-name
    ```

2. **Make your changes**
    - Edit files in `src/`
    - Test your changes using the demo pages
    - Run `npm run format` to format code

3. **Build and test**

    ```bash
    npm run build      # Build the project
    npm run preview    # Test in browser
    ```

4. **Commit your changes**

    ```bash
    git add .
    git commit -m "Description of changes"
    ```

5. **Push and create PR**
    ```bash
    git push origin feature/your-feature-name
    ```
    Then open a Pull Request on GitHub

## Code Style

- TypeScript with strict mode
- Format with Prettier: `npm run format`
- Follow existing code patterns

## Testing

- Test with all demo pages (demo.html, example.html, bare.html)
- Verify different configurations work correctly
- Check browser console for errors

## Pull Request Guidelines

- Provide clear description of changes
- Include screenshots/GIFs if UI changes
- Keep changes focused and atomic
- Update README.md if adding features

## Questions?

Open an issue on GitHub or reach out to the maintainer!
