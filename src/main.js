// Connect to server
const url = process.env.WEBSOCKET_URL;

const ws = new WebSocket(url);

let playerRole = null;
let currentGameState = null;

// DOM elements
const cells = document.querySelectorAll(".grid-container > div");
const announcement = document.getElementById("announcement");
const playerScores = document.querySelectorAll(".player-score");
const playerRoles = document.querySelectorAll(".player-role");

// Connection opened
ws.onopen = () => {
  console.log("Connected to server");
};

// Receive messages from server
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  // Server tells us which player we are
  if (message.type === "assigned") {
    playerRole = message.playerRole;
    console.log(`You are player ${playerRole}`);
    announcement.textContent = `You are ${playerRole}. Waiting for opponent...`;
  }

  // Server sends game update
  if (message.type === "update") {
    currentGameState = message;
    updateBoard();
    updateAnnouncement();

    // Update scoreboard
    if (currentGameState.scores) {
      playerScores[0].textContent = currentGameState.scores.X;
      playerScores[1].textContent = currentGameState.scores.O;
    }
  }
  // Server sends error
  if (message.type === "error") {
    announcement.textContent = message.message;
  }
};

// Update board display
function updateBoard() {
  currentGameState.board.forEach((value, index) => {
    if (value) {
      cells[index].innerHTML = `<p>${value}</p>`;
    } else {
      cells[index].innerHTML = "";
    }
  });
}

// Update announcement text
function updateAnnouncement() {
  if (currentGameState.gameOver) {
    if (currentGameState.draw) {
      announcement.textContent = "This round ends in a tie 🤝";
    } else {
      announcement.textContent = `Player ${currentGameState.winner} wins! 🎉`;
    }
  } else {
    if (currentGameState.currentPlayer === playerRole) {
      announcement.textContent = "✅ Your turn";
    } else {
      announcement.textContent = "⏳ Opponent's turn";
    }
  }
}

// Handle cell clicks
cells.forEach((cell, index) => {
  cell.addEventListener("click", () => {
    if (!currentGameState || currentGameState.gameOver) return;

    // Send move to server
    ws.send(
      JSON.stringify({
        type: "move",
        cellIndex: index,
      }),
    );
  });
});

// Reset game button (add this to your HTML)
function resetGame() {
  ws.send(JSON.stringify({ type: "reset" }));
}
