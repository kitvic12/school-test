let QUESTION_TIME = 10;  
let TOTAL_QUESTIONS = 10;


fetch('/api/get_student_settings')
    .then(response => response.json())
    .then(data => {
        QUESTION_TIME = data.TimePerQuestion || 10;
        TOTAL_QUESTIONS = data.TotalQuestions || 1;
        console.log(`✅ Загружены настройки: ${TOTAL_QUESTIONS} вопросов, ${QUESTION_TIME}сек на вопрос`);
    })
    .catch(err => console.log('⚠️ Не удалось загрузить настройки:', err));

const logoutBtn = document.getElementById('logout-student-btn');
const error_place = document.getElementById('error')

class StudentTestSystem {
    constructor() {
        this.studentName = '';
        this.registered = false;
        this.testActive = false;
        this.testVariant = null;
        this.testFinalized = false;
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
            // Отправляем пустые данные - сервер сам считает баллы
            socket.emit('student_submit', {});
            
            const handleSuccess = (data) => {
                socket.off('submit_error', handleError);
                resolve({ grade: data.grade, score: data.score });
            };
            
            const handleError = (data) => {
                socket.off('submit_success', handleSuccess);
                resolve({ error: data.error });
            };
            
            socket.on('submit_success', handleSuccess);
            socket.on('submit_error', handleError);
        });
    }

    async generateUniqueQuestion() {
        if (!this.testVariant) {console.log("Fuck u");return null}
        
        return new Promise((resolve) => {
            console.log("Generating unique question...");
            socket.emit('new_quest', { 
                mode: this.testVariant, 
                question_type: 'random' 
            });
            console.log("Emitting new_quest event...");

            
            
            const handleNewQuest = (data) => {
                socket.off('quest_error', handleQuestError);
                

                const { question, returned_type } = data;

                let questionHtml = '';

                if (returned_type === 'base') {
                    if (this.testVariant === 'sqrt') {
                        questionHtml = `Чему равен квадрат числа ${question}<sup>2</sup>?`;
                    } else {
                        questionHtml = `Чему равно 2<sup>${question}</sup>?`;
                    }
                } else {
                    if (this.testVariant === 'sqrt') {
                        questionHtml = `Чему равен корень из ${question}?`;
                    } else {
                        questionHtml = `В какую степень нужно возвести 2, чтобы получить ${question}?`;
                    }
                }
                
                resolve({ 
                    questionHtml: questionHtml, 
                    question: question, 
                    questionType: returned_type,
                    answer: undefined  
                });
            };
            
            const handleQuestError = (data) => {
                socket.off('new_quest', handleNewQuest);
                resolve(null);
            };
            
            socket.on('new_quest', handleNewQuest);
            socket.on('quest_error', handleQuestError);
        });
    }
    
    async checkAnswer(question, questionType, studentAnswer) {
        return new Promise((resolve) => {
            socket.emit('check_quest', { 
                mode: this.testVariant, 
                question: question, 
                question_type: questionType, 
                student_answer: studentAnswer 
            });
            
            const handleCheckResult = (data) => {
                socket.off('check_error', handleCheckError);
                resolve(data.result);
            };
            
            const handleCheckError = (data) => {
                socket.off('check_result', handleCheckResult);
                resolve(false);
            };
            
            socket.on('check_result', handleCheckResult);
            socket.on('check_error', handleCheckError);
        });
    }
}

const socket = io('/student');
const studentSystem = new StudentTestSystem();

let score = 0;
let questionCount = 0;
let questionTimer = null;
let timeLeft = QUESTION_TIME;
let currentQuestionData = null;
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
    if (!isNaN(lastInput) && currentQuestionData && 
        studentSystem.checkAnswer(currentQuestionData.question, currentQuestionData.questionType, lastInput)) {
        const points = (attemptCount === 1) ? 10 : 5;
        score += points;
        questionCount++;
        showAnswerFeedback(true, 'Верный ответ!');
    } else {
        questionCount++;
        showAnswerFeedback(false, 'Время вышло!');
    }
}

