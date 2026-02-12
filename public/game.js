// Global variables
let socket;
let sessionId;
let gameId;
let playerId;
let currentSong;
let timerInterval;
let timeRemaining = 30;

// Initialize socket connection
function initSocket() {
    socket = io();
    
    socket.on('player-joined', (data) => {
        updatePlayerList(data.players);
        if (data.gameState === 'playing') {
            showScreen('game-screen');
        }
    });

    socket.on('game-started', (data) => {
        showScreen('game-screen');
        document.getElementById('current-round').textContent = data.round;
        document.getElementById('max-rounds').textContent = data.maxRounds;
        startTimer();
    });

    socket.on('new-line', (data) => {
        addLyricLine(data.line, data.lineNumber, data.totalLines);
    });

    socket.on('lyrics-complete', () => {
        document.getElementById('next-line-btn').disabled = true;
        showFeedback('All lyrics shown!', 'info');
    });

    socket.on('correct-guess', (data) => {
        showFeedback(`🎉 ${data.playerName} guessed correctly! +${data.points} points!`, 'correct');
        updateScoreboard(data.players);
        stopTimer();
        
        setTimeout(() => {
            const currentRound = parseInt(document.getElementById('current-round').textContent);
            const maxRounds = parseInt(document.getElementById('max-rounds').textContent);
            if (currentRound < maxRounds) {
                resetForNextRound();
            }
        }, 3000);
    });

    socket.on('incorrect-guess', (data) => {
        showFeedback(`❌ "${data.guess}" is incorrect. Try again!`, 'incorrect');
    });

    socket.on('song-skipped', (data) => {
        showFeedback(`Song skipped! It was "${data.correctAnswer}" by ${data.artist}`, 'info');
        stopTimer();
        setTimeout(() => {
            resetForNextRound();
        }, 3000);
    });

    socket.on('game-ended', (data) => {
        showScreen('end-screen');
        displayFinalScores(data.players, data.winner);
    });

    socket.on('error', (data) => {
        alert(data.message);
    });
}

// Show specific screen
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Spotify login
function loginSpotify() {
    window.location.href = '/login';
}

// Check if user is authenticated
function checkAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    sessionId = urlParams.get('session');
    
    if (sessionId) {
        showScreen('setup-screen');
        initSocket();
    } else if (window.location.pathname === '/join') {
        gameId = urlParams.get('game');
        showScreen('join-screen');
        initSocket();
    } else {
        showScreen('login-screen');
    }
}

// Create a new game
async function createGame() {
    playerId = generateId();
    
    try {
        const response = await fetch('/api/game/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostId: playerId })
        });
        
        const data = await response.json();
        gameId = data.gameId;
        
        // Join the game via socket
        socket.emit('join-game', {
            gameId: gameId,
            playerId: playerId,
            playerName: 'Host'
        });
        
        // Show QR code
        await generateQRCode();
        
        document.getElementById('game-id-display').textContent = gameId;
        document.getElementById('qr-code-section').style.display = 'block';
    } catch (error) {
        console.error('Error creating game:', error);
        alert('Failed to create game');
    }
}

// Generate QR code
async function generateQRCode() {
    try {
        const response = await fetch(`/api/game/${gameId}/qr`);
        const data = await response.json();
        
        document.getElementById('qr-code').innerHTML = 
            `<img src="${data.qrCode}" alt="QR Code">`;
    } catch (error) {
        console.error('Error generating QR code:', error);
    }
}

// Join existing game
function joinGame() {
    const playerName = document.getElementById('player-name').value.trim();
    
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    
    playerId = generateId();
    
    socket.emit('join-game', {
        gameId: gameId,
        playerId: playerId,
        playerName: playerName
    });
    
    showScreen('waiting-screen');
}

// Update player list
function updatePlayerList(players) {
    const playersList = document.getElementById('players') || document.getElementById('players-join');
    if (!playersList) return;
    
    playersList.innerHTML = players.map(p => 
        `<li>${p.name} - ${p.score} points</li>`
    ).join('');
}

