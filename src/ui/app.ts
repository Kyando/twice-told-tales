import { BOOKS, FEATURED_BOOK, FREE_CHAPTERS, SHELVES, type ShelfId } from '../core/books.ts';
import { emptyProgress, loadSave, writeSave, type Clue, type LevelProgress } from '../game/save.ts';
import { Session } from '../game/session.ts';
import { detectLocale, setLocale, t, type MessageKey } from '../i18n/index.ts';
import { CATALOG } from '../levels/catalog.ts';
import { h } from './dom.ts';
import { ICONS } from './icons.ts';
import { FONTS } from './desk.ts';
import { openEdition } from './edition.ts';
import { turnPage } from './fx.ts';
import { LevelView } from './level-view.ts';
import { Library, type ChapterState } from './library.ts';
import { confirmAction, openModal, openSheet, popHandled, type SheetItem } from './overlay.ts';
import { Sfx } from './sfx.ts';
import { Shelf, type ShelfFeature } from './shelf.ts';

/** Where the player is: the shelf, a book's chapters, or a chapter (by its index in CATALOG). */
type Route = { screen: 'shelf' } | { screen: 'library'; book: string } | { screen: 'level'; index: number };

/**
 * What each history entry holds: the screen, and how deep it is (shelf 0, chapters 1, a chapter 2),
 * so stepping back knows which way to turn the page.
 */
interface Entry {
  route: Route;
  depth: number;
  /** Pushed by the game over its parent screen: stepping back leads there. */
  pushed?: boolean;
}

const depthOf = (route: Route): number => ({ shelf: 0, library: 1, level: 2 })[route.screen];

/** The game modes a link can ask for (?mode=…), by name; the old playtest names (?clue=…) still work. */
const LINK_MODES: Record<string, Clue | undefined> = { story: 'passage', passage: 'passage', words: 'list', list: 'list' };

/**
 * The game, screen by screen, as an app: shelf → a book's chapters → a chapter. Each screen has its
 * own bar (no site header). Every step deeper is a history entry, so the back button (a phone's,
 * or the browser's) steps back out the same way, one screen at a time, and leaves the game only
 * from the shelf; dialogs take part too (see overlay.ts).
 */
export class App {
  private readonly save = loadSave();
  private readonly sfx = new Sfx(this.save.settings.sound);
  private readonly main: HTMLElement;
  private view: LevelView | Library | Shelf | null = null;
  private route: Route = { screen: 'shelf' };
  /**
   * Chapters started since leaving the menus, so the arrows can step away (to look back at the
   * story) and return to the board as it was. Never saved: forgotten back in a menu.
   */
  private readonly playing = new Map<string, LevelProgress>();

  constructor(root: HTMLElement) {
    setLocale(detectLocale());
    document.title = t('game.name');
    this.main = h('div', { class: 'main' });
    root.append(this.main);
    // The finished-chapter desk's typefaces, fetched early so it never waits for them.
    FONTS.forEach((f) => void document.fonts?.load(f).catch(() => undefined));

    if (!CATALOG.length) {
      this.main.append(h('p', { class: 'empty' }, t('empty')));
      return;
    }
    this.applyLinkSettings();
    window.addEventListener('popstate', (e) => this.onBack(e.state as Partial<Entry> | null));
    // A reload keeps the screen the player was on; anything else starts on the shelf.
    const was = history.state as Partial<Entry> | null;
    const kept = was?.route && this.valid(was.route);
    const start = kept ? was.route! : { screen: 'shelf' as const };
    history.replaceState({ route: start, depth: depthOf(start), pushed: kept && was.pushed } satisfies Entry, '');
    // A new player isn't shown the rules: the shelf points them to a book, and its first chapter
    // walks them through (see LevelView's guide). How to play stays in the menus.
    this.show(start, true);
  }

  private persist(): void {
    writeSave(this.save);
  }

  /**
   * A shared link can set the game up: ?mode=story (the passage is the clue) or ?mode=words (the word
   * list), and ?voice=american or ?voice=british. They're kept, as if picked in the menu, and taken out
   * of the address, so reloading later doesn't undo a change made in the menu since.
   */
  private applyLinkSettings(): void {
    const url = new URL(location.href);
    const { settings } = this.save;
    const mode = url.searchParams.get('mode') ?? url.searchParams.get('clue');
    const clue = LINK_MODES[mode?.toLowerCase() ?? ''];
    const voice = url.searchParams.get('voice')?.toLowerCase();
    const accent = voice === 'british' || voice === 'american' ? voice : undefined;
    if (clue) settings.clue = clue;
    if (accent) settings.accent = accent;
    if (clue || accent) this.persist();
    const before = url.search;
    ['mode', 'clue', 'voice'].forEach((name) => url.searchParams.delete(name));
    if (url.search !== before) history.replaceState(history.state, '', url);
  }

