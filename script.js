function toggleTheme() {
    document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme');
    const theme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
}

// Load saved theme on page load
window.onload = () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.add(`${savedTheme}-theme`);
};

document.getElementById('timetable-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const subject = document.getElementById('subject').value;
    const day = document.getElementById('day').value;
    const time = document.getElementById('time').value;

    const listItem = document.createElement('li');
    listItem.textContent = `${subject} - ${day} at ${time}`;
    listItem.className = 'p-2 border-b';
    document.getElementById('timetable-list').appendChild(listItem);

    // Clear form
    document.getElementById('timetable-form').reset();

    // TODO: Send data to backend API
});