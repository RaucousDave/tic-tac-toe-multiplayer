import { WebSocketServer } from "ws";
import http from "http";

const server = http.createServer();
const wss = new WebSocketServer({ server });

class Player {
  constructor(playerRole, score) {
    this.playerRole = playerRole;
    this.score = score;
  }
}

let gameState = {
  gameOver: false,
  draw: false,
  board: [null, null, null, null, null, null, null, null, null],
  winner: null,
  currentPlayer: "X",
  players: {},
};

// Winning combinations
const winningCombinations = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// Players
const player1 = new Player("X", 0);
const player2 = new Player("O", 0);

function checkWinner(board, playerRole) {
  return winningCombinations.some((combination) => {
    const [a, b, c] = combination;
    return (
      board[a] === playerRole &&
      board[b] === playerRole &&
      board[c] === playerRole
    );
  });
}

function sendGameUpdate() {
  const message = JSON.stringify({
    type: "update",
    board: gameState.board,
    currentPlayer: gameState.currentPlayer,
    gameOver: gameState.gameOver,
    draw: gameState.draw,
    winner: gameState.winner,
    scores: {
      X: player1.score,
      O: player2.score,
    },
  });

  Object.values(gameState.players).forEach((ws) => {
    if (ws && ws.readyState === 1) {
      // 1 = OPEN
      ws.send(message);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("Player connected");

  if (!gameState.players["X"]) {
    gameState.players["X"] = ws;
    ws.playerRole = "X";
    ws.send(JSON.stringify({ type: "assigned", playerRole: "X" }));
  } else if (!gameState.players["O"]) {
    gameState.players["O"] = ws;
    ws.playerRole = "O";
    ws.send(JSON.stringify({ type: "assigned", playerRole: "O" }));
  } else {
    ws.send(JSON.stringify({ type: "error", message: "Game is full" }));
    ws.close();
    return;
  }

  sendGameUpdate();

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === "move") {
        const index = message.cellIndex;

        if (gameState.currentPlayer !== ws.playerRole) {
          ws.send(JSON.stringify({ type: "error", message: "Not your turn!" }));
          return;
        }

        if (gameState.board[index] !== null) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "That slot is already taken",
            }),
          );
          return;
        }

        gameState.board[index] = gameState.currentPlayer;

        if (checkWinner(gameState.board, gameState.currentPlayer)) {
          const player = gameState.currentPlayer === "X" ? player1 : player2;
          player.score++;
          gameState.winner = gameState.currentPlayer;
          gameState.gameOver = true;
        }

        gameState.draw = gameState.board.every((cell) => cell !== null);
        if (gameState.draw) {
          gameState.gameOver = true;
        }

        if (!gameState.gameOver) {
          gameState.currentPlayer = gameState.currentPlayer === "X" ? "O" : "X";
        }

        sendGameUpdate();
      }

      if (message.type === "reset") {
        gameState = {
          gameOver: false,
          draw: false,
          board: [null, null, null, null, null, null, null, null, null],
          winner: null,
          currentPlayer: "X",
          players: gameState.players,
        };
        sendGameUpdate();
      }
    } catch (error) {
      console.error(error);
    }
  });

  ws.on("close", () => {
    console.log(`Player ${ws.playerRole} disconnected`);
    delete gameState.players[ws.playerRole];
  });
});

server.listen(8080, () => {
  console.log("🎮 Tic-Tac-Toe server on ws://localhost:8080");
});
