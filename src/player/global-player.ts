import { musicLabels, type MusicKey } from '../artist/artist-page.ts';
import {
  embedUrl,
  readMusicService,
  saveMusicService,
  soundcloudUrl,
  spotifyUri,
  youtubePlaylistId,
  type Player,
} from '../artist/music-player.ts';
import { createSoundCloudHandle, type SoundCloudHandle } from '../artist/soundcloud-widget-api.ts';
import { loadSpotifyUri, playSpotify, type SpotifyController } from '../artist/spotify-iframe-api.ts';
import { playYouTube, type YouTubeHandle } from '../artist/youtube-iframe-api.ts';
import {
  dedupeTracks,
  resolveTrackPlayer,
  stepTrack,
  type ActivePlayback,
  type PlayerTrack,
} from './player-state.ts';

export const PLAYER_CHANGE_EVENT = 'music-player:change';

const SPOTIFY_DOCK_HEIGHT = 80;

const playerTitles: Record<MusicKey, string> = {
  spotify: 'Spotify player',
  apple_music: 'Apple Music player',
  youtube: 'YouTube player',
  soundcloud: 'SoundCloud player',
};

interface PlayerElements {
  root: HTMLElement;
  artistLink: HTMLAnchorElement;
  artistName: HTMLElement;
  serviceButtons: HTMLButtonElement[];
  prevButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  toggleButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  body: HTMLElement;
  fallback: HTMLElement;
  status: HTMLElement;
  slot: HTMLElement;
}

let elements: PlayerElements | undefined;
let current: ActivePlayback | undefined;
let queue: PlayerTrack[] = [];
let fallbackQueuePromise: Promise<PlayerTrack[]> | undefined;
let activeProvider: MusicKey | undefined;
let spotifyController: SpotifyController | undefined;
let soundcloudHandle: SoundCloudHandle | undefined;
let youtubeHandle: YouTubeHandle | undefined;
let preferredService: MusicKey | undefined =
  typeof localStorage !== 'undefined' ? readMusicService(localStorage) : undefined;
let loadToken = 0;

function clearActiveHandles() {
  spotifyController?.destroy?.();
  spotifyController = undefined;
  soundcloudHandle = undefined;
  youtubeHandle?.destroy();
  youtubeHandle = undefined;
  activeProvider = undefined;
}

function notify() {
  document.dispatchEvent(new Event(PLAYER_CHANGE_EVENT));
}

