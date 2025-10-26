/**
 * CalendarProcessor - Handles conversions for a fixed 13x28 calendar system.
 * - 13 months, 28 days each (4 weeks starting Monday).
 * - Year starts on the first Monday on or after the Vernal Equinox.
 * - Includes 'Year Day' (Day 365) and 'Leap Day' (Day 366).
 * - Uses fetched Vernal Equinox data to determine the anchor point.
 */
class CalendarProcessor {
  constructor() {
    // Fixed 13-month structure
    this.fixedMonths = [
      { name: 'March', days: 28, startDay: 1 },
      { name: 'April', days: 28, startDay: 29 },
      { name: 'May', days: 28, startDay: 57 },
      { name: 'June', days: 28, startDay: 85 },
      { name: 'July', days: 28, startDay: 113 },
      { name: 'August', days: 28, startDay: 141 },
      { name: 'September', days: 28, startDay: 169 },
      { name: 'October', days: 28, startDay: 197 },
      { name: 'November', days: 28, startDay: 225 },
      { name: 'December', days: 28, startDay: 253 },
      { name: 'January', days: 28, startDay: 281 },
      { name: 'February', days: 28, startDay: 309 },
      { name: 'Sol', days: 28, startDay: 337 } // Ends on day 364
    ];
    this.totalDaysInMonths = 364;

    this.gregorianMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    this.dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    this.vernalEquinoxData = {}; // Populated by loadVernalEquinoxData
    this.solarYearStartDateCache = {}; // Cache for Gregorian start date of each Solar year
    this.astronomicalEventCache = {}; // Cache for approximate astronomical event dates (Gregorian)
  }

