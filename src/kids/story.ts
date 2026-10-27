/**
 * Goldilocks and the Three Bears, told for the colouring book in English and Portuguese: six
 * scenes, each a page to read (its {WORDS} hidden in a small grid) and a page to colour.
 *
 * Every hidden word inks in a part of the drawing (`ink`, by the part's key in scenes.ts), so
 * finding BOWLS draws the bowls. A part no word names is inked when the last word is found.
 * Boards: `npm run kids:generate` lays out each scene's grid per language (src/kids/levels).
 */

export type Lang = 'en' | 'pt';
export const LANGS: Lang[] = ['en', 'pt'];

export interface SceneText {
  title: string;
  /** The scene, each word to find written as {WORD}: their letters fill the grid exactly. */
  text: string;
  rows: number;
  cols: number;
  /** Each hidden word, and the parts of the picture it inks in. */
  ink: Record<string, string[]>;
  /** Another layout, when the first one tried can't be solved. */
  seed?: number;
}

export interface Scene {
  id: string;
  en: SceneText;
  pt: SceneText;
}

export const BOOK = {
  id: 'goldilocks',
  title: { en: 'Goldilocks and the Three Bears', pt: 'Cachinhos Dourados e os Três Ursos' },
  credit: {
    en: 'A folk tale, first printed by Robert Southey in 1837. Retold, and drawn to colour in, for this book.',
    pt: 'Um conto popular, impresso pela primeira vez por Robert Southey em 1837. Recontado e desenhado para colorir neste livro.',
  },
};

