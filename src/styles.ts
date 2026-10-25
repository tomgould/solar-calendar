// Fonts and styles, shared by the calendar and the privacy, terms and
// disclaimer pages, which load only this.
// The design kit, installed in public/kit from dealmobile-design-kit with its
// tools/install.sh: tokens (with the self-hosted Schibsted Grotesk and Libre
// Caslon), base and components. Bundled here, so every page keeps one stylesheet
import '../public/kit/css/tokens.css';
import '../public/kit/css/base.css';
import '../public/kit/css/kit.css';
// The Latin Extended letters the kit's Latin files lack
import './styles/fonts.css';
// Andika for IPA pronunciations, which the kit's typefaces lack; it downloads only when one is shown
import '@fontsource/andika/400.css';
// Scripts the kit's typefaces lack, for packs' original forms; each downloads only when its letters appear
import '@fontsource/vazirmatn/arabic-400.css';
import '@fontsource/noto-sans-coptic/coptic-400.css';
// Greek letters, such as the θ used in IPA pronunciations
import '@fontsource/noto-sans/greek-400.css';
// System fonts shaped like the kit's typefaces, for the moment before they arrive
import './styles/fallbacks.css';
import './styles/app.css';
