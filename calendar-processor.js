/**
 * CalendarProcessor - Unified calendar date processing class
 * Handles Solar (Persian/Solar Hijri), Gregorian calendar conversions and astronomical events.
 * Adheres to the Solar Hijri rules: First 6 months = 31 days, next 5 = 30 days, last = 29/30 days.
 * Uses fetched Vernal Equinox data as the start of the Solar year.
 */
class CalendarProcessor {
  constructor() {
    // Solar month definitions adhering to Solar Hijri structure
    this.solarMonths = [
      { englishName: 'First Month', persianName: 'Farvardin', season: 'Spring', days: 31, startDay: 1, gregorianMonths: ['March', 'April'] },
      { englishName: 'Second Month', persianName: 'Ordibehesht', season: 'Spring', days: 31, startDay: 32, gregorianMonths: ['April', 'May'] },
      { englishName: 'Third Month', persianName: 'Khordad', season: 'Spring', days: 31, startDay: 63, gregorianMonths: ['May', 'June'] },
      { englishName: 'Fourth Month', persianName: 'Tir', season: 'Summer', days: 31, startDay: 94, gregorianMonths: ['June', 'July'] },
      { englishName: 'Fifth Month', persianName: 'Mordad', season: 'Summer', days: 31, startDay: 125, gregorianMonths: ['July', 'August'] },
      { englishName: 'Sixth Month', persianName: 'Shahrivar', season: 'Summer', days: 31, startDay: 156, gregorianMonths: ['August', 'September'] },
      { englishName: 'Seventh Month', persianName: 'Mehr', season: 'Autumn', days: 30, startDay: 187, gregorianMonths: ['September', 'October'] },
      { englishName: 'Eighth Month', persianName: 'Aban', season: 'Autumn', days: 30, startDay: 217, gregorianMonths: ['October', 'November'] },
      { englishName: 'Ninth Month', persianName: 'Azar', season: 'Autumn', days: 30, startDay: 247, gregorianMonths: ['November', 'December'] },
      { englishName: 'Tenth Month', persianName: 'Dey', season: 'Winter', days: 30, startDay: 277, gregorianMonths: ['December', 'January'] },
      { englishName: 'Eleventh Month', persianName: 'Bahman', season: 'Winter', days: 30, startDay: 307, gregorianMonths: ['January', 'February'] },
      { englishName: 'Twelfth Month', persianName: 'Esfand', season: 'Winter', days: 29, startDay: 337, gregorianMonths: ['February', 'March'] } // Base days = 29
    ];

    this.gregorianMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    this.dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    this.vernalEquinoxData = {}; // Populated by loadVernalEquinoxData
    this.astronomicalEventCache = {}; // Cache for approximate event dates
  }

  /**
   * Load vernal equinox data from JSON file. This data defines the start of each Solar year.
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
        // Only store data within the relevant range for the app
        if (year >= 1899 && year <= 2101) { // Need prev/next year for calculations near year boundaries
          // Ensure date format is consistently YYYY-MM-DD
          const parts = entry.date.split('-');
          const yearStr = String(entry.year).padStart(4, '0'); // Use the year from the entry
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          acc[year] = `${yearStr}-${month}-${day}`;
        }
        return acc;
      }, {});
      console.log("Vernal Equinox data loaded successfully.");

    } catch (error) {
      console.error('Error loading vernal equinox data, using simplified fallback:', error);
      this._useFallbackEquinoxData(); // Use approximation if fetch fails
    }
  }

  /**
   * Fallback equinox data (simple approximation) if JSON fetch fails.
   */
  _useFallbackEquinoxData() {
    console.warn("Using fallback Vernal Equinox data (approximation).");
    for (let year = 1899; year <= 2101; year++) {
        // Approximate as March 20th, adjust slightly for known shifts post-2044
        let day = (year >= 2044 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) || year === 2100 ? 19 : 20;
        // Exception for 2100 (not a leap year, but equinox shifts)
        if (year === 2100) day = 19;
        this.vernalEquinoxData[year] = `${year}-03-${String(day).padStart(2, '0')}`;
    }
  }

