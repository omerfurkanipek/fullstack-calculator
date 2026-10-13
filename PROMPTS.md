# Prompts

The assignment says any AI tooling may be used and asks for the prompts to be shared. This project was built with **Claude Code** (Anthropic's agentic CLI, Claude Opus model) running in my terminal. It worked directly in this repository: it wrote code, ran `go test`, `vitest`, the linters and the dev servers, and checked the UI in a headless browser.

## Prompt 1 — the only top-level instruction

I pasted the full assignment text from the Greenhouse page (identical to the brief: objective, functional and non-functional requirements, constraints, deliverables, instructions), attached two screenshots of that page and the path to my CV, and wrote (originally in Turkish):

> **Original:** "bu adreste benim özgeçmişim var ve bununla bir iş başvurusunda bulundum ve benden şu taskı istediler: *[assignment text]* … ultrathink düşün planla ve en profesyonel aksiyonu al"
>
> **English:** "My CV is at this path. I applied for a job with it and they asked me to do the following task: *[assignment text]* … Think hard, plan, and take the most professional course of action."

## How the work was steered

The agent planned the architecture, then built and verified it in small steps. Decisions made along the way, all visible in the commit history and the README:

- Go with the standard library only; a pure `calculator` domain package separate from the `httpapi` transport layer.
- One endpoint per operation, strict JSON decoding, stable error codes, and 400 vs 422 semantics.
- Rounding results to 15 significant digits after a smoke test showed `0.1 + 0.2 = 0.30000000000000004`. That isn't acceptable for a payments company, and the trade-off against true decimal arithmetic is documented.
- A React reducer that describes API calls as data (MVI-style), so all calculator logic is pure and unit-tested.
- Bugs found through the tests and browser checks, then fixed:
  - `±` followed by a digit lost the sign;
  - a mobile media query overrode the error-message font size;
  - the empty field name in errors for array bodies;
  - `MaxFloat64` overflowing when rounded.
- A Dockerfile verified in CI, since Docker isn't installed on my machine.

Any follow-up prompts I gave are listed below.

## Follow-up prompts

1. *(with a screenshot of the app in the browser)* — Original: "bu localhosta mı çalışsın istiyorlar bu şekilde" · English: "Do they want it to run on localhost like this?" (Answer: yes. The brief asks for a repository plus setup instructions, so reviewers run it locally with Docker or `go run` + `npm run dev`. No hosting is required.)
2. *(with a screenshot of the Greenhouse submission form)* — Original: "şimdi ben bu projeyi nasıl göndereceğim onlara?" · English: "How do I send this project to them now?" (Then chose the repository name `fullstack-calculator` and the commit e-mail.)
3. *(with a screenshot of the GitHub repository page)* — Original: "harika ben şimdi direkt bu linki mi atacağım onlara?" · English: "Great, so do I just send them this link?"
