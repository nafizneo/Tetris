/**
 * CONSTANTS & DATA TABLES
 */
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const COLORS = {
    I: '#2ac3de', J: '#7aa2f7', L: '#ff9e64',
    O: '#e0af68', S: '#9ece6a', T: '#bb9af7', Z: '#f7768e'
};

const PIECES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]]
};

// SRS Wall Kick Data (Common for J, L, S, T, Z)
const KICKS = {
    "0-1": [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
    "1-0": [[0,0], [1,0], [1,-1], [0,2], [1,2]],
    "1-2": [[0,0], [1,0], [1,-1], [0,2], [1,2]],
    "2-1": [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
    "2-3": [[0,0], [1,0], [1,1], [0,-2], [1,-2]],
    "3-2": [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
    "3-0": [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
    "0-3": [[0,0], [1,0], [1,1], [0,-2], [1,-2]]
};

/**
 * CORE LOGIC: TETROMINO
 */
class Piece {
    constructor(type, board) {
        this.type = type;
        this.matrix = PIECES[type].map(row => [...row]);
        this.color = COLORS[type];
        this.board = board;
        this.rotation = 0; // 0: spawn, 1: 90deg, 2: 180deg, 3: 270deg
        this.resetPosition();
    }

    resetPosition() {
        this.x = Math.floor(COLS / 2) - Math.floor(this.matrix[0].length / 2);
        this.y = 0;
    }

    rotate(dir) {
        const prevRotation = this.rotation;
        this.rotation = (this.rotation + dir + 4) % 4;
        
        // Rotate Matrix
        const m = this.matrix;
        const newMatrix = m[0].map((_, i) => m.map(row => row[i]).reverse());
        if (dir < 0) { // CCW
            this.matrix = m[0].map((_, i) => m.map(row => row[i])).reverse();
        } else {
            this.matrix = newMatrix;
        }

        // SRS Wall Kick Logic
        const kickKey = `${prevRotation}-${this.rotation}`;
        const kicks = KICKS[kickKey] || [[0,0]];
        
        for (let [kx, ky] of kicks) {
            if (!this.board.collide(this.x + kx, this.y - ky, this.matrix)) {
                this.x += kx;
                this.y -= ky;
                return true;
            }
        }

        // Revert if no kick works
        this.matrix = m;
        this.rotation = prevRotation;
        return false;
    }
}

/**
 * GAME ENGINE
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('tetris');
        this.ctx = this.canvas.getContext('2d');
        this.grid = Array.from({length: ROWS}, () => Array(COLS).fill(0));
        
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.bag = [];
        this.nextPiece = this.pullFromBag();
        this.holdPiece = null;
        this.canHold = true;
        
        this.aiEnabled = false;
        this.gameOver = false;
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;

        this.spawnPiece();
        this.initControls();
        this.requestUpdate();
    }

    pullFromBag() {
        if (this.bag.length === 0) {
            this.bag = Object.keys(PIECES).sort(() => Math.random() - 0.5);
        }
        return this.bag.pop();
    }

    spawnPiece() {
        this.piece = new Piece(this.nextPiece, this);
        this.nextPiece = this.pullFromBag();
        this.canHold = true;

        if (this.collide(this.piece.x, this.piece.y, this.piece.matrix)) {
            this.gameOver = true;
            document.getElementById('status').innerText = "GAME OVER";
        }
    }

    hold() {
        if (!this.canHold) return;
        if (!this.holdPiece) {
            this.holdPiece = this.piece.type;
            this.spawnPiece();
        } else {
            const temp = this.piece.type;
            this.piece = new Piece(this.holdPiece, this);
            this.holdPiece = temp;
        }
        this.canHold = false;
    }

    collide(x, y, matrix) {
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (matrix[r][c] === 0) continue;
                let newX = x + c;
                let newY = y + r;
                if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
                if (newY >= 0 && this.grid[newY][newX]) return true;
            }
        }
        return false;
    }

    drop() {
        this.piece.y++;
        if (this.collide(this.piece.x, this.piece.y, this.piece.matrix)) {
            this.piece.y--;
            this.lock();
        }
        this.dropCounter = 0;
    }

    hardDrop() {
        while (!this.collide(this.piece.x, this.piece.y + 1, this.piece.matrix)) {
            this.piece.y++;
        }
        this.lock();
    }

    lock() {
        this.piece.matrix.forEach((row, r) => {
            row.forEach((val, c) => {
                if (val) {
                    const y = this.piece.y + r;
                    if (y >= 0) this.grid[y][this.piece.x + c] = this.piece.color;
                }
            });
        });
        this.clearLines();
        this.spawnPiece();
    }

    clearLines() {
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (this.grid[r].every(cell => cell !== 0)) {
                this.grid.splice(r, 1);
                this.grid.unshift(Array(COLS).fill(0));
                cleared++;
                r++;
            }
        }
        if (cleared > 0) {
            this.lines += cleared;
            this.score += [0, 100, 300, 500, 800][cleared] * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
            this.updateUI();
        }
    }

    updateUI() {
        document.getElementById('score').innerText = this.score;
        document.getElementById('lines').innerText = this.lines;
        document.getElementById('level').innerText = this.level;
    }

    initControls() {
        document.addEventListener('keydown', e => {
            if (this.gameOver || this.aiEnabled) {
                if(e.key.toLowerCase() === 'a') this.toggleAI();
                return;
            }
            switch(e.key) {
                case 'ArrowLeft': if(!this.collide(this.piece.x-1, this.piece.y, this.piece.matrix)) this.piece.x--; break;
                case 'ArrowRight': if(!this.collide(this.piece.x+1, this.piece.y, this.piece.matrix)) this.piece.x++; break;
                case 'ArrowDown': this.drop(); break;
                case 'ArrowUp': this.piece.rotate(1); break;
                case ' ': this.hardDrop(); break;
                case 'c': case 'C': this.hold(); break;
                case 'a': case 'A': this.toggleAI(); break;
            }
        });
        document.getElementById('ai-toggle').onclick = () => this.toggleAI();
    }

    toggleAI() {
        this.aiEnabled = !this.aiEnabled;
        document.getElementById('game-container').classList.toggle('ai-active', this.aiEnabled);
        document.getElementById('status').innerText = this.aiEnabled ? "AI AUTO-PILOT" : "MANUAL";
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Grid Lines
        this.ctx.strokeStyle = '#232433';
        for(let i=0; i<=COLS; i++) {
            this.ctx.beginPath(); this.ctx.moveTo(i*BLOCK_SIZE, 0); this.ctx.lineTo(i*BLOCK_SIZE, ROWS*BLOCK_SIZE); this.ctx.stroke();
        }

        // Static Grid
        this.grid.forEach((row, y) => {
            row.forEach((color, x) => {
                if (color) this.drawBlock(this.ctx, x, y, color);
            });
        });

        // Ghost Piece
        let ghostY = this.piece.y;
        while (!this.collide(this.piece.x, ghostY + 1, this.piece.matrix)) ghostY++;
        this.piece.matrix.forEach((row, r) => {
            row.forEach((val, c) => {
                if (val) {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    this.ctx.fillRect((this.piece.x + c)*BLOCK_SIZE, (ghostY + r)*BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });

        // Active Piece
        this.piece.matrix.forEach((row, r) => {
            row.forEach((val, c) => {
                if (val) this.drawBlock(this.ctx, this.piece.x + c, this.piece.y + r, this.piece.color);
            });
        });

        this.drawPreview();
    }

    drawBlock(ctx, x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }

    drawPreview() {
        const nextCtx = document.getElementById('next-canvas').getContext('2d');
        const holdCtx = document.getElementById('hold-canvas').getContext('2d');
        [nextCtx, holdCtx].forEach(c => c.clearRect(0,0,100,100));

        this.drawSmall(nextCtx, this.nextPiece);
        if(this.holdPiece) this.drawSmall(holdCtx, this.holdPiece);
    }

    drawSmall(ctx, type) {
        const m = PIECES[type];
        ctx.fillStyle = COLORS[type];
        m.forEach((row, r) => row.forEach((v, c) => {
            if(v) ctx.fillRect(c*20+20, r*20+20, 18, 18);
        }));
    }

    requestUpdate() {
        const update = (time = 0) => {
            const dt = time - this.lastTime;
            this.lastTime = time;

            if (!this.gameOver) {
                if (this.aiEnabled) {
                    this.runAI();
                } else {
                    this.dropCounter += dt;
                    if (this.dropCounter > this.dropInterval) this.drop();
                }
                this.draw();
                requestAnimationFrame(update);
            }
        };
        update();
    }

    /**
     * AI HEURISTIC SOLVER
     */
    runAI() {
        const best = this.getBestMove();
        if (best) {
            this.piece.matrix = best.matrix;
            this.piece.x = best.x;
            this.hardDrop();
        }
    }

    getBestMove() {
        let bestScore = -Infinity;
        let bestMove = null;

        // Try every rotation
        for (let rot = 0; rot < 4; rot++) {
            let m = [...this.piece.matrix];
            for(let i=0; i<rot; i++) m = m[0].map((_, idx) => m.map(row => row[idx]).reverse());

            // Try every horizontal position
            for (let x = -2; x < COLS; x++) {
                if (this.collide(x, 0, m)) continue;

                // Drop to bottom
                let y = 0;
                while (!this.collide(x, y + 1, m)) y++;

                // Evaluate board
                const score = this.evaluateBoard(x, y, m);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { x, y, matrix: m };
                }
            }
        }
        return bestMove;
    }

    evaluateBoard(px, py, pm) {
        // Clone grid and place piece
        const tempGrid = this.grid.map(row => [...row]);
        pm.forEach((row, r) => row.forEach((v, c) => {
            if (v && py + r >= 0) tempGrid[py+r][px+c] = 1;
        }));

        let holes = 0;
        let aggregateHeight = 0;
        let bumpiness = 0;
        let completeLines = 0;

        const columnHeights = Array(COLS).fill(0);

        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (tempGrid[r][c] !== 0) {
                    columnHeights[c] = ROWS - r;
                    break;
                }
            }
        }

        aggregateHeight = columnHeights.reduce((a, b) => a + b, 0);

        for (let c = 0; c < COLS; c++) {
            let fillFound = false;
            for (let r = 0; r < ROWS; r++) {
                if (tempGrid[r][c] !== 0) fillFound = true;
                else if (fillFound && tempGrid[r][c] === 0) holes++;
            }
            if (c < COLS - 1) bumpiness += Math.abs(columnHeights[c] - columnHeights[c+1]);
        }

        tempGrid.forEach(row => { if (row.every(cell => cell !== 0)) completeLines++; });

        // Weights: Standard Pierre Dellacherie / Heuristic weights
        return (completeLines * 0.76) - (aggregateHeight * 0.51) - (holes * 0.35) - (bumpiness * 0.18);
    }
}

const game = new Game();
