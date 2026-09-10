import type * as Party from "partykit/server";

// ==========================================
// 1. Types and Interfaces
// ==========================================

export type GameMode = "classic" | "open";

export type GamePhase =
  | "LOBBY"
  | "BETTING"
  | "RACE_INPUT"
  | "RACE_RESULTS"
  | "GAME_OVER";

export type MascotId = "gobbler" | "hurley" | "dangle" | "mum";
export type SideBetChoice = "yes" | "no";
export type TicketTier = 1 | 2 | 3;

export interface MascotBet {
  type: "mascot";
  mascotId: MascotId;
  isRisky: boolean;
  tier?: TicketTier; // Used in classic mode (1st, 2nd, or 3rd ticket in stack)
  isDoubled?: boolean; // Double-down on final race
}

export interface SideBet {
  type: "side";
  answer: SideBetChoice;
  isRisky: boolean;
  tier?: TicketTier; // Used in classic mode
  isDoubled?: boolean; // Double-down on final race
}

export type Bet = MascotBet | SideBet;

export interface Player {
  id: string; // Session / connection ID
  name: string;
  score: number;
  currentBets: Bet[];
  isReady: boolean;
  isHost: boolean;
  isPlayingHost: boolean; // Host can choose to be a player or housekeeping only
  connected: boolean;
}

export type TicketCategory = MascotId | SideBetChoice;

export interface AvailableTickets {
  gobbler: TicketTier[];
  hurley: TicketTier[];
  dangle: TicketTier[];
  mum: TicketTier[];
  yes: TicketTier[];
  no: TicketTier[];
}

export interface LivePlacements {
  1?: MascotId;
  2?: MascotId;
  3?: MascotId;
  4?: MascotId;
}

export interface RaceResult {
  raceNumber: number;
  placements: LivePlacements;
  sideBetOccurred: boolean;
  payouts: Record<string, number>; // playerId -> net change
  playerScores: Record<string, number>; // playerId -> score after race
}

export interface GameState {
  roomCode: string;
  mode: GameMode;
  phase: GamePhase;
  currentRace: number;
  totalRaces: number;
  draftOrder: string[]; // Sequence of player IDs for drafting (snake order in classic)
  currentDraftIndex: number;
  doubleDownEnabled: boolean; // Active on final race
  livePlacements: LivePlacements;
  sideBetOccurred: boolean | null;
  availableTickets: AvailableTickets;
  players: Record<string, Player>;
  hostId: string | null;
  raceHistory: RaceResult[];
}

// ==========================================
// Payout Reference Tables (Rulebook)
// ==========================================

const MASCOT_PAYOUTS: Record<
  TicketTier,
  { safe: Record<number, number>; risky: Record<number, number> }
> = {
  1: {
    safe: { 1: 10, 2: 7, 3: 5, 4: 0 },
    risky: { 1: 15, 2: 5, 3: 2, 4: 0 },
  },
  2: {
    safe: { 1: 7, 2: 5, 3: 3, 4: 0 },
    risky: { 1: 11, 2: 3, 3: 1, 4: 0 },
  },
  3: {
    safe: { 1: 5, 2: 3, 3: 2, 4: 0 },
    risky: { 1: 8, 2: 2, 3: 0, 4: 0 },
  },
};

const SIDE_BET_PAYOUTS: Record<
  TicketTier,
  { safe: { win: number; lose: number }; risky: { win: number; lose: number } }
> = {
  1: {
    safe: { win: 10, lose: 0 },
    risky: { win: 15, lose: -5 },
  },
  2: {
    safe: { win: 7, lose: 0 },
    risky: { win: 12, lose: -5 },
  },
  3: {
    safe: { win: 5, lose: 0 },
    risky: { win: 10, lose: -5 },
  },
};

// Open Mode (9+ player variant) Pot values
const OPEN_MODE_POTS = {
  1: 18,
  2: 12,
  3: 6,
  side: 18,
};

// ==========================================
// Client & Server Messages
// ==========================================

