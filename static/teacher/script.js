let teacherSocket = null;
const download_results = true;
const form_id = document.getElementById('settingsForm');
const questionForm = document.getElementById('totalQuestions');
let savedSettingsValues = null;  


function getSettings() {
    return fetch('/api/settings')
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch settings');
            return res.json();
        })
        .catch(() => ({
            TeacherIP: '127.0.0.1',
            Port: 5000,
            TotalQuestions: 10,
            TimePerQuestion: 10,
            Graduations5: 90,
            Graduations4: 75,
            Graduations3: 50
        }));
}

settings = getSettings().then(s => {
    form_id.innerHTML = `
    <table class="settings-table", style="background-color: transparent">
        <tr>
            <td>IP учителя:</td>
            <td><input type="text" class="settings-parametres" id="teacherIP" value=${s.TeacherIP} required></td>
        </tr>
        <tr>
            <td>IP второго учителя (опционально):</td>
            <td><input type="text" class="settings-parametres" id="secondaryTeacherIP" value="${s.SecondaryTeacherIP || ''}" placeholder="Оставьте пусто для отключения"></td>
        </tr>
        <tr>
            <td>Порт:</td>
            <td><input type="number" class="settings-parametres" id="port" value="${s.Port}" required></td>
        </tr>
        <tr>
            <td>Всего вопросов:</td>
            <td><input type="number" class="settings-parametres" id="totalQuestions" value="${s.TotalQuestions}" required></td>
        </tr>
        <tr>
            <td>Время на вопрос (сек):</td>
            <td><input type="number" class="settings-parametres" id="timePerQuestion" value="${s.TimePerQuestion}" required></td>
        </tr>
        <tr>
            <td>Порог для 5:</td>
            <td><input type="number" class="settings-parametres" id="graduations5" value="${s.Graduations5}" required></td>
        </tr>
        <tr>
            <td>Порог для 4:</td>
            <td><input type="number" class="settings-parametres" id="graduations4" value="${s.Graduations4}"required></td>
        </tr>
        <tr>
            <td>Порог для 3:</td>
            <td><input type="number" class="settings-parametres" id="graduations3" value="${s.Graduations3}" required></td>
        </tr>
    </table>
    <p><strong>Максимум баллов:<span id="MaximumScore"> ${s.TotalQuestions * 10}</span>. Наичсляется 10б за ответ с 1 попытки и 5б за ответ со 2 и более попытки</strong></p>
    <p><button type="submit" onclick="update_settings()">Сохранить настройки</button></p>`;
    return s;
})