  /**
   * Determine if a Solar year is a leap year (has 366 days).
   * A Solar year is a leap year if the period between its Vernal Equinox
   * and the *next* year's Vernal Equinox is 366 days.
   */
  isSolarLeapYear(solarYear) {
    const startEquinoxStr = this.vernalEquinoxData[solarYear];
    const nextEquinoxStr = this.vernalEquinoxData[solarYear + 1];

    if (!startEquinoxStr || !nextEquinoxStr) {
      console.warn(`Cannot determine leap year status for ${solarYear}: Missing equinox data. Falling back to Gregorian check.`);
      // Fallback: Approximate using Gregorian leap year rules for the year the Solar year starts in.
      return (solarYear % 4 === 0 && solarYear % 100 !== 0) || (solarYear % 400 === 0);
    }

    const startDate = new Date(startEquinoxStr + 'T00:00:00Z');
    const nextStartDate = new Date(nextEquinoxStr + 'T00:00:00Z');

    // Calculate difference in days
    const diffTime = Math.abs(nextStartDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays === 366;
  }

  /**
   * Get the number of days in a specific Solar month for a given Solar year.
   */
  getDaysInSolarMonth(solarYear, monthIndex) {
      if (monthIndex < 0 || monthIndex > 11) return 0;
      const month = this.solarMonths[monthIndex];
      // Check if it's the last month (Esfand) and if the year is a leap year
      if (monthIndex === 11 && this.isSolarLeapYear(solarYear)) {
          return 30; // Esfand has 30 days in a leap year
      }
      return month.days; // Return standard days (29 for Esfand non-leap)
  }

  /**
   * Get Gregorian date (as UTC Date object) for a specific day number within a Solar year.
   * solarDay is 1-based (1 to 365 or 366).
   */
  getGregorianDateForSolarDay(solarYear, solarDay) {
    const vernalEquinox = this.vernalEquinoxData[solarYear];
    if (!vernalEquinox) {
      console.error(`No vernal equinox data for Solar year ${solarYear}`);
      return null;
    }

    const startDate = new Date(vernalEquinox + 'T00:00:00Z'); // Start date is Day 1
    const targetDate = new Date(startDate);
    targetDate.setUTCDate(startDate.getUTCDate() + solarDay - 1); // Add days

    return targetDate;
  }

  /**
   * Get Solar date information { monthIndex, day, year, ... } from a Gregorian date (local Date object).
   */
  getSolarDateFromGregorian(gregorianDate, gregorianYearHint) {
    // Ensure we have equinox data for the likely year and the one before/after
    let solarYear = gregorianYearHint;
    let vernalEquinox = this.vernalEquinoxData[solarYear];
    let prevVernalEquinox = this.vernalEquinoxData[solarYear - 1];

    if (!vernalEquinox || !prevVernalEquinox) {
        console.error(`Missing equinox data around year ${solarYear} to perform conversion.`);
        // Attempt fallback if data seems sparse
        if (!this.vernalEquinoxData[solarYear+1]) {
             console.warn("Equinox data seems incomplete. Results might be inaccurate near year end.");
        }
       // If critical data missing, cannot proceed reliably
       if(!vernalEquinox && !prevVernalEquinox) return null;
    }

    // Convert input Gregorian date to UTC midnight for consistent comparison
    const gDateUTC = new Date(Date.UTC(gregorianDate.getFullYear(), gregorianDate.getMonth(), gregorianDate.getDate()));

    let startDate;
    // Determine the correct Solar year
    if (vernalEquinox && gDateUTC >= new Date(vernalEquinox + 'T00:00:00Z')) {
      // Date is on or after this Gregorian year's equinox, belongs to this Solar year
      startDate = new Date(vernalEquinox + 'T00:00:00Z');
    } else if (prevVernalEquinox) {
      // Date is before this Gregorian year's equinox, belongs to previous Solar year
      solarYear--;
      startDate = new Date(prevVernalEquinox + 'T00:00:00Z');
    } else {
        // Cannot determine start date
        console.error(`Cannot determine Solar year start date for ${gregorianDate.toDateString()}`);
        return null;
    }

    // Calculate the number of days passed since the start of the Solar year (1-based index)
    const daysDiff = Math.floor((gDateUTC - startDate) / (1000 * 60 * 60 * 24)) + 1;

    return this._getSolarMonthDayFromDayNumber(daysDiff, solarYear);
  }

  /**
   * Helper: Find Solar month and day from the day number within a specific Solar year.
   * dayNumber is 1-based (1 to 365/366).
   */
  _getSolarMonthDayFromDayNumber(dayNumber, solarYear) {
      if (dayNumber < 1 || dayNumber > (this.isSolarLeapYear(solarYear) ? 366 : 365)) {
          return null; // Day number is out of range for the year
      }

      let dayCounter = 0;
      for (let i = 0; i < this.solarMonths.length; i++) {
          const daysInCurrentMonth = this.getDaysInSolarMonth(solarYear, i);
          if (dayNumber <= dayCounter + daysInCurrentMonth) {
              const dayOfMonth = dayNumber - dayCounter;
              const month = this.solarMonths[i];
              return {
                  monthIndex: i,
                  month: month, // Keep original month object ref if needed
                  day: dayOfMonth,
                  year: solarYear,
                  englishName: month.englishName,
                  persianName: month.persianName,
                  monthNumber: i + 1
              };
          }
          dayCounter += daysInCurrentMonth;
      }

      return null; // Should not happen if dayNumber is valid
  }


  /**
   * Get approximate astronomical event dates for a given Gregorian year.
   * Uses the actual loaded Vernal Equinox date. Other dates are approximations.
   */
  getAstronomicalEvents(year) {
    if (this.astronomicalEventCache[year]) {
      return this.astronomicalEventCache[year];
    }

    // Use the *actual* loaded vernal equinox data for the VE
    const vernalEquinoxStr = this.vernalEquinoxData[year];
    const vernalEquinoxDate = vernalEquinoxStr ? new Date(vernalEquinoxStr + 'T00:00:00Z') : new Date(Date.UTC(year, 2, 20)); // Fallback Mar 20

    // Other events are approximations based on common dates
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
    const dateStr = this.toISODateString(date); // Get YYYY-MM-DD string from UTC date

    for (const [key, eventDate] of Object.entries(events)) {
      const eventDateStr = this.toISODateString(eventDate); // Get YYYY-MM-DD string from event UTC date
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

  /**
   * Format month title for Solar calendar view.
   * Example: { main: "First Month / March-April", sub: "Farvardin / 1/12" }
   */
  formatSolarMonthTitle(monthIndex) {
    if (monthIndex < 0 || monthIndex > 11) return { main: 'Invalid Month', sub: '' };
    const month = this.solarMonths[monthIndex];
    return {
      main: `${month.englishName} / ${month.gregorianMonths.join('-')}`,
      sub: `${month.persianName} / ${monthIndex + 1}/12`
    };
  }

  /**
   * Format month title for Gregorian calendar view.
   * Example: { main: "March / Farvardin-Ordibehesht", sub: "Solar: 1-2/12" }
   */
  formatGregorianMonthTitle(gregorianMonthIndex) {
    if (gregorianMonthIndex < 0 || gregorianMonthIndex > 11) return { main: 'Invalid Month', sub: '' };
    const gregorianMonth = this.gregorianMonths[gregorianMonthIndex];
    const correspondingSolar = this.getSolarMonthsForGregorian(gregorianMonthIndex);

    if (correspondingSolar.length === 0) return { main: gregorianMonth, sub: '' };

    const persianNames = correspondingSolar.map(m => m.persianName).join('-');
    const solarNumbers = correspondingSolar.map(m => m.monthNumber).join('-');

    return {
      main: `${gregorianMonth} / ${persianNames}`,
      sub: `Solar: ${solarNumbers}/12`
    };
  }

  /**
   * Get corresponding Solar months that overlap with a given Gregorian month index.
   */
  getSolarMonthsForGregorian(gregorianMonthIndex) {
    if (gregorianMonthIndex < 0 || gregorianMonthIndex > 11) return [];
    const gregorianMonth = this.gregorianMonths[gregorianMonthIndex];
    const result = [];

    for (let i = 0; i < this.solarMonths.length; i++) {
      if (this.solarMonths[i].gregorianMonths.includes(gregorianMonth)) {
        result.push({
          index: i,
          englishName: this.solarMonths[i].englishName,
          persianName: this.solarMonths[i].persianName,
          monthNumber: i + 1
        });
      }
    }
    return result;
  }
}