function updateDockHeight() {
  if (!elements) return;
  const height = elements.root.hidden ? 0 : Math.ceil(elements.root.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--player-dock-height', `${height}px`);
}

function loadFallbackQueue(): Promise<PlayerTrack[]> {
  fallbackQueuePromise ??= fetch('/player-queue.json')
    .then((res) => (res.ok ? (res.json() as Promise<PlayerTrack[]>) : []))
    .catch(() => []);
  return fallbackQueuePromise;
}

function ensureQueue() {
  if (queue.length > 1) return;
  void loadFallbackQueue().then((allTracks) => {
    if (queue.length <= 1 && allTracks.length > 1) {
      queue = allTracks;
      renderChrome();
    }
  });
}

function renderChrome() {
  if (!elements) return;
  const { root, artistLink, artistName, serviceButtons, prevButton, nextButton, toggleButton, fallback } = elements;

  if (!current) {
    root.hidden = true;
    delete root.dataset.service;
    delete root.dataset.minimized;
    updateDockHeight();
    return;
  }

  root.hidden = false;
  root.dataset.service = current.service;
  root.dataset.minimized = String(current.minimized);

  artistLink.href = current.track.artistUrl;
  artistName.textContent = current.track.artistName;

  const available = new Set(current.track.players.map((item) => item.service));
  for (const button of serviceButtons) {
    const service = button.dataset.playerService as MusicKey;
    const hasService = available.has(service);
    button.hidden = !hasService || available.size <= 1;
    button.setAttribute('aria-pressed', String(service === current.service));
  }

  const canStep = queue.length > 1;
  prevButton.disabled = !canStep;
  nextButton.disabled = !canStep;

  toggleButton.setAttribute('aria-expanded', String(!current.minimized));
  toggleButton.setAttribute('aria-label', current.minimized ? 'Expand player' : 'Minimize player');

  if (current.fallbackFrom) {
    fallback.textContent = `${current.track.artistName} has no ${musicLabels[current.fallbackFrom]} player. Playing on ${musicLabels[current.service]}.`;
    fallback.hidden = false;
  } else {
    fallback.textContent = '';
    fallback.hidden = true;
  }

  updateDockHeight();
}

function showStatus(text: string | undefined) {
  if (!elements) return;
  if (text) {
    elements.status.textContent = text;
    elements.status.hidden = false;
  } else {
    elements.status.textContent = '';
    elements.status.hidden = true;
  }
}

function mountOrReuseIframe(slot: HTMLElement, src: string, service: MusicKey) {
  const existing = activeProvider === service ? slot.querySelector<HTMLIFrameElement>('iframe') : null;
  if (existing) {
    existing.src = src;
    existing.title = playerTitles[service];
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = playerTitles[service];
  iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  slot.replaceChildren(iframe);
  activeProvider = service;
}

async function loadEmbed(service: MusicKey, player: Player, token: number) {
  if (!elements) return;
  const { slot } = elements;
  showStatus(undefined);

  // 1. Spotify: reuse the live SpotifyController via loadEntity/loadUri.
  const uri = spotifyUri(player);
  if (uri) {
    if (activeProvider === 'spotify' && spotifyController && slot.querySelector('iframe') && loadSpotifyUri(spotifyController, uri)) {
      updateDockHeight();
      return;
    }

    clearActiveHandles();
    slot.replaceChildren();
    showStatus('Loading Spotify player…');
    const controller = await playSpotify(slot, uri, SPOTIFY_DOCK_HEIGHT, playerTitles.spotify).catch(() => undefined);
    if (token !== loadToken) {
      controller?.destroy?.();
      if (!current) slot.replaceChildren();
      return;
    }
    if (controller) {
      spotifyController = controller;
      activeProvider = 'spotify';
      showStatus(undefined);
      updateDockHeight();
      return;
    }
  }

  // 2. SoundCloud: reuse the live SoundCloud iframe via SC.Widget.load().
  const scArtistUrl = soundcloudUrl(player);
  if (scArtistUrl && player.kind === 'embed') {
    if (activeProvider === 'soundcloud' && soundcloudHandle && (await soundcloudHandle.load(scArtistUrl))) {
      if (token !== loadToken) return;
      updateDockHeight();
      return;
    }
    if (token !== loadToken) return;
    clearActiveHandles();
    soundcloudHandle = createSoundCloudHandle(slot, player.autoplaySrc ?? player.src, playerTitles.soundcloud);
    activeProvider = 'soundcloud';
    updateDockHeight();
    return;
  }

  // 3. YouTube: reuse the live YT.Player iframe via loadPlaylist().
  const ytPlaylist = youtubePlaylistId(player);
  if (ytPlaylist) {
    if (activeProvider === 'youtube' && youtubeHandle?.loadPlaylist(ytPlaylist)) {
      updateDockHeight();
      return;
    }

    clearActiveHandles();
    slot.replaceChildren();
    const handle = await playYouTube(slot, ytPlaylist, playerTitles.youtube).catch(() => undefined);
    if (token !== loadToken) {
      handle?.destroy();
      if (!current) slot.replaceChildren();
      return;
    }
    if (handle) {
      youtubeHandle = handle;
      activeProvider = 'youtube';
      updateDockHeight();
      return;
    }
  }

  // 4. Apple Music (or fallback if a JS API was blocked): keep any existing same-service iframe mounted while fetching.
  if (activeProvider !== service) {
    clearActiveHandles();
    slot.replaceChildren();
  }
  if (player.kind === 'apple-top-song' && !slot.querySelector('iframe')) {
    showStatus('Loading the top song…');
  }
  const src = await embedUrl(
    player.kind === 'embed' ? { ...player, src: player.autoplaySrc ?? player.src } : player,
  );
  if (token !== loadToken) return;
  if (!src) {
    clearActiveHandles();
    slot.replaceChildren();
    showStatus('Apple Music did not give a song for this artist.');
    updateDockHeight();
    return;
  }

  mountOrReuseIframe(slot, src, service);
  showStatus(undefined);
  updateDockHeight();
}

export function getPreferredService(): MusicKey | undefined {
  return preferredService;
}

export function isTrackPlaying(artistId: string, service?: MusicKey): boolean {
  if (!current || current.track.artistId !== artistId) return false;
  return service ? current.service === service : true;
}

function setMinimized(minimized: boolean): void {
  if (!current || current.minimized === minimized) return;
  current = { ...current, minimized };
  renderChrome();
  notify();
}

export function stopPlayback(): void {
  if (!current) return;
  loadToken += 1;
  current = undefined;
  clearActiveHandles();
  elements?.slot.replaceChildren();
  showStatus(undefined);
  renderChrome();
  notify();
}

export function playTrack(
  track: PlayerTrack,
  options: { service?: MusicKey; persistService?: boolean; queue?: PlayerTrack[] } = {},
): void {
  if (options.queue) {
    const unique = dedupeTracks(options.queue);
    if (unique.length > 1) queue = unique;
  }
  ensureQueue();

  if (options.persistService && options.service) {
    preferredService = options.service;
    saveMusicService(localStorage, options.service);
  }

  const resolved = resolveTrackPlayer(track, preferredService, options.service);
  if (!resolved) return;

  const keepMinimized = current?.minimized ?? false;

  // If the same artist and service are already playing, keep the iframe untouched.
  if (current && current.track.artistId === track.artistId && current.service === resolved.service) {
    current = { ...current, track, fallbackFrom: resolved.fallbackFrom, minimized: keepMinimized };
    renderChrome();
    notify();
    return;
  }

  const token = ++loadToken;
  current = {
    track,
    service: resolved.service,
    player: resolved.player,
    fallbackFrom: resolved.fallbackFrom,
    minimized: keepMinimized,
  };
  renderChrome();
  notify();
  void loadEmbed(resolved.service, resolved.player, token);
}

export function stepPlayback(delta: -1 | 1): void {
  if (!current) return;
  const next = stepTrack(queue, current.track.artistId, delta);
  if (next) playTrack(next);
}

export function toggleTrack(track: PlayerTrack, trackQueue?: PlayerTrack[]): void {
  if (current?.track.artistId === track.artistId) {
    stopPlayback();
  } else {
    playTrack(track, { queue: trackQueue });
  }
}

export function mountGlobalPlayer(root: HTMLElement): void {
  if (elements?.root === root) return;

  elements = {
    root,
    artistLink: root.querySelector<HTMLAnchorElement>('[data-player-artist]')!,
    artistName: root.querySelector<HTMLElement>('[data-player-artist-name]')!,
    serviceButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-player-service]')],
    prevButton: root.querySelector<HTMLButtonElement>('[data-player-prev]')!,
    nextButton: root.querySelector<HTMLButtonElement>('[data-player-next]')!,
    toggleButton: root.querySelector<HTMLButtonElement>('[data-player-toggle]')!,
    closeButton: root.querySelector<HTMLButtonElement>('[data-player-close]')!,
    body: root.querySelector<HTMLElement>('[data-player-body]')!,
    fallback: root.querySelector<HTMLElement>('[data-player-fallback]')!,
    status: root.querySelector<HTMLElement>('[data-player-status]')!,
    slot: root.querySelector<HTMLElement>('[data-player-slot]')!,
  };

  for (const button of elements.serviceButtons) {
    button.addEventListener('click', () => {
      if (!current) return;
      const service = button.dataset.playerService as MusicKey;
      playTrack(current.track, { service, persistService: true });
    });
  }

  elements.prevButton.addEventListener('click', () => stepPlayback(-1));
  elements.nextButton.addEventListener('click', () => stepPlayback(1));

  elements.toggleButton.addEventListener('click', () => {
    if (!current) return;
    setMinimized(!current.minimized);
  });

  elements.closeButton.addEventListener('click', () => {
    stopPlayback();
  });

  window.addEventListener('storage', () => {
    preferredService = readMusicService(localStorage);
    notify();
  });

  const resizeObserver = new ResizeObserver(updateDockHeight);
  resizeObserver.observe(root);

  renderChrome();
}
