/** Quiz games on /play. Add a game here and give it a page under app/(site)/play/. */

export type GameResult = {
  /** Small label above the lead line, e.g. "Your Patlang order". */
  leadLabel: string;
  /** One punchy line shown big at the top of the result card. */
  lead: string;
  /** Small label above the result title, e.g. "Your play". */
  titleLabel: string;
  title: string;
  /** Short description line next to the title label, e.g. "Realism". */
  tag?: string;
  blurb: string;
};

export type Game = {
  slug: string;
  name: string;
  /** Short line for the card on /play. */
  cardLine: string;
  /** Small line above the name on the intro screen. */
  eyebrow: string;
  intro: string;
  questions: { q: string; options: { text: string; result: string }[] }[];
  results: Record<string, GameResult>;
  /** The show this game belongs to. */
  show: { title: string; line: string };
  /** Promo code shown on the result screen. Leave empty to show none. */
  promoCode: string;
  promoLabel: string;
  promoNote: string;
  shareText: (result: GameResult) => string;
};

export const GAMES: Game[] = [
  {
    slug: "patlang",
    name: "Order Your Patlang",
    cardLine: "Five questions. One coffee order. One play that fits you.",
    eyebrow: "Patlang at Cafe Xia",
    intro: "Five questions. One coffee order. One play that fits you.",
    questions: [
      {
        q: "How do you take your coffee?",
        options: [
          { text: "Black. No sugar, no nonsense.", result: "interview" },
          { text: "Whatever is hot, with a free refill.", result: "stopover" },
          { text: "Sweet and iced. Easy on the surface.", result: "fine" },
        ],
      },
      {
        q: "Someone asks, \"How are you?\"",
        options: [
          { text: "I answer honestly, even if it gets awkward.", result: "interview" },
          { text: "I tell a story. It is a long one.", result: "stopover" },
          { text: "\"I'm fine.\" Next question.", result: "fine" },
        ],
      },
      {
        q: "Pick a seat.",
        options: [
          { text: "Right across from someone, eye to eye.", result: "interview" },
          { text: "By the window, watching the road.", result: "stopover" },
          { text: "The corner, back to the wall.", result: "fine" },
        ],
      },
      {
        q: "What replays in your head at 2 AM?",
        options: [
          { text: "Something I never got to say.", result: "interview" },
          { text: "The road I did not take.", result: "stopover" },
          { text: "Something I said that was not quite true.", result: "fine" },
        ],
      },
      {
        q: "The best part of a long conversation?",
        options: [
          { text: "When the truth finally comes out.", result: "interview" },
          { text: "The jokes only old friends get.", result: "stopover" },
          { text: "When someone sees right through me.", result: "fine" },
        ],
      },
    ],
    results: {
      interview: {
        leadLabel: "Your Patlang order",
        lead: "Black americano. No sugar. Nothing hidden.",
        titleLabel: "Your play",
        title: "The Interview",
        tag: "Realism",
        blurb:
          "A premarital interview turns into a meeting with the past when Thea faces Father Rex. Some things were never said, and now they have to be.",
      },
      stopover: {
        leadLabel: "Your Patlang order",
        lead: "Brewed coffee, refilled twice. You stopped for a quick cup and stayed for the talk.",
        titleLabel: "Your play",
        title: "Stop Over!",
        tag: "Abstract",
        blurb:
          "John and Cedie, longtime friends, pause on a trip north. Over a meal, old jokes make room for big questions about the paths they took.",
      },
      fine: {
        leadLabel: "Your Patlang order",
        lead: "Iced matcha, extra sweet. Looks easy, hides plenty.",
        titleLabel: "Your play",
        title: "I'm Fine, Darling",
        tag: "Mind play",
        blurb:
          "A blind date between two strangers starts as playful banter and turns into a talk about everything people tuck behind the words \"I'm fine.\"",
      },
    },
    show: { title: "See it live", line: "Cafe Xia, 2735 Taft Avenue, Pasay City. Nov 14 and 15, 3 PM and 7 PM." },
    promoCode: "AAENJOY",
    promoLabel: "Your reward",
    promoNote: "Works on any Act Avenue show. Enter it at checkout. Limited uses.",
    shareText: (r) => `My Patlang order: ${r.lead} My play: ${r.title}. Find yours.`,
  },
  {
    slug: "kwentuhog",
    name: "Which Stage of Sleep Are You?",
    cardLine: "Reality, Dream, Nightmare or Awakening. Find your stage.",
    eyebrow: "Kwentuhog: A Bedtime Story",
    intro: "Five questions about your nights. Reality, Dream, Nightmare or Awakening: find your stage.",
    questions: [
      {
        q: "It is midnight. Where is your phone?",
        options: [
          { text: "In my hand. Still replying.", result: "reality" },
          { text: "Across the room. I am drifting.", result: "dream" },
          { text: "Face down. I am scared to look.", result: "nightmare" },
          { text: "Charging, alarm set, ready for tomorrow.", result: "awakening" },
        ],
      },
      {
        q: "Last thing on your mind before sleep?",
        options: [
          { text: "Tomorrow's to-do list.", result: "reality" },
          { text: "Something that makes no sense, in a good way.", result: "dream" },
          { text: "Every awkward thing I ever said.", result: "nightmare" },
          { text: "A fresh start.", result: "awakening" },
        ],
      },
      {
        q: "Pick a bed.",
        options: [
          { text: "Next to the desk. Laptop still open.", result: "reality" },
          { text: "Cloud soft, too many pillows.", result: "dream" },
          { text: "Blanket pulled over my head.", result: "nightmare" },
          { text: "By the window, curtains open.", result: "awakening" },
        ],
      },
      {
        q: "What do you hear at 3 AM?",
        options: [
          { text: "Notifications.", result: "reality" },
          { text: "Music from a place that does not exist.", result: "dream" },
          { text: "Footsteps. Probably nothing.", result: "nightmare" },
          { text: "Early birds.", result: "awakening" },
        ],
      },
      {
        q: "Your ideal morning?",
        options: [
          { text: "Coffee and inbox.", result: "reality" },
          { text: "Five more minutes. Forever.", result: "dream" },
          { text: "Anything, as long as the night is over.", result: "nightmare" },
          { text: "Slow, sunny, and nobody rushing me.", result: "awakening" },
        ],
      },
    ],
    results: {
      reality: {
        leadLabel: "Your night",
        lead: "Lights off, mind on.",
        titleLabel: "Your sleep stage",
        title: "Reality",
        blurb: "You carry the whole day into bed. The to-do list follows you under the covers, and it has opinions.",
      },
      dream: {
        leadLabel: "Your night",
        lead: "Out of office, in dreamland.",
        titleLabel: "Your sleep stage",
        title: "Dream",
        blurb: "Your mind wanders where logic does not follow. Nobody does the impossible quite like you at 2 AM.",
      },
      nightmare: {
        leadLabel: "Your night",
        lead: "The heavy stuff waits until 3 AM.",
        titleLabel: "Your sleep stage",
        title: "Nightmare",
        blurb: "Your brain saves the big questions for when the lights go out. Brave of you to keep sleeping anyway.",
      },
      awakening: {
        leadLabel: "Your night",
        lead: "You wake up changed.",
        titleLabel: "Your sleep stage",
        title: "Awakening",
        blurb: "Morning finds you lighter than the night did. You made it through, and you know a little more than before.",
      },
    },
    show: {
      title: "Four stories. One bed.",
      line: "Kwentuhog: A Bedtime Story. Nov 28 and 29, 2 PM and 6 PM, Myra Beltran Dance Forum Studio, Quezon City.",
    },
    promoCode: "AAENJOY",
    promoLabel: "Your reward",
    promoNote: "Works on any Act Avenue show. Enter it at checkout. Limited uses.",
    shareText: (r) => `I am in the ${r.title} stage of sleep. Which stage are you? Kwentuhog: A Bedtime Story.`,
  },
];

export function getGame(slug: string) {
  return GAMES.find((g) => g.slug === slug);
}
