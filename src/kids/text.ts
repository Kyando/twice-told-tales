import type { Lang } from './story.ts';

/** The colouring book's own words, in each of its languages. */
const TEXT = {
  en: {
    app: 'Find & Colour',
    langName: 'English',
    pages: 'The pages',
    start: 'Open the book',
    keepGoing: 'Keep going',
    pageOf: 'Page {n} of {count}',
    find: 'Find the coloured words in the letters. Drag across them!',
    foundSome: '{found} of {count} words found',
    foundAll: 'You found every word! Now colour the picture.',
    colourIn: 'Tap a colour, then tap the picture.',
    home: 'Back to the book',
    prev: 'Previous page',
    next: 'Next page',
    read: 'Read it to me',
    stop: 'Stop reading',
    eraser: 'Eraser',
    print: 'Print this page',
    printBook: 'Print the whole book',
    clear: 'Clear the colours',
    clearConfirm: 'Clear all the colours on this picture?',
    theEnd: 'The End',
    language: 'Language',
    done: 'Coloured in',
    // The printed book.
    subtitle: 'A story to read, find and colour',
    belongs: 'This book belongs to',
    howTitle: 'How to play',
    how1: 'Read the story. The words in boxes are hidden in the letters.',
    how2: 'Find each word in the letters and draw a line along it. Words go across, up or down, and can turn a corner. Never diagonally!',
    how3: 'Tick the word under the letters. When you have found them all, colour in the picture.',
    tryColours: 'Try your colours here',
    answers: 'Answers',
    drawYou: 'Draw yourself with the three bears!',
    readOnline: 'Read and colour it on screen too:',
  },
  pt: {
    app: 'Encontre e Pinte',
    langName: 'Português',
    pages: 'As páginas',
    start: 'Abrir o livro',
    keepGoing: 'Continuar',
    pageOf: 'Página {n} de {count}',
    find: 'Encontre as palavras coloridas nas letras. Arraste o dedo por cima delas!',
    foundSome: '{found} de {count} palavras encontradas',
    foundAll: 'Você encontrou todas as palavras! Agora pinte o desenho.',
    colourIn: 'Toque numa cor e depois no desenho.',
    home: 'Voltar ao livro',
    prev: 'Página anterior',
    next: 'Próxima página',
    read: 'Ler para mim',
    stop: 'Parar a leitura',
    eraser: 'Borracha',
    print: 'Imprimir esta página',
    printBook: 'Imprimir o livro todo',
    clear: 'Apagar as cores',
    clearConfirm: 'Apagar todas as cores deste desenho?',
    theEnd: 'Fim',
    language: 'Idioma',
    done: 'Pintado',
    subtitle: 'Uma história para ler, encontrar e pintar',
    belongs: 'Este livro pertence a',
    howTitle: 'Como brincar',
    how1: 'Leia a história. As palavras nos quadrinhos estão escondidas nas letras.',
    how2: 'Encontre cada palavra nas letras e passe um traço por cima dela. As palavras vão para o lado, para cima ou para baixo, e podem virar uma esquina. Nunca na diagonal!',
    how3: 'Marque a palavra embaixo das letras. Quando encontrar todas, pinte o desenho.',
    tryColours: 'Teste suas cores aqui',
    answers: 'Respostas',
    drawYou: 'Desenhe você com os três ursos!',
    readOnline: 'Leia e pinte na tela também:',
  },
} satisfies Record<Lang, Record<string, string>>;

export type TextKey = keyof (typeof TEXT)['en'];

export const say = (lang: Lang, key: TextKey, vars: Record<string, string | number> = {}): string =>
  TEXT[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** The voice to read a scene aloud with (the browser's own, until recorded narration is made). */
export const SPEECH_LANG: Record<Lang, string> = { en: 'en-GB', pt: 'pt-BR' };