async function formCheck() {

    const updateMaxScore = () => {
        const totalInput = document.getElementById('totalQuestions');
        const scoreSpan = document.getElementById('MaximumScore');
        if (totalInput && scoreSpan) {
            const total = parseInt(totalInput.value, 10) || 0;
            scoreSpan.textContent = ` ${total * 10}`;
        }
    };

    const showWarning = () => {
        const el = document.querySelector('#unsavedWarning');
        if (!el) {
            const scoreSpan = document.querySelector('#MaximumScore');
            const warning = document.createElement('div');
            warning.id = 'unsavedWarning';
            warning.style.cssText = 'color:red;font-weight:bold;font-size:16px;margin-top:10px;padding:10px;background:#ffe6e6;border:2px solid red;border-radius:5px;text-align:center;';
            warning.textContent = '⚠️ Настройки не сохранены';
            if (scoreSpan) scoreSpan.parentElement.parentElement.insertAdjacentElement('afterend', warning);
        }
    };

    const hideWarning = () => {
        const el = document.querySelector('#unsavedWarning');
        if (el) el.style.display = 'none';
    };

    const check = () => {
        updateMaxScore();
        if (!savedSettingsValues) return;
        const fields = [
            { id: 'teacherIP', key: 'TeacherIP', parse: v => String(v).trim() },
            { id: 'secondaryTeacherIP', key: 'SecondaryTeacherIP', parse: v => String(v).trim() },
            { id: 'port', key: 'Port', parse: v => parseInt(v, 10) || 0 },
            { id: 'totalQuestions', key: 'TotalQuestions', parse: v => parseInt(v, 10) || 0 },
            { id: 'timePerQuestion', key: 'TimePerQuestion', parse: v => parseInt(v, 10) || 0 },
            { id: 'graduations5', key: 'Graduations5', parse: v => parseInt(v, 10) || 0 },
            { id: 'graduations4', key: 'Graduations4', parse: v => parseInt(v, 10) || 0 },
            { id: 'graduations3', key: 'Graduations3', parse: v => parseInt(v, 10) || 0 }
        ];
        for (const f of fields) {
            const input = document.getElementById(f.id);
            const currentValue = input ? f.parse(input.value) : null;
            const savedValue = savedSettingsValues[f.key];
            if (currentValue !== savedValue) {
                showWarning();
                return;
            }
        }
        hideWarning();
    };


    if (settings && typeof settings.then === 'function') {
        settings.then((s) => {
            if (!s || typeof s !== 'object') return;
            savedSettingsValues = {
                TeacherIP: String(s.TeacherIP || '127.0.0.1').trim(),
                SecondaryTeacherIP: String(s.SecondaryTeacherIP || '').trim(),
                Port: parseInt(s.Port, 10) || 5000,
                TotalQuestions: parseInt(s.TotalQuestions, 10) || 10,
                TimePerQuestion: parseInt(s.TimePerQuestion, 10) || 10,
                Graduations5: parseInt(s.Graduations5, 10) || 90,
                Graduations4: parseInt(s.Graduations4, 10) || 75,
                Graduations3: parseInt(s.Graduations3, 10) || 50
            };
            updateMaxScore();
        });
    }

    const attach = () => {
        const ids = ['teacherIP','secondaryTeacherIP','port','totalQuestions','timePerQuestion','graduations5','graduations4','graduations3'];
        let ok = true;
        ids.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', check);
                input.addEventListener('change', check);
            } else {
                ok = false;
            }
        });
        if (ok) setTimeout(check, 200);
        return ok;
    };

    if (!attach()) setTimeout(formCheck, 300);
}



formCheck();



