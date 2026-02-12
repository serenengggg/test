const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const axios = require('axios');
const QRCode = require('qrcode');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for games
const games = new Map();
const userTokens = new Map();

// Spotify API configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const PORT = process.env.PORT || 3000;

// Generate random game ID
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Spotify OAuth endpoints
app.get('/login', (req, res) => {
  const scopes = 'user-read-private user-read-email user-library-read';
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `response_type=code&client_id=${SPOTIFY_CLIENT_ID}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}`;
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  
  try {
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const sessionId = generateGameId();
    userTokens.set(sessionId, accessToken);

    res.redirect(`/?session=${sessionId}`);
  } catch (error) {
    console.error('Error getting token:', error.response?.data || error.message);
    res.redirect('/?error=auth_failed');
  }
});

// Get random song from user's library
app.get('/api/random-song', async (req, res) => {
  const sessionId = req.query.session;
  const accessToken = userTokens.get(sessionId);

  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Get user's saved tracks
    const response = await axios.get('https://api.spotify.com/v1/me/tracks', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        limit: 50
      }
    });

    const tracks = response.data.items;
    if (tracks.length === 0) {
      return res.status(404).json({ error: 'No tracks found in library' });
    }

    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)].track;
    
    res.json({
      id: randomTrack.id,
      name: randomTrack.name,
      artist: randomTrack.artists[0].name,
      album: randomTrack.album.name,
      imageUrl: randomTrack.album.images[0]?.url
    });
  } catch (error) {
    console.error('Error fetching song:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Create a new game
app.post('/api/game/create', (req, res) => {
  const gameId = generateGameId();
  const hostId = req.body.hostId || generateGameId();
  
  games.set(gameId, {
    id: gameId,
    host: hostId,
    players: [{ id: hostId, name: 'Host', score: 0 }],
    currentSong: null,
    currentLyrics: [],
    currentLineIndex: 0,
    gameState: 'waiting', // waiting, playing, ended
    round: 0,
    maxRounds: 5
  });

  res.json({ gameId, hostId });
});

// Get game details
app.get('/api/game/:gameId', (req, res) => {
  const game = games.get(req.params.gameId);
  
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  res.json(game);
});

// Generate QR code for game
app.get('/api/game/:gameId/qr', async (req, res) => {
  const gameId = req.params.gameId;
  const game = games.get(gameId);

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  try {
    const gameUrl = `http://localhost:${PORT}/join?game=${gameId}`;
    const qrCode = await QRCode.toDataURL(gameUrl);
    res.json({ qrCode, gameUrl });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Socket.IO for real-time gameplay
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-game', (data) => {
    const { gameId, playerId, playerName } = data;
    const game = games.get(gameId);

    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    // Add player if not already in game
    const existingPlayer = game.players.find(p => p.id === playerId);
    if (!existingPlayer) {
      game.players.push({ id: playerId, name: playerName || `Player ${game.players.length + 1}`, score: 0 });
    }

    socket.join(gameId);
    io.to(gameId).emit('player-joined', { 
      players: game.players,
      gameState: game.gameState 
    });
  });

  socket.on('start-game', (data) => {
    const { gameId, song } = data;
    const game = games.get(gameId);

    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    game.currentSong = song;
    game.currentLineIndex = 0;
    game.gameState = 'playing';
    game.round += 1;

    // Mock lyrics - in production, fetch from Genius API or similar
    const mockLyrics = generateMockLyrics(song.name, song.artist);
    game.currentLyrics = mockLyrics;

    io.to(gameId).emit('game-started', { 
      gameState: 'playing',
      round: game.round,
      maxRounds: game.maxRounds
    });
  });

  socket.on('request-next-line', (data) => {
    const { gameId } = data;
    const game = games.get(gameId);

    if (!game || game.gameState !== 'playing') {
      return;
    }

    if (game.currentLineIndex < game.currentLyrics.length) {
      const line = game.currentLyrics[game.currentLineIndex];
      game.currentLineIndex += 1;

      io.to(gameId).emit('new-line', { 
        line,
        lineNumber: game.currentLineIndex,
        totalLines: game.currentLyrics.length
      });
    } else {
      io.to(gameId).emit('lyrics-complete');
    }
  });

  socket.on('submit-guess', (data) => {
    const { gameId, playerId, guess } = data;
    const game = games.get(gameId);

    if (!game || game.gameState !== 'playing') {
      return;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return;
    }

    // Check if guess is correct (case-insensitive, fuzzy match)
    const correctAnswer = game.currentSong.name.toLowerCase();
    const playerGuess = guess.toLowerCase().trim();
    
    const isCorrect = correctAnswer.includes(playerGuess) || 
                     playerGuess.includes(correctAnswer) ||
                     correctAnswer === playerGuess;

    if (isCorrect) {
      // Award points based on how many lines were shown
      const points = Math.max(100 - (game.currentLineIndex * 10), 10);
      player.score += points;

      io.to(gameId).emit('correct-guess', {
        playerId,
        playerName: player.name,
        points,
        correctAnswer: game.currentSong.name,
        players: game.players
      });

      game.gameState = 'waiting';
    } else {
      socket.emit('incorrect-guess', { guess });
    }
  });

  socket.on('skip-song', (data) => {
    const { gameId } = data;
    const game = games.get(gameId);

    if (!game) {
      return;
    }

    game.gameState = 'waiting';
    io.to(gameId).emit('song-skipped', { 
      correctAnswer: game.currentSong?.name,
      artist: game.currentSong?.artist
    });
  });

  socket.on('end-game', (data) => {
    const { gameId } = data;
    const game = games.get(gameId);

    if (!game) {
      return;
    }

    game.gameState = 'ended';
    
    // Sort players by score
    const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
    
    io.to(gameId).emit('game-ended', { 
      players: sortedPlayers,
      winner: sortedPlayers[0]
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to generate mock lyrics
function generateMockLyrics(songName, artist) {
  // In production, integrate with Genius API or similar
  // For now, generate placeholder lyrics
  const lines = [
    `Song by ${artist}`,
    'First line of the lyrics goes here',
    'Second line revealing more clues',
    'Third line with more context',
    'Fourth line getting easier',
    `The title might be "${songName}"`,
    'Final line making it obvious'
  ];
  return lines;
}

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/join', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'join.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to start playing!`);
});
