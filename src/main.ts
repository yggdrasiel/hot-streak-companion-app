import QRCode from "qrcode";
import {
  connectToRoom,
  disconnectFromRoom,
  sendMessage,
  subscribeState,
  subscribeEvent,
  getState,
  sessionId,
  type GameState,
  type MascotId,
  type Bet,
} from "./socket";
import { getLifeOutcome } from "./lifeOutcomes";

// App Root
const app = document.getElementById("app")!;

// Local UI state
let localPlayerName = localStorage.getItem("hot_streak_player_name") || "";
let selectedDraftBet: {
  category: MascotId | "yes" | "no";
  isRisky: boolean;
} | null = null;

// Mascot metadata
const MASCOT_CONFIG: Record<
  MascotId,
  { name: string; icon: string; color: string; desc: string }
> = {
  gobbler: {
    name: "Gobbler",
    icon: "🐻",
    color: "var(--mascot-gobbler)",
    desc: "Lock-picking bear with wanderlust",
  },
  hurley: {
    name: "Hurley",
    icon: "🌭",
    color: "var(--mascot-hurley)",
    desc: "Legendary Boxford Bun Banger",
  },
  dangle: {
    name: "Dangle",
    icon: "🐟",
    color: "var(--mascot-dangle)",
    desc: "Deep sea cursed fish",
  },
  mum: {
    name: "Mum",
    icon: "👑",
    color: "var(--mascot-mum)",
    desc: "Queveland loyalist royalty",
  },
};

// Open mode temporary draft state
let openMascotBet: { mascotId: MascotId; isRisky: boolean; isDoubled: boolean } | null = null;
let openSideBet: { answer: "yes" | "no"; isRisky: boolean; isDoubled: boolean } | null = null;

// ==========================================
// Initialization & Navigation
// ==========================================

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get("room");

  if (roomParam) {
    renderJoinScreen(roomParam.toUpperCase());
  } else {
    renderHomeScreen();
  }

  // Subscribe to reactive state updates from PartyKit
  subscribeState((state) => {
    renderApp(state);
  });

  // Listen to live events
  subscribeEvent((event) => {
    if (event.type === "LIVE_RACER_PLACED" || event.type === "LIVE_SIDE_BET_UPDATED") {
      // Haptic feedback if supported on mobile
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }
    }
  });
}

// ==========================================
// Screen Renderers
// ==========================================

function renderApp(state: GameState | null) {
  if (!state) return;

  switch (state.phase) {
    case "LOBBY":
      renderLobbyScreen(state);
      break;
    case "BETTING":
      renderBettingScreen(state);
      break;
    case "RACE_INPUT":
      renderRaceInputScreen(state);
      break;
    case "RACE_RESULTS":
      renderRaceResultsScreen(state);
      break;
    case "GAME_OVER":
      renderGameOverScreen(state);
      break;
  }
}

// ------------------------------------------
// 1. Home Screen
// ------------------------------------------

function renderHomeScreen() {
  app.innerHTML = `
    <header class="app-header">
      <div class="brand-badge">🔥 HOT STREAK</div>
      <span class="room-tag">Companion</span>
    </header>

    <main class="screen">
      <div class="hero-box">
        <h1 class="hero-title">HOT STREAK</h1>
        <p class="hero-subtitle">The Degenerate Mascot Racing Companion App</p>
      </div>

      <div class="card">
        <div class="input-group">
          <label class="input-label" for="player-name">Your Name</label>
          <input
            id="player-name"
            class="text-input"
            placeholder="e.g. Lucky Charlie"
            value="${localPlayerName}"
            maxlength="16"
          />
        </div>

        <button id="btn-host" class="btn btn-primary btn-full">
          👑 Host New Game
        </button>

        <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin: 4px 0;">
          — OR —
        </div>

        <div class="input-group">
          <label class="input-label" for="room-code-input">4-Letter Room Code</label>
          <input
            id="room-code-input"
            class="text-input"
            placeholder="e.g. STRK"
            maxlength="4"
            style="text-transform: uppercase; letter-spacing: 0.15em; font-size: 1.3rem; text-align: center;"
          />
        </div>

        <button id="btn-join" class="btn btn-secondary btn-full">
          🎟️ Join Existing Room
        </button>
      </div>
    </main>
  `;

  const nameInput = document.getElementById("player-name") as HTMLInputElement;
  const roomInput = document.getElementById("room-code-input") as HTMLInputElement;

  document.getElementById("btn-host")?.addEventListener("click", () => {
    const name = nameInput.value.trim() || "Host";
    localPlayerName = name;
    localStorage.setItem("hot_streak_player_name", name);
    const roomCode = generateRoomCode();
    connectToRoom(roomCode, name, true);
  });

  document.getElementById("btn-join")?.addEventListener("click", () => {
    const name = nameInput.value.trim() || "Racer";
    const room = roomInput.value.trim().toUpperCase();
    if (room.length !== 4) {
      alert("Please enter a valid 4-letter room code.");
      return;
    }
    localPlayerName = name;
    localStorage.setItem("hot_streak_player_name", name);
    connectToRoom(room, name);
  });
}