  // ── navigation ──────────────────────────────────────────────────────────

  /** Can this screen be shown now? A chapter not yet reached can't. */
  private valid(route: Route): boolean {
    if (route.screen === 'library') return !!BOOKS[route.book] && this.chaptersOf(route.book).length > 0;
    if (route.screen === 'level') return !!CATALOG[route.index] && this.playable(route.index);
    return true;
  }

  /** Goes deeper (a new history entry), or across (replacing this one: chapter to chapter). */
  private go(route: Route, how: 'push' | 'replace'): void {
    if (!this.valid(route)) return;
    // Across keeps how this entry came to be: a chapter reached from the chapters still leads back there.
    const pushed = how === 'push' || !!(history.state as Entry | null)?.pushed;
    const entry: Entry = { route, depth: depthOf(route), pushed };
    if (how === 'push') history.pushState(entry, '');
    else history.replaceState(entry, '');
    this.show(route);
  }

  /** One screen up: back through the history when it leads there, so the stack stays true. */
  private up(): void {
    const depth = depthOf(this.route);
    if (depth === 0) return;
    const parent: Route = depth === 2 ? { screen: 'library', book: this.book } : { screen: 'shelf' };
    const here = history.state as Entry | null;
    if (here?.pushed && here.depth === depth) {
      history.back();
      return;
    }
    // Reached without its parent beneath (a link, a fresh start): the parent takes this entry's place.
    history.replaceState({ route: parent, depth: depthOf(parent), pushed: false } satisfies Entry, '');
    this.show(parent);
  }

  /** The back button pressed (or a dialog closed itself): show the screen of the entry reached. */
  private onBack(state: Partial<Entry> | null): void {
    if (popHandled()) return;
    const route = state?.route && this.valid(state.route) ? state.route : { screen: 'shelf' as const };
    if (this.same(route)) return;
    this.show(route);
  }

  private same(route: Route): boolean {
    const now = this.route;
    if (route.screen !== now.screen) return false;
    if (route.screen === 'library' && now.screen === 'library') return route.book === now.book;
    if (route.screen === 'level' && now.screen === 'level') return route.index === now.index;
    return true;
  }

  /** The book open now: the library's, or the chapter's. */
  private get book(): string {
    const r = this.route;
    return r.screen === 'library' ? r.book : r.screen === 'level' ? CATALOG[r.index].def.book : '';
  }

  /**
   * Puts a screen up. Going deeper into the book turns the page forward, coming back turns it back;
   * between chapters, it turns the way the story goes. `still` swaps without turning.
   */
  private show(route: Route, still = false): void {
    const from = this.route;
    const deeper = depthOf(route) - depthOf(from);
    const forward = deeper !== 0 ? deeper > 0 : route.screen === 'level' && from.screen === 'level' ? route.index >= from.index : true;
    // Leaving the chapters for a menu forgets boards in progress.
    if (route.screen !== 'level') this.playing.clear();
    this.route = route;
    const view = route.screen === 'shelf' ? this.makeShelf() : route.screen === 'library' ? this.makeLibrary(route.book) : this.makeLevel(route.index);
    const old = this.view;
    old?.destroy();
    this.view = view;
    if (old && !still) turnPage(this.main, old.el, view.el, forward);
    else this.main.replaceChildren(view.el);
    if (view instanceof Library) view.reveal();
  }

  /** The same screen again, rebuilt (after its progress changed), without turning a page. */
  private refresh(): void {
    this.show(this.route, true);
  }

  // ── chapters ────────────────────────────────────────────────────────────

  /** A book's chapters, as indices into CATALOG, in reading order. */
  private chaptersOf(book: string): number[] {
    return CATALOG.flatMap((entry, i) => (entry.def.book === book ? [i] : []));
  }

  /** The chapter before or after this one in the same book; undefined at either end. */
  private neighbour(index: number, step: -1 | 1): number | undefined {
    const chapters = this.chaptersOf(CATALOG[index].def.book);
    return chapters[chapters.indexOf(index) + step];
  }

  private isDone(index: number): boolean {
    return !!this.save.levels[CATALOG[index].def.id]?.done;
  }

