# SFSpeckit E2E Framework

<div align="center">
  <h3>An Enterprise-Grade, Zero-Dependency, AI-Driven Salesforce Testing Framework</h3>
</div>

---

## 🚀 What is SFSpeckit E2E?

SFSpeckit E2E is a next-generation Salesforce test automation framework built on top of [Playwright](https://playwright.dev/). It is designed specifically to solve the most notoriously difficult, brittle, and historically "un-testable" parts of the Salesforce platform.

Unlike traditional automation tools that require developers to write fragile scripts or QA teams to record-and-playback, SFSpeckit uses an **AI-driven JSON Domain Specific Language (DSL)**. 

QA testers provide natural language or markdown feature stories, the AI generates a structured JSON execution plan, and a static, hardened Playwright execution engine runs the test.

## 🎯 Key Capabilities

*   **100% Deterministic Execution**: AI doesn't write raw Playwright code, eliminating hallucination risks. It generates safe JSON.
*   **Runtime Auto-Healing (Smart Retries)**: Intelligently recovers from transient UI issues (hidden viewport elements) and Salesforce database row locks mid-flight using randomized jitter and scroll injections.
*   **Data Isolation by Design**: Enforces unique, timestamped data boundaries across parallel execution workers to mathematically prevent data conflicts.
*   **Shadow-DOM Piercing Locators**: Natively tests complex Custom Lightning Web Components (LWCs) without breaking when Salesforce updates SLDS classes.
*   **Auto-Navigation & Chaos Handlers**: Automatically hunts for fields in hidden tabs and kills Salesforce popups (like Guidance Center) dynamically so tests never flake.
*   **Iframe Context Engine**: Seamlessly bridges the gap between modern Lightning UI and legacy Visualforce/Setup iframes.
*   **Cross-Browser Cloud Execution**: Natively integrates with BrowserStack to test Experience Cloud and mobile layouts across real `chrome-cloud`, `safari-cloud`, and `mobile-ios` devices.
*   **Spy Agent**: A Playwright MCP agent that autonomously logs into custom managed packages (like CPQ or Conga), maps the DOM, and generates bespoke TypeScript Page Objects automatically.
*   **Playwright Codegen Integration**: Automatically captures undocumented legacy business processes using Playwright's native Record & Playback tool. Bypasses MFA/SSO securely via JWT and translates raw clicks into the safe SFSpeckit JSON DSL.
*   **Docs-as-Code Test Management**: Replaces expensive third-party tools like TestRail. The framework natively generates traceability matrices, manual scripts, and auditor-ready Release Notes directly into your Git repository.
*   **CI/CD Ready**: Fully compatible with GitHub Actions for headless, secure integration testing.

## 🏆 Head-to-Head vs. Legacy Tools (e.g., Provar)

| Feature / Dimension | SFSpeckit E2E | Legacy Tools | Winner |
| :--- | :--- | :--- | :--- |
| **Cost** | **$0 (Open Source)** | Expensive Licensing | 🏆 SFSpeckit |
| **Setup Time** | ~30 minutes | Days to Weeks | 🏆 SFSpeckit |
| **Test Authoring** | AI + JSON DSL (Instant) | Manual / Record & Playback | 🏆 SFSpeckit |
| **Data Management** | Data Tree Import + CSV | CSV / Excel Data Mapping | 🏆 SFSpeckit |
| **CI/CD Integration**| Native Playwright (Fast) | Heavy CLI | 🏆 SFSpeckit |
| **Cross-Browser/Mobile**| Native BrowserStack Cloud | Complex remote node setup | 🏆 SFSpeckit |
| **Salesforce Coverage**| 100% (Spy Agent + Iframes) | 100% (Full platform) | 🤝 Tie |

## 🛠 Getting Started

This repository contains the framework engine and the AI skill definitions required to run it via an AI Agent.

**1. Clone the Repository**
```bash
git clone https://github.com/ysumanth06/Sf-Spec-Kit---Qa-Automation.git
```

**2. Setup the Environment**
Navigate to the framework engine and install dependencies:
```bash
cd skills/sfspeckit-e2e/framework
npm install
npx playwright install chromium
```

**3. Configure your Org**
Copy `.env.example` to `.env` and provide your Salesforce Server-to-Server JWT integration credentials.

**4. Run Health Check**
```bash
npm run qa:doctor
```

## 📖 Comprehensive Documentation

For a deep dive into the repository structure, how to configure Personas, how to utilize the 4 AI Testing Modes (`story`, `baseline`, `regression`, `discover`), and how to set up GitHub Actions, please read the full Technical Architecture guide:

👉 [**SFSpeckit E2E Technical Architecture & User Guide**](./sfspeckit_e2e_technical_architecture.md)
