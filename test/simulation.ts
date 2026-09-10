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

  // Fast-forward Race 2
  for (const drafterId of server.state.draftOrder) {
    const drafter = drafterId === "p1" ? p1 : drafterId === "p2" ? p2 : p3;
    await server.onMessage(
      JSON.stringify({
        type: "SUBMIT_BET",
        payload: { bet: { type: "mascot", mascotId: "mum", isRisky: false } },
      }),
      drafter as any
    );
  }
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 1, mascotId: "mum" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 2, mascotId: "gobbler" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 3, mascotId: "hurley" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 4, mascotId: "dangle" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_TOGGLE_SIDE_BET",
      payload: { sideBetOccurred: false },
    }),
    p1 as any
  );
  await server.onMessage(JSON.stringify({ type: "FINALIZE_RACE" }), p1 as any);

  // 9. Advance to Race 3 (FINAL RACE: double down active)
  await server.onMessage(JSON.stringify({ type: "NEXT_RACE" }), p1 as any);
  console.log("Current race:", server.state.currentRace); // 3
  console.log("doubleDownEnabled is true:", server.state.doubleDownEnabled === true);
  if (!server.state.doubleDownEnabled) {
    throw new Error("doubleDownEnabled should be true on Race 3!");
  }

  // Base order for race 3: [p3, p1, p2], draft order: [p3, p1, p2, p2, p1, p3]
  console.log("Race 3 draft order:", server.state.draftOrder);

  // P3 drafts Pick 1: Gobbler (Safe, Tier 1). P3 does not double it now.
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "mascot", mascotId: "gobbler", isRisky: false, isDoubled: false } },
    }),
    p3 as any
  );

  // P1 drafts Pick 1: Hurley (Safe, Tier 1). P1 EXPLICITLY chooses Bet 1 to double!
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "mascot", mascotId: "hurley", isRisky: false, isDoubled: true } },
    }),
    p1 as any
  );
  console.log("P1 Bet 1 isDoubled === true:", server.state.players["p1"].currentBets[0].isDoubled === true);

  // P2 drafts Pick 1: Dangle (Safe, Tier 1). Not doubled.
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "mascot", mascotId: "dangle", isRisky: false } },
    }),
    p2 as any
  );

  // P2 drafts Pick 2 (turnaround): Side YES (Safe, Tier 1). P2 chooses Bet 2 to be doubled!
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "side", answer: "yes", isRisky: false, isDoubled: true } },
    }),
    p2 as any
  );
  console.log("P2 Bet 1 isDoubled === false:", server.state.players["p2"].currentBets[0].isDoubled === false);
  console.log("P2 Bet 2 isDoubled === true:", server.state.players["p2"].currentBets[1].isDoubled === true);
  if (
    server.state.players["p2"].currentBets[0].isDoubled !== false ||
    server.state.players["p2"].currentBets[1].isDoubled !== true
  ) {
    throw new Error("P2 doubled bet mismatch!");
  }

  // P1 drafts Pick 2: Side YES (Risky, Tier 2). P1 keeps Bet 1 doubled, so Bet 2 is NOT doubled.
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "side", answer: "yes", isRisky: true, isDoubled: false } },
    }),
    p1 as any
  );
  console.log("P1 Bet 1 remains isDoubled === true:", server.state.players["p1"].currentBets[0].isDoubled === true);
  console.log("P1 Bet 2 isDoubled === false:", server.state.players["p1"].currentBets[1].isDoubled === false);
  if (
    server.state.players["p1"].currentBets[0].isDoubled !== true ||
    server.state.players["p1"].currentBets[1].isDoubled !== false
  ) {
    throw new Error("P1 doubled bet mismatch!");
  }

  // P3 drafts Pick 2: Mum (Safe, Tier 1). Without explicit flag, Bet 2 defaults to doubled.
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: { bet: { type: "mascot", mascotId: "mum", isRisky: false } },
    }),
    p3 as any
  );
  console.log("P3 initial Bet 2 doubled:", server.state.players["p3"].currentBets[1].isDoubled === true);

  // Now P3 uses SELECT_DOUBLED_BET to switch doubled bet from Bet 2 (index 1) to Bet 1 (index 0)!
  await server.onMessage(
    JSON.stringify({
      type: "SELECT_DOUBLED_BET",
      payload: { betIndex: 0 },
    }),
    p3 as any
  );
  console.log("P3 after SELECT_DOUBLED_BET (index 0):");
  console.log("  P3 Bet 1 isDoubled:", server.state.players["p3"].currentBets[0].isDoubled);
  console.log("  P3 Bet 2 isDoubled:", server.state.players["p3"].currentBets[1].isDoubled);
  if (
    server.state.players["p3"].currentBets[0].isDoubled !== true ||
    server.state.players["p3"].currentBets[1].isDoubled !== false
  ) {
    throw new Error("P3 SELECT_DOUBLED_BET failed to switch to Bet 1!");
  }

  // 10. Finish Race 3 and verify payout math
  // Placements: 1st Hurley, 2nd Gobbler, 3rd Mum, 4th Dangle. Side bet: YES.
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 1, mascotId: "hurley" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 2, mascotId: "gobbler" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 3, mascotId: "mum" },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "LIVE_PLACE_RACER",
      payload: { position: 4, mascotId: "dangle" },
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

  const preScores = {
    p1: server.state.players["p1"].score,
    p2: server.state.players["p2"].score,
    p3: server.state.players["p3"].score,
  };

  await server.onMessage(JSON.stringify({ type: "FINALIZE_RACE" }), p1 as any);

  const race3Payouts = server.state.raceHistory[2].payouts;
  console.log("Race 3 payouts:", race3Payouts);

  // Verification:
  // P1:
  //   - Bet 1: Hurley 1st, Tier 1 Safe ($10) -> Doubled = +$20!
  //   - Bet 2: Side YES (won), Tier 2 Risky ($12) -> Not doubled = +$12!
  //   - Expected P1 gain: 20 + 12 = +32.
  console.log("P1 race 3 gain === 32?", race3Payouts.p1 === 32);
  if (race3Payouts.p1 !== 32) {
    throw new Error(`Expected P1 gain 32, got ${race3Payouts.p1}`);
  }

  // P2:
  //   - Bet 1: Dangle 4th, Tier 1 Safe ($0) -> Not doubled = $0.
  //   - Bet 2: Side YES (won), Tier 1 Safe ($10) -> Doubled = +$20!
  //   - Expected P2 gain: 0 + 20 = +20.
  console.log("P2 race 3 gain === 20?", race3Payouts.p2 === 20);
  if (race3Payouts.p2 !== 20) {
    throw new Error(`Expected P2 gain 20, got ${race3Payouts.p2}`);
  }

  // P3:
  //   - Bet 1: Gobbler 2nd, Tier 1 Safe ($7) -> Doubled = +$14!
  //   - Bet 2: Mum 3rd, Tier 1 Safe ($5) -> Not doubled = +$5!
  //   - Expected P3 gain: 14 + 5 = +19.
  console.log("P3 race 3 gain === 19?", race3Payouts.p3 === 19);
  if (race3Payouts.p3 !== 19) {
    throw new Error(`Expected P3 gain 19, got ${race3Payouts.p3}`);
  }

  console.log("✅ Classic mode tests and payout checks passed successfully!");
}

