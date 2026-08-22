// Connect to server
const RENDER_WEBSOCKET_URL = "wss://tic-tac-toe-multiplayer-8f0p.onrender.com";
const baseWebSocketUrl =
  import.meta.env.VITE_WEBSOCKET_URL || RENDER_WEBSOCKET_URL;
const roomId = getRoomId();
const url = `${baseWebSocketUrl}?room=${encodeURIComponent(roomId)}`;

const ws = new WebSocket(url);

let playerRole = null;
let currentGameState = null;

// DOM elements
const cells = document.querySelectorAll(".grid-container > div");
const announcement = document.getElementById("announcement");
const playerScores = document.querySelectorAll(".player-score");
const playerRoles = document.querySelectorAll(".player-role");
const inviteLink = document.getElementById("invite-link");
const copyInvite = document.getElementById("copy-invite");

const shareUrl = new URL(window.location.href);
shareUrl.searchParams.set("room", roomId);
inviteLink.value = shareUrl.toString();

function getRoomId() {
  const currentUrl = new URL(window.location.href);
  const existingRoomId = currentUrl.searchParams.get("room");

  if (existingRoomId) {
    return existingRoomId;
  }

  const newRoomId = crypto.randomUUID();
  currentUrl.searchParams.set("room", newRoomId);
  window.history.replaceState(null, "", currentUrl);
  return newRoomId;
}

// Connection opened
ws.onopen = () => {
  console.log("Connected to server");
};

copyInvite.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copyInvite.textContent = "Copied";
    setTimeout(() => {
      copyInvite.textContent = "Copy";
    }, 1500);
  } catch {
    inviteLink.select();
    document.execCommand("copy");
  }
});

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

window.resetGame = resetGame;
