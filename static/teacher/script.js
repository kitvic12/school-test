function calculateGrade(score) {
    if (score == null) return null;
    if (score >= 90) return '5';
    if (score >= 75) return '4';
    if (score >= 50) return '3';
    return '2';
}

async function apiCall(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        credentials: 'include'
    });
    return await res.json();
}

let socket = null;

function loadResults(students) {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Нет зарегистрированных учеников</td></tr>';
    } else {
        students.forEach(s => {
            const grade = calculateGrade(s.score);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${s.name}</td>
                <td>${s.ip}</td>
                <td class="${s.score == null ? 'empty' : ''}">${s.score != null ? s.score : '-'}</td>
                <td class="${grade == null ? 'empty' : ''}">${grade || '-'}</td>
                <td class="${s.timestamp == null ? 'empty' : ''}">${s.timestamp || '-'}</td>
                <td><button class="kick-btn" onclick="kickStudent('${s.ip}')">Выгнать</button></td>
            `;
            tbody.appendChild(row);
        });
    }
}

async function updateButtons() {
    const status = await apiCall('/api/test-status');
    const startPowers = document.getElementById('startPowers');
    const startSquares = document.getElementById('startSquares');
    const stopBtn = document.getElementById('stopBtn');
    const finalizeBtn = document.getElementById('finalizeBtn');
    const activeInfo = document.getElementById('activeTestInfo');

    if (status.active) {
        startPowers.disabled = true;
        startSquares.disabled = true;
        stopBtn.style.display = 'inline-block';
        finalizeBtn.style.display = 'none';
        activeInfo.style.display = 'block';
    } else if (!status.active && !status.finalized) {
        startPowers.disabled = false;
        startSquares.disabled = false;
        stopBtn.style.display = 'none';
        finalizeBtn.style.display = 'inline-block';
        activeInfo.style.display = 'none';
    } else {
        startPowers.disabled = false;
        startSquares.disabled = false;
        stopBtn.style.display = 'none';
        finalizeBtn.style.display = 'none';
        activeInfo.style.display = 'none';
    }
}

function kickStudent(ip) {
    if (!confirm(`Выгнать ученика с IP ${ip}?`)) return;
    fetch('/api/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
        credentials: 'include'
    }).catch(err => alert('Ошибка кика: ' + err.message));
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('username')?.focus();

    socket = io('/teacher');
    socket.on('update_students', (students) => {
        loadResults(students);
    });

    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await apiCall('/api/login', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            })
        });
        if (res.error) {
            document.getElementById('loginError').textContent = res.error;
        } else {
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('teacherSection').style.display = 'block';
            updateButtons();
            loadResults([]);
        }
    });

    document.getElementById('startPowers')?.addEventListener('click', async () => {
        await apiCall('/api/start-test', {
            method: 'POST',
            body: JSON.stringify({ variant: 'powers' }),
            credentials: 'include'
        });
        updateButtons();
    });
    document.getElementById('startSquares')?.addEventListener('click', async () => {
        await apiCall('/api/start-test', {
            method: 'POST',
            body: JSON.stringify({ variant: 'squares' }),
            credentials: 'include'
        });
        updateButtons();
    });
    document.getElementById('stopBtn')?.addEventListener('click', async () => {
        if (confirm('Остановить тест? Ученики больше не смогут проходить его.')) {
            await apiCall('/api/stop-test', { method: 'POST', credentials: 'include' });
            updateButtons();
        }
    });
    document.getElementById('finalizeBtn')?.addEventListener('click', async () => {
        if (confirm('ЗАВЕРШИТЬ тест? Все данные будут УДАЛЕНЫ!')) {
            await apiCall('/api/finalize-test', { method: 'POST', credentials: 'include' });
            window.location.reload();
        }
    });
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        window.location.reload();
    });
});