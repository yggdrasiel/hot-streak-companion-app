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
import { fireConfetti } from "./confetti";

// App Root
const app = document.getElementById("app")!;

// Local UI state
let localPlayerName = localStorage.getItem("hot_streak_player_name") || "";
let selectedDraftBet: {
  category: MascotId | "yes" | "no";
  isRisky: boolean;
} | null = null;
let selectedMascotForHostPlacement: MascotId | null = null;

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
let openMascotBet: { mascotId: MascotId; isRisky: boolean } | null = null;
let openSideBet: { answer: "yes" | "no"; isRisky: boolean } | null = null;
let openDoubleChoice: "mascot" | "side" = "mascot";

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

  // Reaction banner helper
  function showReactionBanner(
    type: "cheer" | "silver" | "bronze" | "heartbreak" | "sidebet",
    icon: string,
    title: string,
    subtitle: string
  ) {
    let container = document.getElementById("live-reaction-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "live-reaction-container";
      document.body.appendChild(container);
    }

    // Dismiss existing banners to prevent clutter
    Array.from(container.children).forEach((child) => {
      child.classList.add("exit");
      setTimeout(() => child.remove(), 250);
    });

    const banner = document.createElement("div");
    banner.className = `reaction-banner reaction-${type}`;
    banner.innerHTML = `
      <div class="reaction-icon">${icon}</div>
      <div class="reaction-text">
        <div class="reaction-title">${title}</div>
        <div class="reaction-subtitle">${subtitle}</div>
      </div>
    `;

    banner.addEventListener("click", () => {
      banner.classList.add("exit");
      setTimeout(() => banner.remove(), 250);
    });

    container.appendChild(banner);

    setTimeout(() => {
      if (banner.parentNode) {
        banner.classList.add("exit");
        setTimeout(() => banner.remove(), 250);
      }
    }, 3200);
  }

  // Listen to live events
  subscribeEvent((event) => {
    if (event.type === "LIVE_RACER_PLACED" || event.type === "LIVE_SIDE_BET_UPDATED") {
      // Haptic feedback if supported on mobile
      if ("vibrate" in navigator) {
        navigator.vibrate(60);
      }
    }

    if (event.type === "LIVE_RACER_PLACED") {
      const { position, mascotId } = event.payload;
      if (!mascotId) return;

      const state = getState();
      if (!state) return;
      const me = state.players[sessionId];
      if (!me) return;

      const myMascotBet = me.currentBets.find(
        (b) => b.type === "mascot" && b.mascotId === mascotId
      );
      const mascotInfo = MASCOT_CONFIG[mascotId];

      const PHRASES_1ST = [
        "GOLDEN GLORY! 🏆",
        "LEADING THE PACK! 🥇",
        "FIRST PLACE CASH COW! 💰",
        "SPEED DEMON IN 1ST! ⚡",
        "PURE UNSTOPPABLE PACE! 🔥",
        "CALL THE BANK! 🤑",
        "FRONT RUNNER DOMINANCE! 👑",
        "BLOWING AWAY THE FIELD! 🚀",
        "RIGHT WHERE YOU WANT 'EM! 🎯",
        "CHAMPIONSHIP DRIVE! 🌟",
        "THE SWEET TASTE OF VICTORY! 🍾",
        "ABSOLUTE MASTERCLASS! 🎩",
        "TOP OF THE PODIUM! 🥇",
        "FLYING HIGH IN 1ST! 🦅",
        "CASHING THE MAX PAYOUT! 💵",
      ];

      const SUBTITLES_1ST = (name: string) => [
        `${name} blasts across the line in 1st place! Maximum payout locked!`,
        `${name} leaves everyone in the dust! Golden ticket vibes!`,
        `Nobody could touch ${name}! You're cashing the top prize!`,
        `${name} takes the crown! Your wallet is smiling!`,
        `Pure speed from ${name}! 1st place podium secured!`,
        `What a run by ${name}! First place honors belong to you!`,
        `A flawless sprint! ${name} delivers the gold!`,
      ];

      const PHRASES_2ND = [
        "SILVER STRIKE! 🥈",
        "PODIUM FINISH! 🥈",
        "SOLID SECOND PLACE! 💵",
        "RUNNER-UP RICHES! 🥈",
        "ALMOST TOOK THE CROWN! ✨",
        "CASHING ON THE PODIUM! 💰",
        "SWEET SILVER PAYOUT! 🪙",
        "HOT ON THEIR HEELS! 🥈",
        "SECOND PLACE SECURED! 🎯",
        "STILL IN THE MONEY! 🤑",
        "A VALIANT SILVER RUN! 🥈",
        "SILVER MEDAL SECURED! 🥈",
        "BIG RUNNER-UP PAYDAY! 💸",
        "TAKING HOME THE SILVER! 🥈",
        "STRONG PODIUM SHOWING! 🏎️",
      ];

      const SUBTITLES_2ND = (name: string) => [
        `${name} grabs 2nd place! Silver on the podium means cash in your pocket!`,
        `${name} fights hard for the runner-up spot! Ticket successfully cashed!`,
        `Just inches from 1st, but 2nd place still brings in a sweet payout for ${name}!`,
        `Strong finish by ${name}! You're firmly on the podium!`,
        `${name} crosses in 2nd! Reliable returns for your bankroll!`,
        `A fantastic silver finish for ${name}! Money in the bank!`,
        `${name} delivers a handsome silver payout! Great bet!`,
      ];

      const PHRASES_3RD = [
        "BRONZE ON THE WIRE! 🥉",
        "PODIUM SQUEAKER! 🥉",
        "SNUCK ONTO THE PODIUM! 🥉",
        "STILL CASHING IN! 💵",
        "SAVED BY THE BRONZE! 🥉",
        "THIRD PLACE CLUTCH! 🥉",
        "AVOIDED THE DISASTER! 🛡️",
        "HONORABLE BRONZE! 🥉",
        "EVERY DOLLAR COUNTS! 💰",
        "AT LEAST IT WASN'T 4TH! 😅",
        "PODIUM SCRAPPER! 🥉",
        "CLUTCH BRONZE FINISH! 🥉",
        "SLIPPED ONTO THE PODIUM! 🥉",
        "THE SWEET TASTE OF BRONZE! 🥉",
        "THIRD PLACE SAVES THE DAY! 🥉",
      ];

      const SUBTITLES_3RD = (name: string) => [
        `${name} hung on for 3rd place! Any podium finish pays out!`,
        `${name} slides into bronze! Better than 4th by a mile!`,
        `Clutch effort from ${name}! You take home 3rd place winnings!`,
        `${name} secures the final podium spot! Your ticket stays alive!`,
        `A nail-biter finish, but ${name} clinches the bronze medal!`,
        `Phew! ${name} sneaks into 3rd to keep your bankroll growing!`,
        `Never in doubt (okay maybe a little)! ${name} takes bronze!`,
      ];

      const PHRASES_4TH = [
        "TOTAL HEARTBREAK! 😭",
        "DOWN GOES YOUR BET! 💔",
        "DEAD LAST DISASTER! 💀",
        "CURSED FINISH! 🛑",
        "TORCHED TICKET! 🔥",
        "THE WHEELS CAME OFF! 📉",
        "DISQUALIFIED FROM GLORY! 🪦",
        "PAIN. AGONY. DEFEAT. 😭",
        "FLAMED OUT AT THE BACK! 💥",
        "DON'T LOOK AT THE SCOREBOARD! 🙈",
        "ABSOLUTE BOTTLER! 🍼",
        "THE SHAME OF 4TH PLACE! 📉",
        "OFF THE RAILS! 🚂",
        "ABSOLUTE CATASTROPHE! 💥",
        "INTO THE DUMPSTER! 🗑️",
      ];

      const SUBTITLES_4TH = (name: string) => [
        `${name} crumbled into 4th place! Sucks don't it!`,
        `${name} ran out of gas completely! Ticket headed for the shredder!`,
        `A heartbreaking last-place finish for ${name}! Ouch!`,
        `${name} takes the wooden spoon. Your bankroll takes a hit!`,
        `From contender to pretender: ${name} ends up in the cellar!`,
        `Disaster strikes! ${name} brings up the rear!`,
        `Someone check ${name}'s shoes... dead last finish!`,
      ];

      function pickRandom<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
      }

      if (myMascotBet) {
        if (position === 1) {
          // 1st Place cheering & Confetti!
          fireConfetti(2500);
          showReactionBanner(
            "cheer",
            "🏆",
            pickRandom(PHRASES_1ST),
            pickRandom(SUBTITLES_1ST(mascotInfo.name))
          );
        } else if (position === 2) {
          // 2nd Place Silver
          fireConfetti(1500);
          showReactionBanner(
            "silver",
            "🥈",
            pickRandom(PHRASES_2ND),
            pickRandom(SUBTITLES_2ND(mascotInfo.name))
          );
        } else if (position === 3) {
          // 3rd Place Bronze
          fireConfetti(1000);
          showReactionBanner(
            "bronze",
            "🥉",
            pickRandom(PHRASES_3RD),
            pickRandom(SUBTITLES_3RD(mascotInfo.name))
          );
        } else if (position === 4) {
          // Heartbreak & Screen Shake!
          document.body.classList.remove("screen-shake");
          void document.body.offsetWidth;
          document.body.classList.add("screen-shake");
          setTimeout(() => document.body.classList.remove("screen-shake"), 600);

          showReactionBanner(
            "heartbreak",
            "💔",
            pickRandom(PHRASES_4TH),
            pickRandom(SUBTITLES_4TH(mascotInfo.name))
          );
        }
      }
    } else if (event.type === "LIVE_SIDE_BET_UPDATED") {
      const { sideBetOccurred } = event.payload;

      if (sideBetOccurred === null) {
        showReactionBanner(
          "sidebet",
          "⏳",
          "Side Bet Pending...",
          "Side bet outcome has been reset to pending."
        );
        return;
      }

      const state = getState();
      const me = state ? state.players[sessionId] : null;
      const mySideBet = me?.currentBets.find((b) => b.type === "side");

      const PHRASES_SIDE_WIN = [
        "YOU WON YOUR SIDE BET! 💰",
        "CHA-CHING! CASHED IN! 🤑",
        "BOOM! TICKET CASHED! 💸",
        "CALLED IT! YOU WON! 🎉",
        "PROPHETIC BETTING! 🔮",
        "POCKETS GETTING HEAVIER! 💰",
        "SIDE BET MAGIC! ✨",
        "EZ MONEY! 💵",
        "THE PROPHECY CAME TRUE! 📜",
        "PURE GENIUS READ! 🧠",
        "BANK IT AND SMILE! 🎉",
        "NEVER IN DOUBT! 😎",
      ];

      const SUBTITLES_SIDE_WIN_YES = [
        "The pure chaos actually unfolded! Your YES ticket hits big!",
        "Total bedlam on the track! That crazy stunt came through for you!",
        "They said it wouldn't happen, but it DID! YES pays out in full!",
        "Stunt accomplished! The track goes wild and your wallet gets fatter!",
      ];

      const SUBTITLES_SIDE_WIN_NO = [
        "The stunt was a dud! Nothing happened and your NO ticket pays out in full!",
        "Clean, boring, and profitable! Your NO bet cashes without a hitch!",
        "Order was maintained! Your NO ticket pays out cleanly!",
        "False alarm! No chaos today, and your NO ticket cashes in!",
      ];

      const PHRASES_SIDE_LOSE = [
        "YOU LOST YOUR SIDE BET! 💀",
        "BUSTED! TICKET TORCHED! 💥",
        "TOUGH BREAK! YOU LOST! 😭",
        "RIPPED UP YOUR TICKET! 📉",
        "BETRAYED BY THE ODDS! 💔",
        "TOTAL BLUNDER! 🛑",
        "FLUSHED DOWN THE DRAIN! 🚽",
        "BETTING THE WRONG HORSE! 🤦",
        "THE HOUSE ALWAYS WINS! 🏦",
        "OOF! THAT'S GONNA STING! 🤕",
        "NOT EVEN CLOSE! 🙈",
        "SHREDDED AT THE WINDOW! ✂️",
      ];

      const SUBTITLES_SIDE_LOSE_YES = [
        "It didn't happen! The scenario never went down — your YES ticket is toast!",
        "Zero chaos this time. The track stayed quiet and your YES ticket busted!",
        "No crazy antics today. Your YES ticket goes straight to the trash!",
      ];

      const SUBTITLES_SIDE_LOSE_NO = [
        "Disaster struck! They actually pulled it off — your NO ticket went up in smoke!",
        "Unbelievable! It actually happened and torched your NO bet!",
        "The chaos couldn't be stopped! Your NO ticket is ruined!",
      ];

      function pickRandom<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
      }

      if (mySideBet) {
        const myPick = mySideBet.answer; // "yes" | "no"
        const isWinning =
          (myPick === "yes" && sideBetOccurred === true) ||
          (myPick === "no" && sideBetOccurred === false);

        if (isWinning) {
          fireConfetti(2200);
          const chosenSubtitle = pickRandom(
            myPick === "yes" ? SUBTITLES_SIDE_WIN_YES : SUBTITLES_SIDE_WIN_NO
          );
          showReactionBanner(
            "sidebet",
            "💰",
            pickRandom(PHRASES_SIDE_WIN),
            chosenSubtitle
          );
        } else {
          document.body.classList.remove("screen-shake");
          void document.body.offsetWidth;
          document.body.classList.add("screen-shake");
          setTimeout(() => document.body.classList.remove("screen-shake"), 600);

          const chosenSubtitle = pickRandom(
            myPick === "yes" ? SUBTITLES_SIDE_LOSE_YES : SUBTITLES_SIDE_LOSE_NO
          );
          showReactionBanner(
            "heartbreak",
            "💀",
            pickRandom(PHRASES_SIDE_LOSE),
            chosenSubtitle
          );
        }
      } else {
        // Universal announcement banner (for Host or spectators/players without side bet)
        if (sideBetOccurred === true) {
          fireConfetti(1800);
          showReactionBanner(
            "sidebet",
            "💥",
            "SIDE BET: IT HAPPENED! (YES)",
            "The event went down! All YES bets are officially winners!"
          );
        } else {
          showReactionBanner(
            "heartbreak",
            "🛑",
            "SIDE BET: DID NOT HAPPEN! (NO)",
            "The stunt was a dud! All NO bets are officially winners!"
          );
        }
      }
    }
  });
}

