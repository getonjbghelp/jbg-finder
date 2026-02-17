// overlay.js - Оверлей для Jackbox Games (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// Сохраните этот файл как overlay.js

(function() {
    // Удаляем существующий оверлей
    const existing = document.getElementById('game-finder-overlay');
    if (existing) existing.remove();

    // === КОНФИГУРАЦИЯ ===
    const CONFIG = {
        databaseURL: 'https://getonjbghelp.github.io/jbg-finder/database.js',
        checkInterval: 2000,
        minQuestionLength: 15,
        defaultLang: 'ru'
    };

    // === ЯЗЫКОВЫЕ НАСТРОЙКИ ===
    const LANG = {
        ru: {
            title: 'JBG-Finder v1.0',
            detectBtn: '🔍 Определить игру',
            searchBtn: '⚡ Найти ответ',
            copyBtn: '📋 Копировать',
            questionLabel: '📝 ВОПРОС',
            answerLabel: '💡 ОТВЕТ',
            notDetected: 'Не определено',
            scanning: 'Сканирование...',
            gameDetected: 'Игра: ',
            answerFound: 'Ответ найден! (',
            answerNotFound: 'Ответ не найден',
            copySuccess: 'Скопировано!',
            detectFirst: 'Сначала определите игру',
            loadingDB: 'Загрузка базы...',
            dbLoaded: 'База загружена ✓',
            dbError: 'Ошибка загрузки базы',
            confidence: 'уверенность: ',
            symbols: ' символов',
            settings: '⚙️',
            langSelect: 'Язык / Language',
            close: 'Закрыть',
            minimize: 'Свернуть'
        },
        en: {
            title: 'JBG-Finder v1.0',
            detectBtn: '🔍 Detect Game',
            searchBtn: '⚡ Find Answer',
            copyBtn: '📋 Copy',
            questionLabel: '📝 QUESTION',
            answerLabel: '💡 ANSWER',
            notDetected: 'Not Detected',
            scanning: 'Scanning...',
            gameDetected: 'Game: ',
            answerFound: 'Answer Found! (',
            answerNotFound: 'Answer Not Found',
            copySuccess: 'Copied!',
            detectFirst: 'Detect game first',
            loadingDB: 'Loading DB...',
            dbLoaded: 'Database Loaded ✓',
            dbError: 'Database Load Error',
            confidence: 'confidence: ',
            symbols: ' symbols',
            settings: '⚙️',
            langSelect: 'Language / Язык',
            close: 'Close',
            minimize: 'Minimize'
        }
    };

    // === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
    let currentGame = null;
    let currentQuestion = '';
    let lastQuestion = '';
    let gameDatabase = null;
    let currentLang = CONFIG.defaultLang;
    let settingsOpen = false;

    // === ЗАГРУЗКА БАЗЫ ДАННЫХ ===
    async function loadDatabase() {
        return new Promise((resolve) => {
            if (window.GameDatabase) {
                gameDatabase = window.GameDatabase;
                updateStatus(getText('dbLoaded'), 'success');
                updateVersionInfo();
                resolve(true);
                return;
            }

            const script = document.createElement('script');
            script.src = CONFIG.databaseURL + '?t=' + Date.now();
            
            script.onload = () => {
                if (window.GameDatabase) {
                    gameDatabase = window.GameDatabase;
                    updateStatus(getText('dbLoaded'), 'success');
                    updateVersionInfo();
                    resolve(true);
                } else {
                    updateStatus(getText('dbError'), 'error');
                    resolve(false);
                }
            };
            
            script.onerror = () => {
                updateStatus(getText('dbError'), 'error');
                resolve(false);
            };
            
            document.head.appendChild(script);
        });
    }

    // === ПОЛУЧЕНИЕ ТЕКСТА ПО ЯЗЫКУ ===
    function getText(key) {
        return LANG[currentLang][key] || LANG['ru'][key] || key;
    }

    // === ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ВЕРСИИ ===
    function updateVersionInfo() {
        if (!gameDatabase) return;
        
        const versionInfo = gameDatabase.getVersionInfo();
        const versionEl = document.getElementById('db-version');
        const ageEl = document.getElementById('db-age');
        
        if (versionEl) versionEl.textContent = 'v' + versionInfo.version;
        
        if (ageEl) {
            const daysText = versionInfo.daysSinceUpdate === 0 ? 
                (currentLang === 'ru' ? 'сегодня' : 'today') : 
                versionInfo.daysSinceUpdate + 'd';
            ageEl.textContent = daysText;
            ageEl.style.color = versionInfo.isOutdated ? '#ff6b6b' : '#4ecdc4';
        }
    }

    // === ОБНОВЛЕНИЕ СТАТУСА ===
    function updateStatus(message, type) {
        const statusEl = document.getElementById('overlay-status');
        if (statusEl) {
            const colors = {
                info: '#606060',
                success: '#4ecdc4',
                warning: '#ffd93d',
                error: '#ff6b6b',
                searching: '#ffd93d'
            };
            statusEl.textContent = message;
            statusEl.style.color = colors[type] || colors.info;
        }
    }

    // === ОБНОВЛЕНИЕ ИНДИКАТОРА ===
    function updateIndicator(detectionResult) {
        const dot = document.getElementById('status-dot');
        const name = document.getElementById('game-name');
        const confidence = document.getElementById('game-confidence');
        const watermark = document.getElementById('game-watermark');
        
        if (detectionResult && detectionResult.gameId) {
            const config = gameDatabase.gameConfig[detectionResult.gameId];
            dot.className = 'indicator-dot active';
            name.textContent = config.name;
            confidence.textContent = detectionResult.confidence + '/2 ✓';
            confidence.title = 'Found: ' + detectionResult.foundIndicators.join(', ');
            
            if (watermark) {
                watermark.textContent = config.name.toUpperCase();
                watermark.style.color = config.backgroundColor + '15';
            }
            
            currentGame = detectionResult.gameId;
        } else {
            dot.className = 'indicator-dot';
            name.textContent = getText('notDetected');
            confidence.textContent = '';
            
            if (watermark) {
                watermark.textContent = 'GAME FINDER';
                watermark.style.color = 'rgba(255, 255, 255, 0.08)';
            }
            
            currentGame = null;
        }
    }

    // === СОЗДАНИЕ ОВЕРЛЕЯ ===
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'game-finder-overlay';
        overlay.innerHTML = `
            <div class="overlay-background-text" id="game-watermark">GAME FINDER</div>
            
            <div class="overlay-header">
                <div class="header-left">
                    <span class="overlay-title">🎮 Game Finder</span>
                    <span class="db-info">
                        <span id="db-version">v0.0</span>
                        <span class="db-separator">•</span>
                        <span id="db-age">--</span>
                    </span>
                </div>
                <div class="overlay-controls">
                    <button class="overlay-btn settings-btn" title="${getText('settings')}">⚙️</button>
                    <button class="overlay-btn minimize-btn" title="${getText('minimize')}">
                        <svg width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="2" fill="#fff"/></svg>
                    </button>
                    <button class="overlay-btn close-btn" title="${getText('close')}">
                        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0L10 10M10 0L0 10" stroke="#fff" stroke-width="1.5"/></svg>
                    </button>
                </div>
            </div>
            
            <div class="overlay-content">
                <div class="game-indicator">
                    <span class="indicator-dot" id="status-dot"></span>
                    <span class="game-name" id="game-name">Не определено</span>
                    <span class="game-confidence" id="game-confidence"></span>
                </div>
                
                <div class="question-box">
                    <div class="question-header">
                        <span class="question-label">📝 ВОПРОС</span>
                        <span class="question-length" id="question-length">0 символов</span>
                    </div>
                    <div class="question-text" id="question-text">Нажмите "Определить игру" для сканирования...</div>
                </div>
                
                <div class="answer-box" id="answer-box">
                    <div class="answer-header">
                        <span class="answer-label">💡 ОТВЕТ</span>
                        <span class="answer-confidence" id="answer-confidence"></span>
                    </div>
                    <div class="answer-text" id="answer-text">Нажмите "Найти ответ" для поиска...</div>
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn detect-btn" id="detect-btn">🔍 Определить игру</button>
                    <button class="action-btn search-btn" id="search-btn" disabled>⚡ Найти ответ</button>
                    <button class="action-btn copy-btn" id="copy-btn" disabled>📋 Копировать</button>
                </div>
                
                <div class="overlay-status" id="overlay-status">Ожидание...</div>
                
                <!-- НАСТРОЙКИ -->
                <div class="settings-panel" id="settings-panel">
                    <div class="settings-header">
                        <span>⚙️ Настройки / Settings</span>
                        <button class="settings-close-btn" id="settings-close-btn">×</button>
                    </div>
                    <div class="settings-content">
                        <div class="setting-item">
                            <span>${getText('langSelect')}</span>
                            <select id="lang-select" class="lang-select">
                                <option value="ru" ${currentLang === 'ru' ? 'selected' : ''}>Русский</option>
                                <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Стили оверлея (ПРЯМОУГОЛЬНЫЙ, ТЁМНО-СЕРЫЙ)
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 580px;
            max-width: 95vw;
            background: linear-gradient(145deg, #2b2b2b 0%, #1e1e1e 100%);
            backdrop-filter: blur(15px);
            border: 1px solid #3a3a3a;
            border-radius: 0px;
            box-shadow: 
                0 10px 40px rgba(0, 0, 0, 0.8),
                0 0 0 1px rgba(255, 255, 255, 0.05);
            z-index: 999999;
            font-family: 'Segoe UI', sans-serif;
            color: #e0e0e0;
            overflow: hidden;
            user-select: none;
            -webkit-user-select: none;
        `;

        document.body.appendChild(overlay);

        // Добавляем CSS
        const style = document.createElement('style');
        style.textContent = `
            #game-finder-overlay * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                user-select: none;
                -webkit-user-select: none;
            }
            
            .overlay-background-text {
				position: absolute;
				top: 50%;
				left: 100%; /* Начинаем справа за границей */
				transform: translateY(-50%); /* Центрируем только по вертикали */
				font-size: 70px;
				font-weight: 900;
				color: rgba(255, 255, 255, 0.05); /* Чуть прозрачнее, чтобы не мешал */
				pointer-events: none;
				white-space: nowrap; /* Запрещаем перенос строк */
				z-index: 0;
				animation: scrollText 30s linear infinite; /* Запускаем анимацию */
			}
            
            .overlay-header {
                display: flex;
                justify-content: space-between;
                align-items: stretch;
                padding: 0;
                background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
                border-bottom: 1px solid #3a3a3a;
                cursor: move;
                height: 40px;
            }
            
            .header-left {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 0 15px;
            }
            
            .overlay-title {
                font-size: 14px;
                font-weight: 600;
                color: #ffffff;
            }
            
            .db-info {
                font-size: 11px;
                color: #808080;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .db-separator {
                color: #505050;
            }
            
            .overlay-controls {
                display: flex;
                height: 100%;
            }
            
            .overlay-btn {
                width: 40px;
                height: 40px;
                border: none;
                border-radius: 0px;
                background: transparent;
                color: #c0c0c0;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.15s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .overlay-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
            }
            
            .settings-btn:hover {
                background: rgba(78, 205, 196, 0.2);
                color: #4ecdc4;
            }
            
            .minimize-btn:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            
            .close-btn:hover {
                background: #e81123;
                color: #ffffff;
            }
            
            .overlay-content {
                padding: 18px;
                position: relative;
                z-index: 10;
            }
            
            .game-indicator {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 15px;
                padding: 10px 14px;
                background: rgba(45, 45, 45, 0.6);
                border: 1px solid #3a3a3a;
            }
            
            .indicator-dot {
                width: 10px;
                height: 10px;
                border-radius: 0px;
                background: #505050;
                transition: all 0.3s ease;
            }
            
            .indicator-dot.active {
                background: #4ecdc4;
                box-shadow: 0 0 10px #4ecdc4;
            }
            
            .indicator-dot.searching {
                background: #ffd93d;
                box-shadow: 0 0 10px #ffd93d;
                animation: pulse 1s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .game-name {
                font-size: 14px;
                color: #ffffff;
                font-weight: 600;
                flex: 1;
            }
            
            .game-confidence {
                font-size: 10px;
                color: #808080;
                padding: 2px 6px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid #3a3a3a;
            }
            
            .question-box, .answer-box {
                margin-bottom: 15px;
                padding: 14px;
                background: rgba(35, 35, 35, 0.7);
                border: 1px solid #3a3a3a;
            }
            
            .question-box {
                border-left: 3px solid #4ecdc4;
            }
            
            .answer-box {
                border-left: 3px solid #505050;
            }
            
            .answer-box.found {
                border-left-color: #4ecdc4;
                background: rgba(78, 205, 196, 0.08);
            }
            
            .answer-box.not-found {
                border-left-color: #ff6b6b;
                background: rgba(255, 107, 107, 0.08);
            }
            
            .question-header, .answer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .question-label, .answer-label {
                font-size: 10px;
                color: #808080;
                font-weight: 600;
                letter-spacing: 1px;
                text-transform: uppercase;
            }
            
            .question-length, .answer-confidence {
                font-size: 9px;
                color: #606060;
                padding: 2px 5px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid #3a3a3a;
            }
            
            .question-text, .answer-text {
                font-size: 13px;
                color: #d0d0d0;
                line-height: 1.5;
                max-height: 120px;
                overflow-y: auto;
                font-weight: 400;
                word-wrap: break-word;
            }
            
            .answer-text {
                font-size: 15px;
                font-weight: 600;
                color: #ffffff;
            }
            
            .answer-box.found .answer-text {
                color: #4ecdc4;
            }
            
            .answer-box.not-found .answer-text {
                color: #ff6b6b;
            }
            
            .action-buttons {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 8px;
                margin-bottom: 15px;
            }
            
            .action-btn {
                padding: 11px 14px;
                border: none;
                border-radius: 0px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.15s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
            }
            
            .action-btn.detect-btn {
                background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
                color: #ffffff;
            }
            
            .action-btn.search-btn {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
                color: #ffffff;
            }
            
            .action-btn.copy-btn {
                background: #3a3a3a;
                color: #c0c0c0;
                border: 1px solid #4a4a4a;
            }
            
            .action-btn:hover:not(:disabled) {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                filter: brightness(1.1);
            }
            
            .action-btn:disabled {
                opacity: 0.35;
                cursor: not-allowed;
                transform: none;
                filter: none;
            }
            
            .action-btn.search-btn:disabled {
                background: linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%);
            }
            
            .overlay-status {
                font-size: 10px;
                color: #606060;
                text-align: center;
                padding-top: 10px;
                border-top: 1px solid #3a3a3a;
                font-family: 'Consolas', monospace;
            }
            
            /* НАСТРОЙКИ */
            .settings-panel {
                position: absolute;
                top: 100%;
                right: 0;
                width: 280px;
                background: #2b2b2b;
                border: 1px solid #3a3a3a;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
                z-index: 100;
                display: none;
            }
            
            .settings-panel.show {
                display: block;
            }
            
            .settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 15px;
                background: #3a3a3a;
                border-bottom: 1px solid #4a4a4a;
            }
            
            .settings-header span {
                font-size: 12px;
                font-weight: 600;
                color: #ffffff;
            }
            
            .settings-close-btn {
                width: 24px;
                height: 24px;
                border: none;
                background: transparent;
                color: #c0c0c0;
                cursor: pointer;
                font-size: 16px;
            }
            
            .settings-close-btn:hover {
                background: #e81123;
                color: #ffffff;
            }
            
            .settings-content {
                padding: 15px;
            }
            
            .setting-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .setting-item span {
                font-size: 12px;
                color: #c0c0c0;
            }
            
            .lang-select {
                padding: 6px 10px;
                background: #3a3a3a;
                border: 1px solid #4a4a4a;
                color: #ffffff;
                font-size: 12px;
                cursor: pointer;
            }
            
            .lang-select:focus {
                outline: none;
                border-color: #4ecdc4;
            }
            
            .overlay-minimized {
                height: 40px !important;
                overflow: hidden;
            }
            
            .overlay-minimized .overlay-content {
                display: none;
            }
            
            /* Scrollbar */
            .question-text::-webkit-scrollbar,
            .answer-text::-webkit-scrollbar,
            .settings-content::-webkit-scrollbar {
                width: 6px;
            }
            
            .question-text::-webkit-scrollbar-track,
            .answer-text::-webkit-scrollbar-track,
            .settings-content::-webkit-scrollbar-track {
                background: #2b2b2b;
            }
            
            .question-text::-webkit-scrollbar-thumb,
            .answer-text::-webkit-scrollbar-thumb,
            .settings-content::-webkit-scrollbar-thumb {
                background: #4a4a4a;
            }
            
            .question-text::-webkit-scrollbar-thumb:hover,
            .answer-text::-webkit-scrollbar-thumb:hover,
            .settings-content::-webkit-scrollbar-thumb:hover {
                background: #5a5a5a;
            }
			
			@keyframes scrollText {
				0% {
					left: 100%; /* Начинаем справа */
				}
				100% {
					left: -200%; /* Уходим далеко влево */
				}
}
        `;
        document.head.appendChild(style);

        return overlay;
    }

    // === АВТО-ОБНОВЛЕНИЕ ВОПРОСА ===
    function autoCheckQuestion() {
        if (!gameDatabase || !currentGame) return;
        
        const question = gameDatabase.extractQuestion(currentGame);
        
        if (question && question !== lastQuestion && question.length >= CONFIG.minQuestionLength) {
            lastQuestion = question;
            currentQuestion = question;
            
            // Обновляем отображение вопроса
            const questionText = document.getElementById('question-text');
            const questionLength = document.getElementById('question-length');
            
            if (questionText) {
                questionText.textContent = question.length > 200 ? 
                    question.substring(0, 200) + '...' : question;
            }
            
            if (questionLength) {
                questionLength.textContent = question.length + getText('symbols');
            }
            
            // Включаем кнопку поиска
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) searchBtn.disabled = false;
            
            updateStatus(getText('gameDetected') + gameDatabase.gameConfig[currentGame].name, 'success');
        }
    }

    // === ОПРЕДЕЛЕНИЕ ИГРЫ ===
    function detectGame() {
        if (!gameDatabase) {
            updateStatus(getText('dbError'), 'error');
            return false;
        }

        updateStatus(getText('scanning'), 'searching');
        document.getElementById('status-dot').className = 'indicator-dot searching';

        setTimeout(() => {
            const detectionResult = gameDatabase.detectGame();
            updateIndicator(detectionResult);
            
            if (detectionResult && detectionResult.gameId) {
                updateStatus(getText('gameDetected') + detectionResult.name + 
                    ' (' + getText('confidence') + detectionResult.confidence + '/2)', 'success');
                document.getElementById('search-btn').disabled = false;
                
                const question = gameDatabase.extractQuestion(detectionResult.gameId);
                if (question) {
                    currentQuestion = question;
                    lastQuestion = question;
                    document.getElementById('question-text').textContent = 
                        question.length > 200 ? question.substring(0, 200) + '...' : question;
                    document.getElementById('question-length').textContent = 
                        question.length + getText('symbols');
                }
            } else {
                updateStatus(getText('detectFirst'), 'warning');
                document.getElementById('search-btn').disabled = true;
            }
            
            document.getElementById('status-dot').className = detectionResult ? 
                'indicator-dot active' : 'indicator-dot';
        }, 500);

        return true;
    }

    // === ПОИСК ОТВЕТА ===
    function searchAnswer() {
        if (!gameDatabase || !currentGame || !currentQuestion) {
            updateStatus(getText('detectFirst'), 'warning');
            return;
        }
        
        updateStatus(getText('scanning'), 'searching');
        document.getElementById('status-dot').className = 'indicator-dot searching';
        
        setTimeout(() => {
            const result = gameDatabase.findAnswer(currentQuestion, currentGame);
            const answerBox = document.getElementById('answer-box');
            const answerText = document.getElementById('answer-text');
            const answerConfidence = document.getElementById('answer-confidence');
            const copyBtn = document.getElementById('copy-btn');
            
            if (result) {
                answerText.textContent = result.answer;
                answerBox.className = 'answer-box found';
                answerConfidence.textContent = result.confidence + '%';
                updateStatus(getText('answerFound') + result.confidence + '%)', 'success');
                copyBtn.disabled = false;
            } else {
                answerText.textContent = getText('answerNotFound');
                answerBox.className = 'answer-box not-found';
                answerConfidence.textContent = '';
                updateStatus(getText('answerNotFound'), 'error');
                copyBtn.disabled = true;
            }
            
            document.getElementById('status-dot').className = 'indicator-dot active';
        }, 300);
    }

    // === КОПИРОВАНИЕ ОТВЕТА ===
    function copyAnswer() {
        const answerText = document.getElementById('answer-text').textContent;
        if (answerText && answerText !== getText('answerNotFound')) {
            navigator.clipboard.writeText(answerText).then(() => {
                updateStatus(getText('copySuccess'), 'success');
                setTimeout(() => updateStatus(getText('gameDetected') + 
                    (currentGame ? gameDatabase.gameConfig[currentGame].name : ''), 'info'), 2000);
            });
        }
    }

    // === ПЕРЕКЛЮЧЕНИЕ ЯЗЫКА ===
    function switchLanguage(lang) {
        currentLang = lang;
        
        // Обновляем все тексты
        document.querySelector('.overlay-title').textContent = getText('title');
        document.getElementById('detect-btn').textContent = getText('detectBtn');
        document.getElementById('search-btn').textContent = getText('searchBtn');
        document.getElementById('copy-btn').textContent = getText('copyBtn');
        document.querySelector('.question-label').textContent = getText('questionLabel');
        document.querySelector('.answer-label').textContent = getText('answerLabel');
        document.querySelector('.settings-header span').textContent = '⚙️ ' + getText('langSelect');
        
        // Обновляем статус
        if (currentGame && gameDatabase) {
            updateStatus(getText('gameDetected') + gameDatabase.gameConfig[currentGame].name, 'success');
        }
    }

    // === ИНИЦИАЛИЗАЦИЯ ===
    async function initOverlay() {
        const overlay = createOverlay();
        updateStatus(getText('loadingDB'), 'info');
        await loadDatabase();

        // Кнопки действий
        document.getElementById('detect-btn').onclick = detectGame;
        document.getElementById('search-btn').onclick = searchAnswer;
        document.getElementById('copy-btn').onclick = copyAnswer;
        
        // Кнопки управления
        overlay.querySelector('.close-btn').onclick = () => overlay.remove();
        overlay.querySelector('.minimize-btn').onclick = () => overlay.classList.toggle('overlay-minimized');
        
        // Настройки
        const settingsBtn = overlay.querySelector('.settings-btn');
        const settingsPanel = document.getElementById('settings-panel');
        const settingsCloseBtn = document.getElementById('settings-close-btn');
        const langSelect = document.getElementById('lang-select');
        
        settingsBtn.onclick = () => {
            settingsOpen = !settingsOpen;
            settingsPanel.classList.toggle('show', settingsOpen);
        };
        
        settingsCloseBtn.onclick = () => {
            settingsOpen = false;
            settingsPanel.classList.remove('show');
        };
        
        langSelect.onchange = (e) => {
            switchLanguage(e.target.value);
            settingsOpen = false;
            settingsPanel.classList.remove('show');
        };
        
        // Закрытие настроек при клике вне
        document.addEventListener('click', (e) => {
            if (settingsOpen && !settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
                settingsOpen = false;
                settingsPanel.classList.remove('show');
            }
        });

        // Перетаскивание (БЕЗ ВЫДЕЛЕНИЯ ТЕКСТА)
        const header = overlay.querySelector('.overlay-header');
        let isDragging = false, startX, startY, initialX, initialY;

        header.onmousedown = (e) => {
            if (e.target.closest('.overlay-btn')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = overlay.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            e.preventDefault();
        };

        document.onmousemove = (e) => {
            if (!isDragging) return;
            overlay.style.left = (initialX + e.clientX - startX) + 'px';
            overlay.style.top = (initialY + e.clientY - startY) + 'px';
            overlay.style.right = 'auto';
            e.preventDefault();
        };

        document.onmouseup = () => { isDragging = false; };

        // Авто-проверка вопроса каждые 2 секунды
        setInterval(autoCheckQuestion, CONFIG.checkInterval);

        updateStatus(getText('gameDetected') + getText('notDetected'), 'success');
    }

    // Запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOverlay);
    } else {
        initOverlay();
    }
})();
