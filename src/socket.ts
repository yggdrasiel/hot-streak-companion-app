import PartySocket from "partysocket";
import type {
  GameState,
  ClientMessage,
  ServerMessage,
  Bet,
  MascotId,
  GameMode,
} from "./server";

// Re-export server types for convenience in UI components
export type { GameState, ClientMessage, ServerMessage, Bet, MascotId, GameMode };

// Default partykit host (overridable via localStorage or window query)
const DEFAULT_PARTYKIT_HOST =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "localhost:1999"
    : (import.meta.env.VITE_PARTYKIT_HOST as string) || "hot-streak.partykit.dev";

// Persistent session management
function getOrCreateSessionId(): string {
  const KEY = "hot_streak_session_id";
  let sessionId = localStorage.getItem(KEY);
  if (!sessionId) {
    sessionId = "hs_" + Math.random().toString(36).substring(2, 11);
    localStorage.setItem(KEY, sessionId);
  }
  return sessionId;
}

export const sessionId = getOrCreateSessionId();

let socket: PartySocket | null = null;
let currentState: GameState | null = null;
type StateListener = (state: GameState) => void;
type EventListener = (message: ServerMessage) => void;

const stateListeners: Set<StateListener> = new Set();
const eventListeners: Set<EventListener> = new Set();

export function getState(): GameState | null {
  return currentState;
}

export function subscribeState(listener: StateListener): () => void {
  stateListeners.add(listener);
  if (currentState) {
    listener(currentState);
  }
  return () => stateListeners.delete(listener);
}

export function subscribeEvent(listener: EventListener): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

export function connectToRoom(roomCode: string, playerName?: string, isPlayingHost?: boolean) {
  if (socket) {
    socket.close();
    socket = null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paramHost = urlParams.get("server") || urlParams.get("host");
  if (paramHost) {
    localStorage.setItem("hot_streak_party_host", paramHost);
  }

  const host = localStorage.getItem("hot_streak_party_host") || DEFAULT_PARTYKIT_HOST;

  socket = new PartySocket({
    host,
    room: roomCode.toUpperCase(),
    query: {
      sessionId,
    },
  });

  socket.addEventListener("open", () => {
    console.log("[PartySocket] Connected to room", roomCode);
    if (playerName) {
      sendMessage({
        type: "REGISTER_PROFILE",
        payload: {
          name: playerName,
          isPlayingHost: isPlayingHost ?? true,
        },
      });
    }
  });

  socket.addEventListener("message", (event) => {
    try {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === "SYNC_STATE") {
        currentState = msg.payload;
        stateListeners.forEach((fn) => fn(msg.payload));
      } else if (msg.type === "LIVE_RACER_PLACED" || msg.type === "LIVE_SIDE_BET_UPDATED") {
        eventListeners.forEach((fn) => fn(msg));
      } else if (msg.type === "ERROR") {
        console.warn("[Server Error]", msg.payload.message);
        alert(msg.payload.message);
      }
    } catch (e) {
      console.error("[PartySocket] Failed to parse message", e);
    }
  });

  socket.addEventListener("close", () => {
    console.log("[PartySocket] Disconnected");
  });

  return socket;
}

export function disconnectFromRoom() {
  if (socket) {
    socket.close();
    socket = null;
    currentState = null;
  }
}

export function sendMessage(message: ClientMessage) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.warn("[PartySocket] Cannot send message, socket not open", message);
  }
}
