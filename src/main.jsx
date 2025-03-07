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

    // Render ball
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = gameState.ball.color;
    ctx.fill();
    ctx.closePath();

    // Render score
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${gameState.score}`, 10, 30);
}

// Start game when the button is clicked
startButton.addEventListener('click', () => {
    socket.emit('startGame');
});