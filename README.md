# 🎵 Spotify Lyrics Guessing Game

A multiplayer web-based game where players guess songs from their Spotify library based on lyrics shown line-by-line. Features real-time multiplayer support with QR code joining, timer-based gameplay, and score tracking.

## Features

- 🎵 **Spotify Integration**: Connect your Spotify account and play with songs from your library
- 👥 **Multiplayer Support**: Multiple players can join via QR code scanning
- ⏱️ **Timer-Based Gameplay**: 30-second countdown for each round
- 📊 **Score Tracking**: Points awarded based on how quickly you guess (fewer lines = more points)
- 🎮 **Game Modes**: Quiz-style gameplay with multiple rounds
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔄 **Real-Time Updates**: Live scoreboard and game state updates using WebSockets

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Spotify account
- Spotify Developer App credentials

## Setup Instructions

### 1. Create a Spotify Developer App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the app name and description
5. Once created, note your **Client ID** and **Client Secret**
6. Click "Edit Settings"
7. Add `http://localhost:3000/callback` to the Redirect URIs
8. Save the settings

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Spotify credentials:
```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
PORT=3000
BASE_URL=http://localhost:3000
```

**Note**: For multiplayer on your local network, set `BASE_URL` to your local IP (e.g., `http://192.168.1.100:3000`).

### 4. Run the Application

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

### 5. Access the Game

Open your browser and navigate to:
```
http://localhost:3000
```

## How to Play

### As Host:
1. Click "Connect with Spotify" to authenticate
2. Click "Create New Game"
3. Share the QR code or Game ID with other players
4. Wait for players to join
5. Click "Start Game" to begin
6. Click "Show Next Line" to reveal lyrics one line at a time
7. Type your guess in the input field and submit
8. First correct guess wins points for that round!

### As Player:
1. Scan the QR code or visit the join URL
2. Enter your name
3. Wait for the host to start the game
4. Guess the song based on the lyrics shown
5. Submit your answer before time runs out!

## Game Rules

- Each game has 5 rounds by default
- Players have 30 seconds per round to guess
- Points are awarded based on how many lyric lines were shown:
  - 1 line: 100 points
  - 2 lines: 90 points
  - 3 lines: 80 points
  - And so on (minimum 10 points)
- The player with the most points at the end wins!

## Technologies Used

- **Backend**: Node.js, Express.js
- **Real-Time Communication**: Socket.io
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **APIs**: Spotify Web API
- **QR Code Generation**: qrcode library

## Project Structure

```
.
├── server.js           # Backend server with Express and Socket.io
├── package.json        # Node.js dependencies
├── .env.example        # Example environment variables
├── .gitignore         # Git ignore file
└── public/            # Frontend files
    ├── index.html     # Host game page
    ├── join.html      # Join game page
    ├── styles.css     # Styling
    └── game.js        # Game logic and Socket.io client
```

## Notes

- **Lyrics**: The current implementation uses mock lyrics. For production, integrate with the [Genius API](https://genius.com/developers) or similar service to fetch real lyrics.
- **Spotify Library**: Make sure you have songs saved in your Spotify library to play the game.
- **Local Network**: To play with others on your local network, replace `localhost` with your local IP address.
- **Production Deployment**: For production, update the redirect URI and use HTTPS.

## Future Enhancements

- Integration with Genius API for real song lyrics
- Difficulty levels (easy/medium/hard)
- Custom game settings (rounds, time limit)
- Playlist selection instead of random library songs
- Audio preview of the song
- Leaderboards and statistics
- Private/public game rooms

## Troubleshooting

**Issue**: "Not authenticated" error
- Solution: Make sure you've connected your Spotify account and have a valid session

**Issue**: "No tracks found in library"
- Solution: Save some songs to your Spotify library first

**Issue**: Can't connect to server
- Solution: Check that the server is running and the PORT in .env matches

## License

ISC