function update_settings() { 
    const TeacherIP = String(document.getElementById('teacherIP').value).trim();
    const SecondaryTeacherIP = String(document.getElementById('secondaryTeacherIP').value).trim();
    const Port = parseInt(document.getElementById('port').value, 10) || 5000;
    const TotalQuestions = parseInt(document.getElementById('totalQuestions').value, 10) || 10;
    const TimePerQuestion = parseInt(document.getElementById('timePerQuestion').value, 10) || 10;
    const Graduations5 = parseInt(document.getElementById('graduations5').value, 10) || 90;
    const Graduations4 = parseInt(document.getElementById('graduations4').value, 10) || 75;
    const Graduations3 = parseInt(document.getElementById('graduations3').value, 10) || 50;
    

    fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TeacherIP, SecondaryTeacherIP, Port, TotalQuestions, TimePerQuestion, Graduations5, Graduations4, Graduations3 }),
        credentials: 'include'
    }).then(res => res.json()).then(data => {
        if (data.error) {
            alert(`Ошибка: ${data.error}`);
        } else {
            if (data.port_changed) {
                alert(`⚠️ Блокировка порта:\nПорт изменён с ${data.old_port} на ${data.new_port}\n\nНастройки сохранены в файл, но сервер ещё работает на старом порту.\nДля применения нового порта нужно перезагрузить сервер вручную!\n\nОстановите сервер (Ctrl+C) и запустите его заново.`);
            } else {
                alert('✅ Настройки сохранены');
            }


            savedSettingsValues = {
                TeacherIP: TeacherIP,
                SecondaryTeacherIP: SecondaryTeacherIP,
                Port: Port,
                TotalQuestions: TotalQuestions,
                TimePerQuestion: TimePerQuestion,
                Graduations5: Graduations5,
                Graduations4: Graduations4,
                Graduations3: Graduations3
            };


            const unsavedWarning = document.querySelector('#unsavedWarning');
            if (unsavedWarning) {
                unsavedWarning.remove();
            }
            

            console.log('📨 Отправляю обновленные настройки студентам:', {TotalQuestions, TimePerQuestion});
            teacherSocket.emit('update_student_settings', {
                TotalQuestions: TotalQuestions,
                TimePerQuestion: TimePerQuestion
            });
        }
    }).catch(() => {
        alert('❌ Ошибка при сохранении настроек');
    });
}



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
    const settingsParametrs = document.querySelectorAll('.settings-parametres');

    if (status.active) {
        settingsParametrs.forEach(input => input.disabled = true);
        startPowers.disabled = true;
        startSquares.disabled = true;
        stopBtn.style.display = 'inline-block';
        finalizeBtn.style.display = 'none';
        activeInfo.style.display = 'block';
        variantBtn.style.display = 'none'; 
        newBtn.style.display = 'none';
        
    } else if (!status.active && !status.finalized) {
        settingsParametrs.forEach(input => input.disabled = false);
        startPowers.disabled = false;
        startSquares.disabled = false;
        stopBtn.style.display = 'none';
        finalizeBtn.style.display = 'inline-block';
        activeInfo.style.display = 'none';
        variantBtn.style.display = 'none';
        newBtn.style.display = 'inline-block';

    } else if (!status.active && status.finalized) {
        settingsParametrs.forEach(input => input.disabled = false);
        startPowers.disabled = false;
        startSquares.disabled = false;
        stopBtn.style.display = 'none';
        finalizeBtn.style.display = 'none';
        activeInfo.style.display = 'none';
        variantBtn.style.display = 'block';
        newBtn.style.display = 'none';

    } else {
        settingsParametrs.forEach(input => input.disabled = false);
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
        
        fetch('/api/test-status', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                console.log('📊 Статус теста при подключении:', data);
                updateButtons(data);
            })
            .catch(err => console.error('❌ Ошибка получения статуса теста:', err));
        
        loadResults([]); 
        fetch('/api/check-login', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn) {
                    teacherSocket.emit('get_students');
                } else {
                    console.log('Не авторизован');
                }
            })
            .catch(() => {
                console.log('Ошибка проверки логина');
            });
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

    teacherSocket.on('check_dead_students', (data) => {
        const deadStudents = data.students || [];
        if (deadStudents.length > 0) {
            let studentList = deadStudents.map(s => `${s.name} (ПК: ${s.pc})`).join('\n');
            const shouldKick = confirm(`Обнаружены студенты без активного подключения:\n\n${studentList}\n\nВыгнать этих студентов?`);
            if (shouldKick) {
                deadStudents.forEach(student => {
                    teacherSocket.emit('kick_student', { ip: student.ip });
                });
            }
        }
    });


    teacherSocket.on('test_stopped', () => {
        updateButtons({active: false, finalized: false});
        document.getElementById('activeTestInfo').style.display = 'none';

        // Обновляем savedSettingsValues чтобы система предупреждений продолжала работать после остановки теста
        setTimeout(() => {
            const t = document.getElementById('totalQuestions');
            const tp = document.getElementById('timePerQuestion');
            const ip = document.getElementById('teacherIP');
            const p = document.getElementById('port');
            const g5 = document.getElementById('graduations5');
            const g4 = document.getElementById('graduations4');
            const g3 = document.getElementById('graduations3');

            if (t && tp && ip && p && g5 && g4 && g3) {
                savedSettingsValues = {
                    TeacherIP: String(ip.value).trim(),
                    Port: parseInt(p.value, 10) || 5000,
                    TotalQuestions: parseInt(t.value, 10) || 10,
                    TimePerQuestion: parseInt(tp.value, 10) || 10,
                    Graduations5: parseInt(g5.value, 10) || 90,
                    Graduations4: parseInt(g4.value, 10) || 75,
                    Graduations3: parseInt(g3.value, 10) || 50
                };
            }
        }, 100);
    });


}



function escapeOutput(toOutput){
    return String(toOutput).replace(/\&/g, '&amp;')
        .replace(/\</g, '&lt;')
        .replace(/\>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/\'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
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
            <td>${escapeOutput(s.computer_number)}</td>
            <td>${escapeOutput(s.name)}</td>
            <td>${escapeOutput(s.ip)}</td>
            <td>${correct}/10</td>
            <td>${escapeOutput(s.score != null ? s.score : '-') }</td>
            <td>${escapeOutput(s.grade || '-') }</td>
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
});

document.getElementById('reloadBtn').addEventListener('click', () => {
    teacherSocket.emit('reload_students')
})