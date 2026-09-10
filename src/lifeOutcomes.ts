// Life Outcomes from official Hot Streak Rulebook (Pages 32-37)
export const LIFE_OUTCOMES: Record<number, string> = {
  0: "You have not won enough money. You become feral.",
  1: "Ape got ya.",
  2: "You shred your losing tickets to build a cozy nest for your geckos.",
  3: "Your winnings don’t add up to much but you fold them over and use them to fix a wiggly table. Nice!",
  4: "Your winnings cover the cost of a coffee. You spill it on a rat who’s trying to slurp your shoelace like spaghetti.",
  5: "You treat yourself to a nice stadium dinner of free diced onions and a bottled water.",
  6: "You slip your winnings under the windshield wiper of a random car in the stadium lot to “pay it forward” in a confusing way.",
  7: "You buy one share of stock in Mascot Racing League Worldwide Corp. Buy what you know!",
  8: "You’ve got just enough for a cheap net to capture the mayor’s poodle for ransom, and a dollar left over as poodle bait.",
  9: "You sell your winnings on Facebook Marketplace for $8.",
  10: "You leave with the exact same amount of money you started with, go to bed, and wake up in the morning back at the start of the day you just lived. Here we go again!!",
  11: "Thanks to your gambling, you can buy your family some ketchup.",
  12: "You buy a cursed ring. But it’s not a big deal curse. It’s fine.",
  13: "You sneeze all over your winnings, so now they’re gross, so into the trash they go.",
  14: "You’re disgusted at yourself for gambling. You go to church and have them hose you down with holy water.",
  15: "At the stadium, you buy your son a Hurley action figure with juice oozing action. The little guy’s just crazy about meat juices!",
  16: "You use your winnings on a Frankenstein mask to kickstart your door-to-door Frankenstein business.",
  17: "You ask for your winnings in coins. They weigh you down and you’re sucked into a mud puddle forever.",
  18: "Your winnings give you a paper cut so you flush them as revenge.",
  19: "Your winnings make you bold enough to quit your job. Then you count them again. Oops.",
  20: "You’re overcome with the irrepressible urge to eat a $20 bill and devour your winnings. The rest of your life is normal.",
  21: "You stash the money in your cheek and it gets moldy.",
  22: "You mail your winnings to your niece, who uses them to buy a sweet butterfly knife to do tricks with.",
  23: "You finally have enough money to fulfill your dream of buying a used copy of Tony Hawk’s Downhill Jam for the Xbox 360, so you do it.",
  24: "You get your winnings in nickels and use the weight to explore the bottom of the river, where you find some nickels.",
  25: "You buy a hardcover book about what to do with $25. It says you made the best possible choice. Wow!",
  26: "You buy yourself a modest crown and live out your days as a well respected local regent.",
  27: "You use the money to hire a mercenary to punch your uncle, but your uncle shakes it off like it’s nothing.",
  28: "A mugger corners you in the parking lot, and that’s how you meet your wife.",
  29: "You throw your winnings onto the field, where you assume the mascots live, because they did such a good job today.",
  30: "Ape tried to get ya, but you paid it off with a cool $30.",
  31: "You get addicted to winning $31 specifically, and your life doesn’t get great from there.",
  32: "Your winnings go straight into Gobbler’s college fund.",
  33: "You buy a jaunty hat and unlock your dangerous new persona, Jackknife Jones.",
  34: "You fold all the cash you win into little origami boxes to make a bug zoo with.",
  35: "You buy yourself a new boomerang. Someday you will learn to throw them right.",
  36: "You can finally pay off your debt to the kid you borrowed $5 from in sixth grade, with interest.",
  37: "You have won too average an amount of money. You become feral.",
  38: "You get yourself a back alley toupee but a seagull steals it.",
  39: "You buy yourself a shovel, get really into digging big holes, and dig a really big one.",
  40: "You use your winnings to buy a copy of the game Hot Streak, by Jon Perry and CMYK. You enjoy playing it for years with friends and family.",
  41: "You lose all your winnings trying to win a cigarette from a claw machine.",
  42: "You add your winnings to the dowry you plan to give Mum to convince her to marry you. A queen deserves the best!",
  43: "You won enough to pay off a bit of your peanut debt to the peanut girl. To celebrate, you borrow some more peanuts.",
  44: "You donate your winnings to NASA. You believe in what they’re doing.",
  45: "You have enough to buy yourself a single mascot glove. Soon, you will be the mascot.",
  46: "You invest your winnings in hog futures and triple them thanks to an outbreak of Good For Hogs Disease.",
  47: "It’s actually illegal to have $47. You are sent into exile.",
  48: "A t-shirt cannon t-shirt is shot directly into your lap, destroying your hopes of ever having children.",
  49: "You book studio time to record your soon-to-be smash hit, “I Saw What I’m Pretty Sure Was A Hot Dog Run Around.”",
  50: "Since $50 is objectively the coolest amount of money, you become wildly popular, with many girlfriends and/or boyfriends.",
  66: "Nice!",
  69: "You finally have enough funds to build a big ramp in your driveway to jump your car over your house.",
  100: "You have won too much money. You become feral."
};

export function getLifeOutcome(score: number): string {
  if (score >= 100) return LIFE_OUTCOMES[100];
  if (score in LIFE_OUTCOMES) return LIFE_OUTCOMES[score];
  if (score <= 0) return LIFE_OUTCOMES[0];
  // Fallback to nearest lower bracket or generic
  const keys = Object.keys(LIFE_OUTCOMES).map(Number).sort((a, b) => a - b);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (score >= keys[i]) return LIFE_OUTCOMES[keys[i]];
  }
  return "You count your winnings under the racetrack lights and smile.";
}
