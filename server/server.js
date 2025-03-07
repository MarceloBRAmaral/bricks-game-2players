import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173', // Allow requests from this origin
        methods: ['GET', 'POST'], // Allowed HTTP methods
    },
});

let players = [];
let gameState = {
    bricks: [], // We'll populate this dynamically
    ball: { x: 400, y: 500, radius: 10, color: 'white', dx: 4, dy: -4, lastTouchedBy: null },
    paddles: {
        player1: { x: 100, y: 550, width: 100, height: 10, color: 'blue' },
        player2: { x: 600, y: 550, width: 100, height: 10, color: 'red' },
    },
    scores: {
        player1: 0,
        player2: 0,
    },
    canvasWidth: 800, // Increased canvas width
    canvasHeight: 600, // Increased canvas height
    isGameStarted: false, // Flag to track if the game has started
};

// Function to generate bricks
function generateBricks() {
    const brickRows = 5; // Number of brick rows
    const brickCols = 8; // Number of brick columns
    const brickWidth = 80; // Width of each brick
    const brickHeight = 20; // Height of each brick
    const brickPadding = 10; // Padding between bricks
    const brickOffsetTop = 50; // Offset from the top of the canvas
    const brickOffsetLeft = 50; // Offset from the left of the canvas

    for (let row = 0; row < brickRows; row++) {
        for (let col = 0; col < brickCols; col++) {
            const brickX = col * (brickWidth + brickPadding) + brickOffsetLeft;
            const brickY = row * (brickHeight + brickPadding) + brickOffsetTop;
            gameState.bricks.push({
                x: brickX,
                y: brickY,
                width: brickWidth,
                height: brickHeight,
                color: `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`,
                visible: true,
            });
        }
    }
}

// Function to reset the game state
function resetGameState() {
    gameState.bricks = []; // Clear existing bricks
    generateBricks(); // Regenerate bricks
    gameState.ball = { x: 400, y: 500, radius: 10, color: 'white', dx: 4, dy: -4, lastTouchedBy: null }; // Reset ball
    gameState.scores.player1 = 0; // Reset Player 1 score
    gameState.scores.player2 = 0; // Reset Player 2 score
    gameState.isGameStarted = true; // Start the game
}

// Function to respawn the ball at a random position
function respawnBall() {
    gameState.ball.x = Math.random() * gameState.canvasWidth;
    gameState.ball.y = Math.random() * (gameState.canvasHeight / 2); // Respawn in the top half
    gameState.ball.dx = 4 * (Math.random() > 0.5 ? 1 : -1); // Random horizontal direction
    gameState.ball.dy = -4; // Always move upwards initially
    gameState.ball.lastTouchedBy = null; // Reset last touched by
}

// Generate initial bricks
generateBricks();

app.use(express.static(path.join(__dirname, '../dist')));

io.on('connection', (socket) => {
    const playerId = `Player ${players.length + 1}`;
    players.push(playerId);

    console.log(`${playerId} is connected`);
    socket.emit('init', { playerId, gameState });

    socket.broadcast.emit('playerConnected', playerId);

    // Assign paddles to Player 1 and Player 2
    if (players.length === 1) {
        socket.emit('assignPaddle', 'player1');
    } else if (players.length === 2) {
        socket.emit('assignPaddle', 'player2');
    }

    // Handle paddle movement
    socket.on('movePaddle', (data) => {
        const { player, deltaX } = data;
        if (player === 'player1') {
            gameState.paddles.player1.x += deltaX;
            // Ensure paddle stays within the left half of the screen
            gameState.paddles.player1.x = Math.max(0, Math.min(gameState.canvasWidth / 2 - gameState.paddles.player1.width, gameState.paddles.player1.x));
        } else if (player === 'player2') {
            gameState.paddles.player2.x += deltaX;
            // Ensure paddle stays within the right half of the screen
            gameState.paddles.player2.x = Math.max(gameState.canvasWidth / 2, Math.min(gameState.canvasWidth - gameState.paddles.player2.width, gameState.paddles.player2.x));
        }
        io.emit('updateGameState', gameState);
    });

    // Handle game start
    socket.on('startGame', () => {
        resetGameState(); // Reset the game state
        io.emit('updateGameState', gameState); // Broadcast the updated state
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        players = players.filter(player => player !== playerId);
        console.log(`${playerId} is disconnected`);
        io.emit('playerDisconnected', playerId);
    });
});

function updateGameState() {
    if (gameState.isGameStarted) {
        // Ball movement (only if the game has started)
        gameState.ball.x += gameState.ball.dx;
        gameState.ball.y += gameState.ball.dy;

        // Ball collision with walls
        if (gameState.ball.x + gameState.ball.radius > gameState.canvasWidth || gameState.ball.x - gameState.ball.radius < 0) {
            gameState.ball.dx *= -1; // Reverse horizontal direction
        }
        if (gameState.ball.y - gameState.ball.radius < 0) {
            gameState.ball.dy *= -1; // Reverse vertical direction
        }

        // Ball collision with paddles
        if (
            gameState.ball.y + gameState.ball.radius > gameState.paddles.player1.y &&
            gameState.ball.x > gameState.paddles.player1.x &&
            gameState.ball.x < gameState.paddles.player1.x + gameState.paddles.player1.width
        ) {
            gameState.ball.dy *= -1; // Reverse vertical direction
            gameState.ball.lastTouchedBy = 'player1'; // Track last touched by Player 1
        }
        if (
            gameState.ball.y + gameState.ball.radius > gameState.paddles.player2.y &&
            gameState.ball.x > gameState.paddles.player2.x &&
            gameState.ball.x < gameState.paddles.player2.x + gameState.paddles.player2.width
        ) {
            gameState.ball.dy *= -1; // Reverse vertical direction
            gameState.ball.lastTouchedBy = 'player2'; // Track last touched by Player 2
        }

        // Ball collision with bricks
        gameState.bricks.forEach(brick => {
            if (
                brick.visible &&
                gameState.ball.x + gameState.ball.radius > brick.x &&
                gameState.ball.x - gameState.ball.radius < brick.x + brick.width &&
                gameState.ball.y + gameState.ball.radius > brick.y &&
                gameState.ball.y - gameState.ball.radius < brick.y + brick.height
            ) {
                brick.visible = false;
                gameState.ball.dy *= -1; // Reverse vertical direction
                if (gameState.ball.lastTouchedBy === 'player1') {
                    gameState.scores.player1 += 1; // Increment Player 1 score
                } else if (gameState.ball.lastTouchedBy === 'player2') {
                    gameState.scores.player2 += 1; // Increment Player 2 score
                }
            }
        });

        // Ball touches the bottom of the screen
        if (gameState.ball.y + gameState.ball.radius > gameState.canvasHeight) {
            if (gameState.ball.x < gameState.canvasWidth / 2) {
                gameState.scores.player1 -= 1; // Decrement Player 1 score
            } else {
                gameState.scores.player2 -= 1; // Decrement Player 2 score
            }
            respawnBall(); // Respawn the ball
        }
    }

    io.emit('updateGameState', gameState);
}

setInterval(updateGameState, 16); // ~60 FPS

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});