document.addEventListener('DOMContentLoaded', () => {
    // Инициализация Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        Telegram.WebApp.setHeaderColor('#0088cc');
        Telegram.WebApp.setBackgroundColor('#333333'); // Устанавливаем фон Telegram такой же, как у игры
    } else {
        console.warn('Telegram WebApp object not found. Running in standalone mode.');
    }

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const nextTetrominoCanvas = document.getElementById('nextTetrominoCanvas');
    const nextCtx = nextTetrominoCanvas.getContext('2d');

    const scoreElement = document.getElementById('score');
    const levelElement = document.getElementById('level');
    const pauseButton = document.getElementById('pauseButton');
    const startButton = document.getElementById('startButton');

    const moveLeftBtn = document.getElementById('moveLeft');
    const rotateBtn = document.getElementById('rotate');
    const moveRightBtn = document.getElementById('moveRight');
    const dropBtn = document.getElementById('drop');

    // Размеры игрового поля и блока
    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 20; // 20px на каждый блок
    const PREVIEW_BLOCK_SIZE = 20; // Размер блока для предпросмотра

    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;

    // Определение фигур Тетриса (тетрамино)
    const TETROMINOS = [
        // I-образная (голубая)
        [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
        // J-образная (синяя)
        [[1,0,0], [1,1,1], [0,0,0]],
        // L-образная (оранжевая)
        [[0,0,1], [1,1,1], [0,0,0]],
        // O-образная (желтая) - квадрат
        [[1,1], [1,1]],
        // S-образная (зеленая)
        [[0,1,1], [1,1,0], [0,0,0]],
        // T-образная (фиолетовая)
        [[0,1,0], [1,1,1], [0,0,0]],
        // Z-образная (красная)
        [[1,1,0], [0,1,1], [0,0,0]]
    ];

    // Цвета для каждой фигуры (соответствуют порядку в TETROMINOS)
    const COLORS = [
        '#00FFFF', // Cyan (I)
        '#0000FF', // Blue (J)
        '#FFA500', // Orange (L)
        '#FFFF00', // Yellow (O)
        '#00FF00', // Lime (S)
        '#800080', // Purple (T)
        '#FF0000'  // Red (Z)
    ];

    let score = 0;
    let level = 1;
    let linesClearedTotal = 0; // Общее количество очищенных линий
    let board = [];

    let currentTetromino;
    let currentX;
    let currentY;

    let nextTetromino; // Следующая фигура

    let dropInterval = 1000; // Начальный интервал падения
    let lastDropTime = 0;
    let animationFrameId;
    let isPaused = false;
    let gameOver = false;

    // --- Звуковые эффекты ---
    const soundLineClear = new Audio('sounds/line_clear.wav');
    const soundDrop = new Audio('sounds/drop.wav');
    const soundGameOver = new Audio('sounds/game_over.wav');

    // Функция для проигрывания звука (с обработкой возможных ошибок)
    function playSound(audioElement) {
        if (audioElement && !isPaused) {
            audioElement.currentTime = 0; // Начинаем с начала
            audioElement.play().catch(e => console.error("Error playing sound:", e));
        }
    }

    // Инициализация пустого игрового поля
    function initBoard() {
        for (let r = 0; r < ROWS; r++) {
            board[r] = Array(COLS).fill(0); // Заполняем нулями
        }
    }

    // Отрисовка одного блока на канвасе
    function drawBlock(ctxToUse, x, y, color, blockSize) {
        ctxToUse.fillStyle = color;
        ctxToUse.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
        ctxToUse.strokeStyle = '#333';
        ctxToUse.lineWidth = 1;
        ctxToUse.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
    }

    // Очистка всего канваса
    function clearCanvas(ctxToUse, canvasToUse) {
        ctxToUse.clearRect(0, 0, canvasToUse.width, canvasToUse.height);
    }

    // Отрисовка застывших блоков на игровом поле
    function drawBoard() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c] !== 0) {
                    drawBlock(ctx, c, r, COLORS[board[r][c] - 1], BLOCK_SIZE);
                }
            }
        }
    }

    // Отрисовка текущей падающей фигуры
    function drawTetromino() {
        if (!currentTetromino) return;

        const shape = currentTetromino.shape;
        const color = currentTetromino.color;

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] === 1) {
                    drawBlock(ctx, currentX + c, currentY + r, color, BLOCK_SIZE);
                }
            }
        }
    }

    // Отрисовка следующей фигуры в окне предпросмотра
    function drawNextTetromino() {
        clearCanvas(nextCtx, nextTetrominoCanvas);
        if (!nextTetromino) return;

        const shape = nextTetromino.shape;
        const color = nextTetromino.color;

        // Центрируем фигуру в окне предпросмотра
        const previewCols = nextTetrominoCanvas.width / PREVIEW_BLOCK_SIZE;
        const previewRows = nextTetrominoCanvas.height / PREVIEW_BLOCK_SIZE;
        const offsetX = Math.floor((previewCols - shape[0].length) / 2);
        const offsetY = Math.floor((previewRows - shape.length) / 2);


        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] === 1) {
                    drawBlock(nextCtx, offsetX + c, offsetY + r, color, PREVIEW_BLOCK_SIZE);
                }
            }
        }
    }

    // Генерация новой случайной фигуры
    function generateTetromino() {
        if (!nextTetromino) { // Если это первый запуск или после Game Over
            const randIndex = Math.floor(Math.random() * TETROMINOS.length);
            nextTetromino = {
                shape: TETROMINOS[randIndex],
                color: COLORS[randIndex],
                index: randIndex
            };
        }

        currentTetromino = nextTetromino;

        const randIndexNext = Math.floor(Math.random() * TETROMINOS.length);
        nextTetromino = {
            shape: TETROMINOS[randIndexNext],
            color: COLORS[randIndexNext],
            index: randIndexNext
        };

        currentX = Math.floor(COLS / 2) - Math.floor(currentTetromino.shape[0].length / 2);
        currentY = 0;

        drawNextTetromino(); // Обновляем предпросмотр

        // Проверка на Game Over
        if (!isValidMove(currentX, currentY, currentTetromino.shape)) {
            gameOver = true;
            console.log('Game Over!');
            cancelAnimationFrame(animationFrameId);
            playSound(soundGameOver);
            alert(`Игра окончена! Ваш счет: ${score}. Уровень: ${level}`);
            pauseButton.style.display = 'none';
            startButton.style.display = 'block'; // Показываем кнопку "Начать новую игру"
        }
    }

    // Проверка, является ли движение фигуры допустимым
    function isValidMove(newX, newY, newShape) {
        for (let r = 0; r < newShape.length; r++) {
            for (let c = 0; c < newShape[r].length; c++) {
                if (newShape[r][c] === 1) {
                    const boardX = newX + c;
                    const boardY = newY + r;

                    if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
                        return false;
                    }
                    if (boardY >= 0 && board[boardY][boardX] !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    // Перемещение текущей фигуры влево
    function moveLeft() {
        if (gameOver || isPaused) return;
        if (isValidMove(currentX - 1, currentY, currentTetromino.shape)) {
            currentX--;
            draw();
        }
    }

    // Перемещение текущей фигуры вправо
    function moveRight() {
        if (gameOver || isPaused) return;
        if (isValidMove(currentX + 1, currentY, currentTetromino.shape)) {
            currentX++;
            draw();
        }
    }

    // Ускоренное падение фигуры (Hard Drop)
    function drop() {
        if (gameOver || isPaused) return;
        while (isValidMove(currentX, currentY + 1, currentTetromino.shape)) {
            currentY++;
        }
        playSound(soundDrop);
        freezeTetromino();
        clearLines();
        generateTetromino();
        draw();
        lastDropTime = performance.now(); // Сброс таймера падения
    }

    // Перемещение текущей фигуры вниз (один шаг - Soft Drop)
    function moveTetrominoDown() {
        if (isValidMove(currentX, currentY + 1, currentTetromino.shape)) {
            currentY++;
            return true; // Успешно перемещено
        } else {
            freezeTetromino();
            clearLines();
            generateTetromino();
            return false; // Не удалось переместить (заморожено)
        }
    }

    // Вращение фигуры
    function rotate() {
        if (gameOver || isPaused) return;
        const originalShape = currentTetromino.shape;
        const N = originalShape.length;
        const rotatedShape = Array(N).fill(0).map(() => Array(N).fill(0));

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                rotatedShape[r][c] = originalShape[N - 1 - c][r];
            }
        }

        // --- Wall Kick Logic (Simple) ---
        // Попытка смещения, чтобы фигура могла вращаться у стен или других блоков
        const testOffsets = [0, 1, -1, 2, -2]; // Попробуем без смещения, затем +1, -1, +2, -2
        for (let offset of testOffsets) {
            if (isValidMove(currentX + offset, currentY, rotatedShape)) {
                currentX += offset;
                currentTetromino.shape = rotatedShape;
                draw();
                return; // Успешно повернули и сместили
            }
        }
    }

    // "Замораживание" фигуры на игровом поле
    function freezeTetromino() {
        const shape = currentTetromino.shape;
        const colorIndex = currentTetromino.index + 1;

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] === 1) {
                    if (currentY + r >= 0 && currentY + r < ROWS && currentX + c >= 0 && currentX + c < COLS) {
                        board[currentY + r][currentX + c] = colorIndex;
                    }
                }
            }
        }
    }

    // Проверка и удаление заполненных линий
    function clearLines() {
        let linesCleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r].every(cell => cell !== 0)) {
                board.splice(r, 1);
                board.unshift(Array(COLS).fill(0)); // Добавляем новую пустую строку сверху
                linesCleared++;
                r++; // Проверяем эту же строку снова, так как все строки сдвинулись вниз
            }
        }
        if (linesCleared > 0) {
            score += linesCleared * 100 * level; // Очки зависят от уровня
            scoreElement.textContent = score;
            linesClearedTotal += linesCleared;
            playSound(soundLineClear);

            // Увеличение уровня
            if (linesClearedTotal >= level * 10) { // Например, каждые 10 линий для каждого уровня
                level++;
                levelElement.textContent = level;
                dropInterval = Math.max(100, dropInterval - 100); // Увеличиваем скорость
                console.log(`Уровень ${level}, интервал ${dropInterval}мс`);
            }
        }
    }

    // Главный цикл отрисовки игры
    function draw() {
        clearCanvas(ctx, canvas);
        drawBoard();
        drawTetromino();
    }

    // Основной игровой цикл
    function gameLoop(currentTime) {
        if (!isPaused && !gameOver) {
            if (currentTime - lastDropTime > dropInterval) {
                moveTetrominoDown();
                lastDropTime = currentTime;
            }
            draw();
        }
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Переключение состояния паузы
    function togglePause() {
        isPaused = !isPaused;
        if (isPaused) {
            pauseButton.textContent = 'Продолжить';
            pauseButton.classList.add('paused');
            // При паузе можно остановить requestAnimationFrame, но для простоты
            // мы просто не выполняем логику в gameLoop, если isPaused = true.
        } else {
            pauseButton.textContent = 'Пауза';
            pauseButton.classList.remove('paused');
            lastDropTime = performance.now(); // Сброс таймера после паузы
            requestAnimationFrame(gameLoop); // Возобновляем цикл, если он был остановлен
        }
    }

    // Функция для инициализации или перезапуска игры
    function initGame() {
        cancelAnimationFrame(animationFrameId); // Останавливаем любой текущий цикл

        initBoard();
        score = 0;
        level = 1;
        linesClearedTotal = 0;
        scoreElement.textContent = score;
        levelElement.textContent = level;
        dropInterval = 1000;
        isPaused = false;
        gameOver = false;

        pauseButton.textContent = 'Пауза';
        pauseButton.classList.remove('paused');
        pauseButton.style.display = 'block';
        startButton.style.display = 'none';

        generateTetromino(); // Генерируем первую и следующую фигуры
        lastDropTime = performance.now(); // Чтобы сразу начать падать
        animationFrameId = requestAnimationFrame(gameLoop);
        draw(); // Начальная отрисовка
    }

    // --- Обработчики событий для управления ---

    // Управление с клавиатуры
    document.addEventListener('keydown', (e) => {
        if (gameOver || isPaused) return; // Игнорируем ввод, если игра окончена или на паузе

        if (e.key === 'ArrowLeft') {
            moveLeft();
        } else if (e.key === 'ArrowRight') {
            moveRight();
        } else if (e.key === 'ArrowDown') {
            if (moveTetrominoDown()) { // Если успешно перемещено (мягкое падение)
                score += 1; // Добавляем очки за мягкое падение
                scoreElement.textContent = score;
            }
            draw();
            lastDropTime = performance.now(); // Сброс таймера падения, чтобы фигура сразу начала падать снова
        } else if (e.key === 'ArrowUp' || e.key === ' ') {
            rotate();
        } else if (e.key === 'Enter') { // Например, Enter для Hard Drop
            drop();
        }
    });

    // Управление с экранных кнопок
    moveLeftBtn.addEventListener('click', moveLeft);
    rotateBtn.addEventListener('click', rotate);
    moveRightBtn.addEventListener('click', moveRight);
    dropBtn.addEventListener('click', drop);

    // Кнопки Пауза/Старт
    pauseButton.addEventListener('click', togglePause);
    startButton.addEventListener('click', initGame);


    // --- Инициализация игры при загрузке страницы ---
    initGame();

    console.log('Canvas и Telegram WebApp готовы. Игра запущена.');
});