async function generateQuestion() {
    error_place.textContent = " ";
    const qData = await studentSystem.generateUniqueQuestion();
    if (!qData) return;
    currentQuestionData = qData;
    attemptCount = 0;
    
    // Использую textContent для безопасного отображения вопроса с HTML элементами
    const questionElement = document.getElementById('question');
    questionElement.innerHTML = ''; // Очищаю элемент
    
    // Парсю HTML из questionHtml
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = qData.questionHtml;
    
    // Добавляю содержимое в реальный элемент
    while (tempDiv.firstChild) {
        questionElement.appendChild(tempDiv.firstChild);
    }
    
    // Добавляю текст с номером вопроса
    const questionNumber = document.createElement('span');
    questionNumber.textContent = ` (Вопрос ${questionCount + 1}/${TOTAL_QUESTIONS})`;
    questionElement.appendChild(questionNumber);
    
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

async function handleAnswerSubmit() {
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
    
    if (!currentQuestionData) {
        error_place.textContent = 'Ошибка загрузки вопроса';
        return;
    }
    
    attemptCount++;
    const isCorrect = await studentSystem.checkAnswer(
        currentQuestionData.question, 
        currentQuestionData.questionType, 
        userAnswer
    );
    
    if (isCorrect) {
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
    document.getElementById('main-title').textContent = 'Тест завершён';
    const resultMessage = document.getElementById('result-message');
    document.getElementById('test-block').style.display = 'none';
    document.getElementById('waiting-block').style.display = 'none';
    document.getElementById('result-block').style.display = 'block';
    
    // Отправляем на сервер (без score - сервер сам считает баллы)
    const result = await studentSystem.submitResult(null);
    
    if (result.error) {
        resultMessage.textContent = `❌ Ошибка: ${result.error}`;
        console.log(`Ошибка отправки ${result.error}`);
    } else {
        // Показываем баллы и оценку, полученные от сервера
        const finalScore = result.score || 0;
        const grade = result.grade || '2';
        resultMessage.textContent = `✅ Тест завершён!\nБаллы: ${finalScore}\nОценка: ${grade}`;
    }
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

    async function checkServerSessionAndRestore() {
        try {
            const response = await fetch('/api/server-session');
            const data = await response.json();
            const currentServerSessionId = data.server_session_id;
            const savedServerSessionId = localStorage.getItem('server_session_id');
            
            if (savedServerSessionId && savedServerSessionId !== currentServerSessionId) {
                localStorage.clear();
                localStorage.setItem('server_session_id', currentServerSessionId);
                return;
            }
            localStorage.setItem('server_session_id', currentServerSessionId);
        } catch (e) {
            console.log('Ошибка при проверке сессии сервера:', e);
        }
    }

    checkServerSessionAndRestore();

    const savedSession = localStorage.getItem('student_session');
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            if (session.name && session.computerNumber) {
                studentSystem.studentName = session.name;
                studentSystem.computerNumber = session.computerNumber;
                studentSystem.registered = true;
                nameInput.value = session.name;
                compInput.value = session.computerNumber;
                displayName.textContent = session.name;
                regBlock.style.display = 'none';
                waitBlock.style.display = 'block';
                title.textContent = 'Ожидание';
                logoutBtn.style.display = 'inline-block';

                socket.emit('student_register', {
                    student_name: session.name,
                    computer_number: session.computerNumber
                });
            }
        } catch (e) {
            console.log('Не удалось восстановить сеанс:', e);
            localStorage.removeItem('student_session');
        }
    }

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
        localStorage.removeItem('student_session');
        studentSystem.registered = false;
        studentSystem.testActive = false;
        studentSystem.testVariant = null;
        studentSystem.usedQuestions = [];
        regBlock.style.display = 'block';
        testBlock.style.display = 'none';
        resultBlock.style.display = 'none';
        waitBlock.style.display = 'none';
        title.textContent = 'Регистрация';
        nameInput.value = '';
        compInput.value = '';
        answerInput.value = '';
        logoutBtn.style.display = 'none';
        questionCount = 0;
        score = 0;
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

    startBtn.addEventListener('click', async () => {
        if (!studentSystem.registered || !studentSystem.testActive) return;
        waitBlock.style.display = 'none';
        testBlock.style.display = 'block';
        title.textContent = 'Тестирование';
        score = 0;
        questionCount = 0;
        studentSystem.usedQuestions = []; 
        await generateQuestion();
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

    socket.on('logout_success', () => {
        localStorage.removeItem('student_session');
        studentSystem.registered = false;
        studentSystem.testActive = false;
        studentSystem.testVariant = null;
        studentSystem.usedQuestions = [];
        regBlock.style.display = 'block';
        waitBlock.style.display = 'none';
        testBlock.style.display = 'none';
        resultBlock.style.display = 'none';
        title.textContent = 'Регистрация';
        nameInput.value = '';
        compInput.value = '';
        answerInput.value = '';
        logoutBtn.style.display = 'none';
        questionCount = 0;
        score = 0;
    });

    logoutBtn.addEventListener('click', () => {
        if (!confirm('Выйти из теста?')) return;
        socket.emit('student_logout');
    });

    socket.on('update_student_settings', (data) => {
        TOTAL_QUESTIONS = data.TotalQuestions;
        QUESTION_TIME = data.TimePerQuestion;
    });
});
