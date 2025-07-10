<p align="center">
  <a href="https://github.com/MrPoll0/flowming">
    <img src="flowming/public/logo.svg" alt="Flowming Logo" width="400">
  </a>
</p>

<p align="center">
  <a href="https://github.com/MrPoll0/flowming/actions/workflows/test.yml"><img src="https://github.com/MrPoll0/flowming/actions/workflows/test.yml/badge.svg" alt="Build Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg" alt="License"></a>
</p>

Interactive web application for designing, executing and debugging algorithms using standard flowchart notation.

Flowming helps beginners focus on computational thinking before wrestling with the syntax of a textual language.  Students build flowcharts visually, run them step-by-step, watch variables change in real time and export the equivalent Python code – all from their browser.

---

## ✨ Key features

* Visual editor powered by React Flow: drag-and-drop blocks, connect them and rearrange freely.
* Strongly-typed execution engine with breakpoint support, variable watch panel and execution trace.
* Automatic code generation (Python 3) showing the 1-to-1 mapping from flowchart to text.
* Exercises bank & auto-evaluation.
* Real-time collaboration (peer-to-peer WebRTC): edit the same diagram together *(experimental)*.
* Modern SPA built with React 19, TypeScript, Vite and Tailwind.

---

## 🚀 Getting started

### Prerequisites

* Node.js **>= 18** (https://nodejs.org)
* Git (to clone the repo)  
  *(all other dependencies are installed via **npm**)*

### 1. Clone & install

```bash
git clone https://github.com/MrPoll0/flowming.git
cd flowming
npm install # Installs dependencies for all packages
```

### 2. Run development servers

To start the Vite dev server for the main application and the WebRTC signaling server simultaneously, run:
```bash
# From the project root
npm run dev
```
This will start the `flowming` app (usually on `http://localhost:5173`) and the collaboration server.

### 3. Production build

```bash
# From the project root
npm run build    # Builds the flowming app to flowming/dist/
npm run preview  # Serves the production build locally
```

### 4. Test

```bash
# From the project root
npm run test      # Runs Vitest unit tests for flowming
```

---

## 🗂️ Repository layout (short)

```
.
├── flowming/           # Main React application
│   └── src/
│       ├── components/   # React UI & flowchart nodes
│       ├── context/      # React context providers (state)
│       ├── models/       # Core domain classes (Variable, Expression, …)
│       └── utils/        # Execution engine, code generation, helpers
├── y-webrtc-server/    # WebSocket-based WebRTC signaling server
│   └── server.js
├── README.md           # This file
├── LICENSE             # CC BY-NC-SA 4.0
├── CONTRIBUTING.md
└── CLA.md
```

---

## 🤝 Contributing

We love contributions!  Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, coding style and commit conventions.  
The first time you open a pull request you will be asked to sign our **Contributor License Agreement (CLA)** via CLA-Assistant.

---

## 📚 Project Thesis

This repository includes the full bachelor's thesis (Spanish, TFG) that motivated the project, detailing state-of-the-art, design decisions and user evaluation.

*Title:* "Aplicación web para el diseño y ejecución de diagramas de flujo"  
*Author:* Daniel Pérez Fernández  
*Advisor*: Álvaro Montero Montes  
*Grade*: 10 out of 10     
**Universidad Carlos III de Madrid**, 2025    

You can find the PDF and additional assets in the `docs/` release section.

---

## 📜 License & trademarks

* **Source code**: Creative Commons **Attribution-NonCommercial-ShareAlike 4.0** International (CC BY-NC-SA 4.0).  
  You may study, fork and improve Flowming for non-commercial purposes, but must share derivatives under the same license.
* **Documentation** (thesis, README, etc.): Creative Commons **Attribution-NonCommercial-NoDerivatives 4.0** (CC BY-NC-ND 4.0).
* The name **"Flowming"** and the logo are **not** part of the CC license and remain protected trademarks of the author.

See [LICENSE](LICENSE) for the full text.

---

## ❤️ Acknowledgements

Built with:

* React & TypeScript
* React Flow – amazing node-based UI toolkit
* Yjs – CRDT magic for collaboration
* shadcn/ui & Lucide icons
* Vite & Vitest