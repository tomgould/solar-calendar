/**
 * CalendarProcessor - Unified calendar date processing class
 * Handles Solar (Persian), Gregorian calendar conversions and astronomical events
 */
class CalendarProcessor {
  constructor() {
    // Solar month definitions with English ordinal names
    this.solarMonths = [
      { 
        englishName: 'First Month',
        persianName: 'Farvardin',
        season: 'Spring',
        days: 31,
        startDay: 1,
        gregorianMonths: ['March', 'April']
      },
      { 
        englishName: 'Second Month',
        persianName: 'Ordibehesht',
        season: 'Spring',
        days: 31,
        startDay: 32,
        gregorianMonths: ['April', 'May']
      },
      { 
        englishName: 'Third Month',
        persianName: 'Khordad',
        season: 'Spring',
        days: 31,
        startDay: 63,
        gregorianMonths: ['May', 'June']
      },
      { 
        englishName: 'Fourth Month',
        persianName: 'Tir',
        season: 'Summer',
        days: 31,
        startDay: 94,
        gregorianMonths: ['June', 'July']
      },
      { 
        englishName: 'Fifth Month',
        persianName: 'Mordad',
        season: 'Summer',
        days: 31,
        startDay: 125,
        gregorianMonths: ['July', 'August']
      },
      { 
        englishName: 'Sixth Month',
        persianName: 'Shahrivar',
        season: 'Summer',
        days: 31,
        startDay: 156,
        gregorianMonths: ['August', 'September']
      },
      { 
        englishName: 'Seventh Month',
        persianName: 'Mehr',
        season: 'Autumn',
        days: 30,
        startDay: 187,
        gregorianMonths: ['September', 'October']
      },
      { 
        englishName: 'Eighth Month',
        persianName: 'Aban',
        season: 'Autumn',
        days: 30,
        startDay: 217,
        gregorianMonths: ['October', 'November']
      },
      { 
        englishName: 'Ninth Month',
        persianName: 'Azar',
        season: 'Autumn',
        days: 30,
        startDay: 247,
        gregorianMonths: ['November', 'December']
      },
      { 
        englishName: 'Tenth Month',
        persianName: 'Dey',
        season: 'Winter',
        days: 30,
        startDay: 277,
        gregorianMonths: ['December', 'January']
      },
      { 
        englishName: 'Eleventh Month',
        persianName: 'Bahman',
        season: 'Winter',
        days: 30,
        startDay: 307,
        gregorianMonths: ['January', 'February']
      },
      { 
        englishName: 'Twelfth Month',
        persianName: 'Esfand',
        season: 'Winter',
        days: 29,
        startDay: 337,
        gregorianMonths: ['February', 'March']
      }
    ];

    // Gregorian month names
    this.gregorianMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Day names
    this.dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    this.dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Vernal Equinox dates (starting point for Solar calendar)
    this.vernalEquinoxData = this._initVernalEquinoxData();
  }