  /** The paid shelf a book is on, if the player doesn't own it yet. */
  private unowned(book: string): ShelfId | undefined {
    const shelf = BOOKS[book]?.shelf;
    return shelf && !this.save.shelves.includes(shelf) ? shelf : undefined;
  }

  /**
   * Each book's chapters open in order: the first, any finished, and the one after a finished
   * chapter. Names are only hidden once the story has introduced them, so it reads in order. A
   * paid book the player doesn't own stops after its free chapters.
   */
  private stateOf(index: number): ChapterState {
    if (this.isDone(index)) return 'done';
    const book = CATALOG[index].def.book;
    if (this.unowned(book) && this.chaptersOf(book).indexOf(index) >= FREE_CHAPTERS) return 'sealed';
    const prev = this.neighbour(index, -1);
    if (prev === undefined || this.isDone(prev)) return 'open';
    return 'locked';
  }

  private playable(index: number): boolean {
    const state = this.stateOf(index);
    return state === 'done' || state === 'open';
  }

  /** Where to pick up in a book: its first chapter not yet finished; undefined once it's done. */
  private currentChapter(book: string): number | undefined {
    return this.chaptersOf(book).find((i) => this.stateOf(i) === 'open');
  }

  // ── screens ─────────────────────────────────────────────────────────────

  /** The first screen: every book, with how far the player has read it. */
  private makeShelf(): Shelf {
    const books = Object.entries(BOOKS).flatMap(([key, book]) => {
      const chapters = this.chaptersOf(key);
      if (!chapters.length) return [];
      // A paid book not owned yet counts only its free chapters.
      const sample = !!this.unowned(key);
      const open = sample ? chapters.slice(0, FREE_CHAPTERS) : chapters;
      return [{ key, book, sample, total: open.length, done: open.filter((i) => this.isDone(i)).length }];
    });
    return new Shelf({
      books,
      feature: this.featured(),
      onOpen: (key) => this.go({ screen: 'library', book: key }, 'push'),
      onSettings: () => this.openSettings(),
    });
  }

  /**
   * The book the shelf puts first, with a button straight into it: for a new player, FEATURED_BOOK
   * (start here); after that, the book last opened, at the chapter to read next (continue).
   */
  private featured(): ShelfFeature | undefined {
    const fresh = !Object.keys(this.save.levels).length;
    const key = fresh ? FEATURED_BOOK : this.save.settings.lastBook;
    if (!key || !BOOKS[key]) return undefined;
    const chapters = this.chaptersOf(key);
    const next = this.currentChapter(key);
    if (!chapters.length || next === undefined) return undefined;
    const def = CATALOG[next].def;
    return {
      key,
      book: BOOKS[key],
      fresh,
      scenes: chapters.length,
      next: { chapter: def.chapter, title: def.title },
      onGo: () => {
        // The book's chapters go under the chapter, so stepping back leads there, then to the shelf.
        const library: Route = { screen: 'library', book: key };
        history.pushState({ route: library, depth: depthOf(library), pushed: true } satisfies Entry, '');
        this.go({ screen: 'level', index: next }, 'push');
      },
    };
  }

  /** A book's chapters, finished ones showing their picture. */
  private makeLibrary(book: string): Library {
    const chapters = this.chaptersOf(book);
    const current = this.currentChapter(book);
    return new Library({
      chapters: chapters.map((i) => ({ def: CATALOG[i].def, state: this.stateOf(i), sealed: !!this.save.levels[CATALOG[i].def.id]?.unaided })),
      onEdition: () => this.openEdition(book),
      current: current === undefined ? -1 : chapters.indexOf(current),
      onOpen: (i) => this.go({ screen: 'level', index: chapters[i] }, 'push'),
      onBack: () => this.up(),
      onSettings: () => this.openSettings(book),
      shelf: this.unowned(book),
      onUnlock: (shelf) => this.openUnlock(shelf),
    });
  }

