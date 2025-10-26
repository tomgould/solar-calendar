/**
 * CalendarProcessor - Handles conversions for the Solar Calendar system.
 * - This system utilizes 13 months, each containing 28 days (4 weeks starting Monday).
 * - The year commences on the first Monday occurring on or after the Vernal Equinox.
 * - Includes 'Year Day' (Day 365) and 'Leap Day' (Day 366) outside the standard months.
 * - Vernal Equinox data determines the anchor point for each year.
 */
class CalendarProcessor {
  constructor() {
    // Current 13-month structure
    this.calendarStructure = [
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
   * Load vernal equinox data from the JSON source. This defines the year's anchor point.
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
      // Pre-calculate start dates after loading
      this.preCalculateYearStartDates();

    } catch (error) {
      // Use fallback data if fetch fails
      this._useFallbackEquinoxData();
      this.preCalculateYearStartDates(); // Calculate start dates even with fallback
    }
  }

  /**
   * Fallback equinox data (approximation) if JSON source is unavailable.
   */
  _useFallbackEquinoxData() {
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
      if (this.solarYearStartDateCache[solarYear]) {
          return this.solarYearStartDateCache[solarYear];
      }

      const vernalEquinoxStr = this.vernalEquinoxData[solarYear];
      if (!vernalEquinoxStr) {
          return null; // Missing data
      }

      const equinoxDate = new Date(vernalEquinoxStr + 'T00:00:00Z');
      const dayOfWeek = equinoxDate.getUTCDay(); // 0=Sun, 1=Mon

      let daysToAdd = 0;
      if (dayOfWeek !== 1) { // If not Monday
          daysToAdd = (8 - dayOfWeek) % 7;
      }

      const startDate = new Date(equinoxDate);
      startDate.setUTCDate(equinoxDate.getUTCDate() + daysToAdd);

      this.solarYearStartDateCache[solarYear] = startDate;
      return startDate;
  }

   /** Pre-calculate and cache start dates for the relevant range */
   preCalculateYearStartDates() {
       for (let year = 1900; year <= 2100; year++) {
           this.getSolarYearStartDate(year); // Calculate and cache
       }
   }

  /**
   * Determine if the current Solar year is a leap year (has 366 days).
   */
  isSolarLeapYear(solarYear) {
    const startDate = this.getSolarYearStartDate(solarYear);
    const nextStartDate = this.getSolarYearStartDate(solarYear + 1);

    if (!startDate || !nextStartDate) {
      // Fallback approximation if data is missing
      const veYear = parseInt(this.vernalEquinoxData[solarYear]?.substring(0, 4) || solarYear);
      return (veYear % 4 === 0 && veYear % 100 !== 0) || (veYear % 400 === 0);
    }

    const diffTime = Math.abs(nextStartDate - startDate);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return diffDays === 366;
  }

  /**
   * Get the Gregorian date (UTC Date object) for a specific day number within the Solar year structure.
   */
  getGregorianDateForSolarDay(solarYear, solarDayOfYear) {
    const startDate = this.getSolarYearStartDate(solarYear);
    if (!startDate) return null;

    if (solarDayOfYear < 1 || solarDayOfYear > (this.isSolarLeapYear(solarYear) ? 366 : 365)) {
        return null; // Invalid day number
    }

    const targetDate = new Date(startDate);
    targetDate.setUTCDate(startDate.getUTCDate() + solarDayOfYear - 1);
    return targetDate;
  }

