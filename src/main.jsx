import { io } from 'socket.io-client';
import './style.css';

// Create canvas and button
const canvas = document.createElement('canvas');
const startButton = document.createElement('button');
startButton.id = 'startButton';
startButton.textContent = 'Start Game';

// Set canvas dimensions
canvas.width = 800; // Increased canvas width
canvas.height = 600; // Increased canvas height

// Append elements to the body
document.body.appendChild(canvas);
document.body.appendChild(startButton);

// Get canvas context
const ctx = canvas.getContext('2d');

// Connect to the Node.js server
const socket = io('http://localhost:3000');

let gameState;
let playerPaddle = null; // Track which paddle the player controls

// Handle initialization from the server
socket.on('init', (data) => {
    gameState = data.gameState;
    renderGame();
});

// Handle game state updates from the server
socket.on('updateGameState', (newGameState) => {
    gameState = newGameState;
    renderGame();
});

// Handle paddle assignment
socket.on('assignPaddle', (paddle) => {
    playerPaddle = paddle; // Assign the paddle to the player
});

// Render the game
function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render bricks
    gameState.bricks.forEach(brick => {
        if (brick.visible) {
            ctx.fillStyle = brick.color;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        }
    });

    // Render paddles
    ctx.fillStyle = gameState.paddles.player1.color;
    ctx.fillRect(gameState.paddles.player1.x, gameState.paddles.player1.y, gameState.paddles.player1.width, gameState.paddles.player1.height);

    ctx.fillStyle = gameState.paddles.player2.color;
    ctx.fillRect(gameState.paddles.player2.x, gameState.paddles.player2.y, gameState.paddles.player2.width, gameState.paddles.player2.height);

    // Render ball
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = gameState.ball.color;
    ctx.fill();
    ctx.closePath();

    // Render scores
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Player 1: ${gameState.scores.player1}`, 10, 30); // Player 1 score
    ctx.fillText(`Player 2: ${gameState.scores.player2}`, canvas.width - 150, 30); // Player 2 score
}

// Handle paddle movement
document.addEventListener('keydown', (event) => {
    if (playerPaddle) {
        const deltaX = event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0;
        if (deltaX !== 0) {
            socket.emit('movePaddle', { player: playerPaddle, deltaX });
        }
    }
});

// Start game when the button is clicked
startButton.addEventListener('click', () => {
    socket.emit('startGame');
});