// ==========================================
// Screen Renderers
// ==========================================

function renderApp(state: GameState | null) {
  if (!state) return;

  // Don't blow away the screen while the host is actively dragging the race slider
  if (state.phase === "LOBBY" && document.activeElement?.id === "slider-races") {
    return;
  }

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

  const activePlayers = Object.values(state.players).filter((p) => {
    if (!p.connected) return false;
    if (p.isHost && !p.isPlayingHost) return false;
    return true;
  });
  const activeCount = activePlayers.length;
  const isClassic = state.mode === "classic";
  const isTooFew = activeCount < 3;
  const isTooMany = isClassic && activeCount > 9;
  const canStart = !isTooFew && !isTooMany;

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
      ${isHost
      ? `
        <div class="card">
          <h3 style="font-size: 1.1rem; color: var(--color-gold);">⚙️ Game Configuration</h3>

          <div class="input-group">
            <label class="input-label">Game Mode</label>
            <div style="display: flex; gap: 8px;">
              <button id="mode-classic" class="btn ${state.mode === "classic" ? "btn-primary" : "btn-secondary"}" style="flex: 1;">
                Classic Draft (3-9)
              </button>
              <button id="mode-open" class="btn ${state.mode === "open" ? "btn-primary" : "btn-secondary"}" style="flex: 1;">
                Open Track (3+)
              </button>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
              ${state.mode === "classic"
        ? "Turn-based snake draft of 2 tickets per player (strictly 3 to 9 players, 18 tickets total)."
        : "Simultaneous picks: 1 mascot & 1 side bet. Payouts split the 4 race pots (3+ players, no limit)."
      }
            </p>
          </div>

          <div class="input-group" style="margin-top: 6px;">
            <div style="display:flex; justify-content:space-between;">
              <label class="input-label">Total Races</label>
              <span id="slider-races-val" style="font-weight: 800; color: var(--color-gold);">${state.totalRaces}</span>
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
            Mode: <strong>${state.mode === "classic" ? "Classic Snake Draft (3-9 players)" : "Open Track (3+ players)"}</strong> (${state.totalRaces} Races)
          </p>
        </div>
      `
    }

      <!-- Players List -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size: 1.05rem;">Joined Players</h3>
          <span style="font-size: 0.85rem; color: ${isTooFew ? "var(--color-gold)" : isTooMany ? "#ef4444" : "var(--text-secondary)"}; font-weight: 700;">
            ${activeCount} active racer${activeCount === 1 ? "" : "s"} ${isClassic ? "(3–9)" : "(3+)"}
          </span>
        </div>
        ${isTooFew
          ? `<div style="font-size: 0.8rem; color: var(--color-gold); margin-top: 6px; padding: 6px 10px; background: rgba(251, 133, 0, 0.12); border-radius: var(--radius-sm); border: 1px solid rgba(251, 133, 0, 0.3);">
              ⚠️ Need at least 3 players to start (${activeCount}/3 joined).
            </div>`
          : isTooMany
          ? `<div style="font-size: 0.8rem; color: #fca5a5; margin-top: 6px; padding: 6px 10px; background: rgba(239, 68, 68, 0.15); border-radius: var(--radius-sm); border: 1px solid rgba(239, 68, 68, 0.4);">
              ⛔ Classic Draft allows max 9 players (18 tickets). Switch to Open Track or have extra racers spectate.
            </div>`
          : ""
        }
        <div class="player-list" style="margin-top: 8px;">
          ${playersListHtml}
        </div>
      </div>
    </main>

    ${isHost
      ? `
      <div class="host-action-bar">
        <button id="btn-start-game" class="btn ${canStart ? "btn-green" : "btn-secondary"} btn-full" ${!canStart ? "style='opacity: 0.65; cursor: not-allowed;'" : ""}>
          ${isTooFew ? `Waiting for Racers (${activeCount}/3 min)` : isTooMany ? "Classic Max 9 Players Exceeded" : "🚀 Start Game"}
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

    const sliderRaces = document.getElementById("slider-races") as HTMLInputElement | null;
    const sliderValDisplay = document.getElementById("slider-races-val");
    sliderRaces?.addEventListener("input", (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      if (sliderValDisplay) {
        sliderValDisplay.textContent = String(val);
      }
    });
    sliderRaces?.addEventListener("change", (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      sendMessage({ type: "UPDATE_CONFIG", payload: { totalRaces: val } });
    });

    document.getElementById("toggle-playing-host")?.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      sendMessage({ type: "UPDATE_CONFIG", payload: { isPlayingHost: checked } });
    });

    document.getElementById("btn-start-game")?.addEventListener("click", () => {
      if (isTooFew) {
        alert("Hot Streak requires at least 3 active players to start. (2-player variant is not currently supported).");
        return;
      }
      if (isTooMany) {
        alert("Classic mode is strictly limited to 9 players (18 tickets total). Please switch to Open Track mode or set additional racers to spectate.");
        return;
      }
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
        ${isMyTurn
        ? `<div style="font-size: 1.2rem; font-weight: 800; color: var(--color-gold);">🎯 IT IS YOUR TURN TO DRAFT!</div>
               <div style="font-size: 0.85rem; color: var(--text-primary);">Pick a Mascot or Side Bet below (${myBetsCount + 1}/2)</div>`
        : `<div style="font-size: 1rem; font-weight: 700;">Waiting for <strong>${currentDrafter?.name || "Player"}</strong> to draft...</div>
               <div style="font-size: 0.8rem; color: var(--text-secondary);">Turn ${state.currentDraftIndex + 1} of ${state.draftOrder.length}</div>`
      }
      </div>

      <!-- Player's Drafted Tickets Summary -->
      <div class="card" ${isFinalRace && myBetsCount === 2 ? 'style="border: 1px solid var(--color-gold);"' : ""}>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h3 style="font-size: 0.95rem;">Your Drafted Tickets (${myBetsCount}/2)</h3>
          ${isFinalRace && myBetsCount === 2 ? '<span class="badge badge-ready">Tap ticket to set 2x</span>' : ""}
        </div>
        ${isFinalRace && myBetsCount === 2
        ? `
          <div style="font-size: 0.75rem; color: var(--color-gold); margin-bottom: 8px;">
            🔥 Final Race: Exactly one bet is doubled. Tap either ticket below to choose!
          </div>
        `
        : ""
      }
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${myBets.length === 0
        ? '<span style="color: var(--text-muted); font-size: 0.85rem;">No tickets drafted yet this race.</span>'
        : myBets
          .map(
            (b, idx) => `
              <div
                class="drafted-ticket-chip ${isFinalRace && myBets.length === 2 ? "clickable-double" : ""}"
                data-ticket-idx="${idx}"
                style="background: ${b.isDoubled ? "rgba(251, 133, 0, 0.18)" : "rgba(255,255,255,0.06)"}; padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; border: ${b.isDoubled ? "2px solid var(--color-gold)" : "1px solid var(--border-glass)"}; cursor: ${isFinalRace && myBets.length === 2 ? "pointer" : "default"}; transition: all 0.2s ease; flex: 1; min-width: 130px;"
              >
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                  <strong>${b.type === "mascot" ? b.mascotId.toUpperCase() : "SIDE: " + b.answer.toUpperCase()}</strong>
                  ${b.isDoubled ? '<span class="badge" style="background: var(--color-gold); color: #000; font-weight: 900; font-size: 0.7rem;">🔥 2X DOUBLED</span>' : (isFinalRace && myBets.length === 2 ? '<span style="font-size: 0.7rem; color: var(--text-muted);">Tap to 2x</span>' : "")}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 3px;">
                  Tier ${b.tier}, ${b.isRisky ? "🔥 Risky" : "🛡️ Safe"}
                </div>
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
      </div>

      ${isFinalRace
        ? `
        <div class="card" style="border: 1px solid var(--color-gold);">
          <div style="font-size: 0.85rem; font-weight: 800; color: var(--color-gold); text-transform: uppercase; margin-bottom: 4px;">
            🔥 Final Race: Choose Bet to Double Down (2x)
          </div>
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 10px;">
            One of your two bets will pay double (2x gain or 2x penalty). Pick which one to double:
          </div>
          <div style="display: flex; gap: 8px;">
            <button
              id="btn-double-mascot"
              type="button"
              class="btn ${openDoubleChoice === "mascot" ? "btn-primary" : "btn-secondary"}"
              style="flex: 1; padding: 10px 8px; font-weight: 800;"
            >
              ${openDoubleChoice === "mascot" ? "🔥 " : ""}Mascot Bet (2x)
            </button>
            <button
              id="btn-double-side"
              type="button"
              class="btn ${openDoubleChoice === "side" ? "btn-primary" : "btn-secondary"}"
              style="flex: 1; padding: 10px 8px; font-weight: 800;"
            >
              ${openDoubleChoice === "side" ? "🔥 " : ""}Side Bet (2x)
            </button>
          </div>
        </div>
      `
        : ""
      }

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
    ${isHost
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

    // Final race: tap drafted ticket to choose double down
    document.querySelectorAll(".drafted-ticket-chip.clickable-double").forEach((chip) => {
      chip.addEventListener("click", () => {
        const idx = Number(chip.getAttribute("data-ticket-idx"));
        sendMessage({
          type: "SELECT_DOUBLED_BET",
          payload: { betIndex: idx },
        });
      });
    });
  } else {
    // Open mode listeners
    document.querySelectorAll("[data-open-mascot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.getAttribute("data-open-mascot") as MascotId;
        openMascotBet = { mascotId: m, isRisky: false };
        renderBettingScreen(state);
      });
    });

    document.querySelectorAll("[data-open-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ans = btn.getAttribute("data-open-side") as "yes" | "no";
        openSideBet = { answer: ans, isRisky: false };
        renderBettingScreen(state);
      });
    });

    document.getElementById("btn-double-mascot")?.addEventListener("click", () => {
      openDoubleChoice = "mascot";
      renderBettingScreen(state);
    });

    document.getElementById("btn-double-side")?.addEventListener("click", () => {
      openDoubleChoice = "side";
      renderBettingScreen(state);
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
              isDoubled: isFinalRace ? openDoubleChoice === "mascot" : false,
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
              isDoubled: isFinalRace ? openDoubleChoice === "side" : false,
            },
          },
        });
      }
    });
  }

  // Host force start
  document.getElementById("btn-force-start-race")?.addEventListener("click", () => {
    if (confirm("Force end betting and advance to the race?")) {
      sendMessage({ type: "FORCE_START_RACE" });
    }
  });
}