export type ClientMessage =
  | {
      type: "REGISTER_PROFILE";
      payload: { name: string; isPlayingHost?: boolean };
    }
  | {
      type: "UPDATE_CONFIG";
      payload: {
        mode?: GameMode;
        totalRaces?: number;
        isPlayingHost?: boolean;
      };
    }
  | { type: "SET_READY"; payload: { isReady: boolean } }
  | { type: "HOST_START_GAME"; payload?: { randomizeOrder?: boolean } }
  | { type: "SUBMIT_BET"; payload: { bet: Bet } }
  | {
      type: "LIVE_PLACE_RACER";
      payload: { position: 1 | 2 | 3 | 4; mascotId: MascotId | null };
    }
  | {
      type: "LIVE_TOGGLE_SIDE_BET";
      payload: { sideBetOccurred: boolean | null };
    }
  | { type: "FINALIZE_RACE" }
  | { type: "NEXT_RACE" }
  | { type: "FORCE_START_RACE" }
  | { type: "SELECT_DOUBLED_BET"; payload: { betIndex: number } }
  | { type: "RESTART_GAME" };

export type ServerMessage =
  | { type: "SYNC_STATE"; payload: GameState }
  | {
      type: "LIVE_RACER_PLACED";
      payload: { position: 1 | 2 | 3 | 4; mascotId: MascotId | null };
    }
  | {
      type: "LIVE_SIDE_BET_UPDATED";
      payload: { sideBetOccurred: boolean | null };
    }
  | { type: "ERROR"; payload: { message: string } };

// ==========================================
// Helper Utilities
// ==========================================

function createInitialAvailableTickets(): AvailableTickets {
  return {
    gobbler: [1, 2, 3],
    hurley: [1, 2, 3],
    dangle: [1, 2, 3],
    mum: [1, 2, 3],
    yes: [1, 2, 3],
    no: [1, 2, 3],
  };
}

/**
 * Builds the classic snake draft order sequence for 2 tickets per player.
 * E.g., [P1, P2, P3] -> [P1, P2, P3, P3, P2, P1]
 */
function buildSnakeDraftSequence(playerIds: string[]): string[] {
  if (playerIds.length === 0) return [];
  const forward = [...playerIds];
  const reverse = [...playerIds].reverse();
  return [...forward, ...reverse];
}

// ==========================================
// 2. PartyKit Server Class
// ==========================================

export default class HotStreakServer implements Party.Server {
  state: GameState;
  basePlayerOrder: string[] = []; // Base turn rotation across races

  constructor(readonly room: Party.Room) {
    this.state = {
      roomCode: room.id,
      mode: "classic",
      phase: "LOBBY",
      currentRace: 1,
      totalRaces: 3,
      draftOrder: [],
      currentDraftIndex: 0,
      doubleDownEnabled: false,
      livePlacements: {},
      sideBetOccurred: null,
      availableTickets: createInitialAvailableTickets(),
      players: {},
      hostId: null,
      raceHistory: [],
    };
  }

  // ----------------------------------------
  // Connection Lifecycle
  // ----------------------------------------

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const requestedSessionId = url.searchParams.get("sessionId");
    const playerId = requestedSessionId || conn.id;

    // Check if re-connecting existing player
    let player = this.state.players[playerId];

    if (!player) {
      // First person to connect is designated as host
      const isFirstClient = !this.state.hostId;
      if (isFirstClient) {
        this.state.hostId = playerId;
      }

      player = {
        id: playerId,
        name: `Player ${Object.keys(this.state.players).length + 1}`,
        score: 10, // Starting cash per Hot Streak rules ($10)
        currentBets: [],
        isReady: false,
        isHost: isFirstClient,
        isPlayingHost: true,
        connected: true,
      };
      this.state.players[playerId] = player;
    } else {
      player.connected = true;
    }

    // Assign session id attribute so onClose identifies player
    conn.setState({ playerId });

    // In onConnect, immediately dispatch full room state sync (SYNC_STATE)
    conn.send(
      JSON.stringify({
        type: "SYNC_STATE",
        payload: this.state,
      } satisfies ServerMessage)
    );