  /** A chapter: new, finished, or as it was left if the arrows only stepped away from it. */
  private makeLevel(index: number): LevelView {
    const entry = CATALOG[index];
    const id = entry.def.id;
    let progress = this.playing.get(id);
    if (!progress) {
      progress = this.save.levels[id]?.done
        ? { found: entry.puzzle.words.map((w) => w.text), done: true, misses: 0, hints: 0 }
        : emptyProgress();
      this.playing.set(id, progress);
    }
    if (this.save.settings.lastBook !== entry.def.book) {
      this.save.settings.lastBook = entry.def.book;
      this.persist();
    }
    const session = new Session(entry.puzzle, progress, () => {
      if (!progress.done) return;
      // Every word found just now, with no hint taken: the chapter earns its seal (and keeps it).
      const unaided = progress.found.length === entry.puzzle.words.length && progress.hints === 0;
      const kept = this.save.levels[id];
      if (kept && (kept.unaided || !unaided)) return;
      this.save.levels[id] = unaided ? { done: true, unaided: true } : { done: true };
      this.persist();
    });
    const prev = this.neighbour(index, -1);
    const next = this.neighbour(index, 1);
    // The next chapter's picture, so it's ready when the player gets there.
    if (next !== undefined) new Image().src = CATALOG[next].def.story.image;
    return new LevelView({
      session,
      sfx: this.sfx,
      onPrev: prev === undefined ? undefined : () => this.go({ screen: 'level', index: prev }, 'replace'),
      onNext: next === undefined ? undefined : () => this.go({ screen: 'level', index: next }, 'replace'),
      nextLocked: next !== undefined && !this.playable(next),
      nextTitle: next === undefined ? undefined : CATALOG[next].def.title,
      onChapters: () => this.up(),
      menuItems: () => [this.soundItem(), this.accentItem(), this.clueItem(), this.helpItem()],
      clue: this.save.settings.clue,
      accent: this.save.settings.accent,
      intro: true,
      guide: !this.save.settings.seenHelp,
      onGuided: () => {
        this.save.settings.seenHelp = true;
        this.persist();
      },
      sealed: () => !!this.save.levels[id]?.unaided,
      // The book's last chapter ends the book: its desk opens the player's edition of it.
      onEdition: next === undefined ? () => this.openEdition(entry.def.book, true) : undefined,
    });
  }

  // ── menus and dialogs ───────────────────────────────────────────────────

  /** The player's edition of a book: the chapters pieced together so far, read through. */
  private openEdition(book: string, finale = false): void {
    const chapters = this.chaptersOf(book);
    const next = this.currentChapter(book);
    openEdition({
      book: BOOKS[book],
      chapters: chapters.filter((i) => this.isDone(i)).map((i) => ({ def: CATALOG[i].def, sealed: !!this.save.levels[CATALOG[i].def.id]?.unaided })),
      total: chapters.length,
      next: next === undefined ? undefined : CATALOG[next].def,
      finale,
      accent: this.save.settings.accent,
    });
  }

  /** What a paid shelf holds. Buying comes with the store releases; until then, this says so. */
  private openUnlock(shelf: ShelfId): void {
    const { title, blurb } = SHELVES[shelf];
    const modal = openModal({
      title,
      className: 'modal--unlock',
      body: h('div', { class: 'unlock' }, h('p', {}, t('unlock.body', { blurb })), h('p', { class: 'unlock-soon' }, t('unlock.soon'))),
      actions: [h('button', { type: 'button', class: 'btn btn--primary', onclick: () => modal.close() }, t('unlock.ok'))],
    });
  }

  private soundItem(): SheetItem {
    return { icon: ICONS.soundOn, label: t('settings.sound'), on: this.save.settings.sound, onSelect: () => this.toggleSound() };
  }

  /** The narrator's voice: American by default, or British. Switching rebuilds an open chapter with it. */
  private accentItem(): SheetItem {
    return {
      icon: ICONS.listen,
      label: t('settings.british'),
      on: this.save.settings.accent === 'british',
      onSelect: () => {
        this.save.settings.accent = this.save.settings.accent === 'british' ? 'american' : 'british';
        this.persist();
        if (this.route.screen === 'level') this.refresh();
      },
    };
  }

  /** While both are playtested: the old list of words to find, instead of the unmarked passage. */
  private clueItem(): SheetItem {
    return {
      icon: ICONS.list,
      label: t('settings.clueList'),
      on: this.save.settings.clue === 'list',
      onSelect: () => {
        this.save.settings.clue = this.save.settings.clue === 'list' ? 'passage' : 'list';
        this.persist();
        if (this.route.screen === 'level') this.refresh();
      },
    };
  }

  private helpItem(): SheetItem {
    return { icon: ICONS.help, label: t('settings.help'), onSelect: () => this.openHelp() };
  }