  /**
   * Get Solar date information { monthIndex, day, year, specialDay? } from a Gregorian date.
   */
  getSolarDateFromGregorian(gregorianDate) {
    const gDateUTC = new Date(Date.UTC(gregorianDate.getFullYear(), gregorianDate.getMonth(), gregorianDate.getDate()));
    const gYear = gregorianDate.getFullYear();

    let solarYear = gYear;
    let solarYearStartDate = this.getSolarYearStartDate(solarYear);

    // Determine the correct Solar year context
    if (!solarYearStartDate || gDateUTC < solarYearStartDate) {
        solarYear--;
        solarYearStartDate = this.getSolarYearStartDate(solarYear);
        if (!solarYearStartDate) return null;
    }

    const diffTime = gDateUTC - solarYearStartDate;
    const daysSinceSolarYearStart = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // 0-based

    const isLeap = this.isSolarLeapYear(solarYear);

    // Check for Year Day or Leap Day
    if (daysSinceSolarYearStart === 364) {
        return { monthIndex: -1, day: 1, year: solarYear, specialDay: 'Year Day', monthName: 'Year Day', monthNumber: null };
    } else if (isLeap && daysSinceSolarYearStart === 365) {
        return { monthIndex: -1, day: 2, year: solarYear, specialDay: 'Leap Day', monthName: 'Leap Day', monthNumber: null };
    } else if (daysSinceSolarYearStart >= (isLeap ? 366 : 365)) {
         // Date belongs to the subsequent Solar year
         return this.getSolarDateFromGregorian(gregorianDate, solarYear + 1);
    } else if (daysSinceSolarYearStart < 0) {
        return null; // Calculation error
    }

    // Regular day within the 13 months
    const monthIndex = Math.floor(daysSinceSolarYearStart / 28);
    const dayOfMonth = (daysSinceSolarYearStart % 28) + 1; // 1-based

    if (monthIndex < 0 || monthIndex >= this.calendarStructure.length) {
         return null; // Index out of bounds
    }

    const month = this.calendarStructure[monthIndex];
    return {
      monthIndex: monthIndex,
      month: month,
      day: dayOfMonth,
      year: solarYear,
      monthName: month.name,
      monthNumber: monthIndex + 1,
      specialDay: null
    };
  }

  /**
   * Format month title for the Solar calendar view.
   */
  formatSolarMonthTitle(monthIndex, solarYear) {
      if (monthIndex < 0 || monthIndex >= this.calendarStructure.length) return { main: 'Invalid Month', sub: '' };
      const month = this.calendarStructure[monthIndex];
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
   * Format month title for Gregorian calendar view, showing corresponding Solar info.
   */
  formatGregorianMonthTitle(gregorianMonthIndex, gregorianYear) {
    if (gregorianMonthIndex < 0 || gregorianMonthIndex > 11) return { main: 'Invalid Month', sub: '' };
    const gregorianMonthName = this.gregorianMonths[gregorianMonthIndex];
    const gregMonthStartDate = new Date(Date.UTC(gregorianYear, gregorianMonthIndex, 1));
    const gregMonthEndDate = new Date(Date.UTC(gregorianYear, gregorianMonthIndex + 1, 0));
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
             if(solarStartInfo.monthNumber && solarEndInfo.monthNumber) solarNumStr = `${solarStartInfo.monthNumber}-${solarEndInfo.monthNumber}/13`;
             else if (solarStartInfo.monthNumber) solarNumStr = `${solarStartInfo.monthNumber}/13+`;
             else if (solarEndInfo.monthNumber) solarNumStr = `+${solarEndInfo.monthNumber}/13`;
        }
    }
    return {
      main: `${gregorianMonthName} / Solar: ${solarInfoStr}`,
      sub: solarNumStr ? `Month(s) ${solarNumStr}` : ''
    };
  }

  /**
   * Get approximate astronomical event dates (Gregorian).
   */
  getAstronomicalEvents(year) {
    if (this.astronomicalEventCache[year]) {
      return this.astronomicalEventCache[year];
    }
    const vernalEquinoxStr = this.vernalEquinoxData[year];
    // Use approximation if exact data is missing
    const vernalEquinoxDate = vernalEquinoxStr ? new Date(vernalEquinoxStr + 'T00:00:00Z') : new Date(Date.UTC(year, 2, 20));
    const events = {
      vernalEquinox: vernalEquinoxDate,
      summerSolstice: new Date(Date.UTC(year, 5, 21)),
      autumnEquinox: new Date(Date.UTC(year, 8, 22)),
      winterSolstice: new Date(Date.UTC(year, 11, 21))
    };
    this.astronomicalEventCache[year] = events;
    return events;
  }

  /**
   * Check if a Gregorian date coincides with an approximate astronomical event.
   */
  checkAstronomicalEvent(date, year) {
    const events = this.getAstronomicalEvents(year);
    const dateStr = this.toISODateString(date);
    for (const [key, eventDate] of Object.entries(events)) {
        if (!eventDate || isNaN(eventDate.getTime())) continue;
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
   * Format Date to ISO string (YYYY-MM-DD) using UTC values.
   */
  toISODateString(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