    // Broadcast updated player roster to all clients
    this.broadcastState();
  }

  async onClose(conn: Party.Connection) {
    const connState = conn.state as { playerId?: string } | undefined;
    const playerId = connState?.playerId || conn.id;

    const player = this.state.players[playerId];
    if (player) {
      player.connected = false;

      // In lobby phase, if disconnected player has never played, optionally clean up
      // but retain state during active games so they can reconnect seamlessly.
      if (this.state.phase === "LOBBY") {
        // If host disconnected in lobby and is gone, transfer host if others exist
        if (player.isHost) {
          const connectedPlayers = Object.values(this.state.players).filter(
            (p) => p.connected && p.id !== playerId
          );
          if (connectedPlayers.length > 0) {
            connectedPlayers[0].isHost = true;
            this.state.hostId = connectedPlayers[0].id;
          }
        }
      }
      this.broadcastState();
    }
  }

  // ----------------------------------------
  // Action Handlers
  // ----------------------------------------

  async onMessage(message: string, sender: Party.Connection) {
    const connState = sender.state as { playerId?: string } | undefined;
    const senderId = connState?.playerId || sender.id;

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message);
    } catch {
      this.sendError(sender, "Invalid message JSON");
      return;
    }

    switch (parsed.type) {
      case "REGISTER_PROFILE":
        this.handleRegisterProfile(senderId, parsed.payload);
        break;

      case "UPDATE_CONFIG":
        this.handleUpdateConfig(sender, senderId, parsed.payload);
        break;

      case "SET_READY":
        this.handleSetReady(senderId, parsed.payload.isReady);
        break;

      case "HOST_START_GAME":
        this.handleHostStartGame(
          sender,
          senderId,
          parsed.payload?.randomizeOrder ?? true
        );
        break;

      case "SUBMIT_BET":
        this.handleSubmitBet(sender, senderId, parsed.payload.bet);
        break;

      case "LIVE_PLACE_RACER":
        this.handleLivePlaceRacer(
          sender,
          senderId,
          parsed.payload.position,
          parsed.payload.mascotId
        );
        break;

      case "LIVE_TOGGLE_SIDE_BET":
        this.handleLiveToggleSideBet(
          sender,
          senderId,
          parsed.payload.sideBetOccurred
        );
        break;

      case "FINALIZE_RACE":
        this.handleFinalizeRace(sender, senderId);
        break;

      case "NEXT_RACE":
        this.handleNextRace(sender, senderId);
        break;

      case "FORCE_START_RACE":
        this.handleForceStartRace(sender, senderId);
        break;

      case "SELECT_DOUBLED_BET":
        this.handleSelectDoubledBet(sender, senderId, parsed.payload.betIndex);
        break;

      case "RESTART_GAME":
        this.handleRestartGame(sender, senderId);
        break;

      default:
        this.sendError(sender, "Unknown message type");
    }
  }

  // ----------------------------------------
  // Handler Implementations
  // ----------------------------------------

  private handleRegisterProfile(
    playerId: string,
    payload: { name: string; isPlayingHost?: boolean }
  ) {
    const player = this.state.players[playerId];
    if (player) {
      if (payload.name && payload.name.trim().length > 0) {
        player.name = payload.name.trim();
      }
      if (player.isHost && typeof payload.isPlayingHost === "boolean") {
        player.isPlayingHost = payload.isPlayingHost;
      }
      this.broadcastState();
    }
  }

  private handleUpdateConfig(
    sender: Party.Connection,
    senderId: string,
    payload: {
      mode?: GameMode;
      totalRaces?: number;
      isPlayingHost?: boolean;
    }
  ) {
    if (!this.assertHost(sender, senderId)) return;
    if (this.state.phase !== "LOBBY") {
      this.sendError(sender, "Game configuration can only be altered in lobby.");
      return;
    }

    if (payload.mode) this.state.mode = payload.mode;
    if (typeof payload.totalRaces === "number" && payload.totalRaces > 0) {
      this.state.totalRaces = payload.totalRaces;
    }
    const host = this.state.players[senderId];
    if (host && typeof payload.isPlayingHost === "boolean") {
      host.isPlayingHost = payload.isPlayingHost;
    }

    this.broadcastState();
  }

  private handleSetReady(playerId: string, isReady: boolean) {
    const player = this.state.players[playerId];
    if (player) {
      player.isReady = isReady;
      this.broadcastState();
    }
  }

  private handleHostStartGame(
    sender: Party.Connection,
    senderId: string,
    randomizeOrder: boolean = true
  ) {
    if (!this.assertHost(sender, senderId)) return;

    // Filter active playing participants
    const activePlayers = Object.values(this.state.players).filter((p) => {
      if (!p.connected) return false;
      if (p.isHost && !p.isPlayingHost) return false;
      return true;
    });

    if (activePlayers.length < 1) {
      this.sendError(sender, "Need at least 1 participating player to start.");
      return;
    }

    // Classic mode recommendation: 3-9 players (or 2-player variant)
    if (this.state.mode === "classic" && activePlayers.length < 2) {
      this.sendError(
        sender,
        "Classic mode requires at least 2 players for drafting."
      );
      return;
    }

    const order = activePlayers.map((p) => p.id);
    if (randomizeOrder) {
      // Fisher-Yates shuffle for randomized initial draft order
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    this.basePlayerOrder = order;
    this.startBettingPhase();
  }

  private startBettingPhase() {
    this.state.phase = "BETTING";
    this.state.doubleDownEnabled =
      this.state.currentRace === this.state.totalRaces;
    this.state.availableTickets = createInitialAvailableTickets();
    this.state.livePlacements = {};
    this.state.sideBetOccurred = null;

    // Clear previous round bets
    for (const p of Object.values(this.state.players)) {
      p.currentBets = [];
      p.isReady = false;
    }

    if (this.state.mode === "classic") {
      this.state.draftOrder = buildSnakeDraftSequence(this.basePlayerOrder);
      this.state.currentDraftIndex = 0;
    } else {
      // Open mode: simultaneous bets
      this.state.draftOrder = [...this.basePlayerOrder];
      this.state.currentDraftIndex = 0;
    }

    this.broadcastState();
  }

  private handleSubmitBet(
    sender: Party.Connection,
    senderId: string,
    bet: Bet
  ) {
    if (this.state.phase !== "BETTING") {
      this.sendError(sender, "Bets are only accepted during BETTING phase.");
      return;
    }

    const player = this.state.players[senderId];
    if (!player) {
      this.sendError(sender, "Player not found.");
      return;
    }

    if (player.isHost && !player.isPlayingHost) {
      this.sendError(sender, "Non-playing host cannot place bets.");
      return;
    }

    if (this.state.mode === "classic") {
      this.handleSubmitClassicBet(sender, player, bet);
    } else {
      this.handleSubmitOpenBet(sender, player, bet);
    }
  }

  private handleSubmitClassicBet(
    sender: Party.Connection,
    player: Player,
    bet: Bet
  ) {
    // 1. Verify turn in snake draft order
    const expectedDrafterId =
      this.state.draftOrder[this.state.currentDraftIndex];
    if (expectedDrafterId !== player.id) {
      this.sendError(sender, "It is not your turn to draft a betting ticket.");
      return;
    }

    // 2. Each player gets exactly 2 tickets per race in classic mode
    if (player.currentBets.length >= 2) {
      this.sendError(sender, "You have already drafted your 2 tickets.");
      return;
    }

    // 3. Check ticket availability and assign tier
    const category: TicketCategory =
      bet.type === "mascot" ? bet.mascotId : bet.answer;
    const ticketStack = this.state.availableTickets[category];

    if (!ticketStack || ticketStack.length === 0) {
      this.sendError(
        sender,
        `No more tickets available for ${category.toUpperCase()}.`
      );
      return;
    }

    // Top ticket in the stack has the lowest tier number (1 = Top, 2 = Middle, 3 = Bottom)
    const assignedTier = ticketStack.shift()!;
    bet.tier = assignedTier;

    // In final race, handle double down choice
    if (this.state.doubleDownEnabled) {
      if (player.currentBets.length === 0) {
        // First ticket pick
        bet.isDoubled = !!bet.isDoubled;
      } else if (player.currentBets.length === 1) {
        // Second ticket pick
        if (bet.isDoubled === true) {
          bet.isDoubled = true;
          player.currentBets[0].isDoubled = false;
        } else if (bet.isDoubled === false) {
          bet.isDoubled = false;
          player.currentBets[0].isDoubled = true;
        } else {
          // If not explicitly specified by client
          if (player.currentBets[0].isDoubled) {
            bet.isDoubled = false;
          } else {
            bet.isDoubled = true;
          }
        }
      }
    }

    player.currentBets.push(bet);

    // Advance snake draft index
    this.state.currentDraftIndex++;

    // Check if draft is finished
    if (this.state.currentDraftIndex >= this.state.draftOrder.length) {
      this.state.phase = "RACE_INPUT";
    }

    this.broadcastState();
  }

  private handleSubmitOpenBet(
    sender: Party.Connection,
    player: Player,
    bet: Bet
  ) {
    // In Open Mode: max 1 mascot bet and 1 side bet per player
    if (bet.type === "mascot") {
      const existingMascotBetIndex = player.currentBets.findIndex(
        (b) => b.type === "mascot"
      );
      if (existingMascotBetIndex >= 0) {
        player.currentBets[existingMascotBetIndex] = bet;
      } else {
        player.currentBets.push(bet);
      }
    } else if (bet.type === "side") {
      const existingSideBetIndex = player.currentBets.findIndex(
        (b) => b.type === "side"
      );
      if (existingSideBetIndex >= 0) {
        player.currentBets[existingSideBetIndex] = bet;
      } else {
        player.currentBets.push(bet);
      }
    }

    // On final race, ensure exactly one bet is doubled when both are placed
    if (this.state.doubleDownEnabled && player.currentBets.length === 2) {
      const b0 = player.currentBets[0];
      const b1 = player.currentBets[1];
      if (b0.isDoubled && b1.isDoubled) {
        // Resolve conflict: prioritize the newly updated bet
        if (bet.type === b0.type) {
          b1.isDoubled = false;
        } else {
          b0.isDoubled = false;
        }
      } else if (!b0.isDoubled && !b1.isDoubled) {
        // Neither was doubled; default to doubling the mascot bet
        const mascotBet = player.currentBets.find((b) => b.type === "mascot");
        if (mascotBet) {
          mascotBet.isDoubled = true;
        } else {
          player.currentBets[0].isDoubled = true;
        }
      }
    }

    if (player.currentBets.length === 2) {
      player.isReady = true;
    }

    // Check if all active players have placed both bets
    const activePlayers = Object.values(this.state.players).filter(
      (p) => p.connected && (!p.isHost || p.isPlayingHost)
    );
    const allReady =
      activePlayers.length > 0 &&
      activePlayers.every((p) => p.currentBets.length === 2);

    if (allReady) {
      this.state.phase = "RACE_INPUT";
    }

    this.broadcastState();
  }

  private handleSelectDoubledBet(
    sender: Party.Connection,
    senderId: string,
    betIndex: number
  ) {
    const player = this.state.players[senderId];
    if (!player) {
      this.sendError(sender, "Player not found.");
      return;
    }

    if (!this.state.doubleDownEnabled) {
      this.sendError(sender, "Double down is only active on the final race.");
      return;
    }

    if (player.currentBets.length !== 2) {
      this.sendError(
        sender,
        "You must have 2 bets placed before selecting which one to double."
      );
      return;
    }

    if (betIndex !== 0 && betIndex !== 1) {
      this.sendError(sender, "Invalid bet selection.");
      return;
    }

    // Do not allow changing once live race placements have started
    if (Object.keys(this.state.livePlacements).length > 0) {
      this.sendError(
        sender,
        "Cannot change double-down bet once race placements have begun."
      );
      return;
    }

    player.currentBets[0].isDoubled = betIndex === 0;
    player.currentBets[1].isDoubled = betIndex === 1;

    this.broadcastState();
  }

  private handleLivePlaceRacer(
    sender: Party.Connection,
    senderId: string,
    position: 1 | 2 | 3 | 4,
    mascotId: MascotId | null
  ) {
    if (!this.assertHost(sender, senderId)) return;

    if (mascotId === null) {
      delete this.state.livePlacements[position];
    } else {
      // Remove mascot from any other position if already set
      for (const pos of [1, 2, 3, 4] as const) {
        if (this.state.livePlacements[pos] === mascotId) {
          delete this.state.livePlacements[pos];
        }
      }
      this.state.livePlacements[position] = mascotId;
    }

    // Broadcast immediate live reaction event to all connected clients
    this.room.broadcast(
      JSON.stringify({
        type: "LIVE_RACER_PLACED",
        payload: { position, mascotId },
      } satisfies ServerMessage)
    );

    this.broadcastState();
  }

  private handleLiveToggleSideBet(
    sender: Party.Connection,
    senderId: string,
    sideBetOccurred: boolean | null
  ) {
    if (!this.assertHost(sender, senderId)) return;

    this.state.sideBetOccurred = sideBetOccurred;

    // Broadcast immediate tentative status
    this.room.broadcast(
      JSON.stringify({
        type: "LIVE_SIDE_BET_UPDATED",
        payload: { sideBetOccurred },
      } satisfies ServerMessage)
    );

    this.broadcastState();
  }

  private handleFinalizeRace(sender: Party.Connection, senderId: string) {
    if (!this.assertHost(sender, senderId)) return;

    const placements = this.state.livePlacements;
    // Check if at least top 3 or all 4 positions are recorded
    if (!placements[1] || !placements[2] || !placements[3]) {
      this.sendError(
        sender,
        "Cannot finalize race: top 3 placements must be recorded."
      );
      return;
    }

    if (this.state.sideBetOccurred === null) {
      this.sendError(
        sender,
        "Cannot finalize race: side bet outcome (Yes/No) must be settled."
      );
      return;
    }

    // Invert placements to get mascot -> position map
    const mascotPositions: Record<string, number> = {};
    for (const [pos, mascot] of Object.entries(placements)) {
      if (mascot) mascotPositions[mascot] = Number(pos);
    }

    const netPayouts: Record<string, number> = {};
    const updatedScores: Record<string, number> = {};

    if (this.state.mode === "classic") {
      // Payouts based on Ticket Tier & Safe/Risky tables
      for (const player of Object.values(this.state.players)) {
        if (!player.connected && player.currentBets.length === 0) continue;

        let playerNet = 0;
        for (const bet of player.currentBets) {
          const tier = bet.tier || 1;
          let payout = 0;

          if (bet.type === "mascot") {
            const finishPos = mascotPositions[bet.mascotId] || 4;
            const tierTable = MASCOT_PAYOUTS[tier];
            const payoutsByPos = bet.isRisky
              ? tierTable.risky
              : tierTable.safe;
            payout = payoutsByPos[finishPos] ?? 0;
          } else if (bet.type === "side") {
            const won =
              (bet.answer === "yes" && this.state.sideBetOccurred === true) ||
              (bet.answer === "no" && this.state.sideBetOccurred === false);
            const sideTable = SIDE_BET_PAYOUTS[tier];
            const outcome = bet.isRisky ? sideTable.risky : sideTable.safe;
            payout = won ? outcome.win : outcome.lose;
          }

          if (bet.isDoubled) {
            payout *= 2;
          }
          playerNet += payout;
        }

        netPayouts[player.id] = playerNet;
        // Hot Streak rule: If you lose more than you have, score floors at $0
        player.score = Math.max(0, player.score + playerNet);
        updatedScores[player.id] = player.score;
      }
    } else {
      // Open mode (pot system with simultaneous bets)
      // Pots: 1st ($18), 2nd ($12), 3rd ($6), Side Bet ($18)
      const winnersByPot: Record<string, string[]> = {
        1: [],
        2: [],
        3: [],
        side: [],
      };

      for (const player of Object.values(this.state.players)) {
        for (const bet of player.currentBets) {
          if (bet.type === "mascot") {
            const finishPos = mascotPositions[bet.mascotId];
            if (finishPos === 1 || finishPos === 2 || finishPos === 3) {
              winnersByPot[finishPos].push(player.id);
            }
          } else if (bet.type === "side") {
            const won =
              (bet.answer === "yes" && this.state.sideBetOccurred === true) ||
              (bet.answer === "no" && this.state.sideBetOccurred === false);
            if (won) {
              winnersByPot.side.push(player.id);
            }
          }
        }
      }

      // Calculate share per winning player
      const playerGains: Record<string, number> = {};
      for (const p of Object.values(this.state.players)) {
        playerGains[p.id] = 0;
      }

      for (const pos of [1, 2, 3] as const) {
        const winners = winnersByPot[pos];
        if (winners.length > 0) {
          const share = Math.floor(OPEN_MODE_POTS[pos] / winners.length);
          for (const winnerId of winners) {
            const player = this.state.players[winnerId];
            const bet = player?.currentBets.find((b) => b.type === "mascot");
            const mult = bet?.isDoubled ? 2 : 1;
            playerGains[winnerId] = (playerGains[winnerId] || 0) + share * mult;
          }
        }
      }

      const sideWinners = winnersByPot.side;
      if (sideWinners.length > 0) {
        const share = Math.floor(OPEN_MODE_POTS.side / sideWinners.length);
        for (const winnerId of sideWinners) {
          const player = this.state.players[winnerId];
          const bet = player?.currentBets.find((b) => b.type === "side");
          const mult = bet?.isDoubled ? 2 : 1;
          playerGains[winnerId] = (playerGains[winnerId] || 0) + share * mult;
        }
      }

      for (const [pid, gain] of Object.entries(playerGains)) {
        const player = this.state.players[pid];
        if (player) {
          netPayouts[pid] = gain;
          player.score += gain;
          updatedScores[pid] = player.score;
        }
      }
    }

    // Save race result to history
    this.state.raceHistory.push({
      raceNumber: this.state.currentRace,
      placements: { ...this.state.livePlacements },
      sideBetOccurred: this.state.sideBetOccurred,
      payouts: netPayouts,
      playerScores: updatedScores,
    });

    // Check game over
    if (this.state.currentRace >= this.state.totalRaces) {
      this.state.phase = "GAME_OVER";
    } else {
      this.state.phase = "RACE_RESULTS";
    }

    this.broadcastState();
  }

  private handleNextRace(sender: Party.Connection, senderId: string) {
    if (!this.assertHost(sender, senderId)) return;
    if (this.state.phase !== "RACE_RESULTS") {
      this.sendError(sender, "Cannot advance to next race until race results are shown.");
      return;
    }

    // Rotate snake draft order: race 1's first drafter moves to the bottom
    if (this.basePlayerOrder.length > 1) {
      const first = this.basePlayerOrder.shift()!;
      this.basePlayerOrder.push(first);
    }

    this.state.currentRace++;
    this.startBettingPhase();
  }

  private handleRestartGame(sender: Party.Connection, senderId: string) {
    if (!this.assertHost(sender, senderId)) return;

    this.state.phase = "LOBBY";
    this.state.currentRace = 1;
    this.state.draftOrder = [];
    this.state.currentDraftIndex = 0;
    this.state.doubleDownEnabled = false;
    this.state.livePlacements = {};
    this.state.sideBetOccurred = null;
    this.state.availableTickets = createInitialAvailableTickets();
    this.state.raceHistory = [];

    // Reset all player cash back to $10
    for (const player of Object.values(this.state.players)) {
      player.score = 10;
      player.currentBets = [];
      player.isReady = false;
    }

    this.broadcastState();
  }

  private handleForceStartRace(sender: Party.Connection, senderId: string) {
    if (!this.assertHost(sender, senderId)) return;
    if (this.state.phase !== "BETTING") {
      this.sendError(sender, "Can only advance to race during betting phase.");
      return;
    }

    this.state.phase = "RACE_INPUT";
    this.broadcastState();
  }

  // ----------------------------------------
  // Utilities
  // ----------------------------------------

  private assertHost(conn: Party.Connection, senderId: string): boolean {
    if (this.state.hostId !== senderId) {
      this.sendError(conn, "Only the host can perform this action.");
      return false;
    }
    return true;
  }

  private sendError(conn: Party.Connection, message: string) {
    conn.send(
      JSON.stringify({
        type: "ERROR",
        payload: { message },
      } satisfies ServerMessage)
    );
  }

  private broadcastState() {
    this.room.broadcast(
      JSON.stringify({
        type: "SYNC_STATE",
        payload: this.state,
      } satisfies ServerMessage)
    );
  }
}
