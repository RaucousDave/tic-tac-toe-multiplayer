import { WebSocketServer } from "ws";
import http from "http";

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});
const wss = new WebSocketServer({ server });

const rooms = new Map();

function createGameState() {
  return {
    gameOver: false,
    draw: false,
    board: [null, null, null, null, null, null, null, null, null],
    winner: null,
    currentPlayer: "X",
    players: {},
    scores: {
      X: 0,
      O: 0,
    },
  };
}

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

function sendGameUpdate(room) {
  const message = JSON.stringify({
    type: "update",
    roomId: room.id,
    board: room.gameState.board,
    currentPlayer: room.gameState.currentPlayer,
    gameOver: room.gameState.gameOver,
    draw: room.gameState.draw,
    winner: room.gameState.winner,
    scores: room.gameState.scores,
  });

  Object.values(room.gameState.players).forEach((ws) => {
    if (ws && ws.readyState === 1) {
      // 1 = OPEN
      ws.send(message);
    }
  });
}

function getRoomId(req) {
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get("room") || "lobby";
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      gameState: createGameState(),
    });
  }

  return rooms.get(roomId);
}

function resetBoard(gameState) {
  gameState.gameOver = false;
  gameState.draw = false;
  gameState.board = [null, null, null, null, null, null, null, null, null];
  gameState.winner = null;
  gameState.currentPlayer = "X";
}

wss.on("connection", (ws, req) => {
  const room = getOrCreateRoom(getRoomId(req));
  let { gameState } = room;

  console.log(`Player connected to room ${room.id}`);

  if (!gameState.players["X"]) {
    gameState.players["X"] = ws;
    ws.playerRole = "X";
    ws.send(
      JSON.stringify({ type: "assigned", playerRole: "X", roomId: room.id }),
    );
  } else if (!gameState.players["O"]) {
    gameState.players["O"] = ws;
    ws.playerRole = "O";
    ws.send(
      JSON.stringify({ type: "assigned", playerRole: "O", roomId: room.id }),
    );
  } else {
    ws.send(JSON.stringify({ type: "error", message: "Game is full" }));
    ws.close();
    return;
  }

  ws.roomId = room.id;

  sendGameUpdate(room);

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === "move") {
        const index = message.cellIndex;

        if (!Number.isInteger(index) || index < 0 || index > 8) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid move" }));
          return;
        }

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
          gameState.scores[gameState.currentPlayer]++;
          gameState.winner = gameState.currentPlayer;
          gameState.gameOver = true;
        }

        gameState.draw =
          !gameState.winner && gameState.board.every((cell) => cell !== null);
        if (gameState.draw) {
          gameState.gameOver = true;
        }

        if (!gameState.gameOver) {
          gameState.currentPlayer = gameState.currentPlayer === "X" ? "O" : "X";
        }

        sendGameUpdate(room);
      }

      if (message.type === "reset") {
        resetBoard(gameState);
        sendGameUpdate(room);
      }
    } catch (error) {
      console.error(error);
    }
  });

  ws.on("close", () => {
    console.log(`Player ${ws.playerRole} disconnected from room ${room.id}`);
    delete gameState.players[ws.playerRole];

    if (Object.keys(gameState.players).length === 0) {
      rooms.delete(room.id);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎮 Tic-Tac-Toe server running on port ${PORT}`);
});