function renderJoinScreen(prefilledRoom: string) {
  app.innerHTML = `
    <header class="app-header">
      <div class="brand-badge">🔥 HOT STREAK</div>
      <span class="room-tag">Room ${prefilledRoom}</span>
    </header>

    <main class="screen">
      <div class="hero-box">
        <h1 class="hero-title">JOIN GAME</h1>
        <p class="hero-subtitle">You are joining Room <strong>${prefilledRoom}</strong></p>
      </div>

      <div class="card">
        <div class="input-group">
          <label class="input-label" for="join-name">Enter Your Name</label>
          <input
            id="join-name"
            class="text-input"
            placeholder="e.g. High Roller"
            value="${localPlayerName}"
            maxlength="16"
            autofocus
          />
        </div>

        <button id="btn-confirm-join" class="btn btn-primary btn-full">
          Enter Racetrack
        </button>
      </div>
    </main>
  `;

  document.getElementById("btn-confirm-join")?.addEventListener("click", () => {
    const nameInput = document.getElementById("join-name") as HTMLInputElement;
    const name = nameInput.value.trim() || "Racer";
    localPlayerName = name;
    localStorage.setItem("hot_streak_player_name", name);
    connectToRoom(prefilledRoom, name);
  });
}

// ------------------------------------------
// 2. Lobby Screen
// ------------------------------------------

