<?php

function loadEquinoxDates($filePath)
{
    if (!file_exists($filePath)) {
        die("Equinox data file not found.");
    }

    $json = file_get_contents($filePath);
    return json_decode($json, true);
}

function findMostRecentEquinox($inputDate, $equinoxDates)
{
    $lastEquinox = null;

    foreach ($equinoxDates as $entry) {
        $equinoxDate = DateTime::createFromFormat('Y-m-d', $entry['date']);
        if ($equinoxDate > $inputDate) {
            break;
        }
        $lastEquinox = $equinoxDate;
    }

    return $lastEquinox;
}

function getFirstMondayAfter(DateTime $start)
{
    $dayOfWeek = (int)$start->format('w'); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    $daysToAdd = ($dayOfWeek === 1) ? 0 : (8 - $dayOfWeek) % 7;
    return (clone $start)->add(new DateInterval("P{$daysToAdd}D"));
}

function convertToCustomCalendar($gregorianDateStr, $equinoxDates)
{
    $inputDate = DateTime::createFromFormat('Y-m-d', $gregorianDateStr);

    if (!$inputDate) {
        return "Invalid date format. Use YYYY-MM-DD.";
    }

    $currentYear = (int)$inputDate->format('Y');
    $equinox = findMostRecentEquinox($inputDate, $equinoxDates);

    if (!$equinox) {
        return "No equinox date available before input.";
    }

    // Define Equinox Day
    if ($inputDate->format('Y-m-d') === $equinox->format('Y-m-d')) {
        return [
            'Year' => $currentYear,
            'Month' => 'Equinox Day',
            'Day' => null,
            'Weekday' => $inputDate->format('l')
        ];
    }

    // Find start of Month 1, Day 1 (first Monday on/after equinox)
    $calendarYearStart = getFirstMondayAfter($equinox);

    // If the input date is before the start of the custom year, it belongs to the previous year
    if ($inputDate < $calendarYearStart) {
        $previousEquinox = findMostRecentEquinox((clone $equinox)->sub(new DateInterval('P1D')), $equinoxDates);
        $calendarYearStart = getFirstMondayAfter($previousEquinox);
        $currentYear = (int)$previousEquinox->format('Y');
    }

    $daysSinceStart = $calendarYearStart->diff($inputDate)->days;

    // 13 months x 28 days = 364 days/year
    if ($daysSinceStart >= 364) {
        return [
            'Year' => $currentYear,
            'Month' => 'Equinox Day',
            'Day' => null,
            'Weekday' => $inputDate->format('l')
        ];
    }

    $daysPerMonth = 28;
    $monthIndex = intdiv($daysSinceStart, $daysPerMonth);
    $dayInMonth = ($daysSinceStart % $daysPerMonth) + 1;

    $monthNames = [
        "March", "April", "May", "June", "Quintilis", "Sextilis",
        "September", "October", "November", "December", "January", "February", "Sol"
    ];

    return [
        'Year' => $currentYear,
        'Month' => $monthNames[$monthIndex],
        'Day' => $dayInMonth,
        'Weekday' => $inputDate->format('l')
    ];
}

// --- USAGE EXAMPLE ---

$equinoxFile = __DIR__ . '/spring_equinox_dates_0001_to_2100.json';
$equinoxDates = loadEquinoxDates($equinoxFile);

$today = date('Y-m-d'); // or use: '2025-03-20';
$result = convertToCustomCalendar($today, $equinoxDates);

print_r($today . "\n");
print_r($result);
