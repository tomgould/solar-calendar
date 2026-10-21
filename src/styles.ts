// Fonts and styles, shared by the calendar and the privacy, terms and
// disclaimer pages, which load only this
import '@fontsource-variable/big-shoulders/opsz.css';
import '@fontsource/andika/400.css';
import '@fontsource/andika/400-italic.css';
import '@fontsource/andika/700.css';
// Scripts Andika lacks, for packs' original forms; each downloads only when its letters appear
import '@fontsource/vazirmatn/arabic-400.css';
import '@fontsource/noto-sans-coptic/coptic-400.css';
// Greek letters Andika lacks, such as the θ used in IPA pronunciations
import '@fontsource/noto-sans/greek-400.css';
// Arial and Roboto shaped like Andika, for the moment before Andika arrives
import './styles/fallbacks.css';
import './styles/app.css';
