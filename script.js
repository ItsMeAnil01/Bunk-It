let targetAttendance = parseFloat(localStorage.getItem('targetAttendance')) || null;
let subjects = JSON.parse(localStorage.getItem('subjects')) || [];
let attendance = JSON.parse(localStorage.getItem('attendance')) || [];

function toggleTheme() {
    console.log('Toggling theme');
    document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme');
    const theme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
}

function changeBackgroundColor() {
    const color = document.getElementById('bg-color').value;
    console.log('Changing background color to:', color);
    document.body.style.backgroundColor = color;
    localStorage.setItem('bgColor', color);
}

// Initialize page
window.onload = () => {
    console.log('Page loaded');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.add(`${savedTheme}-theme`);
    const savedColor = localStorage.getItem('bgColor') || (savedTheme === 'light' ? '#f4f4f4' : '#1a1a1a');
    document.body.style.backgroundColor = savedColor;
    document.getElementById('bg-color').value = savedColor;

    if (targetAttendance) {
        document.getElementById('target-section').classList.add('hidden');
        document.getElementById('subject-section').classList.remove('hidden');
        document.getElementById('calendar-section').classList.remove('hidden');
        document.getElementById('stats-section').classList.remove('hidden');
        loadSubjects();
        initializeCalendar();
        updateStats();
    }
};

// Target Attendance Form
document.getElementById('target-form').addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Target form submitted');
    targetAttendance = parseFloat(document.getElementById('target-attendance').value);
    if (isNaN(targetAttendance) || targetAttendance < 0 || targetAttendance > 100) {
        alert('Please enter a valid percentage (0-100).');
        return;
    }
    localStorage.setItem('targetAttendance', targetAttendance);
    document.getElementById('target-section').classList.add('hidden');
    document.getElementById('subject-section').classList.remove('hidden');
    document.getElementById('calendar-section').classList.remove('hidden');
    document.getElementById('stats-section').classList.remove('hidden');
    initializeCalendar();
});

// Subject Form Submission
document.getElementById('subject-form').addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Subject form submitted');
    const name = document.getElementById('subject-name').value.trim();
    const days = Array.from(document.querySelectorAll('input[name="days"]:checked')).map(input => input.value);
    const totalClasses = parseInt(document.getElementById('total-classes').value);
    const attendedClasses = parseInt(document.getElementById('attended-classes').value);

    if (!name) {
        alert('Please enter a subject name.');
        return;
    }
    if (!days.length) {
        alert('Please select at least one day.');
        return;
    }
    if (totalClasses < 0 || attendedClasses < 0 || attendedClasses > totalClasses) {
        alert('Please enter valid class counts.');
        return;
    }

    const subject = { name, days, totalClasses, attendedClasses };
    subjects.push(subject);
    localStorage.setItem('subjects', JSON.stringify(subjects));

    addSubjectToList(subject);
    updateCalendarSubjectDropdown();
    updateStats();
    document.getElementById('subject-form').reset();
});

// Load Subjects
function loadSubjects() {
    console.log('Loading subjects:', subjects);
    const list = document.getElementById('subject-list');
    list.innerHTML = '';
    subjects.forEach(subject => addSubjectToList(subject));
    updateCalendarSubjectDropdown();
}

function addSubjectToList(subject) {
    const listItem = document.createElement('li');
    listItem.textContent = `${subject.name} - Days: ${subject.days.join(', ')} - ${subject.attendedClasses}/${subject.totalClasses} attended`;
    listItem.className = 'p-2 border-b';
    document.getElementById('subject-list').appendChild(listItem);
}

// Calendar Initialization
let calendar;
function initializeCalendar() {
    console.log('Initializing calendar');
    const calendarEl = document.getElementById('calendar');
    try {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            events: attendance.map(entry => ({
                title: `${entry.subject}: ${entry.status}`,
                start: entry.date,
                backgroundColor: entry.status === 'Present' ? '#10b981' : entry.status === 'Absent' ? '#ef4444' : '#f59e0b',
            })),
            dateClick: function(info) {
                console.log('Date clicked:', info.dateStr);
                document.getElementById('calendar-date').value = info.dateStr;
            }
        });
        calendar.render();
    } catch (error) {
        console.error('Calendar initialization failed:', error);
        alert('Failed to load calendar. Please check your internet connection.');
    }
}

// Update Calendar Subject Dropdown
function updateCalendarSubjectDropdown() {
    console.log('Updating subject dropdown');
    const dropdown = document.getElementById('calendar-subject');
    dropdown.innerHTML = '<option value="">Select Subject</option>';
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.name;
        option.textContent = subject.name;
        dropdown.appendChild(option);
    });
}

// Mark Attendance
function markAttendance(status) {
    console.log('Marking attendance:', status);
    const subject = document.getElementById('calendar-subject').value;
    const date = document.getElementById('calendar-date').value;
    if (!subject || !date) {
        alert('Please select a subject and date.');
        return;
    }

    const subjectData = subjects.find(s => s.name === subject);
    if (!subjectData) {
        alert('Subject not found.');
        return;
    }

    if (status === 'Present' || status === 'Extra') {
        subjectData.attendedClasses++;
        subjectData.totalClasses++;
    } else if (status === 'Absent') {
        subjectData.totalClasses++;
    }

    const entry = { subject, status, date };
    attendance.push(entry);
    localStorage.setItem('subjects', JSON.stringify(subjects));
    localStorage.setItem('attendance', JSON.stringify(attendance));

    calendar.addEvent({
        title: `${subject}: ${status}`,
        start: date,
        backgroundColor: status === 'Present' ? '#10b981' : status === 'Absent' ? '#ef4444' : '#f59e0b',
    });

    updateStats();
}

// Update Stats
function updateStats() {
    console.log('Updating stats');
    const display = document.getElementById('stats-display');
    display.innerHTML = '';
    subjects.forEach(subject => {
        const currentAttendance = subject.totalClasses ? (subject.attendedClasses / subject.totalClasses) * 100 : 0;
        const classesNeeded = targetAttendance && subject.totalClasses ? 
            Math.ceil((targetAttendance * subject.totalClasses - 100 * subject.attendedClasses) / (100 - targetAttendance)) : 0;
        const classesCanBunk = targetAttendance && subject.totalClasses ? 
            Math.floor((subject.attendedClasses * 100 - targetAttendance * subject.totalClasses) / targetAttendance) : 0;

        const stat = document.createElement('div');
        stat.className = 'p-4 border rounded-md';
        stat.innerHTML = `
            <h4 class="font-medium">${subject.name}</h4>
            <p>Current: ${currentAttendance.toFixed(2)}%</p>
            <p>Need to attend: ${classesNeeded > 0 ? classesNeeded : 0} more classes</p>
            <p>Can bunk: ${classesCanBunk > 0 ? classesCanBunk : 0} classes</p>
        `;
        display.appendChild(stat);
    });
}