  /**
   * Load vernal equinox data from JSON file. Crucial for finding the year's anchor point.
   */
  async loadVernalEquinoxData() {
    try {
      const response = await fetch('spring_equinox_dates_0001_to_2100.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      this.vernalEquinoxData = data.reduce((acc, entry) => {
        const year = parseInt(entry.year, 10);
        if (year >= 1899 && year <= 2101) { // Need prev/next year data
          const parts = entry.date.split('-');
          const yearStr = String(entry.year).padStart(4, '0');
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          acc[year] = `${yearStr}-${month}-${day}`;
        }
        return acc;
      }, {});
      console.log("Vernal Equinox data loaded successfully.");
      // Pre-calculate start dates after loading
      this.preCalculateYearStartDates();

    } catch (error) {
      console.error('Error loading vernal equinox data, using simplified fallback:', error);
      this._useFallbackEquinoxData();
       this.preCalculateYearStartDates(); // Calculate start dates even with fallback
    }
  }

  /**
   * Fallback equinox data (simple approximation) if JSON fetch fails.
   */
  _useFallbackEquinoxData() {
    console.warn("Using fallback Vernal Equinox data (approximation).");
    for (let year = 1899; year <= 2101; year++) {
        let day = (year >= 2044 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) || year === 2100 ? 19 : 20;
        if (year === 2100) day = 19;
        this.vernalEquinoxData[year] = `${year}-03-${String(day).padStart(2, '0')}`;
    }
  }

  /**
   * Calculate the Gregorian date (UTC Date object) corresponding to Day 1, Month 1
   * of a given Solar year. This is the first Monday on or after the Vernal Equinox.
   */
  getSolarYearStartDate(solarYear) {
      // Return cached value if available
      if (this.solarYearStartDateCache[solarYear]) {
          return this.solarYearStartDateCache[solarYear];
      }

      const vernalEquinoxStr = this.vernalEquinoxData[solarYear];
      if (!vernalEquinoxStr) {
          console.error(`Missing Vernal Equinox data for year ${solarYear}. Cannot calculate start date.`);
          return null;
      }

      const equinoxDate = new Date(vernalEquinoxStr + 'T00:00:00Z');
      const dayOfWeek = equinoxDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      let daysToAdd = 0;
      if (dayOfWeek !== 1) { // If equinox is not already a Monday
          daysToAdd = (8 - dayOfWeek) % 7; // Calculate days until next Monday (1-6 days)
      }

      const startDate = new Date(equinoxDate);
      startDate.setUTCDate(equinoxDate.getUTCDate() + daysToAdd);

      // Cache the result
      this.solarYearStartDateCache[solarYear] = startDate;
      return startDate;
  }

   /** Pre-calculate and cache start dates for the relevant range */
   preCalculateYearStartDates() {
       console.log("Pre-calculating Solar year start dates...");
       for (let year = 1900; year <= 2100; year++) {
           this.getSolarYearStartDate(year); // Calculate and cache
       }
       console.log("Finished pre-calculating start dates.");
   }

  /**
   * Determine if a Solar year is a leap year (has 366 days).
   * It's a leap year if the gap between its start date and the next year's start date is 366 days.
   */
  isSolarLeapYear(solarYear) {
    const startDate = this.getSolarYearStartDate(solarYear);
    const nextStartDate = this.getSolarYearStartDate(solarYear + 1);

    if (!startDate || !nextStartDate) {
      console.warn(`Cannot determine leap year status for ${solarYear}: Missing start date data. Falling back.`);
      // Fallback: Check if the *Gregorian* year containing the VE is a leap year. Crude approximation.
      const veYear = parseInt(this.vernalEquinoxData[solarYear]?.substring(0, 4) || solarYear);
      return (veYear % 4 === 0 && veYear % 100 !== 0) || (veYear % 400 === 0);
    }

    const diffTime = Math.abs(nextStartDate - startDate);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); // Use Math.round for robustness

    return diffDays === 366;
  }

  /**
   * Get the Gregorian date (UTC Date object) for a specific day number within the 13x28 structure
   * OR for the special Year Day / Leap Day.
   * solarDayOfYear: 1 to 364 for regular months, 365 for Year Day, 366 for Leap Day.
   */
  getGregorianDateForSolarDay(solarYear, solarDayOfYear) {
    const startDate = this.getSolarYearStartDate(solarYear); // Gregorian date of Month 1, Day 1
    if (!startDate) return null;

    if (solarDayOfYear < 1 || solarDayOfYear > (this.isSolarLeapYear(solarYear) ? 366 : 365)) {
        return null; // Invalid day number
    }

    const targetDate = new Date(startDate);
    targetDate.setUTCDate(startDate.getUTCDate() + solarDayOfYear - 1); // Add days

    return targetDate;
  }

  /**
   * Get Solar date information { monthIndex, day, year, specialDay? }
   * from a Gregorian date (local Date object).
   */
  getSolarDateFromGregorian(gregorianDate) {
    // Convert input Gregorian date to UTC midnight for consistent calculations
    const gDateUTC = new Date(Date.UTC(gregorianDate.getFullYear(), gregorianDate.getMonth(), gregorianDate.getDate()));
    const gYear = gregorianDate.getFullYear(); // Use the Gregorian year as a hint

    // Find the start date of the Solar year potentially containing this Gregorian date
    let solarYear = gYear;
    let solarYearStartDate = this.getSolarYearStartDate(solarYear);

    // If the date is before the calculated start date, it belongs to the previous Solar year
    if (!solarYearStartDate || gDateUTC < solarYearStartDate) {
        solarYear--;
        solarYearStartDate = this.getSolarYearStartDate(solarYear);
        if (!solarYearStartDate) {
            console.error(`Cannot find start date for Solar year ${solarYear}`);
            return null; // Cannot proceed
        }
    }

    // Calculate the number of days passed since the start of this Solar year (0-based index)
    const diffTime = gDateUTC - solarYearStartDate;
    const daysSinceSolarYearStart = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // 0-based

    const isLeap = this.isSolarLeapYear(solarYear);

    // Check for special days first
    if (daysSinceSolarYearStart === 364) { // Day 365
        return { monthIndex: -1, day: 1, year: solarYear, specialDay: 'Year Day', monthName: 'Year Day', monthNumber: null };
    } else if (isLeap && daysSinceSolarYearStart === 365) { // Day 366
        return { monthIndex: -1, day: 2, year: solarYear, specialDay: 'Leap Day', monthName: 'Leap Day', monthNumber: null };
    } else if (daysSinceSolarYearStart >= (isLeap ? 366 : 365)) {
        // This date actually falls into the *next* solar year (should have been caught earlier, but safety check)
        console.warn("Date calculation overflowed into next solar year, re-evaluating.");
         return this.getSolarDateFromGregorian(gregorianDate, solarYear + 1); // Re-run with hint
    } else if (daysSinceSolarYearStart < 0) {
        console.error("Negative day difference calculated, logic error.");
        return null;
    }


    // Regular day within the 13 months
    const monthIndex = Math.floor(daysSinceSolarYearStart / 28);
    const dayOfMonth = (daysSinceSolarYearStart % 28) + 1; // 1-based day

    if (monthIndex < 0 || monthIndex >= this.fixedMonths.length) {
         console.error(`Invalid month index calculated: ${monthIndex}`);
         return null;
    }

    const month = this.fixedMonths[monthIndex];
    return {
      monthIndex: monthIndex,
      month: month, // Keep ref if needed
      day: dayOfMonth,
      year: solarYear,
      monthName: month.name, // Use the new name
      monthNumber: monthIndex + 1, // 1-based month number
      specialDay: null // Not a special day
    };
  }

  /**
   * Format month title for the fixed Solar calendar view.
   * Example: { main: "March / (1/13)", sub: "Gregorian: Mar-Apr" }
   */
  formatSolarMonthTitle(monthIndex, solarYear) {
      if (monthIndex < 0 || monthIndex >= this.fixedMonths.length) return { main: 'Invalid Month', sub: '' };
      const month = this.fixedMonths[monthIndex];

      // Estimate Gregorian range (less precise now)
      const startDayOfYear = month.startDay;
      const endDayOfYear = startDayOfYear + month.days - 1;
      const gregStartDate = this.getGregorianDateForSolarDay(solarYear, startDayOfYear);
      const gregEndDate = this.getGregorianDateForSolarDay(solarYear, endDayOfYear);

      let gregRange = '';
      if (gregStartDate && gregEndDate) {
          const startM = this.gregorianMonths[gregStartDate.getUTCMonth()].substring(0, 3);
          const endM = this.gregorianMonths[gregEndDate.getUTCMonth()].substring(0, 3);
          gregRange = startM === endM ? startM : `${startM}-${endM}`;
      }

      return {
          main: `${month.name} / (${monthIndex + 1}/13)`,
          sub: `Gregorian: ${gregRange}`
      };
  }


  /**
   * Format month title for Gregorian calendar view (shows corresponding fixed calendar info).
   * Example: { main: "March / Solar: March", sub: "Month 1/13" }
   */
  formatGregorianMonthTitle(gregorianMonthIndex, gregorianYear) {
    if (gregorianMonthIndex < 0 || gregorianMonthIndex > 11) return { main: 'Invalid Month', sub: '' };
    const gregorianMonthName = this.gregorianMonths[gregorianMonthIndex];

    // Find which Solar months overlap significantly
    // Get start and end dates of the Gregorian month
    const gregMonthStartDate = new Date(Date.UTC(gregorianYear, gregorianMonthIndex, 1));
    const gregMonthEndDate = new Date(Date.UTC(gregorianYear, gregorianMonthIndex + 1, 0)); // Day 0 of next month = last day of current

    // Convert start and end to Solar dates
    const solarStartInfo = this.getSolarDateFromGregorian(gregMonthStartDate);
    const solarEndInfo = this.getSolarDateFromGregorian(gregMonthEndDate);

    let solarInfoStr = '';
    let solarNumStr = '';

    if (solarStartInfo && solarEndInfo) {
        const startMonthName = solarStartInfo.monthName || solarStartInfo.specialDay;
        const endMonthName = solarEndInfo.monthName || solarEndInfo.specialDay;

        if (startMonthName === endMonthName) {
            solarInfoStr = startMonthName;
            if (solarStartInfo.monthNumber) solarNumStr = `${solarStartInfo.monthNumber}/13`;
        } else {
             solarInfoStr = `${startMonthName}-${endMonthName}`;
             if(solarStartInfo.monthNumber && solarEndInfo.monthNumber) {
                 solarNumStr = `${solarStartInfo.monthNumber}-${solarEndInfo.monthNumber}/13`;
             } else if (solarStartInfo.monthNumber) {
                 solarNumStr = `${solarStartInfo.monthNumber}/13+`;
             } else if (solarEndInfo.monthNumber) {
                  solarNumStr = `+${solarEndInfo.monthNumber}/13`;
             }
        }
    }

    return {
      main: `${gregorianMonthName} / Solar: ${solarInfoStr}`,
      sub: solarNumStr ? `Month(s) ${solarNumStr}` : ''
    };
  }

  // --- Methods below are less dependent on the core calendar structure ---
  // --- but kept for compatibility and astronomical event display   ---

  /**
   * Get approximate astronomical event dates for a given Gregorian year.
   * Uses the actual loaded Vernal Equinox date. Other dates are approximations.
   */
  getAstronomicalEvents(year) {
    if (this.astronomicalEventCache[year]) {
      return this.astronomicalEventCache[year];
    }
    const vernalEquinoxStr = this.vernalEquinoxData[year];
    const vernalEquinoxDate = vernalEquinoxStr ? new Date(vernalEquinoxStr + 'T00:00:00Z') : new Date(Date.UTC(year, 2, 20));

    const events = {
      vernalEquinox: vernalEquinoxDate,
      summerSolstice: new Date(Date.UTC(year, 5, 21)), // Approx June 21
      autumnEquinox: new Date(Date.UTC(year, 8, 22)), // Approx Sep 22
      winterSolstice: new Date(Date.UTC(year, 11, 21)) // Approx Dec 21
    };
    this.astronomicalEventCache[year] = events;
    return events;
  }

  /**
   * Check if a specific Gregorian date (UTC Date object) matches an approximate astronomical event.
   */
  checkAstronomicalEvent(date, year) {
    const events = this.getAstronomicalEvents(year);
    const dateStr = this.toISODateString(date);

    for (const [key, eventDate] of Object.entries(events)) {
        if (!eventDate || isNaN(eventDate.getTime())) continue; // Skip if event date is invalid
        const eventDateStr = this.toISODateString(eventDate);
        if (dateStr === eventDateStr) {
            const icons = { vernalEquinox: '🌱', summerSolstice: '☀️', autumnEquinox: '🍂', winterSolstice: '❄️' };
            const classes = { vernalEquinox: 'vernal-equinox', summerSolstice: 'summer-solstice', autumnEquinox: 'autumn-equinox', winterSolstice: 'winter-solstice' };
            return { icon: icons[key], class: classes[key] };
        }
    }
    return null;
  }

  /**
   * Format a Date object to an ISO date string (YYYY-MM-DD) using UTC values.
   */
  toISODateString(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

