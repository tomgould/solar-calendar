# Solar & Gregorian Calendar System

## Overview
A comprehensive dual-calendar system displaying both Solar (Persian) and Gregorian calendars with full astronomical event tracking and cross-calendar linking.

## Files

### HTML Files
- **solar-calendar.html** - Solar calendar with Gregorian date references
- **gregorian-calendar.html** - Gregorian calendar with Solar date references

### JavaScript
- **calendar-processor.js** - CalendarProcessor class handling all date conversions and calculations

### CSS
- **calendar-styles.css** - Shared styling for both calendars

## Features

### Solar Calendar Display Format
Each month shows:
```
First Month / March-April
Farvardin / 1/12
```
- **English Name**: First Month, Second Month, etc. (ordinal position)
- **Gregorian Months**: Corresponding Gregorian months that overlap
- **Persian Name**: Traditional Persian month name (Farvardin, Ordibehesht, etc.)
- **Month Number**: Position in solar year (1/12, 2/12, etc.)

### Gregorian Calendar Display Format
Each month shows:
```
March / Farvardin-Ordibehesht
Solar Months: 1-2/12
```
- **Gregorian Month**: Standard month name
- **Solar Months**: Corresponding Persian month names
- **Solar Numbers**: Position numbers of the solar months

### Astronomical Events
Both calendars display:
- 🌱 **Vernal Equinox** (March 20) - Spring begins
- ☀️ **Summer Solstice** (June 21) - Longest day
- 🍂 **Autumn Equinox** (September 22) - Fall begins
- ❄️ **Winter Solstice** (December 21) - Shortest day

Features:
- Clickable event cards with hover tooltips
- Special day highlighting with colored borders
- Event badges on calendar days
- Direct navigation to event dates

### Cross-Calendar Linking
- **Click month headings** to jump to the corresponding month in the other calendar
- **Click any day** in one calendar to view it in the other calendar
- URL parameters enable deep linking between calendars
- Smooth animations and highlighting
- Bidirectional navigation maintains year context

**Month Heading Links:**
- Solar calendar month → Opens first corresponding Gregorian month
- Gregorian calendar month → Opens first corresponding Solar month

**Day Links:**
- Solar calendar day → Opens exact date in Gregorian calendar
- Gregorian calendar day → Opens exact date in Solar calendar

### Month Name Origins

The Persian month names come from the **Solar Hijri calendar** (Zoroastrian tradition):

1. **Farvardin** - Guardian spirits
2. **Ordibehesht** - Best righteousness
3. **Khordad** - Perfection
4. **Tir** - Rain/water deity
5. **Mordad** - Immortality
6. **Shahrivar** - Desirable dominion
7. **Mehr** - Love/affection
8. **Aban** - Waters
9. **Azar** - Fire
10. **Dey** - Creator
11. **Bahman** - Good mind
12. **Esfand** - Holy devotion

## CalendarProcessor Class

The `CalendarProcessor` class provides:

### Properties
- `solarMonths` - Complete solar month data with English names, Persian names, and Gregorian mappings
- `gregorianMonths` - Standard month names
- `vernalEquinoxData` - Vernal equinox dates for years 1900-2100

### Key Methods

#### Date Conversion
```javascript
getGregorianDateForSolarDay(solarYear, solarDay)
// Convert solar day number to Gregorian date

getSolarDateFromGregorian(gregorianDate, gregorianYear)
// Convert Gregorian date to solar calendar info
```

#### Astronomical Events
```javascript
getAstronomicalEvents(year)
// Get all 4 astronomical events for a year

checkAstronomicalEvent(date, year)
// Check if a date is an astronomical event
```

#### Formatting
```javascript
formatSolarMonthTitle(monthIndex)
// Returns: { main: "First Month / March-April", sub: "Farvardin / 1/12" }

formatGregorianMonthTitle(gregorianMonthIndex)
// Returns: { main: "March / Farvardin-Ordibehesht", sub: "Solar Months: 1-2/12" }
```

## Usage

### Basic Setup
All three files must be in the same directory:
```
solar-calendar.html
gregorian-calendar.html
calendar-processor.js
calendar-styles.css
```

### Standalone Use
Each HTML file works independently and includes all necessary JavaScript inline.

### Year Selection
Both calendars support years 1900-2100 through the year input control.

### Theme Toggle
- Light/Dark mode toggle
- Preference saved in localStorage
- System preference detection

### Navigation
- Previous/Next month buttons
- Smooth scrolling between months
- Active month indicator
- **Clickable month headings** - hover to see link effect, click to navigate to other calendar
- Month headings show hover state to indicate they are clickable

## Technical Details

### Solar Calendar
- Based on astronomical observations
- Starts at Vernal Equinox (Nowruz - Persian New Year)
- First 6 months: 31 days each
- Next 5 months: 30 days each  
- Last month (Esfand): 29 days (30 in leap years)

### Date Calculations
- Solar year starts March 20/21 (Vernal Equinox)
- Leap years follow Gregorian leap year rules for simplicity
- Astronomical event dates are approximations

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ JavaScript features
- CSS Grid and Flexbox layouts
- CSS custom properties (variables)

## Customization

### Styling
Modify `calendar-styles.css` to customize:
- Color schemes (CSS custom properties in `:root`)
- Layout dimensions
- Typography
- Animation timing

### Date Processing
Extend `CalendarProcessor` class to:
- Add more calendar systems
- Improve astronomical event accuracy
- Add cultural holidays
- Implement custom date calculations

## License
This calendar system is provided as-is for educational and personal use.

## Credits
Solar calendar based on the Persian Solar Hijri calendar system.
Astronomical event calculations are approximate for demonstration purposes.