  /**
   * Initialize vernal equinox data for years 1900-2100
   */
  _initVernalEquinoxData() {
    const data = {};
    // Simplified approximation: March 20 for most years, with leap year adjustments
    for (let year = 1900; year <= 2100; year++) {
      // Most years: March 20
      // Leap years and century rules affect this slightly
      if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
        data[year] = `${year}-03-20`;
      } else {
        data[year] = `${year}-03-20`;
      }
    }
    // Special adjustments for known variations
    const march19Years = [1916, 1920, 1924, 1928, 1932, 1936, 1940, 1944, 1948, 1952, 1956, 1960, 1964, 1968, 1972, 1976, 1980, 1984, 1988, 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024, 2028, 2032, 2036, 2040, 2044, 2048, 2052, 2056, 2060, 2064, 2068, 2072, 2076, 2080, 2084, 2088, 2092, 2096, 2100];
    march19Years.forEach(year => {
      if (year >= 2016) data[year] = `${year}-03-19`;
    });
    return data;
  }

  /**
   * Get Gregorian date for a solar day
   */
  getGregorianDateForSolarDay(solarYear, solarDay) {
    const vernalEquinox = this.vernalEquinoxData[solarYear];
    if (!vernalEquinox) return null;

    const startDate = new Date(vernalEquinox + 'T00:00:00');
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + solarDay - 1);

    return targetDate;
  }

  /**
   * Get Solar date from Gregorian date
   */
  getSolarDateFromGregorian(gregorianDate, gregorianYear) {
    const vernalEquinox = this.vernalEquinoxData[gregorianYear];
    if (!vernalEquinox) return null;

    const startDate = new Date(vernalEquinox + 'T00:00:00');
    const daysDiff = Math.floor((gregorianDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    if (daysDiff < 1) {
      // Date is before this year's vernal equinox, belongs to previous solar year
      const prevVernalEquinox = this.vernalEquinoxData[gregorianYear - 1];
      if (!prevVernalEquinox) return null;
      const prevStartDate = new Date(prevVernalEquinox + 'T00:00:00');
      const prevDaysDiff = Math.floor((gregorianDate - prevStartDate) / (1000 * 60 * 60 * 24)) + 1;
      return this._getSolarMonthDay(prevDaysDiff, gregorianYear - 1);
    }

    return this._getSolarMonthDay(daysDiff, gregorianYear);
  }

  /**
   * Helper to get solar month and day from day number
   */
  _getSolarMonthDay(dayNumber, solarYear) {
    for (let i = 0; i < this.solarMonths.length; i++) {
      const month = this.solarMonths[i];
      if (dayNumber >= month.startDay && dayNumber < month.startDay + month.days) {
        const day = dayNumber - month.startDay + 1;
        return {
          monthIndex: i,
          month: month,
          day: day,
          year: solarYear,
          englishName: month.englishName,
          persianName: month.persianName,
          monthNumber: i + 1
        };
      }
    }
    return null;
  }

  /**
   * Get astronomical events for a year
   */
  getAstronomicalEvents(year) {
    return {
      vernalEquinox: new Date(year, 2, 20), // March 20
      summerSolstice: new Date(year, 5, 21), // June 21
      autumnEquinox: new Date(year, 8, 22), // September 22
      winterSolstice: new Date(year, 11, 21) // December 21
    };
  }

  /**
   * Check if a date is an astronomical event
   */
  checkAstronomicalEvent(date, year) {
    const events = this.getAstronomicalEvents(year);
    const dateStr = this.toISODateString(date);

    for (const [key, eventDate] of Object.entries(events)) {
      const eventDateStr = this.toISODateString(eventDate);
      if (dateStr === eventDateStr) {
        const icons = {
          vernalEquinox: '🌱',
          summerSolstice: '☀️',
          autumnEquinox: '🍂',
          winterSolstice: '❄️'
        };
        const classes = {
          vernalEquinox: 'vernal-equinox',
          summerSolstice: 'summer-solstice',
          autumnEquinox: 'autumn-equinox',
          winterSolstice: 'winter-solstice'
        };
        return { icon: icons[key], class: classes[key] };
      }
    }
    return null;
  }

  /**
   * Format date to ISO string (YYYY-MM-DD)
   */
  toISODateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format month title for Solar calendar
   * Format: "First Month / March-April / Farvardin / 1/12"
   */
  formatSolarMonthTitle(monthIndex) {
    const month = this.solarMonths[monthIndex];
    const englishName = month.englishName;
    const gregorianRange = month.gregorianMonths.join('-');
    const persianName = month.persianName;
    const monthNumber = `${monthIndex + 1}/12`;
    
    return {
      main: `${englishName} / ${gregorianRange}`,
      sub: `${persianName} / ${monthNumber}`
    };
  }

  /**
   * Format month title for Gregorian calendar
   * Format: "March / Farvardin-Ordibehesht / 1-2/12"
   */
  formatGregorianMonthTitle(gregorianMonthIndex) {
    const gregorianMonth = this.gregorianMonths[gregorianMonthIndex];
    
    // Find corresponding solar months
    const correspondingSolarMonths = [];
    for (let i = 0; i < this.solarMonths.length; i++) {
      const solarMonth = this.solarMonths[i];
      if (solarMonth.gregorianMonths.includes(gregorianMonth)) {
        correspondingSolarMonths.push({
          name: solarMonth.persianName,
          number: i + 1
        });
      }
    }
    
    if (correspondingSolarMonths.length === 0) return { main: gregorianMonth, sub: '' };
    
    const persianNames = correspondingSolarMonths.map(m => m.name).join('-');
    const solarNumbers = correspondingSolarMonths.map(m => m.number).join('-');
    
    return {
      main: `${gregorianMonth} / ${persianNames}`,
      sub: `Solar Months: ${solarNumbers}/12`
    };
  }

  /**
   * Get corresponding solar months for a gregorian month
   */
  getSolarMonthsForGregorian(gregorianMonthIndex) {
    const gregorianMonth = this.gregorianMonths[gregorianMonthIndex];
    const result = [];
    
    for (let i = 0; i < this.solarMonths.length; i++) {
      const solarMonth = this.solarMonths[i];
      if (solarMonth.gregorianMonths.includes(gregorianMonth)) {
        result.push({
          index: i,
          englishName: solarMonth.englishName,
          persianName: solarMonth.persianName,
          monthNumber: i + 1
        });
      }
    }
    
    return result;
  }

  /**
   * Check if a year is a leap year
   */
  isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }
}
