// overlay.js - Оверлей для Jackbox Games
// Сохраните этот файл как overlay.js

(function() {
    const existing = document.getElementById('game-finder-overlay');
    if (existing) existing.remove();

    const CONFIG = {
        databaseURL: 'https://getonjbghelp.github.io/jbg-finder/database.js',
        checkInterval: 3000
    };

    let currentGame = null;
    let currentQuestion = '';
    let gameDatabase = null;

    async function loadDatabase() {
        return new Promise((resolve) => {
            if (window.GameDatabase) {
                gameDatabase = window.GameDatabase;
                updateStatus('База загружена ✓', 'success');
                updateVersionInfo();
                resolve(true);
                return;
            }

            const script = document.createElement('script');
            script.src = CONFIG.databaseURL + '?t=' + Date.now();
            
            script.onload = () => {
                if (window.GameDatabase) {
                    gameDatabase = window.GameDatabase;
                    updateStatus('База загружена ✓', 'success');
                    updateVersionInfo();
                    resolve(true);
                } else {
                    updateStatus('Ошибка: GameDatabase не найден', 'error');
                    resolve(false);
                }
            };
            
            script.onerror = () => {
                updateStatus('Ошибка загрузки базы', 'error');
                resolve(false);
            };
            
            document.head.appendChild(script);
        });
    }

    function updateVersionInfo() {
        if (!gameDatabase) return;
        
        const versionInfo = gameDatabase.getVersionInfo();
        const versionEl = document.getElementById('db-version');
        const ageEl = document.getElementById('db-age');
        
        if (versionEl) versionEl.textContent = 'v' + versionInfo.version;
        
        if (ageEl) {
            const daysText = versionInfo.daysSinceUpdate === 0 ? 'сегодня' : versionInfo.daysSinceUpdate + ' дн. назад';
            ageEl.textContent = daysText;
            ageEl.style.color = versionInfo.isOutdated ? '#ff6b6b' : '#4ecdc4';
        }
    }

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
            confidence.title = 'Найдено: ' + detectionResult.foundIndicators.join(', ');
            
            if (watermark) {
                watermark.textContent = config.name.toUpperCase();
                watermark.style.color = config.backgroundColor + '08';
            }
            
            currentGame = detectionResult.gameId;
        } else {
            dot.className = 'indicator-dot';
            name.textContent = 'Не определено';
            confidence.textContent = '';
            
            if (watermark) {
                watermark.textContent = 'GAME FINDER';
                watermark.style.color = 'rgba(255, 255, 255, 0.03)';
            }
            
            currentGame = null;
        }
    }

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
                    <button class="overlay-btn detect-btn" title="Определить игру">🔍</button>
                    <button class="overlay-btn search-btn" title="Найти ответ">⚡</button>
                    <button class="overlay-btn minimize-btn" title="Свернуть">−</button>
                    <button class="overlay-btn close-btn" title="Закрыть">×</button>
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
            </div>
        `;

        overlay.style.cssText = `
            position: fixed;
            top: 30px;
            right: 30px;
            width: 500px;
            max-width: 90vw;
            background: linear-gradient(145deg, #2a2a2a 0%, #1f1f1f 100%);
            backdrop-filter: blur(15px);
            border: 1px solid #404040;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
            z-index: 999999;
            font-family: 'Segoe UI', sans-serif;
            color: #e0e0e0;
            overflow: hidden;
        `;

        document.body.appendChild(overlay);

        const style = document.createElement('style');
        style.textContent = `
            #game-finder-overlay * { box-sizing: border-box; margin: 0; padding: 0; }
            .overlay-background-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 80px; font-weight: 900; color: rgba(255,255,255,0.03); pointer-events: none; white-space: nowrap; text-transform: uppercase; letter-spacing: 10px; z-index: 0; }
            .overlay-header { display: flex; justify-content: space-between; padding: 16px 20px; background: rgba(60,60,60,0.8); cursor: move; }
            .header-left { display: flex; align-items: center; gap: 12px; }
            .overlay-title { font-size: 16px; font-weight: 700; color: #fff; }
            .db-info { font-size: 12px; color: #808080; display: flex; align-items: center; gap: 6px; }
            .db-separator { color: #505050; }
            .overlay-controls { display: flex; gap: 6px; }
            .overlay-btn { width: 34px; height: 34px; border: none; border-radius: 8px; background: rgba(80,80,80,0.5); color: #c0c0c0; cursor: pointer; font-size: 16px; }
            .overlay-btn:hover { background: rgba(100,100,100,0.7); }
            .overlay-content { padding: 20px; }
            .game-indicator { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 12px; background: rgba(50,50,50,0.5); border-radius: 10px; }
            .indicator-dot { width: 12px; height: 12px; border-radius: 50%; background: #505050; }
            .indicator-dot.active { background: #4ecdc4; box-shadow: 0 0 15px #4ecdc4; }
            .game-name { color: #fff; font-weight: 600; flex: 1; }
            .game-confidence { font-size: 11px; color: #808080; padding: 3px 8px; background: rgba(255,255,255,0.05); border-radius: 10px; }
            .question-box, .answer-box { margin-bottom: 16px; padding: 16px; background: rgba(40,40,40,0.6); border-radius: 10px; }
            .question-box { border-left: 3px solid #4ecdc4; }
            .answer-box.found { border-left-color: #4ecdc4; }
            .answer-box.not-found { border-left-color: #ff6b6b; }
            .question-header, .answer-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .question-label, .answer-label { font-size: 11px; color: #808080; font-weight: 600; text-transform: uppercase; }
            .question-length, .answer-confidence { font-size: 10px; color: #606060; padding: 2px 6px; background: rgba(255,255,255,0.05); border-radius: 6px; }
            .question-text, .answer-text { font-size: 13px; color: #d0d0d0; max-height: 100px; overflow-y: auto; }
            .answer-text { font-size: 16px; font-weight: 600; }
            .answer-box.found .answer-text { color: #4ecdc4; }
            .answer-box.not-found .answer-text { color: #ff6b6b; }
            .action-buttons { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px; }
            .action-btn { padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
            .action-btn.detect-btn { background: linear-gradient(135deg, #4ecdc4, #44a08d); color: #fff; }
            .action-btn.search-btn { background: linear-gradient(135deg, #ff6b6b, #ee5a5a); color: #fff; }
            .action-btn.copy-btn { background: rgba(80,80,80,0.5); color: #c0c0c0; }
            .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .overlay-status { font-size: 11px; color: #606060; text-align: center; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); }
            .overlay-minimized .overlay-content { display: none; }
        `;
        document.head.appendChild(style);

        return overlay;
    }

    function detectGame() {
        if (!gameDatabase) {
            updateStatus('База не загружена', 'error');
            return false;
        }

        updateStatus('Сканирование...', 'searching');
        document.getElementById('status-dot').className = 'indicator-dot searching';

        setTimeout(() => {
            const detectionResult = gameDatabase.detectGame();
            updateIndicator(detectionResult);
            
            if (detectionResult && detectionResult.gameId) {
                updateStatus('Игра: ' + detectionResult.name, 'success');
                document.getElementById('search-btn').disabled = false;
                
                const question = gameDatabase.extractQuestion(detectionResult.gameId);
                if (question) {
                    currentQuestion = question;
                    document.getElementById('question-text').textContent = question.length > 150 ? question.substring(0, 150) + '...' : question;
                    document.getElementById('question-length').textContent = question.length + ' символов';
                }
            } else {
                updateStatus('Игра не определена', 'warning');
                document.getElementById('search-btn').disabled = true;
            }
            
            document.getElementById('status-dot').className = detectionResult ? 'indicator-dot active' : 'indicator-dot';
        }, 500);

        return true;
    }

    function searchAnswer() {
        if (!gameDatabase || !currentGame || !currentQuestion) {
            updateStatus('Определите игру и вопрос', 'warning');
            return;
        }
        
        updateStatus('Поиск...', 'searching');
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
                updateStatus('Ответ найден! (' + result.confidence + '%)', 'success');
                copyBtn.disabled = false;
            } else {
                answerText.textContent = 'Не найден в базе';
                answerBox.className = 'answer-box not-found';
                answerConfidence.textContent = '';
                updateStatus('Ответ не найден', 'error');
                copyBtn.disabled = true;
            }
            
            document.getElementById('status-dot').className = 'indicator-dot active';
        }, 300);
    }

    function copyAnswer() {
        const answerText = document.getElementById('answer-text').textContent;
        if (answerText && answerText !== 'Нажмите "Найти ответ" для поиска...' && answerText !== 'Не найден в базе') {
            navigator.clipboard.writeText(answerText).then(() => {
                updateStatus('Скопировано!', 'success');
            });
        }
    }

    async function initOverlay() {
        const overlay = createOverlay();
        updateStatus('Загрузка базы...', 'info');
        await loadDatabase();

        document.getElementById('detect-btn').onclick = detectGame;
        document.getElementById('search-btn').onclick = searchAnswer;
        document.getElementById('copy-btn').onclick = copyAnswer;
        
        overlay.querySelector('.close-btn').onclick = () => overlay.remove();
        overlay.querySelector('.minimize-btn').onclick = () => overlay.classList.toggle('overlay-minimized');
        overlay.querySelector('.detect-btn').onclick = detectGame;
        overlay.querySelector('.search-btn').onclick = searchAnswer;

        const header = overlay.querySelector('.overlay-header');
        let isDragging = false, startX, startY, initialX, initialY;

        header.onmousedown = (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = overlay.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
        };

        document.onmousemove = (e) => {
            if (!isDragging) return;
            overlay.style.left = (initialX + e.clientX - startX) + 'px';
            overlay.style.top = (initialY + e.clientY - startY) + 'px';
            overlay.style.right = 'auto';
        };

        document.onmouseup = () => isDragging = false;
        updateStatus('Готов к работе', 'success');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOverlay);
    } else {
        initOverlay();
    }
})();