async function renderLobbyScreen(state: GameState) {
  const isHost = state.hostId === sessionId;
  const currentMe = state.players[sessionId];
  const joinUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 140,
      color: { dark: "#0b0e17", light: "#ffd166" },
    });
  } catch (e) {
    console.error("QR Error", e);
  }

  const playersListHtml = Object.values(state.players)
    .map(
      (p) => `
      <div class="player-item">
        <div class="player-info">
          <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>${p.name}</strong>
            ${p.id === sessionId ? '<span style="color: var(--color-gold); font-size: 0.8rem;"> (You)</span>' : ""}
          </div>
        </div>
        <div>
          ${p.isHost ? '<span class="badge badge-host">HOST</span>' : ""}
          ${!p.connected ? '<span class="badge" style="background: rgba(239,68,68,0.2); color:#ef4444;">AWAY</span>' : ""}
        </div>
      </div>
    `
    )
    .join("");

  app.innerHTML = `
    <header class="app-header">
      <div class="brand-badge">🔥 HOT STREAK</div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="room-tag">${state.roomCode}</span>
        <button id="btn-leave" class="btn btn-secondary" style="padding: 4px 10px; min-height: unset; font-size: 0.8rem;">Leave</button>
      </div>
    </header>

    <main class="screen">
      <!-- Invite Card -->
      <div class="card" style="align-items: center; text-align: center;">
        <div style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700;">
          Room Code
        </div>
        <div style="font-family: var(--font-display); font-size: 2.4rem; font-weight: 900; letter-spacing: 0.2em; color: var(--color-gold);">
          ${state.roomCode}
        </div>
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" style="border-radius: 12px; margin: 6px 0;" />` : ""}
        <button id="btn-copy-link" class="btn btn-secondary" style="font-size: 0.85rem; padding: 8px 16px; min-height: unset;">
          📋 Copy Invite Link
        </button>
      </div>

      <!-- Host Settings (if Host) -->
      ${
        isHost
          ? `
        <div class="card">
          <h3 style="font-size: 1.1rem; color: var(--color-gold);">⚙️ Game Configuration</h3>

          <div class="input-group">
            <label class="input-label">Game Mode</label>
            <div style="display: flex; gap: 8px;">
              <button id="mode-classic" class="btn ${state.mode === "classic" ? "btn-primary" : "btn-secondary"}" style="flex: 1;">
                Classic Draft
              </button>
              <button id="mode-open" class="btn ${state.mode === "open" ? "btn-primary" : "btn-secondary"}" style="flex: 1;">
                Open Track
              </button>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
              ${
                state.mode === "classic"
                  ? "Turn-based snake draft of 2 tickets per player with limited ticket stacks."
                  : "Simultaneous picks: 1 mascot & 1 side bet. Payouts split the 4 race pots!"
              }
            </p>
          </div>

          <div class="input-group" style="margin-top: 6px;">
            <div style="display:flex; justify-content:space-between;">
              <label class="input-label">Total Races</label>
              <span style="font-weight: 800; color: var(--color-gold);">${state.totalRaces}</span>
            </div>
            <input
              id="slider-races"
              type="range"
              min="1"
              max="5"
              value="${state.totalRaces}"
              style="accent-color: var(--color-gold); cursor: pointer;"
            />
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px;">
            <div>
              <div style="font-weight: 700; font-size: 0.95rem;">Host is a Player</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Allow host to bet and play along</div>
            </div>
            <input
              id="toggle-playing-host"
              type="checkbox"
              ${currentMe?.isPlayingHost ? "checked" : ""}
              style="width: 22px; height: 22px; accent-color: var(--color-gold); cursor: pointer;"
            />
          </div>
        </div>
      `
          : `
        <div class="card" style="text-align: center; padding: 24px;">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">⏳</div>
          <h3>Waiting for Host to Start...</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">
            Mode: <strong>${state.mode === "classic" ? "Classic Snake Draft" : "Open Track"}</strong> (${state.totalRaces} Races)
          </p>
        </div>
      `
      }

      <!-- Players List -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: 1.05rem;">Joined Players</h3>
          <span style="font-size: 0.85rem; color: var(--text-secondary);">
            ${Object.values(state.players).length} racers
          </span>
        </div>
        <div class="player-list">
          ${playersListHtml}
        </div>
      </div>
    </main>

    ${
      isHost
        ? `
      <div class="host-action-bar">
        <button id="btn-start-game" class="btn btn-green btn-full">
          🚀 Start Game
        </button>
      </div>
    `
        : ""
    }
  `;

  // Listeners
  document.getElementById("btn-leave")?.addEventListener("click", () => {
    disconnectFromRoom();
    renderHomeScreen();
  });

  document.getElementById("btn-copy-link")?.addEventListener("click", () => {
    navigator.clipboard.writeText(joinUrl);
    alert("Invite link copied to clipboard!");
  });

  if (isHost) {
    document.getElementById("mode-classic")?.addEventListener("click", () => {
      sendMessage({ type: "UPDATE_CONFIG", payload: { mode: "classic" } });
    });

    document.getElementById("mode-open")?.addEventListener("click", () => {
      sendMessage({ type: "UPDATE_CONFIG", payload: { mode: "open" } });
    });

    document.getElementById("slider-races")?.addEventListener("change", (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      sendMessage({ type: "UPDATE_CONFIG", payload: { totalRaces: val } });
    });

    document.getElementById("toggle-playing-host")?.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      sendMessage({ type: "UPDATE_CONFIG", payload: { isPlayingHost: checked } });
    });

    document.getElementById("btn-start-game")?.addEventListener("click", () => {
      sendMessage({ type: "HOST_START_GAME" });
    });
  }
}

// ------------------------------------------
// 3. Betting Screen
// ------------------------------------------

function renderBettingScreen(state: GameState) {
  const me = state.players[sessionId];
  const isHost = state.hostId === sessionId;
  const isClassic = state.mode === "classic";

  const myBetsCount = me?.currentBets.length || 0;
  const myBets = me?.currentBets || [];

  // Classic draft turn logic
  const currentDrafterId = state.draftOrder[state.currentDraftIndex];
  const isMyTurn = isClassic && currentDrafterId === sessionId;
  const currentDrafter = currentDrafterId ? state.players[currentDrafterId] : null;

  // Double down status for final race
  const isFinalRace = state.currentRace === state.totalRaces;

  let contentHtml = "";

  if (isClassic) {
    // ==========================================
    // CLASSIC DRAFT BOARD
    // ==========================================
    const renderTicketCard = (
      cat: MascotId | "yes" | "no",
      title: string,
      icon: string,
      color: string
    ) => {
      const remainingTiers = state.availableTickets[cat];
      const count = remainingTiers.length;
      const topTier = remainingTiers[0];
      const isDepleted = count === 0;

      let payoutPreview = "Depleted";
      if (topTier) {
        if (cat === "yes" || cat === "no") {
          payoutPreview = `Tier ${topTier}: Win +$${topTier === 1 ? 10 : topTier === 2 ? 7 : 5}`;
        } else {
          payoutPreview = `Tier ${topTier}: 1st $${topTier === 1 ? 10 : topTier === 2 ? 7 : 5}`;
        }
      }

      return `
        <div
          class="ticket-card ${cat} ${isDepleted ? "depleted" : ""}"
          data-category="${cat}"
          style="${!isDepleted && isMyTurn ? "cursor: pointer;" : ""}"
        >
          <div class="ticket-title">
            <span>${icon} ${title}</span>
            <span class="badge ${isDepleted ? "" : "badge-ready"}">${count}/3</span>
          </div>
          <div class="ticket-payouts">${payoutPreview}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted);">
            ${isDepleted ? "No tickets left" : "Tap to pick Safe or Risky"}
          </div>
        </div>
      `;
    };

    contentHtml = `
      <!-- Draft Order Indicator -->
      <div class="turn-banner ${isMyTurn ? "my-turn" : ""}">
        ${
          isMyTurn
            ? `<div style="font-size: 1.2rem; font-weight: 800; color: var(--color-gold);">🎯 IT IS YOUR TURN TO DRAFT!</div>
               <div style="font-size: 0.85rem; color: var(--text-primary);">Pick a Mascot or Side Bet below (${myBetsCount + 1}/2)</div>`
            : `<div style="font-size: 1rem; font-weight: 700;">Waiting for <strong>${currentDrafter?.name || "Player"}</strong> to draft...</div>
               <div style="font-size: 0.8rem; color: var(--text-secondary);">Turn ${state.currentDraftIndex + 1} of ${state.draftOrder.length}</div>`
        }
      </div>

      <!-- Player's Drafted Tickets Summary -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 0.95rem;">Your Drafted Tickets (${myBetsCount}/2)</h3>
          ${isFinalRace && myBetsCount === 1 ? '<span class="badge badge-turn">2nd Ticket Doubled!</span>' : ""}
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${
            myBets.length === 0
              ? '<span style="color: var(--text-muted); font-size: 0.85rem;">No tickets drafted yet this race.</span>'
              : myBets
                  .map(
                    (b) => `
              <div style="background: rgba(255,255,255,0.06); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; border: 1px solid var(--border-glass);">
                <strong>${b.type === "mascot" ? b.mascotId.toUpperCase() : "SIDE: " + b.answer.toUpperCase()}</strong>
                (Tier ${b.tier}, ${b.isRisky ? "Risky" : "Safe"}${b.isDoubled ? " 🔥2x" : ""})
              </div>
            `
                  )
                  .join("")
          }
        </div>
      </div>

      <!-- Mascot Tickets Section -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <h4 style="font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Mascot Tickets</h4>
        <div class="ticket-grid">
          ${renderTicketCard("gobbler", "Gobbler", "🐻", "var(--mascot-gobbler)")}
          ${renderTicketCard("hurley", "Hurley", "🌭", "var(--mascot-hurley)")}
          ${renderTicketCard("dangle", "Dangle", "🐟", "var(--mascot-dangle)")}
          ${renderTicketCard("mum", "Mum", "👑", "var(--mascot-mum)")}
        </div>
      </div>

      <!-- Side Bet Tickets Section -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
        <h4 style="font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Side Bet Tickets</h4>
        <div class="ticket-grid">
          ${renderTicketCard("yes", "YES Bet", "✅", "var(--color-green)")}
          ${renderTicketCard("no", "NO Bet", "❌", "var(--color-red)")}
        </div>
      </div>
    `;
  } else {
    // ==========================================
    // OPEN TRACK SIMULTANEOUS BETTING
    // ==========================================
    contentHtml = `
      <div class="card">
        <h3 style="font-size: 1.1rem; color: var(--color-gold);">1. Choose 1 Mascot</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          ${(["gobbler", "hurley", "dangle", "mum"] as MascotId[])
            .map((m) => {
              const cfg = MASCOT_CONFIG[m];
              const isSel = openMascotBet?.mascotId === m;
              return `
                <button
                  class="btn ${isSel ? "btn-primary" : "btn-secondary"}"
                  data-open-mascot="${m}"
                  style="flex-direction: column; height: 72px; padding: 6px;"
                >
                  <span style="font-size: 1.4rem;">${cfg.icon}</span>
                  <span style="font-size: 0.85rem;">${cfg.name}</span>
                </button>
              `;
            })
            .join("")}
        </div>

        ${
          isFinalRace
            ? `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top: 6px;">
            <span style="font-size: 0.85rem;">Double Down on Mascot?</span>
            <input type="checkbox" id="open-mascot-double" ${openMascotBet?.isDoubled ? "checked" : ""} style="accent-color:var(--color-gold); width:20px; height:20px;" />
          </div>
        `
            : ""
        }
      </div>

      <div class="card">
        <h3 style="font-size: 1.1rem; color: var(--color-green);">2. Side Bet (Yes / No)</h3>
        <div style="display: flex; gap: 8px;">
          <button
            class="btn ${openSideBet?.answer === "yes" ? "btn-primary" : "btn-secondary"}"
            data-open-side="yes"
            style="flex: 1;"
          >
            ✅ YES
          </button>
          <button
            class="btn ${openSideBet?.answer === "no" ? "btn-primary" : "btn-secondary"}"
            data-open-side="no"
            style="flex: 1;"
          >
            ❌ NO
          </button>
        </div>

        ${
          isFinalRace
            ? `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top: 6px;">
            <span style="font-size: 0.85rem;">Double Down on Side Bet?</span>
            <input type="checkbox" id="open-side-double" ${openSideBet?.isDoubled ? "checked" : ""} style="accent-color:var(--color-gold); width:20px; height:20px;" />
          </div>
        `
            : ""
        }
      </div>

      <button id="btn-submit-open-bets" class="btn btn-green btn-full" ${openMascotBet && openSideBet ? "" : "disabled"}>
        🔒 Lock In Bets
      </button>
    `;
  }

  app.innerHTML = `
    <header class="app-header">
      <div class="brand-badge">🔥 HOT STREAK</div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="room-tag">Race ${state.currentRace}/${state.totalRaces}</span>
        <span class="score-badge">$${me?.score ?? 10}</span>
      </div>
    </header>

    <main class="screen">
      ${contentHtml}

      <!-- Roster Readiness Status -->
      <div class="card" style="margin-top: 10px;">
        <h4 style="font-size: 0.85rem; color: var(--text-secondary);">RACER STATUS</h4>
        <div class="player-list">
          ${Object.values(state.players)
            .filter((p) => p.connected && (!p.isHost || p.isPlayingHost))
            .map((p) => {
              const isLocked = isClassic ? p.currentBets.length === 2 : p.currentBets.length === 2;
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 0.85rem;">
                  <span>${p.name} ${p.id === sessionId ? "(You)" : ""}</span>
                  <span>${isLocked ? "✅ Locked" : isClassic ? `${p.currentBets.length}/2 Drafted` : "⏳ Picking"}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    </main>

    <!-- Host Floating Controls -->
    ${
      isHost
        ? `
      <div class="host-action-bar">
        <button id="btn-force-start-race" class="btn btn-secondary btn-full" style="font-size: 0.85rem;">
          🏎️ Force Advance to Race
        </button>
      </div>
    `
        : ""
    }

    <!-- Bottom Sheet Modal for Ticket Selection (Safe vs Risky) -->
    <div id="draft-modal-container"></div>
  `;

  // Attach Event Listeners
  if (isClassic) {
    document.querySelectorAll(".ticket-card:not(.depleted)").forEach((card) => {
      card.addEventListener("click", () => {
        if (!isMyTurn) {
          alert("Please wait for your turn in the snake draft.");
          return;
        }
        if (myBetsCount >= 2) {
          alert("You have already drafted your 2 tickets for this race.");
          return;
        }
        const category = card.getAttribute("data-category") as MascotId | "yes" | "no";
        openDraftModal(state, category);
      });
    });
  } else {
    // Open mode listeners
    document.querySelectorAll("[data-open-mascot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.getAttribute("data-open-mascot") as MascotId;
        openMascotBet = { mascotId: m, isRisky: false, isDoubled: false };
        renderBettingScreen(state);
      });
    });

    document.querySelectorAll("[data-open-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ans = btn.getAttribute("data-open-side") as "yes" | "no";
        openSideBet = { answer: ans, isRisky: false, isDoubled: false };
        renderBettingScreen(state);
      });
    });

    document.getElementById("open-mascot-double")?.addEventListener("change", (e) => {
      if (openMascotBet) {
        openMascotBet.isDoubled = (e.target as HTMLInputElement).checked;
      }
    });

    document.getElementById("open-side-double")?.addEventListener("change", (e) => {
      if (openSideBet) {
        openSideBet.isDoubled = (e.target as HTMLInputElement).checked;
      }
    });

    document.getElementById("btn-submit-open-bets")?.addEventListener("click", () => {
      if (openMascotBet && openSideBet) {
        sendMessage({
          type: "SUBMIT_BET",
          payload: {
            bet: {
              type: "mascot",
              mascotId: openMascotBet.mascotId,
              isRisky: openMascotBet.isRisky,
              isDoubled: openMascotBet.isDoubled,
            },
          },
        });
        sendMessage({
          type: "SUBMIT_BET",
          payload: {
            bet: {
              type: "side",
              answer: openSideBet.answer,
              isRisky: openSideBet.isRisky,
              isDoubled: openSideBet.isDoubled,
            },
          },
        });
      }
    });
  }

  // Host force start
  document.getElementById("btn-force-start-race")?.addEventListener("click", () => {
    // Transition to race
    if (confirm("Force end betting and move to the race?")) {
      // In server, if bets are completed it moves automatically, but host can advance
    }
  });
}

function openDraftModal(state: GameState, category: MascotId | "yes" | "no") {
  const modalContainer = document.getElementById("draft-modal-container");
  if (!modalContainer) return;

  const remainingTiers = state.availableTickets[category];
  const nextTier = remainingTiers[0];
  if (!nextTier) return;

  const isMascot = category !== "yes" && category !== "no";
  const name = isMascot ? MASCOT_CONFIG[category as MascotId].name : `Side Bet (${category.toUpperCase()})`;

  // Payout description
  let safeDesc = "";
  let riskyDesc = "";
  if (isMascot) {
    if (nextTier === 1) {
      safeDesc = "1st: $10 | 2nd: $7 | 3rd: $5";
      riskyDesc = "1st: $15 | 2nd: $5 | 3rd: $2";
    } else if (nextTier === 2) {
      safeDesc = "1st: $7 | 2nd: $5 | 3rd: $3";
      riskyDesc = "1st: $11 | 2nd: $3 | 3rd: $1";
    } else {
      safeDesc = "1st: $5 | 2nd: $3 | 3rd: $2";
      riskyDesc = "1st: $8 | 2nd: $2 | 3rd: $0";
    }
  } else {
    if (nextTier === 1) {
      safeDesc = "Win: +$10 | Lose: $0";
      riskyDesc = "Win: +$15 | Lose: -$5";
    } else if (nextTier === 2) {
      safeDesc = "Win: +$7 | Lose: $0";
      riskyDesc = "Win: +$12 | Lose: -$5";
    } else {
      safeDesc = "Win: +$5 | Lose: $0";
      riskyDesc = "Win: +$10 | Lose: -$5";
    }
  }

  let selectedRisky = false;

  modalContainer.innerHTML = `
    <div class="backdrop" id="modal-backdrop"></div>
    <div class="bottom-sheet">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-size: 1.25rem;">Draft ${name}</h3>
        <span class="badge badge-ready">Tier ${nextTier}</span>
      </div>

      <div style="font-size: 0.85rem; color: var(--text-secondary);">
        Choose whether you want the Safe side or the Risky side of this ticket:
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div
          id="choice-safe"
          class="card"
          style="cursor: pointer; border: 2px solid var(--color-green); padding: 12px; background: rgba(16, 185, 129, 0.1);"
        >
          <div style="display: flex; justify-content: space-between; font-weight: 800;">
            <span>🛡️ SAFE SIDE</span>
            <span style="color: var(--color-green);">Recommended</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-primary); margin-top: 4px;">${safeDesc}</div>
        </div>

        <div
          id="choice-risky"
          class="card"
          style="cursor: pointer; border: 1px solid var(--border-glass); padding: 12px;"
        >
          <div style="display: flex; justify-content: space-between; font-weight: 800;">
            <span>🔥 RISKY SIDE</span>
            <span style="color: var(--color-orange);">High Risk / High Reward</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-primary); margin-top: 4px;">${riskyDesc}</div>
        </div>
      </div>

      <button id="btn-confirm-draft" class="btn btn-primary btn-full">
        Confirm Draft Pick
      </button>
    </div>
  `;

  const safeCard = document.getElementById("choice-safe")!;
  const riskyCard = document.getElementById("choice-risky")!;

  safeCard.addEventListener("click", () => {
    selectedRisky = false;
    safeCard.style.border = "2px solid var(--color-green)";
    safeCard.style.background = "rgba(16, 185, 129, 0.1)";
    riskyCard.style.border = "1px solid var(--border-glass)";
    riskyCard.style.background = "var(--bg-card)";
  });

  riskyCard.addEventListener("click", () => {
    selectedRisky = true;
    riskyCard.style.border = "2px solid var(--color-orange)";
    riskyCard.style.background = "rgba(251, 133, 0, 0.15)";
    safeCard.style.border = "1px solid var(--border-glass)";
    safeCard.style.background = "var(--bg-card)";
  });

  document.getElementById("modal-backdrop")?.addEventListener("click", () => {
    modalContainer.innerHTML = "";
  });

  document.getElementById("btn-confirm-draft")?.addEventListener("click", () => {
    const bet: Bet = isMascot
      ? {
          type: "mascot",
          mascotId: category as MascotId,
          isRisky: selectedRisky,
        }
      : {
          type: "side",
          answer: category as "yes" | "no",
          isRisky: selectedRisky,
        };

    sendMessage({
      type: "SUBMIT_BET",
      payload: { bet },
    });

    modalContainer.innerHTML = "";
  });
}

// ------------------------------------------
// 4. Race Input / Live Race Screen
// ------------------------------------------

function renderRaceInputScreen(state: GameState) {
  const isHost = state.hostId === sessionId;
  const placements = state.livePlacements;

  const renderPositionSlot = (pos: 1 | 2 | 3 | 4) => {
    const assigned = placements[pos];
    const mascot = assigned ? MASCOT_CONFIG[assigned] : null;

    return `
      <div class="podium-slot">
        <div class="podium-rank">${pos}</div>
        <div class="podium-mascot">
          ${
            mascot
              ? `<span style="font-size: 1.5rem;">${mascot.icon}</span> ${mascot.name}`
              : `<span style="color: var(--text-muted); font-size: 0.9rem; font-weight: normal;">Not placed yet</span>`
          }
        </div>
        ${
          isHost
            ? `
          <div style="display: flex; gap: 4px;">
            ${(["gobbler", "hurley", "dangle", "mum"] as MascotId[])
              .map((m) => {
                const isCurrent = assigned === m;
                return `
                  <button
                    class="btn ${isCurrent ? "btn-primary" : "btn-secondary"}"
                    data-place-pos="${pos}"
                    data-place-mascot="${m}"
                    style="padding: 4px 8px; min-height: unset; font-size: 0.85rem;"
                  >
                    ${MASCOT_CONFIG[m].icon}
                  </button>
                `;
              })
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;
  };

  app.innerHTML = `
    <header class="app-header">
      <div class="brand-badge">🔥 HOT STREAK</div>
      <span class="room-tag">Race ${state.currentRace}/${state.totalRaces}</span>
    </header>

    <main class="screen">
      <div class="hero-box" style="padding-bottom: 0;">
        <h2 style="font-size: 1.8rem;">🏁 THE RACE IS ON!</h2>
        <p class="hero-subtitle">Dealer is flipping cards and moving mascots on the board.</p>
      </div>

      <!-- Live Positions Board -->
      <div class="card">
        <h3 style="font-size: 1.05rem; color: var(--color-gold);">Podium & Finish Placements</h3>
        <div class="racetrack">
          ${renderPositionSlot(1)}
          ${renderPositionSlot(2)}
          ${renderPositionSlot(3)}
          ${renderPositionSlot(4)}
        </div>
      </div>

      <!-- Live Side Bet Status -->
      <div class="card">
        <h3 style="font-size: 1.05rem;">Side Bet Outcome</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="flex: 1; font-weight: 700;">
            Did the side bet scenario occur?
          </div>
          ${
            isHost
              ? `
            <button id="btn-side-yes" class="btn ${state.sideBetOccurred === true ? "btn-green" : "btn-secondary"}" style="padding: 6px 14px; min-height: unset;">
              YES
            </button>
            <button id="btn-side-no" class="btn ${state.sideBetOccurred === false ? "btn-danger" : "btn-secondary"}" style="padding: 6px 14px; min-height: unset;">
              NO
            </button>
          `
              : `
            <span class="badge ${state.sideBetOccurred === true ? "badge-ready" : state.sideBetOccurred === false ? "badge-host" : ""}">
              ${state.sideBetOccurred === null ? "PENDING..." : state.sideBetOccurred ? "YES" : "NO"}
            </span>
          `
          }
        </div>
      </div>
    </main>

    ${
      isHost
        ? `
      <div class="host-action-bar">
        <button id="btn-finalize-race" class="btn btn-green btn-full">
          💰 Finalize Race & Settle Bets
        </button>
      </div>
    `
        : ""
    }
  `;

  if (isHost) {
    // Placement buttons
    document.querySelectorAll("[data-place-pos]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pos = Number(btn.getAttribute("data-place-pos")) as 1 | 2 | 3 | 4;
        const mascot = btn.getAttribute("data-place-mascot") as MascotId;
        sendMessage({
          type: "LIVE_PLACE_RACER",
          payload: { position: pos, mascotId: mascot },
        });
      });
    });

    // Side bet toggle
    document.getElementById("btn-side-yes")?.addEventListener("click", () => {
      sendMessage({
        type: "LIVE_TOGGLE_SIDE_BET",
        payload: { sideBetOccurred: true },
      });
    });

    document.getElementById("btn-side-no")?.addEventListener("click", () => {
      sendMessage({
        type: "LIVE_TOGGLE_SIDE_BET",
        payload: { sideBetOccurred: false },
      });
    });

    document.getElementById("btn-finalize-race")?.addEventListener("click", () => {
      sendMessage({ type: "FINALIZE_RACE" });
    });
  }
}

// ------------------------------------------
// 5. Race Results Screen
// ------------------------------------------

function renderRaceResultsScreen(state: GameState) {
  const isHost = state.hostId === sessionId;
  const lastRace = state.raceHistory[state.raceHistory.length - 1];
  const me = state.players[sessionId];
  const myPayout = lastRace?.payouts[sessionId] ?? 0;

  // Sorted leaderboard
  const sortedPlayers = Object.values(state.players).sort((a, b) => b.score - a.score);

  app.innerHTML = `
    <header class="app-header">
      <div class="brand-badge">🔥 HOT STREAK</div>
      <span class="room-tag">Race ${lastRace?.raceNumber} Results</span>
    </header>

    <main class="screen">
      <!-- Your Personal Payout Card -->
      <div class="card" style="text-align: center; border: 2px solid ${myPayout >= 0 ? "var(--color-green)" : "var(--color-red)"};">
        <div style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700;">
          Your Winnings This Race
        </div>
        <div style="font-size: 2.6rem; font-weight: 900; color: ${myPayout >= 0 ? "var(--color-green)" : "var(--color-red)"};">
          ${myPayout >= 0 ? `+$${myPayout}` : `-$${Math.abs(myPayout)}`}
        </div>
        <div style="font-size: 0.95rem; color: var(--text-muted);">
          Total Bankroll: <strong style="color: var(--color-gold);">$${me?.score ?? 0}</strong>
        </div>
      </div>

      <!-- Leaderboard -->
      <div class="card">
        <h3 style="font-size: 1.05rem; color: var(--color-gold);">🏆 Standings</h3>
        <div class="player-list">
          ${sortedPlayers
            .map((p, idx) => {
              const change = lastRace?.payouts[p.id] ?? 0;
              return `
                <div class="player-item">
                  <div class="player-info">
                    <span style="font-weight: 800; width: 20px;">#${idx + 1}</span>
                    <strong>${p.name}</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.8rem; color: ${change >= 0 ? "var(--color-green)" : "var(--color-red)"};">
                      (${change >= 0 ? `+${change}` : change})
                    </span>
                    <span class="score-badge">$${p.score}</span>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    </main>

    ${
      isHost
        ? `
      <div class="host-action-bar">
        <button id="btn-next-race" class="btn btn-primary btn-full">
          ➡️ Next Race (${state.currentRace + 1}/${state.totalRaces})
        </button>
      </div>
    `
        : ""
    }
  `;

  if (isHost) {
    document.getElementById("btn-next-race")?.addEventListener("click", () => {
      sendMessage({ type: "NEXT_RACE" });
    });
  }
}

// ------------------------------------------
// 6. Game Over Screen
// ------------------------------------------

function renderGameOverScreen(state: GameState) {
  const isHost = state.hostId === sessionId;
  const me = state.players[sessionId];
  const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const myOutcome = getLifeOutcome(me?.score ?? 0);

  app.innerHTML = `
    <header class="app-header">
      <div class="brand-badge">🔥 HOT STREAK</div>
      <span class="badge badge-host">FINAL RESULTS</span>
    </header>

    <main class="screen">
      <div class="hero-box">
        <div style="font-size: 3rem;">👑</div>
        <h1 style="font-size: 2.2rem; color: var(--color-gold);">${winner?.name || "Someone"} Wins!</h1>
        <p class="hero-subtitle">With a bankroll of <strong>$${winner?.score || 0}</strong></p>
      </div>

      <!-- Life Outcome Box -->
      <div class="card">
        <h3 style="font-size: 1rem; color: var(--color-gold);">📖 Your Official Life Outcome ($${me?.score ?? 0})</h3>
        <div class="outcome-box">
          "${myOutcome}"
        </div>
      </div>

      <!-- Final Standings -->
      <div class="card">
        <h3 style="font-size: 1.05rem;">Final Bankrolls</h3>
        <div class="player-list">
          ${sorted
            .map(
              (p, idx) => `
            <div class="player-item">
              <div class="player-info">
                <span style="font-weight: 800; width: 22px;">#${idx + 1}</span>
                <strong>${p.name}</strong>
              </div>
              <span class="score-badge">$${p.score}</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    </main>

    ${
      isHost
        ? `
      <div class="host-action-bar">
        <button id="btn-restart-game" class="btn btn-secondary btn-full">
          🔄 Play Again (Reset Lobby)
        </button>
      </div>
    `
        : ""
    }
  `;

  if (isHost) {
    document.getElementById("btn-restart-game")?.addEventListener("click", () => {
      sendMessage({ type: "RESTART_GAME" });
    });
  }
}

// Start application
init();