async function runOpenModeTest() {
  console.log("\n=== Testing Open Mode Final Race Double Down ===");
  const room = new MockRoom();
  const server = new HotStreakServer(room as any);

  const p1 = new MockConnection("p1");
  await server.onConnect(
    p1 as any,
    {
      request: {
        url: "http://localhost:1999/party/open-room?sessionId=p1",
      },
    } as any
  );

  const p2 = new MockConnection("p2");
  await server.onConnect(
    p2 as any,
    {
      request: {
        url: "http://localhost:1999/party/open-room?sessionId=p2",
      },
    } as any
  );

  // Set mode to open and totalRaces to 1 (making Race 1 immediately the final race with double down)
  await server.onMessage(
    JSON.stringify({
      type: "UPDATE_CONFIG",
      payload: { mode: "open", totalRaces: 1 },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({ type: "HOST_START_GAME" }),
    p1 as any
  );

  console.log(
    "Open mode doubleDownEnabled:",
    server.state.doubleDownEnabled === true
  );

  // P1 submits Mascot (Gobbler) doubled, Side (Yes) not doubled
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: {
        bet: {
          type: "mascot",
          mascotId: "gobbler",
          isRisky: false,
          isDoubled: true,
        },
      },
    }),
    p1 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: {
        bet: { type: "side", answer: "yes", isRisky: false, isDoubled: false },
      },
    }),
    p1 as any
  );

  // P2 submits Mascot (Hurley) not doubled, Side (Yes) doubled
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: {
        bet: {
          type: "mascot",
          mascotId: "hurley",
          isRisky: false,
          isDoubled: false,
        },
      },
    }),
    p2 as any
  );
  await server.onMessage(
    JSON.stringify({
      type: "SUBMIT_BET",
      payload: {
        bet: { type: "side", answer: "yes", isRisky: false, isDoubled: true },
      },
    }),
    p2 as any
  );

  console.log(
    "P1 initial bets doubled flags:",
    server.state.players["p1"].currentBets.map(
      (b) => `${b.type}:${b.isDoubled}`
    )
  );
  console.log(
    "P2 initial bets doubled flags:",
    server.state.players["p2"].currentBets.map(
      (b) => `${b.type}:${b.isDoubled}`
    )
  );

  // P1 switches doubled bet from Mascot (0) to Side (1) using SELECT_DOUBLED_BET
  await server.onMessage(
    JSON.stringify({
      type: "SELECT_DOUBLED_BET",
      payload: { betIndex: 1 },
    }),
    p1 as any
  );
  console.log("P1 after SELECT_DOUBLED_BET to index 1:");
  console.log(
    "  Mascot doubled:",
    server.state.players["p1"].currentBets[0].isDoubled
  );
  console.log(
    "  Side doubled:",
    server.state.players["p1"].currentBets[1].isDoubled
  );
  if (
    server.state.players["p1"].currentBets[0].isDoubled !== false ||
    server.state.players["p1"].currentBets[1].isDoubled !== true
  ) {
    throw new Error("Open mode SELECT_DOUBLED_BET failed for P1!");
  }

  // Live placements: 1st Gobbler, 2nd Hurley, 3rd Dangle, 4th Mum. Side bet: YES.
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
  await server.onMessage(
    JSON.stringify({ type: "FINALIZE_RACE" }),
    p1 as any
  );

  // In Open Mode:
  // 1st pot = $18. Winner: P1 (Gobbler). P1 mascot is NOT doubled -> 18 * 1 = 18.
  // 2nd pot = $12. Winner: P2 (Hurley). P2 mascot is NOT doubled -> 12 * 1 = 12.
  // Side pot = $18. Winners: P1 and P2 (both bet YES).
  // Base share per winner = floor(18 / 2) = $9.
  // P1 side bet is DOUBLED -> 9 * 2 = 18.
  // P2 side bet is DOUBLED -> 9 * 2 = 18.
  // Total P1 gain = 18 (mascot) + 18 (side) = 36.
  // Total P2 gain = 12 (mascot) + 18 (side) = 30.
  const openPayouts = server.state.raceHistory[0].payouts;
  console.log("Open mode payouts:", openPayouts);
  console.log("P1 open gain === 36?", openPayouts.p1 === 36);
  console.log("P2 open gain === 30?", openPayouts.p2 === 30);
  if (openPayouts.p1 !== 36 || openPayouts.p2 !== 30) {
    throw new Error(
      `Open mode payouts mismatch! Got ${JSON.stringify(openPayouts)}`
    );
  }
  console.log("✅ Open mode double down test passed successfully!");
}

async function main() {
  await runTest();
  await runOpenModeTest();
  console.log("\n🎉 ALL TESTS AND SUITES PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
