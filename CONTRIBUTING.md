# 🤝 Contributing to Solar Calendar

Thanks for your interest in contributing to the Solar Calendar project! 🌞  
We welcome ideas, improvements, and collaboration from developers, designers, time nerds, and calendar reformers alike.

---

## 🛠️ Ways You Can Contribute

- 🏷️ Add a month name pack (one JSON file in `src/names/packs/`, see the README)
- ✨ Improve design, layout, or mobile responsiveness
- 🔍 Add festivals and holidays
- 🧪 Add tests or validation tools
- 📝 Improve documentation or translations

---

## 📐 Project Standards

Please follow these conventions when contributing:

- Write clean, readable TypeScript, HTML, and CSS
- Do date arithmetic on day numbers (`src/core/days.ts`), never on `Date` objects
- Cite a source for every month name meaning, and mark disputed ones as uncertain
- Use descriptive commit messages
- Prefer semantic HTML
- Keep styling responsive and accessible
- Run `npm run typecheck` and `npm test` before opening a pull request 😅

---

## 🧪 Running the Project Locally

1. Clone the repo:
   ```bash
   git clone https://github.com/tomgould/solar-calendar.git
   cd solar-calendar
   ```

2. Install and start the dev server:
   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:5173 in your browser.

---

## 🧾 License

By contributing, you agree that your code will be licensed under the [GNU GPL v3.0](https://www.gnu.org/licenses/gpl-3.0.html).

---

## 🙋 Questions?

Open an [issue](https://github.com/tomgould/solar-calendar/issues) and we’ll get back to you!

---

Thanks again!  
– Tom ☀️
