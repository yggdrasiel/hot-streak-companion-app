import HotStreakServer from "../src/server";

// Mock PartyKit Room and Connection
class MockConnection {
  state: Record<string, any> = {};
  messages: any[] = [];

  constructor(public id: string) {}

  setState(newState: Record<string, any>) {
    this.state = { ...this.state, ...newState };
  }

  send(data: string) {
    this.messages.push(JSON.parse(data));
  }
}

class MockRoom {
  id = "test-room";
  broadcastMessages: any[] = [];

  broadcast(data: string) {
    this.broadcastMessages.push(JSON.parse(data));
  }
}

async function runTest() {
  console.log("=== Testing Hot Streak PartyKit Server ===");
  const room = new MockRoom();
  const server = new HotStreakServer(room as any);

  // 1. Connect Host (P1)
  const p1 = new MockConnection("p1");
  await server.onConnect(p1 as any, {
    request: { url: "http://localhost:1999/party/test-room?sessionId=p1" },
  } as any);

  console.log("P1 connected as host:", server.state.hostId === "p1");
  console.log("P1 score starts at:", server.state.players["p1"].score); // 10

  // 2. Connect P2 and P3
  const p2 = new MockConnection("p2");
  await server.onConnect(p2 as any, {
    request: { url: "http://localhost:1999/party/test-room?sessionId=p2" },
  } as any);

  const p3 = new MockConnection("p3");
  await server.onConnect(p3 as any, {
    request: { url: "http://localhost:1999/party/test-room?sessionId=p3" },
  } as any);

  console.log("Total players in lobby:", Object.keys(server.state.players).length);

  // 3. Host starts game
  await server.onMessage(
    JSON.stringify({ type: "HOST_START_GAME" }),
    p1 as any
  );

  console.log("Phase after start:", server.state.phase); // BETTING
  console.log("Snake draft order:", server.state.draftOrder); // [p1, p2, p3, p3, p2, p1]

  if (JSON.stringify(server.state.draftOrder) !== JSON.stringify(["p1", "p2", "p3", "p3", "p2", "p1"])) {
    throw new Error("Snake draft order mismatch!");
  }

  // 4. Test Draft Round 1
  // P1 drafts Tier 1 Gobbler (Safe)
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "mascot", mascotId: "gobbler", isRisky: false } },
    }),
    p1 as any
  );
  console.log("P1 Bet 1 tier assigned:", server.state.players["p1"].currentBets[0].tier); // 1
  console.log("Gobbler available tiers:", server.state.availableTickets.gobbler); // [2, 3]

  // P2 drafts Tier 2 Gobbler (Risky)
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "mascot", mascotId: "gobbler", isRisky: true } },
    }),
    p2 as any
  );
  console.log("P2 Bet 1 tier assigned:", server.state.players["p2"].currentBets[0].tier); // 2

  // P3 drafts Tier 1 Side Bet YES (Safe)
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "side", answer: "yes", isRisky: false } },
    }),
    p3 as any
  );
  console.log("P3 Bet 1 tier assigned:", server.state.players["p3"].currentBets[0].tier); // 1

  // 5. Test Snake turnaround (P3 drafts 2nd bet immediately)
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "mascot", mascotId: "hurley", isRisky: false } },
    }),
    p3 as any
  );
  console.log("P3 Bet 2 drafted. Bets count:", server.state.players["p3"].currentBets.length); // 2

  // P2 drafts 2nd bet: Side Bet NO (Risky - Tier 1)
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "side", answer: "no", isRisky: true } },
    }),
    p2 as any
  );

  // P1 drafts 2nd bet: Hurley (Risky - Tier 2)
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "mascot", mascotId: "hurley", isRisky: true } },
    }),
    p1 as any
  );

  console.log("Phase after last bet:", server.state.phase); // RACE_INPUT

  // 6. Host places live racers & side bet outcome
  // Placements: 1st Gobbler, 2nd Hurley, 3rd Dangle, 4th Mum
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 1, mascotId: "gobbler" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 2, mascotId: "hurley" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 3, mascotId: "dangle" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 4, mascotId: "mum" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_TOGGLE_SIDE_BET",
      payload: { sideBetOccurred: true },
    }),
    p1 as any
  );

  console.log("Live placements:", server.state.livePlacements);
  console.log("Side bet occurred:", server.state.sideBetOccurred);

  // 7. Finalize Race 1
  await server.onMessage(
    JSON.stringify({ type: "FINALIZE_RACE" }),
    p1 as any
  );

  console.log("Phase after finalize:", server.state.phase); // RACE_RESULTS
  const lastRace = server.state.raceHistory[0];
  console.log("Race 1 payouts:", lastRace.payouts);
  console.log("Player scores after Race 1:", lastRace.playerScores);

  // Verification of math:
  // P1:
  //   - Bet 1: Gobbler (1st place), Tier 1 Safe -> $10
  //   - Bet 2: Hurley (2nd place), Tier 2 Risky -> $3
  //   - Net: +$13. New score: 10 + 13 = $23.
  console.log("P1 score === 23?", server.state.players["p1"].score === 23);
  if (server.state.players["p1"].score !== 23) {
    throw new Error(`Expected P1 score 23, got ${server.state.players["p1"].score}`);
  }

  // P2:
  //   - Bet 1: Gobbler (1st place), Tier 2 Risky -> $11
  //   - Bet 2: Side Bet NO (Outcome was YES), Tier 1 Risky -> -$5
  //   - Net: +$6. New score: 10 + 6 = $16.
  console.log("P2 score === 16?", server.state.players["p2"].score === 16);
  if (server.state.players["p2"].score !== 16) {
    throw new Error(`Expected P2 score 16, got ${server.state.players["p2"].score}`);
  }

  // P3:
  //   - Bet 1: Side Bet YES (Outcome was YES), Tier 1 Safe -> +$10
  //   - Bet 2: Hurley (2nd place), Tier 1 Safe -> +$7
  //   - Net: +$17. New score: 10 + 17 = $27.
  console.log("P3 score === 27?", server.state.players["p3"].score === 27);
  if (server.state.players["p3"].score !== 27) {
    throw new Error(`Expected P3 score 27, got ${server.state.players["p3"].score}`);
  }

  // 8. Next race rotation
  await server.onMessage(
    JSON.stringify({ type: "NEXT_RACE" }),
    p1 as any
  );
  console.log("Current race:", server.state.currentRace); // 2
  console.log("Base player order rotated to:", server.basePlayerOrder); // [p2, p3, p1]
  console.log("New snake draft order:", server.state.draftOrder); // [p2, p3, p1, p1, p3, p2]

  if (JSON.stringify(server.state.draftOrder) !== JSON.stringify(["p2", "p3", "p1", "p1", "p3", "p2"])) {
    throw new Error("Rotated draft order mismatch!");
  }

  console.log("✅ All tests and payout checks passed successfully!");
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