// Start a game round
async function startGameRound() {
    try {
        // Fetch random song from Spotify
        const response = await fetch(`/api/random-song?session=${sessionId}`);
        const song = await response.json();
        
        if (song.error) {
            alert(song.error);
            return;
        }
        
        currentSong = song;
        
        // Start the game
        socket.emit('start-game', {
            gameId: gameId,
            song: song
        });
        
        // Show song image
        if (song.imageUrl) {
            document.getElementById('song-image').innerHTML = 
                `<img src="${song.imageUrl}" alt="Album Cover">`;
        }
        
        // Clear previous lyrics
        document.getElementById('lyrics-display').innerHTML = '';
        document.getElementById('guess-input').value = '';
        document.getElementById('next-line-btn').disabled = false;
        
    } catch (error) {
        console.error('Error starting game:', error);
        alert('Failed to start game. Make sure you have songs in your Spotify library!');
    }
}

// Show next lyric line
function showNextLine() {
    socket.emit('request-next-line', { gameId: gameId });
}

// Add lyric line to display
function addLyricLine(line, lineNumber, totalLines) {
    const lyricsDisplay = document.getElementById('lyrics-display');
    const lineElement = document.createElement('div');
    lineElement.className = 'lyrics-line';
    lineElement.textContent = `${lineNumber}. ${line}`;
    lyricsDisplay.appendChild(lineElement);
}

// Submit guess
function submitGuess() {
    const guess = document.getElementById('guess-input').value.trim();
    
    if (!guess) {
        alert('Please enter a guess');
        return;
    }
    
    socket.emit('submit-guess', {
        gameId: gameId,
        playerId: playerId,
        guess: guess
    });
}

// Handle Enter key press in guess input
function handleGuessKeyPress(event) {
    if (event.key === 'Enter') {
        submitGuess();
    }
}

// Skip current song
function skipSong() {
    socket.emit('skip-song', { gameId: gameId });
}

// Show feedback message
function showFeedback(message, type) {
    const feedback = document.getElementById('feedback');
    feedback.textContent = message;
    feedback.className = `feedback ${type} show`;
    
    setTimeout(() => {
        feedback.classList.remove('show');
    }, 3000);
}

// Update scoreboard
function updateScoreboard(players) {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const scoresDiv = document.getElementById('scores');
    
    scoresDiv.innerHTML = sortedPlayers.map((player, index) => `
        <div class="score-item ${index === 0 ? 'winner' : ''}">
            <span class="score-name">${index + 1}. ${player.name}</span>
            <span class="score-points">${player.score} pts</span>
        </div>
    `).join('');
}

// Display final scores
function displayFinalScores(players, winner) {
    const finalScoresDiv = document.getElementById('final-scores');
    
    finalScoresDiv.innerHTML = `
        <h3>🏆 Winner: ${winner.name} with ${winner.score} points!</h3>
        <div style="margin-top: 20px;">
            ${players.map((player, index) => `
                <div class="score-item ${index === 0 ? 'winner' : ''}">
                    <span class="score-name">${index + 1}. ${player.name}</span>
                    <span class="score-points">${player.score} pts</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Timer functionality
function startTimer() {
    timeRemaining = 30;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            stopTimer();
            skipSong();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
        timerDisplay.textContent = timeRemaining;
        
        // Change color based on time remaining
        if (timeRemaining <= 10) {
            timerDisplay.style.color = '#e53e3e';
        } else if (timeRemaining <= 20) {
            timerDisplay.style.color = '#ed8936';
        } else {
            timerDisplay.style.color = '#48bb78';
        }
    }
}

// Reset for next round
function resetForNextRound() {
    document.getElementById('lyrics-display').innerHTML = '';
    document.getElementById('guess-input').value = '';
    document.getElementById('next-line-btn').disabled = false;
    hideFeedback();
    
    const currentRound = parseInt(document.getElementById('current-round').textContent);
    const maxRounds = parseInt(document.getElementById('max-rounds').textContent);
    
    if (currentRound >= maxRounds) {
        socket.emit('end-game', { gameId: gameId });
    } else {
        // Show button to start next round (only for host)
        if (window.location.pathname !== '/join') {
            showScreen('setup-screen');
            document.getElementById('qr-code-section').style.display = 'block';
        }
    }
}

function hideFeedback() {
    const feedback = document.getElementById('feedback');
    feedback.classList.remove('show');
}

// Utility function to generate random ID
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