  /** Settings, from the shelf or (with `book`) a book's chapters, where starting it again belongs. */
  private openSettings(book?: string): void {
    const items: SheetItem[] = [this.soundItem(), this.accentItem(), this.clueItem(), this.helpItem(), { icon: ICONS.info, label: t('settings.credits'), onSelect: () => this.openCredits() }];
    if (book && this.chaptersOf(book).some((i) => this.isDone(i))) {
      items.push({ icon: ICONS.restart, label: t('settings.eraseBook'), danger: true, onSelect: () => this.confirmErase(book) });
    } else if (!book && Object.keys(this.save.levels).length) {
      items.push({ icon: ICONS.restart, label: t('settings.eraseAll'), danger: true, onSelect: () => this.confirmErase() });
    }
    openSheet(t('settings.title'), items);
  }

  /** The rules in three small pictures: shown by itself the first time, as a welcome. */
  private openHelp(first = false): void {
    // A little board with TALE traced through it, bending once.
    const word = ['0,0', '0,1', '1,1', '1,2'];
    const board = h(
      'div',
      { class: 'help-board', 'aria-hidden': 'true' },
      ...['TAOR', 'SLEW', 'INKD'].flatMap((row, r) =>
        [...row].map((letter, c) => {
          const i = word.indexOf(`${r},${c}`);
          return h('span', i < 0 ? {} : { class: 'is-word', style: `--i: ${i}` }, letter);
        }),
      ),
    );
    // A painted plate (A Christmas Carol's cover), coming in piece by piece.
    const cover = BOOKS['a-christmas-carol'].cover;
    const picture = h(
      'div',
      { class: 'help-picture', 'aria-hidden': 'true' },
      ...[0, 1, 2, 3].map((i) => h('span', { style: `--i: ${[0, 2, 3, 1][i]}; background-image: url("${cover}")` })),
    );
    const page = h(
      'div',
      { class: 'help-page', 'aria-hidden': 'true' },
      h('i'),
      h('i'),
      h('b', {}, 'TALE'),
      h('i'),
      h('i'),
    );
    const reading = this.save.settings.clue === 'passage';
    const step = (art: Node, title: MessageKey, body: MessageKey) =>
      h('li', { class: 'help-step' }, art, h('div', {}, h('h3', {}, t(title)), h('p', {}, t(body))));
    const modal = openModal({
      title: t(first ? 'help.welcome' : 'help.title'),
      className: 'modal--help',
      body: h(
        'div',
        { class: 'help' },
        h('p', { class: 'help-lead' }, t('help.passageLead')),
        h(
          'ol',
          { class: 'help-steps' },
          // Reading comes first: the passage is where the words are found (marked, with the easier help).
          step(page, 'help.passageRead', reading ? 'help.passageReadBody' : 'help.markedReadBody'),
          step(board, 'help.trace', 'help.traceBody'),
          step(picture, 'help.reveal', 'help.passageRevealBody'),
        ),
        h('p', { class: 'help-note' }, t('help.note')),
      ),
      actions: [h('button', { type: 'button', class: 'btn btn--primary', onclick: () => modal.close() }, t('help.go'))],
    });
  }

  /** The books, their authors, and whose pictures they carry: all in the public domain. */
  private openCredits(): void {
    const books = Object.entries(BOOKS).flatMap(([key, book]) => {
      const artists = [...new Set(this.chaptersOf(key).map((i) => CATALOG[i].def.story.credit))];
      return artists.length ? [h('li', {}, h('b', {}, book.title), ` · ${book.author}, ${book.year}`, h('br', {}), h('small', {}, artists.join(' · ')))] : [];
    });
    openModal({
      title: t('credits.title'),
      className: 'modal--credits',
      body: h('div', { class: 'credits-text' }, h('p', {}, t('credits.intro')), h('ul', {}, ...books)),
    });
  }

  /** Asks before wiping a book's progress (or, from the shelf, every book's); sound and the seen help stay. */
  private confirmErase(book?: string): void {
    confirmAction({
      title: t(book ? 'erase.title' : 'erase.allTitle'),
      body: t(book ? 'erase.body' : 'erase.allBody'),
      cancel: t('erase.cancel'),
      confirm: t('erase.confirm'),
      onConfirm: () => {
        if (book) for (const i of this.chaptersOf(book)) delete this.save.levels[CATALOG[i].def.id];
        else this.save.levels = {};
        this.persist();
        this.refresh();
      },
    });
  }

  private toggleSound(): void {
    this.save.settings.sound = !this.save.settings.sound;
    this.sfx.enabled = this.save.settings.sound;
    this.persist();
    if (this.sfx.enabled) this.sfx.pick();
  }
}
