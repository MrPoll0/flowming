# Contributing to Flowming

Thank you for taking the time to contribute!

## Licensing at a glance

* **Source code:** Creative Commons Attribution–NonCommercial–ShareAlike 4.0 International (CC BY-NC-SA 4.0)
* **Documentation:** Creative Commons Attribution–NonCommercial–NoDerivatives 4.0 International (CC BY-NC-ND 4.0)

For full terms see the LICENSE file in this repository.

When you open your first pull request you'll be asked to sign our **Contributor License Agreement (CLA)**. The CLA lets us include your code in the project and, if needed, redistribute it under the project's license.

## Development Workflow

1. **Fork** the repository and create a descriptive branch (`feature/your-feature`, `fix/issue-123`, etc.).
2. **Run the tests** with `npm test`; make sure everything passes.
3. **Commit** using clear messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification (see below).
4. **Open a pull request** and describe what you changed/why. Reference related issues.
5. **Sign the CLA** when prompted.
6. A maintainer will review your PR—please reply to any comments and update as needed.

### Conventional Commits Cheat-Sheet

```
<type>(optional-scope): <short summary>

<body>

<footer>
```

Typical **type** values:

* **feat**: A new feature
* **fix**: A bug fix
* **docs**: Documentation only changes
* **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
* **refactor**: Code change that neither fixes a bug nor adds a feature
* **test**: Adding or correcting tests
* **chore**: Maintenance tasks (build, CI, tooling)

Examples:

```
feat(ui): add dark-mode toggle
fix(flow): prevent crash when deleting node
```

Thanks again for helping us improve Flowming!