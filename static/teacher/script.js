let isLoggedIn = false;
let teacherSocket = null;

console.log("✅ Скрипт учительской загружен");

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/check-login', { credentials: 'include' });
        const data = await res.json();
        if (data.loggedIn) {
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('teacherSection').style.display = 'block';
            initSocket();
        }
    } catch (err) {
        document.getElementById('loginSection').style.display = 'block';
    }
});


function setupSocketHandlers() {
    teacherSocket.on('test_status', (status) => {
        updateButtons(status);
        if (status.active) {
            document.getElementById('activeTestInfo').style.display = 'block';
            document.getElementById('current-variant').textContent = 
                status.variant === 'powers' ? 'Степени двойки' : 'Квадраты чисел';
        } else {
            document.getElementById('activeTestInfo').style.display = 'none';
        }
    });

    teacherSocket.on('test_started', (data) => {
        updateButtons({active: true, variant: data.variant, finalized: false});
        document.getElementById('activeTestInfo').style.display = 'block';
    });

    teacherSocket.on('test_stopped', (data) => {
        if (data?.reason === 'auto') {
            alert('⚠️ ' + data.message);
        }
        updateButtons({active: false, finalized: false});
        document.getElementById('activeTestInfo').style.display = 'none';
        loadResults();
    });

    teacherSocket.on('update_students', (students) => {
        loadResults(students);
    });
}


document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    console.log("🔧 Попытка подключения к серверу...");


    teacherSocket = io('/teacher');


    teacherSocket.on('connect', () => {
        console.log("🔗 Подключён к /teacher");
        teacherSocket.emit('teacher_login', { username: user, password: pass });
    });


    teacherSocket.on('login_success', () => {
        console.log("✅ Успешный вход");
        isLoggedIn = true;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('teacherSection').style.display = 'block';
        setupSocketHandlers();  
    });


    teacherSocket.on('login_error', (data) => {
        console.log("❌ Ошибка входа:", data.error);
        document.getElementById('loginError').textContent = data.error;
    });


    teacherSocket.on('connect_error', (err) => {
        console.error("❌ Ошибка подключения:", err);
    });
});

function updateButtons(status) {
    const startPowers = document.getElementById('startPowers');
    const startSquares = document.getElementById('startSquares');
    const stopBtn = document.getElementById('stopBtn');
    const finalizeBtn = document.getElementById('finalizeBtn');

    if (status.active) {
        startPowers.disabled = true;
        startSquares.disabled = true;
        stopBtn.style.display = 'inline-block';
        finalizeBtn.style.display = 'none';
    } else if (!status.active && !status.finalized) {
        startPowers.disabled = false;
        startSquares.disabled = false;
        stopBtn.style.display = 'none';
        finalizeBtn.style.display = 'inline-block';
    } else {
        startPowers.disabled = false;
        startSquares.disabled = false;
        stopBtn.style.display = 'none';
        finalizeBtn.style.display = 'none';
    }
}

function loadResults(students) {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';
    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Нет учеников</td></tr>';
        return;
    }
    
    students.forEach(s => {
        const correct = s.score ? Math.min(10, Math.floor(s.score / 10)) : 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${s.computer_number}</td>
            <td>${s.name}</td>
            <td>${s.ip}</td>
            <td>${correct}/10</td>
            <td>${s.score != null ? s.score : '-'}</td>
            <td>${s.grade || '-'}</td>
            <td><button class="kick-btn" onclick="kick('${s.ip}')">Выгнать</button></td>
        `;
        tbody.appendChild(row);
    });
}

function kick(ip) {
    if (confirm(`Выгнать ученика с IP ${ip}?`)) {
        teacherSocket.emit('kick_student', {ip});
    }
}


document.getElementById('startPowers').addEventListener('click', () => {
    if (confirm('Запустить тест "Степени двойки"?')) {
        teacherSocket.emit('start_test', {variant: 'powers'});
    }
});

document.getElementById('startSquares').addEventListener('click', () => {
    if (confirm('Запустить тест "Квадраты чисел"?')) {
        teacherSocket.emit('start_test', {variant: 'squares'});
    }
});

document.getElementById('stopBtn').addEventListener('click', () => {
    if (confirm('Остановить тест?')) {
        downloadResultsAsCSV();
        teacherSocket.emit('stop_test');
    }
});

function downloadResultsAsCSV() {
    const rows = Array.from(document.querySelectorAll('#resultsBody tr'));
    if (rows.length === 0) return;
    
    const csv = rows.map(row => {
        const cells = row.querySelectorAll('td, th');
        return Array.from(cells).slice(0, -1).map(cell => `"${cell.textContent}"`).join(',');
    }).join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `результаты-${date}.csv`);
    link.click();
}

document.getElementById('finalizeBtn').addEventListener('click', () => {
    if (confirm('ЗАВЕРШИТЬ тест? Все данные будут УДАЛЕНЫ!')) {
        teacherSocket.emit('finalize_test');
        window.location.reload();
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    teacherSocket.emit('teacher_logout');
    window.location.reload();
});