function openDraftModal(state: GameState, category: MascotId | "yes" | "no") {
  const modalContainer = document.getElementById("draft-modal-container");
  if (!modalContainer) return;

  const remainingTiers = state.availableTickets[category];
  const nextTier = remainingTiers[0];
  if (!nextTier) return;

  const me = state.players[sessionId];
  const isFinalRace = state.currentRace === state.totalRaces;
  const myBetsCount = me?.currentBets.length || 0;
  const myFirstBet = me?.currentBets[0];

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
  // If 2nd bet on final race, 0 = ticket 1 doubled, 1 = ticket 2 (this ticket) doubled
  let selectedDoubleIndex = myFirstBet?.isDoubled ? 0 : 1;

  let doubleHtml = "";
  if (isFinalRace) {
    if (myBetsCount === 0) {
      doubleHtml = `
        <div class="card" style="border: 1px solid var(--border-glass); padding: 10px; margin-top: 2px;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 800; font-size: 0.9rem; color: var(--color-gold);">
                🔥 Double Down on This Ticket?
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">
                Pays 2x on wins, costs 2x on losses. (You can also choose to double your 2nd ticket instead).
              </div>
            </div>
            <input type="checkbox" id="draft-double-check" style="accent-color: var(--color-gold); width: 22px; height: 22px; cursor: pointer; margin-left: 10px;" />
          </label>
        </div>
      `;
    } else {
      const t1Name = myFirstBet?.type === "mascot" ? MASCOT_CONFIG[myFirstBet.mascotId].name : `Side Bet (${myFirstBet?.answer.toUpperCase()})`;
      const t1Details = `Tier ${myFirstBet?.tier}, ${myFirstBet?.isRisky ? "🔥 Risky" : "🛡️ Safe"}`;
      doubleHtml = `
        <div class="card" style="border: 1px solid var(--color-gold); padding: 10px; margin-top: 2px;">
          <div style="font-weight: 800; font-size: 0.9rem; color: var(--color-gold); margin-bottom: 4px;">
            🔥 Final Race: Which bet do you want doubled (2x)?
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 8px;">
            One of your two bets must be doubled. Select which one:
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div
              id="draft-choice-double-1"
              class="card"
              style="cursor: pointer; padding: 8px 12px; margin: 0; border: ${selectedDoubleIndex === 0 ? "2px solid var(--color-gold)" : "1px solid var(--border-glass)"}; background: ${selectedDoubleIndex === 0 ? "rgba(251, 133, 0, 0.15)" : "var(--bg-card)"};"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.85rem; font-weight: 700;">Ticket 1: ${t1Name}</span>
                <span class="badge ${selectedDoubleIndex === 0 ? "badge-turn" : ""}" id="badge-opt-1">${selectedDoubleIndex === 0 ? "🔥 2x Doubled" : "Tap to 2x"}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${t1Details}</div>
            </div>

            <div
              id="draft-choice-double-2"
              class="card"
              style="cursor: pointer; padding: 8px 12px; margin: 0; border: ${selectedDoubleIndex === 1 ? "2px solid var(--color-gold)" : "1px solid var(--border-glass)"}; background: ${selectedDoubleIndex === 1 ? "rgba(251, 133, 0, 0.15)" : "var(--bg-card)"};"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.85rem; font-weight: 700;">Ticket 2: ${name} (This Pick)</span>
                <span class="badge ${selectedDoubleIndex === 1 ? "badge-turn" : ""}" id="badge-opt-2">${selectedDoubleIndex === 1 ? "🔥 2x Doubled" : "Tap to 2x"}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Tier ${nextTier}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

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

      ${doubleHtml}

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

  const opt1 = document.getElementById("draft-choice-double-1");
  const opt2 = document.getElementById("draft-choice-double-2");
  if (opt1 && opt2) {
    opt1.addEventListener("click", () => {
      selectedDoubleIndex = 0;
      opt1.style.border = "2px solid var(--color-gold)";
      opt1.style.background = "rgba(251, 133, 0, 0.15)";
      opt2.style.border = "1px solid var(--border-glass)";
      opt2.style.background = "var(--bg-card)";
      const b1 = document.getElementById("badge-opt-1");
      const b2 = document.getElementById("badge-opt-2");
      if (b1) {
        b1.textContent = "🔥 2x Doubled";
        b1.className = "badge badge-turn";
      }
      if (b2) {
        b2.textContent = "Tap to 2x";
        b2.className = "badge";
      }
    });

    opt2.addEventListener("click", () => {
      selectedDoubleIndex = 1;
      opt2.style.border = "2px solid var(--color-gold)";
      opt2.style.background = "rgba(251, 133, 0, 0.15)";
      opt1.style.border = "1px solid var(--border-glass)";
      opt1.style.background = "var(--bg-card)";
      const b1 = document.getElementById("badge-opt-1");
      const b2 = document.getElementById("badge-opt-2");
      if (b2) {
        b2.textContent = "🔥 2x Doubled";
        b2.className = "badge badge-turn";
      }
      if (b1) {
        b1.textContent = "Tap to 2x";
        b1.className = "badge";
      }
    });
  }

  document.getElementById("modal-backdrop")?.addEventListener("click", () => {
    modalContainer.innerHTML = "";
  });

  document.getElementById("btn-confirm-draft")?.addEventListener("click", () => {
    let isDoubled = false;
    if (isFinalRace) {
      if (myBetsCount === 0) {
        const check = document.getElementById("draft-double-check") as HTMLInputElement | null;
        isDoubled = !!check?.checked;
      } else {
        isDoubled = selectedDoubleIndex === 1;
      }
    }

    const bet: Bet = isMascot
      ? {
        type: "mascot",
        mascotId: category as MascotId,
        isRisky: selectedRisky,
        isDoubled,
      }
      : {
        type: "side",
        answer: category as "yes" | "no",
        isRisky: selectedRisky,
        isDoubled,
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
  const me = state.players[sessionId];
  const placements = state.livePlacements;

  // Track placed mascots
  const placedMap: Partial<Record<MascotId, 1 | 2 | 3 | 4>> = {};
  for (const pos of [1, 2, 3, 4] as const) {
    if (placements[pos]) {
      placedMap[placements[pos]!] = pos;
    }
  }

  const allPositionsPlaced = [1, 2, 3, 4].every(
    (pos) => !!placements[pos as 1 | 2 | 3 | 4]
  );
  const sideBetConfirmed = state.sideBetOccurred !== null;
  const canFinalize = allPositionsPlaced && sideBetConfirmed;

  // Active bets for the current user
  const myBets = me?.currentBets || [];
  const isFinalRace = state.currentRace === state.totalRaces;
  const canSwitchDouble =
    isFinalRace &&
    myBets.length === 2 &&
    Object.keys(placements).length === 0;

  const renderPositionSlot = (pos: 1 | 2 | 3 | 4) => {
    const assigned = placements[pos];
    const mascot = assigned ? MASCOT_CONFIG[assigned] : null;
    const isTarget = isHost && selectedMascotForHostPlacement !== null && !assigned;

    const rankLabels = {
      1: { title: "1ST", sub: "Gold" },
      2: { title: "2ND", sub: "Silver" },
      3: { title: "3RD", sub: "Bronze" },
      4: { title: "4TH", sub: "DQ / Last" },
    }[pos];

    return `
      <div
        class="podium-slot rank-${pos} ${isHost && !assigned ? "clickable" : ""} ${isTarget ? "target-highlight" : ""}"
        data-slot-pos="${pos}"
      >
        <div class="podium-rank-badge">
          <div class="podium-rank">${rankLabels.title}</div>
          <div class="podium-rank-sub">${rankLabels.sub}</div>
        </div>

        <div class="podium-mascot-content">
          ${mascot
        ? `
            <div class="mascot-avatar">${mascot.icon}</div>
            <div class="mascot-name-tag">
              <strong>${mascot.name}</strong>
              <span>${mascot.desc}</span>
            </div>
          `
        : `
            <div class="slot-empty-notice">
              ${isHost
          ? selectedMascotForHostPlacement
            ? `👉 Tap here to assign <strong>${MASCOT_CONFIG[selectedMascotForHostPlacement].name}</strong>`
            : `<span>⚪ Empty Slot (Select racer below)</span>`
          : `<span>⏳ Waiting for finish placement...</span>`
        }
            </div>
          `
      }
        </div>

        ${isHost && assigned
        ? `
          <button
            class="btn-slot-remove"
            data-remove-pos="${pos}"
            title="Remove racer from this slot"
          >
            ✕
          </button>
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
        <p class="hero-subtitle">
          ${isHost
      ? "Assign finishes as cards are flipped on the table."
      : "Watch the board live as the dealer flips cards!"
    }
        </p>
      </div>

      <!-- Player Bets Reminder (if participating) -->
      ${myBets.length > 0
      ? `
        <div class="card" style="padding: 12px 14px; ${isFinalRace ? "border: 1px solid var(--color-gold);" : ""}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-size: 0.75rem; font-weight: 800; color: var(--color-gold); text-transform: uppercase; letter-spacing: 0.05em;">
              🎯 Your Active Wagers This Race
            </div>
            ${canSwitchDouble ? '<span style="font-size: 0.7rem; color: var(--text-muted);">Tap to switch 2x</span>' : ""}
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${myBets
        .map((b, idx) => {
          const doubleBadge = b.isDoubled
            ? '<span class="badge" style="background: var(--color-gold); color: #000; font-weight: 900; font-size: 0.7rem; margin-left: 6px;">🔥 2X DOUBLED</span>'
            : canSwitchDouble
              ? `<button class="btn btn-secondary btn-switch-double" data-switch-idx="${idx}" style="padding: 2px 8px; font-size: 0.7rem; min-height: unset; margin-left: 6px; font-weight: 700;">Tap to 2x</button>`
              : "";

          if (b.type === "mascot") {
            const m = MASCOT_CONFIG[b.mascotId];
            return `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                      <div style="display: flex; align-items: center;">
                        <span>${m.icon}</span> <strong style="margin-left: 4px;">${m.name}</strong>
                        <span style="font-size: 0.75rem; color: ${b.isRisky ? "var(--color-orange)" : "var(--color-green)"}; margin-left: 4px;">
                          (${b.isRisky ? "🔥 Risky" : "🛡️ Safe"}${b.tier ? ` T${b.tier}` : ""})
                        </span>
                        ${doubleBadge}
                      </div>
                      <span style="font-size: 0.8rem; color: var(--text-muted);">Goal: 1st-3rd</span>
                    </div>
                  `;
          } else {
            const sideWon =
              state.sideBetOccurred !== null &&
              ((b.answer === "yes" && state.sideBetOccurred === true) ||
                (b.answer === "no" && state.sideBetOccurred === false));

            return `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                      <div style="display: flex; align-items: center;">
                        <span>🎲</span> <strong style="margin-left: 4px;">Side Bet: ${b.answer.toUpperCase()}</strong>
                        <span style="font-size: 0.75rem; color: ${b.isRisky ? "var(--color-orange)" : "var(--color-green)"}; margin-left: 4px;">
                          (${b.isRisky ? "🔥 Risky" : "🛡️ Safe"}${b.tier ? ` T${b.tier}` : ""})
                        </span>
                        ${doubleBadge}
                      </div>
                      <span style="font-size: 0.8rem; font-weight: 800;">
                        ${state.sideBetOccurred === null
                ? `<span style="color: var(--text-muted);">Awaiting flip</span>`
                : sideWon
                  ? `<span style="color: var(--color-green);">💰 WON!</span>`
                  : `<span style="color: var(--color-red);">💀 BUSTED!</span>`
              }
                      </span>
                    </div>
                  `;
          }
        })
        .join("")}
          </div>
        </div>
      `
      : ""
    }

      <!-- Live Finish Slots Board -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <h3 style="font-size: 1.05rem; color: var(--color-gold);">Podium & Finish Slots</h3>
          <span style="font-size: 0.75rem; color: var(--text-muted);">
            ${Object.keys(placements).length}/4 Placed
          </span>
        </div>
        <div class="racetrack">
          ${renderPositionSlot(1)}
          ${renderPositionSlot(2)}
          ${renderPositionSlot(3)}
          ${renderPositionSlot(4)}
        </div>
      </div>

      <!-- Host Mascot Roster (Tap-to-Assign) -->
      ${isHost
      ? `
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
            <h3 style="font-size: 1.05rem; color: var(--color-gold);">Select Racer to Place</h3>
            <span style="font-size: 0.75rem; color: var(--text-muted);">
              ${selectedMascotForHostPlacement
        ? `👉 Selected: ${MASCOT_CONFIG[selectedMascotForHostPlacement].name}`
        : "Tap a mascot to select"
      }
            </span>
          </div>
          <div class="roster-grid">
            ${(["gobbler", "hurley", "dangle", "mum"] as MascotId[])
        .map((m) => {
          const placedPos = placedMap[m];
          const isPlaced = placedPos !== undefined;
          const isSelected = selectedMascotForHostPlacement === m;
          const config = MASCOT_CONFIG[m];

          return `
                  <div
                    class="roster-card ${m} ${isSelected ? "selected" : ""} ${isPlaced ? "placed" : ""}"
                    data-roster-mascot="${m}"
                  >
                    <span style="font-size: 1.6rem;">${config.icon}</span>
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                      <strong style="font-size: 0.95rem; white-space:nowrap; text-overflow:ellipsis;">${config.name}</strong>
                      <span style="font-size: 0.72rem; color: var(--text-muted);">
                        ${isPlaced ? `Placed #${placedPos}` : isSelected ? "Ready to place" : "Tap to pick"}
                      </span>
                    </div>
                    ${isPlaced ? `<span class="roster-badge">#${placedPos}</span>` : ""}
                  </div>
                `;
        })
        .join("")}
          </div>
        </div>
      `
      : ""
    }

      <!-- Live Side Bet Status -->
      <div class="card">
        <h3 style="font-size: 1.05rem;">Side Bet Outcome</h3>
        <div style="display: flex; gap: 10px; align-items: center; margin-top: 6px;">
          <div style="flex: 1; font-weight: 700; font-size: 0.95rem;">
            Did the side bet scenario occur?
          </div>
          ${isHost
      ? `
            <div style="display: flex; gap: 8px;">
              <button
                id="btn-side-yes"
                class="btn ${state.sideBetOccurred === true ? "btn-green" : "btn-secondary"}"
                style="padding: 8px 16px; min-height: unset; font-weight: 800;"
              >
                YES
              </button>
              <button
                id="btn-side-no"
                class="btn ${state.sideBetOccurred === false ? "btn-danger" : "btn-secondary"}"
                style="padding: 8px 16px; min-height: unset; font-weight: 800;"
              >
                NO
              </button>
            </div>
          `
      : `
            <span class="badge ${state.sideBetOccurred === true
        ? "badge-ready"
        : state.sideBetOccurred === false
          ? "badge-host"
          : ""
      }" style="font-size: 0.95rem; font-weight: 800; padding: 6px 14px;">
              ${state.sideBetOccurred === null
        ? "⏳ AWAITING OUTCOME..."
        : state.sideBetOccurred
          ? "💥 IT HAPPENED! (YES)"
          : "🛑 DID NOT HAPPEN (NO)"
      }
            </span>
          `
    }
        </div>
      </div>
    </main>

    ${isHost
      ? `
      <div class="host-action-bar">
        <button
          id="btn-finalize-race"
          class="btn btn-green btn-full"
          ${canFinalize ? "" : "disabled"}
        >
          ${canFinalize
        ? "💰 Finalize Race & Calculate Payouts"
        : !allPositionsPlaced
          ? `⏳ Place All 4 Racers (${Object.keys(placements).length}/4)`
          : "⏳ Toggle Side Bet (YES/NO)"
      }
        </button>
      </div>
    `
      : ""
    }
  `;

  if (isHost) {
    // 1. Roster click: select / deselect mascot
    document.querySelectorAll("[data-roster-mascot]").forEach((card) => {
      card.addEventListener("click", () => {
        const mascot = card.getAttribute("data-roster-mascot") as MascotId;
        if (placedMap[mascot] !== undefined) return; // already placed

        if (selectedMascotForHostPlacement === mascot) {
          selectedMascotForHostPlacement = null;
        } else {
          selectedMascotForHostPlacement = mascot;
        }
        renderRaceInputScreen(state);
      });
    });

    // 2. Slot click: place selected mascot into empty slot
    document.querySelectorAll(".podium-slot").forEach((slot) => {
      slot.addEventListener("click", (e) => {
        // If clicked the remove button, do not handle slot assignment
        if ((e.target as HTMLElement).closest(".btn-slot-remove")) return;

        const pos = Number(slot.getAttribute("data-slot-pos")) as 1 | 2 | 3 | 4;
        if (placements[pos]) return; // already filled

        if (selectedMascotForHostPlacement) {
          sendMessage({
            type: "LIVE_PLACE_RACER",
            payload: { position: pos, mascotId: selectedMascotForHostPlacement },
          });
          selectedMascotForHostPlacement = null;
        }
      });
    });

    // 3. Remove button click: unassign slot
    document.querySelectorAll("[data-remove-pos]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pos = Number(btn.getAttribute("data-remove-pos")) as 1 | 2 | 3 | 4;
        sendMessage({
          type: "LIVE_PLACE_RACER",
          payload: { position: pos, mascotId: null },
        });
      });
    });

    // 4. Side bet toggles
    document.getElementById("btn-side-yes")?.addEventListener("click", () => {
      const nextVal = state.sideBetOccurred === true ? null : true;
      sendMessage({
        type: "LIVE_TOGGLE_SIDE_BET",
        payload: { sideBetOccurred: nextVal },
      });
    });

    document.getElementById("btn-side-no")?.addEventListener("click", () => {
      const nextVal = state.sideBetOccurred === false ? null : false;
      sendMessage({
        type: "LIVE_TOGGLE_SIDE_BET",
        payload: { sideBetOccurred: nextVal },
      });
    });

    // 5. Finalize Race
    document.getElementById("btn-finalize-race")?.addEventListener("click", () => {
      if (canFinalize) {
        sendMessage({ type: "FINALIZE_RACE" });
      }
    });
  }

  // Switch doubled bet before race placements begin
  document.querySelectorAll(".btn-switch-double").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-switch-idx"));
      sendMessage({
        type: "SELECT_DOUBLED_BET",
        payload: { betIndex: idx },
      });
    });
  });
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

      <!-- Official Finish & Side Bet Breakdown -->
      <div class="card" style="padding: 14px 16px;">
        <div style="font-size: 0.75rem; font-weight: 800; color: var(--color-gold); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
          🏁 Official Race Outcome
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">🥇 1st Place:</span>
            <strong>${lastRace?.placements[1] ? `${MASCOT_CONFIG[lastRace.placements[1]].icon} ${MASCOT_CONFIG[lastRace.placements[1]].name}` : "-"}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">🥈 2nd Place:</span>
            <strong>${lastRace?.placements[2] ? `${MASCOT_CONFIG[lastRace.placements[2]].icon} ${MASCOT_CONFIG[lastRace.placements[2]].name}` : "-"}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">🥉 3rd Place:</span>
            <strong>${lastRace?.placements[3] ? `${MASCOT_CONFIG[lastRace.placements[3]].icon} ${MASCOT_CONFIG[lastRace.placements[3]].name}` : "-"}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">💀 4th (DQ):</span>
            <strong style="color: #ef4444;">${lastRace?.placements[4] ? `${MASCOT_CONFIG[lastRace.placements[4]].icon} ${MASCOT_CONFIG[lastRace.placements[4]].name}` : "-"}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-glass); padding-top: 6px; margin-top: 2px;">
            <span style="color: var(--text-muted);">🎲 Side Bet Result:</span>
            <strong style="color: ${lastRace?.sideBetOccurred ? "var(--color-green)" : "var(--color-red)"};">
              ${lastRace?.sideBetOccurred ? "YES — It Actually Happened! 💥" : "NO — Did Not Happen 🛑"}
            </strong>
          </div>
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

    ${isHost
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

    ${isHost
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
