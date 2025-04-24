// @ts-nocheck
(function() {
    let targetAttendance = parseFloat(localStorage.getItem('targetAttendance')) || null;
    let subjects = JSON.parse(localStorage.getItem('subjects')) || [];
    let attendance = JSON.parse(localStorage.getItem('attendance')) || [];
    let pendingStorageUpdate = false;
    let cachedStats = new Map();
    let lastStatsUpdate = 0;
    let calendar = null;

    // Prune old attendance data
    if (attendance.length > 50) {
        console.log('Pruning attendance to 50 entries');
        attendance = attendance.slice(-50);
        localStorage.setItem('attendance', JSON.stringify(attendance));
    }

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
        document.body.style.background = color;
        localStorage.setItem('bgColor', color);
    }

    // Debounce localStorage updates
    function updateStorage() {
        if (!pendingStorageUpdate) {
            pendingStorageUpdate = true;
            setTimeout(() => {
                console.log('Updating localStorage');
                if (attendance.length > 50) {
                    console.log('Capping attendance at 50 entries');
                    attendance = attendance.slice(-50);
                }
                localStorage.setItem('subjects', JSON.stringify(subjects));
                localStorage.setItem('attendance', JSON.stringify(attendance));
                pendingStorageUpdate = false;
            }, 50);
        }
    }

    // Client-Side Routing
    function navigateTo(page) {
        console.log('Navigating to:', page);
        document.querySelectorAll('.page').forEach(p => {
            p.classList.add('hidden');
            p.classList.remove('animate__fadeIn');
        });
        const targetPage = document.getElementById(`${page}-page`);
        targetPage.classList.remove('hidden');
        targetPage.classList.add('animate__fadeIn');
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${page}`) {
                link.classList.add('active');
            }
        });
        // Close mobile menu
        document.getElementById('nav-mobile-links').classList.remove('active');
        document.getElementById('nav-toggle').innerText = '☰';
    }

    window.addEventListener('hashchange', () => {
        const page = window.location.hash.slice(1) || 'home';
        navigateTo(page);
    });

    // Initialize page
    window.onload = () => {
        console.log('Page loaded');
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.add(`${savedTheme}-theme`);
        const savedColor = localStorage.getItem('bgColor') || (savedTheme === 'light' ? 'linear-gradient(135deg, #e0e7ff 0%, #f9e2ff 100%)' : 'linear-gradient(135deg, #1e1b4b 0%, #3b0764 100%)');
        document.body.style.background = savedColor;
        document.getElementById('bg-color').value = savedColor.includes('linear-gradient') ? (savedTheme === 'light' ? '#f4f4f4' : '#1a1a1a') : savedColor;

        const page = window.location.hash.slice(1) || 'home';
        navigateTo(page);

        if (targetAttendance) {
            navigateTo('subjects');
            loadSubjects();
            initializeCalendar();
            updateStats();
        }

        // Bind button event listeners
        document.getElementById('present-btn').addEventListener('click', () => markAttendance('Present'));
        document.getElementById('absent-btn').addEventListener('click', () => markAttendance('Absent'));
        document.getElementById('reset-btn').addEventListener('click', resetAttendance);
        document.getElementById('save-edit-btn').addEventListener('click', saveEditedAttendance);
        document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);

        // Mobile menu toggle
        document.getElementById('nav-toggle').addEventListener('click', () => {
            const mobileMenu = document.getElementById('nav-mobile-links');
            mobileMenu.classList.toggle('active');
            document.getElementById('nav-toggle').innerText = mobileMenu.classList.contains('active') ? '✕' : '☰';
        });
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
        navigateTo('subjects');
        loadSubjects();
        initializeCalendar();
        updateStats();
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
        updateStorage();

        addSubjectToList(subject);
        updateCalendarSubjectDropdown();
        updateStats();
        document.getElementById('subject-form').reset();
    });

    // Load Subjects
    function loadSubjects() {
        console.log('Loading subjects:', subjects.length);
        const list = document.getElementById('subject-list');
        list.innerHTML = '';
        subjects.forEach(subject => addSubjectToList(subject));
        updateCalendarSubjectDropdown();
    }

    function addSubjectToList(subject) {
        const listItem = document.createElement('li');
        listItem.className = 'glass-card p-4 rounded-lg animate__animated animate__slideInUp';
        listItem.innerHTML = `
            <h4 class="font-semibold text-gray-800 dark:text-gray-200">${subject.name}</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">Days: ${subject.days.join(', ')}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">Attendance: ${subject.attendedClasses}/${subject.totalClasses}</p>
        `;
        document.getElementById('subject-list').appendChild(listItem);
    }

    // Calendar Initialization
    function initializeCalendar() {
        console.log('Initializing calendar');
        const calendarEl = document.getElementById('calendar');
        const loadingEl = document.getElementById('calendar-loading');
        const errorEl = document.getElementById('calendar-error');

        if (!window.FullCalendar) {
            console.error('FullCalendar not loaded');
            loadingEl.classList.add('hidden');
            errorEl.classList.remove('hidden');
            setTimeout(() => {
                console.log('Retrying calendar initialization');
                initializeCalendar();
            }, 2000);
            return;
        }

        try {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                eventSources: [{
                    events: function(fetchInfo, successCallback, failureCallback) {
                        console.log('Fetching events from', fetchInfo.startStr, 'to', fetchInfo.endStr);
                        try {
                            const filteredEvents = attendance
                                .filter(entry => {
                                    if (!entry.date || !entry.subject || !entry.status) {
                                        console.warn('Invalid attendance entry:', entry);
                                        return false;
                                    }
                                    return entry.date >= fetchInfo.startStr && entry.date <= fetchInfo.endStr;
                                })
                                .slice(-50)
                                .map(entry => ({
                                    id: entry.id,
                                    title: `${entry.subject}: ${entry.status}`,
                                    start: entry.date,
                                    backgroundColor: entry.status === 'Present' ? '#10b981' : '#ef4444',
                                }));
                            console.log('Loaded', filteredEvents.length, 'events');
                            successCallback(filteredEvents);
                        } catch (error) {
                            console.error('Error processing events:', error);
                            failureCallback(error);
                        }
                    }
                }],
                eventDisplay: 'block',
                eventDidMount: info => {
                    info.el.style.cursor = 'pointer';
                },
                dateClick: function(info) {
                    console.log('Date clicked:', info.dateStr);
                    document.getElementById('calendar-date').value = info.dateStr;
                    showEditModal(info.dateStr);
                },
                eventClick: function(info) {
                    console.log('Event clicked:', info.event.id);
                    showEditModal(info.event.startStr);
                }
            });
            calendar.render();
            calendarEl.classList.remove('hidden');
            loadingEl.classList.add('hidden');
            errorEl.classList.add('hidden');
        } catch (error) {
            console.error('Calendar initialization failed:', error);
            loadingEl.classList.add('hidden');
            errorEl.classList.remove('hidden');
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
        const messageEl = document.getElementById('attendance-message');
        if (!subject || !date) {
            alert('Please select a subject and date.');
            return;
        }

        const subjectData = subjects.find(s => s.name === subject);
        if (!subjectData) {
            alert('Subject not found.');
            return;
        }

        if (status === 'Present') {
            subjectData.attendedClasses++;
            subjectData.totalClasses++;
        } else if (status === 'Absent') {
            subjectData.totalClasses++;
        }

        const entry = { id: Date.now().toString(), subject, status, date };
        attendance.push(entry);
        updateStorage();

        if (calendar) {
            calendar.addEvent({
                id: entry.id,
                title: `${subject}: ${status}`,
                start: date,
                backgroundColor: status === 'Present' ? '#10b981' : '#ef4444',
            });
        }

        messageEl.textContent = `Marked ${status} for ${subject} on ${date}`;
        messageEl.classList.remove('hidden');
        setTimeout(() => messageEl.classList.add('hidden'), 2000);

        updateStats();
    }

    // Reset Attendance
    function resetAttendance() {
        console.log('Resetting attendance');
        const subject = document.getElementById('calendar-subject').value;
        const date = document.getElementById('calendar-date').value;
        const messageEl = document.getElementById('attendance-message');
        if (!subject || !date) {
            alert('Please select a subject and date.');
            return;
        }

        const subjectData = subjects.find(s => s.name === subject);
        if (!subjectData) {
            alert('Subject not found.');
            return;
        }

        const entriesToRemove = attendance.filter(entry => entry.subject === subject && entry.date === date);
        entriesToRemove.forEach(entry => {
            if (entry.status === 'Present') {
                subjectData.attendedClasses--;
                subjectData.totalClasses--;
            } else if (entry.status === 'Absent') {
                subjectData.totalClasses--;
            }
            if (calendar) {
                calendar.getEventById(entry.id)?.remove();
            }
        });

        attendance = attendance.filter(entry => !(entry.subject === subject && entry.date === date));
        updateStorage();

        messageEl.textContent = `Reset attendance for ${subject} on ${date}`;
        messageEl.classList.remove('hidden');
        setTimeout(() => messageEl.classList.add('hidden'), 2000);

        updateStats();
    }

    // Edit Attendance
    let editDate = null;
    function showEditModal(date) {
        console.log('Showing edit modal for date:', date);
        editDate = date;
        const modal = document.getElementById('edit-modal');
        const editDateEl = document.getElementById('edit-date');
        const editEntriesEl = document.getElementById('edit-entries');

        editDateEl.textContent = `Date: ${date}`;
        editEntriesEl.innerHTML = '';

        const entries = attendance.filter(entry => entry.date === date);
        if (entries.length === 0) {
            editEntriesEl.textContent = 'No attendance records for this date.';
        } else {
            entries.forEach(entry => {
                const div = document.createElement('div');
                div.className = 'flex gap-3 items-center';
                div.innerHTML = `
                    <select data-id="${entry.id}" class="border rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 transition-all duration-300">
                        <option value="Present" ${entry.status === 'Present' ? 'selected' : ''}>Present</option>
                        <option value="Absent" ${entry.status === 'Absent' ? 'selected' : ''}>Absent</option>
                    </select>
                    <button type="button" onclick="deleteAttendance('${entry.id}')" class="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transform hover:scale-105 transition-all duration-200">Delete</button>
                `;
                editEntriesEl.appendChild(div);
            });
        }

        modal.classList.remove('hidden');
    }

    function closeEditModal() {
        console.log('Closing edit modal');
        document.getElementById('edit-modal').classList.add('hidden');
        document.getElementById('edit-modal').classList.remove('animate__zoomIn');
        document.getElementById('edit-modal').classList.add('animate__zoomOut');
        setTimeout(() => {
            document.getElementById('edit-modal').classList.remove('animate__zoomOut');
        }, 200);
    }

    function saveEditedAttendance() {
        console.log('Saving edited attendance');
        const entries = document.querySelectorAll('#edit-entries select');
        const messageEl = document.getElementById('attendance-message');
        entries.forEach(select => {
            const id = select.dataset.id;
            const newStatus = select.value;
            const entry = attendance.find(e => e.id === id);
            if (entry) {
                const subjectData = subjects.find(s => s.name === entry.subject);
                if (subjectData) {
                    // Revert previous effect
                    if (entry.status === 'Present') {
                        subjectData.attendedClasses--;
                        subjectData.totalClasses--;
                    } else if (entry.status === 'Absent') {
                        subjectData.totalClasses--;
                    }
                    // Apply new effect
                    if (newStatus === 'Present') {
                        subjectData.attendedClasses++;
                        subjectData.totalClasses++;
                    } else if (newStatus === 'Absent') {
                        subjectData.totalClasses++;
                    }
                    entry.status = newStatus;
                }
            }
        });

        updateStorage();
        if (calendar) {
            calendar.getEvents().forEach(event => event.remove());
            const currentView = calendar.view;
            const filteredEvents = attendance
                .filter(entry => entry.date >= currentView.activeStart.toISOString().split('T')[0] && entry.date <= currentView.activeEnd.toISOString().split('T')[0])
                .slice(-50)
                .map(entry => ({
                    id: entry.id,
                    title: `${entry.subject}: ${entry.status}`,
                    start: entry.date,
                    backgroundColor: entry.status === 'Present' ? '#10b981' : '#ef4444',
                }));
            filteredEvents.forEach(event => calendar.addEvent(event));
        }

        messageEl.textContent = `Updated attendance for ${editDate}`;
        messageEl.classList.remove('hidden');
        setTimeout(() => messageEl.classList.add('hidden'), 2000);

        updateStats();
        closeEditModal();
    }

    function deleteAttendance(id) {
        console.log('Deleting attendance:', id);
        const messageEl = document.getElementById('attendance-message');
        const entry = attendance.find(e => e.id === id);
        if (entry) {
            const subjectData = subjects.find(s => s.name === entry.subject);
            if (subjectData) {
                if (entry.status === 'Present') {
                    subjectData.attendedClasses--;
                    subjectData.totalClasses--;
                } else if (entry.status === 'Absent') {
                    subjectData.totalClasses--;
                }
            }
            attendance = attendance.filter(e => e.id !== id);
            updateStorage();
            if (calendar) {
                calendar.getEventById(id)?.remove();
            }
            messageEl.textContent = `Deleted attendance for ${entry.subject} on ${editDate}`;
            messageEl.classList.remove('hidden');
            setTimeout(() => messageEl.classList.add('hidden'), 2000);
            updateStats();
            showEditModal(editDate);
        }
    }

    // Update Stats
    function updateStats() {
        const now = Date.now();
        if (now - lastStatsUpdate < 100) {
            console.log('Throttling stats update');
            return;
        }
        lastStatsUpdate = now;
        console.log('Updating stats');
        const display = document.getElementById('stats-display');
        display.innerHTML = '';
        subjects.forEach(subject => {
            const cacheKey = `${subject.name}-${subject.totalClasses}-${subject.attendedClasses}`;
            let stats;
            if (cachedStats.has(cacheKey)) {
                stats = cachedStats.get(cacheKey);
            } else {
                const currentAttendance = subject.totalClasses ? (subject.attendedClasses / subject.totalClasses) * 100 : 0;
                const classesNeeded = targetAttendance && subject.totalClasses ? 
                    Math.ceil((targetAttendance * subject.totalClasses - 100 * subject.attendedClasses) / (100 - targetAttendance)) : 0;
                const classesCanBunk = targetAttendance && subject.totalClasses ? 
                    Math.floor((subject.attendedClasses * 100 - targetAttendance * subject.totalClasses) / targetAttendance) : 0;
                stats = { currentAttendance, classesNeeded, classesCanBunk };
                cachedStats.set(cacheKey, stats);
            }

            const stat = document.createElement('div');
            stat.className = 'glass-card p-6 rounded-lg animate__animated animate__slideInUp';
            stat.innerHTML = `
                <h4 class="font-semibold text-lg text-gray-800 dark:text-gray-200">${subject.name}</h4>
                <p class="text-gray-600 dark:text-gray-400">Current: ${stats.currentAttendance.toFixed(2)}%</p>
                <p class="text-gray-600 dark:text-gray-400">Need to attend: ${stats.classesNeeded > 0 ? stats.classesNeeded : 0} more classes</p>
                <p class="text-gray-600 dark:text-gray-400">Can bunk: ${stats.classesCanBunk > 0 ? stats.classesCanBunk : 0} classes</p>
            `;
            display.appendChild(stat);
        });
    }
})();