export const SCENES: Scene[] = [
  {
    id: 'the-three-bears',
    en: {
      title: 'The Three Bears',
      text: 'Once upon a time, three {BEARS} lived in a little house in the {WOODS}: Papa Bear, Mama Bear and Baby Bear. One morning they made {PORRIDGE} for breakfast, but it was too {HOT} to eat. So they went for a {WALK} while it cooled.',
      rows: 5,
      cols: 5,
      ink: { BEARS: ['bears'], WOODS: ['woods'], PORRIDGE: ['porridge'], HOT: ['hot'], WALK: ['walk'] },
    },
    pt: {
      title: 'Os Três Ursos',
      seed: 4,
      text: 'Era uma vez três {URSOS} que moravam numa casinha no {BOSQUE}: o Papai Urso, a Mamãe Ursa e o Ursinho. Certa manhã, eles fizeram {MINGAU}, mas estava {QUENTE} demais. Então foram {PASSEAR} enquanto ele esfriava.',
      rows: 6,
      cols: 5,
      ink: { URSOS: ['bears'], BOSQUE: ['woods'], MINGAU: ['porridge'], QUENTE: ['hot'], PASSEAR: ['walk'] },
    },
  },
  {
    id: 'a-knock-at-the-door',
    en: {
      title: 'A Knock at the Door',
      text: 'Nearby, a little girl called Goldilocks was picking flowers. She found the bears’ {HOUSE} and gave a {KNOCK} on the {DOOR}. Nobody answered. So, very quietly, she went {INSIDE}.',
      rows: 5,
      cols: 4,
      ink: { HOUSE: ['house'], KNOCK: ['knock'], DOOR: ['door'], INSIDE: ['inside'] },
    },
    pt: {
      title: 'Toc, Toc!',
      text: 'Ali perto, uma menina chamada Cachinhos Dourados colhia flores. Ela encontrou a {CASA} dos ursos e {BATEU} na {PORTA}. Ninguém respondeu. Então, bem quietinha, ela {ENTROU}.',
      rows: 5,
      cols: 4,
      ink: { CASA: ['house'], BATEU: ['knock'], PORTA: ['door'], ENTROU: ['inside'] },
    },
  },
  {
    id: 'just-right',
    en: {
      title: 'Just Right',
      text: 'On the table were three {BOWLS} of porridge. The big bowl was too hot. The middle bowl was too {COLD}. The little bowl was just {RIGHT}! She took a {SPOON} and {ATE} it all {UP}.',
      rows: 6,
      cols: 4,
      ink: { BOWLS: ['bowls'], COLD: ['cold'], RIGHT: ['right'], SPOON: ['spoon'], ATE: ['girl'], UP: ['up'] },
    },
    pt: {
      title: 'Do Jeitinho Certo',
      seed: 9,
      text: 'Na mesa havia três {TIGELAS} de mingau. A grande estava quente demais. A do meio estava {FRIA} demais. A pequena estava {CERTINHA}! Ela pegou a {COLHER} e {COMEU} tudo.',
      rows: 6,
      cols: 5,
      ink: { TIGELAS: ['bowls'], FRIA: ['cold'], CERTINHA: ['right'], COLHER: ['spoon'], COMEU: ['girl', 'up'] },
    },
  },
  {
    id: 'three-chairs',
    en: {
      title: 'Three Chairs',
      text: 'Then she saw three {CHAIRS}. The big chair was too {HARD}. The middle chair was too {SOFT}. The little chair was just right, but when she sat down, it {BROKE} into {PIECES}!',
      rows: 5,
      cols: 5,
      ink: { CHAIRS: ['hard', 'soft'], HARD: ['hard'], SOFT: ['soft'], BROKE: ['girl'], PIECES: ['pieces'] },
    },
    pt: {
      title: 'Três Cadeiras',
      seed: 23,
      text: 'Depois, ela viu três {CADEIRAS}. A grande era {DURA} demais. A do meio era {MOLE} demais. A pequena era certinha, mas, quando ela se sentou, a cadeira {QUEBROU} em {PEDAÇOS}!',
      rows: 6,
      cols: 5,
      ink: { CADEIRAS: ['hard', 'soft'], DURA: ['hard'], MOLE: ['soft'], QUEBROU: ['girl'], PEDAÇOS: ['pieces'] },
    },
  },
  {
    id: 'fast-asleep',
    en: {
      title: 'Fast Asleep',
      text: 'Now she felt {SLEEPY}. She went {UPSTAIRS} and found three {BEDS}. The big bed was too high. The middle bed was too low. The little bed was just right, and she fell fast {ASLEEP}.',
      rows: 6,
      cols: 4,
      ink: { SLEEPY: ['sleepy'], UPSTAIRS: ['upstairs'], BEDS: ['beds'], ASLEEP: ['asleep'] },
    },
    pt: {
      title: 'Sono Gostoso',
      text: 'Agora ela estava com {SONO}. Ela {SUBIU} a escada e achou três {CAMAS}. A grande era alta demais. A do meio era baixa demais. A pequena era certinha, e ela {DORMIU} na hora.',
      rows: 5,
      cols: 4,
      ink: { SONO: ['sleepy'], SUBIU: ['upstairs'], CAMAS: ['beds'], DORMIU: ['asleep'] },
    },
  },
  {
    id: 'here-she-is',
    en: {
      title: 'Here She Is!',
      text: 'The three bears came {HOME}. “Someone’s been eating my porridge!” said Papa Bear. “Someone’s been sitting in my chair!” said Mama Bear. “Someone’s been sleeping in my bed, and here she is!” said Baby Bear. Goldilocks {WOKE} up with a {JUMP}. “{SORRY}!” she cried, and she {RAN} all the way back to her mother.',
      rows: 5,
      cols: 4,
      ink: { HOME: ['home'], WOKE: ['woke'], JUMP: ['jump'], SORRY: ['sorry'], RAN: ['ran'] },
    },
    pt: {
      title: 'Olha Ela Aqui!',
      seed: 1,
      text: 'Os três ursos voltaram para a {CASINHA}. “Alguém comeu o meu mingau!”, disse o Papai Urso. “Alguém sentou na minha cadeira!”, disse a Mamãe Ursa. “Alguém está dormindo na minha cama, e olha ela aqui!”, disse o Ursinho. Cachinhos Dourados {ACORDOU} num pulo. “{DESCULPA}!”, gritou ela, e {CORREU} de volta para a mamãe dela.',
      rows: 7,
      cols: 4,
      ink: { CASINHA: ['home'], ACORDOU: ['woke', 'jump'], DESCULPA: ['sorry'], CORREU: ['ran'] },
    },
  },
];
