const QUESTION_TIME = 10;

class StudentTestSystem {
    constructor() {
        this.studentName = '';
        this.registered = false;
        this.testActive = false;
        this.testVariant = null;
        this.testFinalized = false;
        this.usedQuestions = new Set();
    }

    async checkTestStatus() {
        try {
            const response = await fetch('/api/test-status');
            const data = await response.json();
            return data;
        } catch (error) {
            return { active: false, variant: null, finalized: false };
        }
    }

    async register(studentName) {
        try {
            const response = await fetch('/api/student/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_name: studentName })
            });
            const result = await response.json();
            if (response.ok) {
                this.studentName = studentName;
                this.registered = true;
            }
            return result;
        } catch (error) {
            return { error: 'Ошибка соединения' };
        }
    }

    async submitResult(score) {
        try {
            const response = await fetch('/api/student/submit-result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_name: this.studentName,
                    score: score
                })
            });
            return await response.json();
        } catch (error) {
            return { error: 'Ошибка соединения' };
        }
    }

    generateUniqueQuestion() {
        if (!this.testVariant) return null;
        const maxAttempts = 100;
        let attempts = 0;
        while (attempts < maxAttempts) {
            let questionHtml, answer, key;
            if (this.testVariant === 'powers') {
                const exponent = Math.floor(Math.random() * 15);
                questionHtml = `Чему равно 2<sup>${exponent}</sup>?`;
                answer = Math.pow(2, exponent);
                key = `powers_${exponent}`;
            } else {
            const number = Math.floor(Math.random() * 21) + 10;
                questionHtml = `Чему равен квадрат числа ${number}<sup>2</sup>?`;
                answer = number * number;
                key = `squares_${number}`;
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

const studentSystem = new StudentTestSystem();

let score = 0;
let questionCount = 0;
const TOTAL_QUESTIONS = 10;
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
    questionCount++;
    showAnswerFeedback(false, 'Время вышло!');
}

function generateQuestion() {
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

async function finishTest() {
    clearInterval(questionTimer);
    document.getElementById('timer-container').style.display = 'none';
    const finalScore = Math.min(100, Math.max(0, Math.round(score)));
    const result = await studentSystem.submitResult(finalScore);
    document.getElementById('main-title').textContent = 'Тест завершён';
    const resultMessage = document.getElementById('result-message');
    if (result.error) {
        resultMessage.textContent = `❌ Ошибка отправки: ${result.error}`;
    } else {
        resultMessage.textContent = `✅ Тест завершён!\nБаллы: ${finalScore}`;
    }
    document.getElementById('test-block').style.display = 'none';
    document.getElementById('waiting-block').style.display = 'none';
    document.getElementById('result-block').style.display = 'block';
}

async function showFinalResults() {
    const response = await fetch('/api/results');
    const data = await response.json();
    const studentResult = data.results.find(s => s.name === studentSystem.studentName);
    if (studentResult && studentResult.score !== null) {
        document.getElementById('main-title').textContent = 'Результаты';
        document.getElementById('result-message').textContent = 
            `✅ Тест завершён!\nБаллы: ${studentResult.score}`;
        document.getElementById('test-block').style.display = 'none';
        document.getElementById('waiting-block').style.display = 'none';
        document.getElementById('result-block').style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Элементы
    const regBlock = document.getElementById('registration-block');
    const waitBlock = document.getElementById('waiting-block');
    const testBlock = document.getElementById('test-block');
    const resultBlock = document.getElementById('result-block');
    const title = document.getElementById('main-title');
    const nameInput = document.getElementById('student-name');
    const registerBtn = document.getElementById('register-btn');
    const displayName = document.getElementById('display-name');
    const startBtn = document.getElementById('start-btn');
    const answerInput = document.getElementById('answer');
    const submitBtn = document.getElementById('submit-btn');
    if (!registerBtn || !startBtn) {
        console.error('❌ Не найдены кнопки регистрации или старта');
        return;
    }


    registerBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            alert('Введите фамилию');
            return;
        }
        const result = await studentSystem.register(name);
        if (result.error) {
            alert(result.error);
            return;
        }
        studentSystem.studentName = name;
        displayName.textContent = name;
        regBlock.style.display = 'none';
        waitBlock.style.display = 'block';
        title.textContent = 'Ожидание';
        const status = await studentSystem.checkTestStatus();
        studentSystem.testActive = status.active;
        studentSystem.testVariant = status.variant;
        if (studentSystem.testActive) {
            startBtn.style.display = 'inline-block';
        }
    });

    // Старт теста
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

    // Отправка ответа
    submitBtn.addEventListener('click', () => {
        if (!studentSystem.registered || !studentSystem.testActive || questionCount >= TOTAL_QUESTIONS || timeLeft <= 0) return;
        const userAnswer = parseInt(answerInput.value.trim());
        if (isNaN(userAnswer)) {
            alert('Введите число');
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
    });

    // Проверка статуса каждую секунду
    setInterval(async () => {
        const status = await studentSystem.checkTestStatus();
        
        // Обновляем статус в системе
        studentSystem.testActive = status.active;
        studentSystem.testVariant = status.variant;
        studentSystem.testFinalized = status.finalized;

        // Управление кнопкой старта
        if (studentSystem.registered && studentSystem.testActive && !studentSystem.testFinalized) {
            startBtn.style.display = 'inline-block';
        } else {
            startBtn.style.display = 'none';
        }

        // Показ результатов после сдачи
        if (!studentSystem.testActive && !studentSystem.testFinalized && questionCount >= TOTAL_QUESTIONS) {
            showFinalResults();
        }
    }, 1000);
});