localStorage.removeItem('student_session');

const QUESTION_TIME = 10;
const TOTAL_QUESTIONS = 10;

const logoutBtn = document.getElementById('logout-student-btn');
const error_place = document.getElementById('error')

class StudentTestSystem {
    constructor() {
        this.studentName = '';
        this.registered = false;
        this.testActive = false;
        this.testVariant = null;
        this.testFinalized = false;
        this.usedQuestions = new Set();
        this.computerNumber = '';
    }

    async register(studentName, computerNumber) {
        return new Promise((resolve) => {
            socket.emit('student_register', { 
                student_name: studentName, 
                computer_number: computerNumber 
            });
            
            const handleSuccess = (data) => {
                socket.off('register_error', handleError);
                this.studentName = studentName;
                this.computerNumber = computerNumber;
                this.registered = true;
                this.testActive = data.active;
                this.testVariant = data.variant;
                
                localStorage.setItem('student_session', JSON.stringify({
                    name: studentName,
                    computerNumber: computerNumber,
                    registered: true
                }));
                
                resolve({ success: true });
            };
            
            const handleError = (data) => {
                socket.off('register_success', handleSuccess);
                resolve({ error: data.error });
            };
            
            socket.on('register_success', handleSuccess);
            socket.on('register_error', handleError);
        });
    }

    async submitResult(score) {
        return new Promise((resolve) => {
            socket.emit('student_submit', { score });
            
            const handleSuccess = (data) => {
                socket.off('submit_error', handleError);
                resolve({ grade: data.grade });
            };
            
            const handleError = (data) => {
                socket.off('submit_success', handleSuccess);
                resolve({ error: data.error });
            };
            
            socket.on('submit_success', handleSuccess);
            socket.on('submit_error', handleError);
        });
    }

    generateUniqueQuestion() {
        if (!this.testVariant) return null;
        const maxAttempts = 100;
        let attempts = 0;
        while (attempts < maxAttempts) {
            let questionHtml, answer, key;
            if (this.testVariant === 'powers') {
                const type = Math.random() > 0.5 ? 'direct' : 'reverse';
                if (type === 'direct') {
                    const exp = Math.floor(Math.random() * 15); 
                    questionHtml = `Чему равно 2<sup>${exp}</sup>?`;
                    answer = Math.pow(2, exp);
                    key = `p_dir_${exp}`;
                } else {
                    const exp = Math.floor(Math.random() * 15); 
                    const res = Math.pow(2, exp);
                    questionHtml = `В какую степень нужно возвести 2, чтобы получить ${res}?`;
                    answer = exp;
                    key = `p_rev_${res}`;
                }
            } else {
                const type = Math.random() > 0.5 ? 'direct' : 'reverse';
                if (type === 'direct') {
                    const num = Math.floor(Math.random() * 21) + 10;
                    questionHtml = `Чему равен квадрат числа ${num}<sup>2</sup>?`;
                    answer = num * num;
                    key = `s_dir_${num}`;
                } else {
                    const base = Math.floor(Math.random() * 21) + 10; 
                    const res = Math.pow(base, 2);
                    questionHtml = `Чему равен корень из ${res}?`;
                    answer = base;
                    key = `s_rev_${res}`;
                }
            }
            if (!this.usedQuestions.has(key)) {
                this.usedQuestions.add(key);
                return { questionHtml, answer, key };
            }
            attempts++;
        }
        this.usedQuestions.clear();
        return this.generateUniqueQuestion();
    }
}

const socket = io('/student');
const studentSystem = new StudentTestSystem();

let score = 0;
let questionCount = 0;
let questionTimer = null;
let timeLeft = QUESTION_TIME;
let currentCorrectAnswer = null;
let attemptCount = 0;

function updateQuestionTimerDisplay() {
    const timerEl = document.getElementById('timer-container');
    timerEl.textContent = timeLeft + ' с';
    timerEl.style.display = 'block';
}

function startQuestionTimer() {
    clearInterval(questionTimer);
    timeLeft = QUESTION_TIME;
    updateQuestionTimerDisplay();
    questionTimer = setInterval(() => {
        timeLeft--;
        updateQuestionTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(questionTimer);
            handleTimeUp();
        }
    }, 1000);
}

function handleTimeUp() {
    const lastInput = parseInt(document.getElementById('answer').value.trim());
    if (!isNaN(lastInput) && lastInput === currentCorrectAnswer) {
        const points = (attemptCount === 1) ? 10 : 5;
        score += points;
        questionCount++;
        showAnswerFeedback(true, 'Верный ответ!');
    } else {
        questionCount++;
        showAnswerFeedback(false, 'Время вышло!');
    }
}

function generateQuestion() {
    error_place.textContent = " ";
    const qData = studentSystem.generateUniqueQuestion();
    if (!qData) return;
    currentCorrectAnswer = qData.answer;
    attemptCount = 0;
    document.getElementById('question').innerHTML = `${qData.questionHtml} (Вопрос ${questionCount + 1}/${TOTAL_QUESTIONS})`;
    document.getElementById('answer').value = '';
    document.getElementById('answer').focus();
    startQuestionTimer();
}

