# Contributing to EventKit

Thank you for your interest in contributing to EventKit! We welcome bug reports, documentation enhancements, feature proposals, and pull requests.

---

## Code of Conduct

Please treat all contributors and maintainers with respect, empathy, and professional courtesy.

---

## Development Setup

1. **Prerequisites**:
   - Node.js >= 22.0.0
   - npm >= 10.0.0
   - Git

2. **Clone the Repository**:
   ```bash
   git clone https://github.com/nsaky/eventkit.git
   cd eventkit
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run the Test Suite**:
   ```bash
   npm test
   ```

5. **Run Test Coverage**:
   ```bash
   npm run test:coverage
   ```

6. **Run Interactive Examples**:
   ```bash
   node examples/complete-workflow.js
   node examples/ticket-validation.js
   node examples/qr-generation.js
   node examples/data-export.js
   ```

---

## Pull Request Guidelines

1. **Branch Naming**: Use descriptive prefixes such as `fix/issue-description` or `docs/update-readme`.
2. **Coding Standards**:
   - Write clean, modular, and idiomatic CommonJS JavaScript (ES6+).
   - Use asynchronous Promise-based APIs (`async/await`) for all I/O operations.
   - Return safe copies of records to prevent callers from directly mutating internal in-memory state.
   - Maintain centralized validation and structured error classes extending `EventKitError`.
3. **Testing**:
   - Every bug fix or new feature must include automated unit and integration tests using Vitest.
   - Tests must use isolated temporary directories and clean up after themselves.
   - All tests (`npm test`) must pass before opening a pull request.
4. **Documentation**:
   - Update `README.md` and JSDoc comments if public interfaces or options change.
   - Document any changes in `CHANGELOG.md`.

---

## Reporting Issues

If you encounter a bug or unexpected behavior:
1. Search existing issues on GitHub to see if it has already been reported.
2. If not, open a new issue with:
   - A clear, descriptive title.
   - Steps to reproduce the issue.
   - Expected behavior vs. actual behavior.
   - Node.js version, operating system, and EventKit version.
   - Minimal code reproduction snippet.
