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
        days: 29, // Handled by leap year logic
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
    // This will be populated by loadVernalEquinoxData
    this.vernalEquinoxData = {};
    this.astronomicalEventCache = {}; // Cache for event dates
  }

  /**
   * Load vernal equinox data from JSON file
   */
  async loadVernalEquinoxData() {
    try {
      const response = await fetch('spring_equinox_dates_0001_to_2100.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Process the data into the format the class expects (YYYY-MM-DD)
      this.vernalEquinoxData = data.reduce((acc, entry) => {
        const year = parseInt(entry.year, 10);
        if (year >= 1900 && year <= 2100) {
          // The 'date' field is like "1-03-21" or "2024-03-20".
          // We trust the 'year' field and parse month/day from 'date'.
          const parts = entry.date.split('-');
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          const yearStr = String(entry.year).padStart(4, '0');
          acc[year] = `${yearStr}-${month}-${day}`;
        }
        return acc;
      }, {});

    } catch (error) {
      console.error('Error loading equinox data, using fallback:', error);
      this._useFallbackEquinoxData();
    }
  }

  /**
   * Fallback equinox data if JSON fetch fails
   */
  _useFallbackEquinoxData() {
    // Simplified approximation: March 20 for most years
    for (let year = 1900; year <= 2100; year++) {
      this.vernalEquinoxData[year] = `${year}-03-20`;
    }
    // Special adjustments for known variations (post-2044)
    const march19Years = [2044, 2048, 2052, 2056, 2060, 2064, 2068, 2072, 2076, 2080, 2084, 2088, 2092, 2096, 2100];
    march19Years.forEach(year => {
      this.vernalEquinoxData[year] = `${year}-03-19`;
    });
  }

  /**
   * Check if a Gregorian year is a leap year
   */
  isGregorianLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * Check if a Solar year is a leap year
   * A solar year is a leap year if its Vernal Equinox is on March 19
   * or if the *following* year's Vernal Equinox is on March 19.
   * This also corresponds to Gregorian leap years in this simplified model.
   * We will base it on the Gregorian leap year for simplicity, as the
   * Persian calendar's leap year rule is complex.
   * A common approximation is that if the *Gregorian* year is a leap year,
   * the *corresponding* Solar year (which starts in March) will have a 30-day Esfand.
   */
  isSolarLeapYear(solarYear) {
    // The Persian leap year is complex. A common approximation
    // is to check if the *next* Gregorian year is a leap year.
    // e.g., Solar 1399 (March 2020-March 2021) was a leap year
    // because 2020 (Gregorian) was a leap year.
    // Let's check the Gregorian year this solar year *starts* in.
    return this.isGregorianLeapYear(solarYear);
  }

  /**
   * Get Gregorian date for a solar day
   */
  getGregorianDateForSolarDay(solarYear, solarDay) {
    const vernalEquinox = this.vernalEquinoxData[solarYear];
    if (!vernalEquinox) {
      console.error(`No equinox data for year ${solarYear}`);
      return null;
    }

    const startDate = new Date(vernalEquinox + 'T00:00:00Z'); // Use UTC
    const targetDate = new Date(startDate);
    targetDate.setUTCDate(startDate.getUTCDate() + solarDay - 1);

    return targetDate;
  }

  /**
   * Get Solar date from Gregorian date
   */
  getSolarDateFromGregorian(gregorianDate, gregorianYear) {
    let solarYear = gregorianYear;
    let vernalEquinox = this.vernalEquinoxData[solarYear];
    if (!vernalEquinox) return null;

    let startDate = new Date(vernalEquinox + 'T00:00:00Z');
    
    // Create a UTC date for comparison
    const gDateUTC = new Date(Date.UTC(gregorianDate.getFullYear(), gregorianDate.getMonth(), gregorianDate.getDate()));

    if (gDateUTC < startDate) {
      // Date is before this year's vernal equinox, belongs to previous solar year
      solarYear--;
      vernalEquinox = this.vernalEquinoxData[solarYear];
      if (!vernalEquinox) return null;
      startDate = new Date(vernalEquinox + 'T00:00:00Z');
    }

    const daysDiff = Math.floor((gDateUTC - startDate) / (1000 * 60 * 60 * 24)) + 1;

    return this._getSolarMonthDay(daysDiff, solarYear);
  }

  /**
   * Helper to get solar month and day from day number
   */
  _getSolarMonthDay(dayNumber, solarYear) {
    const isLeap = this.isSolarLeapYear(solarYear);
    
    for (let i = 0; i < this.solarMonths.length; i++) {
      const month = this.solarMonths[i];
      let daysInMonth = month.days;
      
      // Adjust days for last month in leap year
      if (i === 11 && isLeap) {
        daysInMonth = 30;
      }
      
      if (dayNumber >= month.startDay && dayNumber < month.startDay + daysInMonth) {
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
    
    // Handle day 366 in a leap year (which should be Esfand 30)
    if (isLeap && dayNumber === 366) {
      const month = this.solarMonths[11];
      return {
        monthIndex: 11,
        month: month,
        day: 30,
        year: solarYear,
        englishName: month.englishName,
        persianName: month.persianName,
        monthNumber: 12
      };
    }

    return null; // Date is out of range
  }

  /**
   * Get astronomical events for a year (approximations)
   * Caches results per year.
   */
  getAstronomicalEvents(year) {
    if (this.astronomicalEventCache[year]) {
      return this.astronomicalEventCache[year];
    }

    // Use the *actual* loaded vernal equinox data
    const vernalEquinoxDate = this.vernalEquinoxData[year] ? new Date(this.vernalEquinoxData[year] + 'T00:00:00Z') : new Date(Date.UTC(year, 2, 20));
    
    // Other events are approximations based on the equinox
    const events = {
      vernalEquinox: vernalEquinoxDate,
      summerSolstice: new Date(Date.UTC(year, 5, 21)), // June 21
      autumnEquinox: new Date(Date.UTC(year, 8, 22)), // Sep 22
      winterSolstice: new Date(Date.UTC(year, 11, 21)) // Dec 21
    };

    this.astronomicalEventCache[year] = events;
    return events;
  }

  /**
   * Check if a date is an astronomical event
   */
  checkAstronomicalEvent(date, year) {
    const events = this.getAstronomicalEvents(year);
    // Compare using UTC date strings
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
   * Format date to ISO string (YYYY-MM-DD) using UTC
   */
  toISODateString(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format month title for Solar calendar
   * Format: "First Month / March-April"
   * "Farvardin / 1/12"
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
   * Format: "March / Farvardin-Ordibehesht"
   * "Solar: 1-2/12"
   */
  formatGregorianMonthTitle(gregorianMonthIndex) {
    const gregorianMonth = this.gregorianMonths[gregorianMonthIndex];
    
    // Find corresponding solar months
    const correspondingSolarMonths = this.getSolarMonthsForGregorian(gregorianMonthIndex);
    
    if (correspondingSolarMonths.length === 0) return { main: gregorianMonth, sub: '' };
    
    const persianNames = correspondingSolarMonths.map(m => m.persianName).join('-');
    const solarNumbers = correspondingSolarMonths.map(m => m.monthNumber).join('-');
    
    return {
      main: `${gregorianMonth} / ${persianNames}`,
      sub: `Solar: ${solarNumbers}/12`
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
}