function showAnswerFeedback(isCorrect, message = '') {
    const answerStatus = document.getElementById('answer-status');
    answerStatus.className = isCorrect ? 'right' : 'wrong';
    setTimeout(() => answerStatus.classList.add('expand'), 10);
    setTimeout(() => {
        answerStatus.classList.remove('expand');
        answerStatus.classList.add('hidden');
        if (questionCount >= TOTAL_QUESTIONS) {
            finishTest();
        } else if (!isCorrect && timeLeft > 0) {
            document.getElementById('answer').value = '';
            document.getElementById('answer').focus();
        } else {
            generateQuestion();
        }
    }, 1000);
}

function handleAnswerSubmit() {
    if (!studentSystem.registered || !studentSystem.testActive || questionCount >= TOTAL_QUESTIONS) return;
    
    if (timeLeft <= 0) {
        error_place.textContent = 'Время вышло!';
        return;
    }
    
    const userAnswer = parseInt(document.getElementById('answer').value.trim());
    if (isNaN(userAnswer)) {
        error_place.textContent = 'Введите число';
        return;
    }
    
    attemptCount++;
    if (userAnswer === currentCorrectAnswer) {
        const points = (attemptCount === 1) ? 10 : 5;
        score += points;
        questionCount++;
        showAnswerFeedback(true);
    } else {
        showAnswerFeedback(false, 'Неверно!');
    }
}

async function finishTest() {
    clearInterval(questionTimer);
    document.getElementById('timer-container').style.display = 'none';
    const finalScore = Math.min(100, Math.max(0, Math.round(score)));
    document.getElementById('main-title').textContent = 'Тест завершён';
    const resultMessage = document.getElementById('result-message');
    resultMessage.textContent = `✅ Тест завершён!\nБаллы: ${finalScore}`;
    document.getElementById('test-block').style.display = 'none';
    document.getElementById('waiting-block').style.display = 'none';
    document.getElementById('result-block').style.display = 'block';
    const result = await studentSystem.submitResult(finalScore);
    if (result.error) console.log(`Ошибка отправки ${result.error}`);
    logoutBtn.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
    const regBlock = document.getElementById('registration-block');
    const waitBlock = document.getElementById('waiting-block');
    const testBlock = document.getElementById('test-block');
    const resultBlock = document.getElementById('result-block');
    const title = document.getElementById('main-title');
    const nameInput = document.getElementById('student-name');
    const compInput = document.getElementById('computer-number');
    const registerBtn = document.getElementById('register-btn');
    const displayName = document.getElementById('display-name');
    const startBtn = document.getElementById('start-btn');
    const answerInput = document.getElementById('answer');
    const submitBtn = document.getElementById('submit-btn');

    socket.on('connect', () => {
        console.log('✅ Ученик подключён');
    });

    socket.on('test_started', (data) => {
        questionCount = 0;
        studentSystem.testActive = true;
        studentSystem.testVariant = data.variant;
        if (studentSystem.registered) {
            if (questionCount < TOTAL_QUESTIONS) {
                startBtn.style.display = 'inline-block';
                logoutBtn.style.display = 'none';
            } else {
                startBtn.style.display = 'none';
                logoutBtn.style.display = 'inline-block';
            }
        }
    });

    socket.on('test_stopped', (data) => {
        studentSystem.testActive = false;
        finishTest();
    });

    socket.on('new_test', (data) => {
        studentSystem.testActive = false;
        regBlock.style.display = 'none';
        waitBlock.style.display = 'block';
        title.textContent = 'Ожидание';
        logoutBtn.style.display = 'inline-block'; 
        resultBlock.style.display = 'none';
        startBtn.style.display = 'none'; 
    });

    socket.on('test_finalized', () => {
        regBlock.style.display = 'block'; 
        testBlock.style.display = 'none'; 
        resultBlock.style.display = 'none';
        waitBlock.style.display = 'none'; 
        title.textContent = 'Регистрация'; 
        studentSystem.testActive = false;
        logoutBtn.style.display = 'none';
    });

    socket.on('kicked_to_login', () => {
        alert('Вас выгнали!');
        localStorage.removeItem('student_session');
        window.location.href = '/';
        logoutBtn.style.display = 'none';
    });

    registerBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const compNum = compInput.value.trim();
        if (!name || !compNum) {
            alert('Введите фамилию и номер компьютера');
            return;
        }
        const result = await studentSystem.register(name, compNum);
        if (result.error) {
            alert(result.error);
            return;
        }
        studentSystem.studentName = name;
        displayName.textContent = name;
        regBlock.style.display = 'none';
        waitBlock.style.display = 'block';
        title.textContent = 'Ожидание';
        logoutBtn.style.display = 'inline-block';
        if (studentSystem.testActive) {
            startBtn.style.display = 'inline-block';
        } else { 
            startBtn.style.display = 'none';
        }
    });

    startBtn.addEventListener('click', () => {
        if (!studentSystem.registered || !studentSystem.testActive) return;
        waitBlock.style.display = 'none';
        testBlock.style.display = 'block';
        title.textContent = 'Тестирование';
        score = 0;
        questionCount = 0;
        studentSystem.usedQuestions.clear();
        generateQuestion();
    });

    answerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            handleAnswerSubmit();
        }
    });

    answerInput.setAttribute('autocomplete', 'off');
    answerInput.setAttribute('autocorrect', 'off');
    answerInput.setAttribute('autocapitalize', 'off');
    answerInput.setAttribute('spellcheck', 'false');

    submitBtn.addEventListener('click', handleAnswerSubmit);

    logoutBtn.addEventListener('click', () => {
        if (!confirm('Выйти из теста?')) return;
        socket.emit('student_logout');
        logoutBtn.style.display = 'none';
    });
});