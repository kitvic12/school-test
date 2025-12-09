let teacherSocket = null;
const download_results = true;



function getMoscowTimeString() {
    const now = new Date();
    const moscowTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    const year = moscowTime.getUTCFullYear();
    const month = String(moscowTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(moscowTime.getUTCDate()).padStart(2, '0');
    const hours = String(moscowTime.getUTCHours()).padStart(2, '0');
    const minutes = String(moscowTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(moscowTime.getUTCSeconds()).padStart(2, '0');
    
    return `${year}.${month}.${day}_${hours}-${minutes}-${seconds}`;
}




function downloadResultsAsCSV() {
    if (!download_results) {alert("Результат загружен"); return}
    const rows = Array.from(document.querySelectorAll('#resultsBody tr'));
    if (rows.length === 0) {
        alert('Нет данных для скачивания');
        return;
    }

    let csvContent = '"№ ПК","Фамилия","IP","Правильных","Баллы","Оценка","Действие"\n';

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const rowData = Array.from(cells).slice(0, -1)
                .map(cell => `"${cell.textContent.replace(/"/g, '""')}"`)
                .join(',');
            csvContent += rowData + '\n';
        }
    });

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const dateStr = getMoscowTimeString();
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `результаты_${dateStr}.csv`);
    link.click();
}

document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/check-login', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.loggedIn) {
                document.getElementById('loginSection').style.display = 'none';
                document.getElementById('teacherSection').style.display = 'block';
                initSocket();
            } else {
                document.getElementById('loginSection').style.display = 'block';
            }
        });


    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass }),
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('teacherSection').style.display = 'block';
            initSocket();
        } else {
            document.getElementById('loginError').textContent = data.error;
        }
    });
});



function updateButtons(status) {
    const startPowers = document.getElementById('startPowers');
    const startSquares = document.getElementById('startSquares');
    const stopBtn = document.getElementById('stopBtn');
    const finalizeBtn = document.getElementById('finalizeBtn');
    const activeInfo = document.getElementById('activeTestInfo');
    const variantBtn = document.getElementById('variant-btns');
    const newBtn = document.getElementById('newBtn');

    if (status.active) {
        startPowers.disabled = true;
        startSquares.disabled = true;
        stopBtn.style.display = 'inline-block';
        finalizeBtn.style.display = 'none';
        activeInfo.style.display = 'block';
        variantBtn.style.display = 'none'; 
        newBtn.style.display = 'none';
        
    } else if (!status.active && !status.finalized) {
        startPowers.disabled = false;
        startSquares.disabled = false;
        stopBtn.style.display = 'none';
        finalizeBtn.style.display = 'inline-block';
        activeInfo.style.display = 'none';
        variantBtn.style.display = 'none';
        newBtn.style.display = 'inline-block';

    } else if (!status.active && status.finalized) {
        startPowers.disabled = false;
        startSquares.disabled = false;
        stopBtn.style.display = 'none';
        finalizeBtn.style.display = 'none';
        activeInfo.style.display = 'none';
        variantBtn.style.display = 'block';
        newBtn.style.display = 'none';

    } else {
        startPowers.disabled = false;
        startSquares.disabled = false;
        stopBtn.style.display = 'none';
        finalizeBtn.style.display = 'none';
        activeInfo.style.display = 'none';
        variantBtn.style.display = 'block';
        newBtn.style.display = 'none';
    }
}




function initSocket() {
    teacherSocket = io('/teacher');

    teacherSocket.on('connect', () => {
        console.log('✅ Учитель подключён');
        teacherSocket.emit('get_students');
    });


    teacherSocket.on('all_students_submitted', (data) => {
        alert("Все ученики сдали тест, он автоматически остановлен.");
        teacherSocket.emit('stop_test');
        downloadResultsAsCSV();        
    });


    teacherSocket.on('update_students', (students) => {
        loadResults(students);
    });


    teacherSocket.on('test_started', (data) => {
        updateButtons({active: true, variant: data.variant, finalized: false});
        document.getElementById('activeTestInfo').style.display = 'block';
        document.getElementById('what_open').textContent = `На данный момент открыт вариант "${data.variant === 'powers' ? 'Степени двойки' : 'Квадраты чисел'}". Результаты обновляются автоматически.`});


    teacherSocket.on('test_stopped', () => {
        updateButtons({active: false, finalized: false});
        document.getElementById('activeTestInfo').style.display = 'none';
    });


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
        teacherSocket.emit('start_test', {variant: 'squares'})}
});

document.getElementById('stopBtn').addEventListener('click', () => {
    if (confirm('Остановить тест?')) {
        teacherSocket.emit('stop_test');
        downloadResultsAsCSV();
    }
});

document.getElementById('finalizeBtn').addEventListener('click', () => {
    if (confirm('Завершить тестирование? Все ученики будут возвращены на страницу регестрации.')) {
        teacherSocket.emit('finalize_test');
        window.location.reload();
    }
});


document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', {method: 'POST', credentials: 'include'});
    window.location.reload();
});

document.getElementById('newBtn').addEventListener('click', () => {
    teacherSocket.emit('new_test')
    updateButtons({active: false, finalized: true})
})