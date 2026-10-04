<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import { useFileStore } from '@/utils/fileStore'
import { useAuthStore } from '@/utils/authStore'
import { useProgressStore } from '@/utils/progressStore'
import { useSettingsStore, type StreamQuality } from '@/utils/settingsStore'
import type { Episode, MediaInfo, PlaybackMethod } from '@/types/media'
import { episodeTitle, formatFileSize, formatResolution } from '@/utils/format'
import VideoPlayer from '@/components/player/VideoPlayer.vue'
import EpisodeDetails from '@/components/player/EpisodeDetails.vue'
import UpNextList from '@/components/player/UpNextList.vue'
import IconArrowLeft from '@/components/ui/IconArrowLeft.vue'
import MetaChip from '@/components/ui/MetaChip.vue'
import { API_BASE_URL } from '@/config'

const BACKEND_BASE_URL = API_BASE_URL

/** How often the resume position is saved while playing. */
const PROGRESS_INTERVAL_MS = 10_000
/** Don't resume this close to the end: start over instead. */
const RESUME_END_MARGIN_SECONDS = 15

const QUALITY_HEIGHTS: Record<Exclude<StreamQuality, 'source'>, number> = {
  '360p': 360,
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
}

const METHOD_LABELS: Record<PlaybackMethod, string> = {
  direct: 'Lecture directe',
  remux: 'Remux',
  transcode: 'Transcodage',
}

/** Everything the `<VideoPlayer>` needs, swapped atomically. */
interface Playback {
  episodeId: string
  src: string
  method: PlaybackMethod
  duration: number | null
  startAt: number
}

const props = defineProps<{ id: string }>()

const router = useRouter()
const fileStore = useFileStore()
const authStore = useAuthStore()
const progressStore = useProgressStore()
const settings = useSettingsStore()

/** Episode id currently loaded in the player (mutates without navigation). */
const currentId = ref(props.id)

const mediaInfo = ref<MediaInfo | null>(null)
const audioIndex = ref(0)
/** Set when the browser refused to play the original file. */
const forceConvert = ref(false)
const playback = ref<Playback | null>(null)
const playbackError = ref<string | null>(null)
const libraryLoaded = ref(false)

/** Episode object currently playing, looked up across the whole library. */
const currentEpisode = computed(() =>
  fileStore.allEpisodes.find(episode => String(episode.id) === currentId.value) ?? null,
)

/**
 * Locate the anime + season that contain the current episode.
 * Returns null while the library is still loading.
 */
const currentContext = computed(() => {
  for (const anime of fileStore.animes) {
    for (const season of anime.seasons) {
      if (season.episodes.some(episode => String(episode.id) === currentId.value)) {
        return { anime, season }
      }
    }
  }
  return null
})

const currentAnime = computed(() => currentContext.value?.anime ?? null)
const currentSeason = computed(() => currentContext.value?.season ?? null)

/** Every episode of the anime in viewing order, so "next" crosses seasons. */
const animeEpisodes = computed<Episode[]>(() =>
  currentAnime.value?.seasons.flatMap(season => season.episodes) ?? [],
)

const currentIndex = computed(() =>
  animeEpisodes.value.findIndex(episode => String(episode.id) === currentId.value),
)

const nextEpisode = computed<Episode | null>(() =>
  currentIndex.value >= 0 ? animeEpisodes.value[currentIndex.value + 1] ?? null : null,
)

const prevEpisode = computed<Episode | null>(() =>
  currentIndex.value > 0 ? animeEpisodes.value[currentIndex.value - 1] ?? null : null,
)

const upcomingEpisodes = computed(() =>
  currentIndex.value >= 0 ? animeEpisodes.value.slice(currentIndex.value + 1) : [],
)

const isWatched = computed(() =>
  currentEpisode.value ? progressStore.isWatched(currentEpisode.value.id) : false,
)

// ── Stream selection ───────────────────────────────────────────────────

const audioOptions = computed(() =>
  (mediaInfo.value?.audio ?? []).map(track => ({
    value: track.index,
    label: (track.language ?? track.title ?? `Piste ${track.index + 1}`).toUpperCase(),
    hint: `${track.codec} ${track.channels > 2 ? `${track.channels - 1}.1` : 'stéréo'}`,
  })),
)

const selectedQuality = computed<StreamQuality>(() => settings.effectiveQuality ?? 'source')

/** Source plus every preset that would actually shrink the video. */
const qualityOptions = computed(() => {
  const sourceHeight = mediaInfo.value?.video?.height ?? currentEpisode.value?.height ?? 0
  const presets = (Object.keys(QUALITY_HEIGHTS) as Exclude<StreamQuality, 'source'>[])
    .filter(quality => !sourceHeight || QUALITY_HEIGHTS[quality] < sourceHeight)
    .sort((a, b) => QUALITY_HEIGHTS[b] - QUALITY_HEIGHTS[a])
    .map(quality => ({ value: quality as StreamQuality, label: quality }))
  return [
    { value: 'source' as StreamQuality, label: 'Source', hint: formatResolution(sourceHeight) },
    ...presets,
  ]
})

/**
 * Cheapest way to deliver the current episode given the user's
 * choices: a forced quality always transcodes, a non-default audio
 * track needs at least a remux, otherwise follow the server's verdict.
 */
function resolveMethod(): PlaybackMethod {
  const info = mediaInfo.value
  if (settings.effectiveQuality) return 'transcode'
  if (!info) return forceConvert.value ? 'transcode' : 'direct'
  if (info.method === 'direct' && audioIndex.value === 0 && !forceConvert.value) return 'direct'
  return info.canCopyVideo ? 'remux' : 'transcode'
}

/**
 * Authenticated stream URL for the current episode. Converted streams
 * carry the parameters ffmpeg needs server-side.
 */
function buildStreamUrl(episodeId: string, method: PlaybackMethod): string {
  const params = new URLSearchParams({ token: authStore.token ?? '' })
  if (method !== 'direct') {
    if (settings.effectiveQuality) params.set('quality', settings.effectiveQuality)
    else params.set('convert', '1')
    if (audioIndex.value > 0) params.set('audio', String(audioIndex.value))
  }
  return `${BACKEND_BASE_URL}/stream/${episodeId}?${params.toString()}`
}

/** Recompute the stream for the episode already in the player. */
function rebuildPlayback() {
  if (!playback.value) return
  const method = resolveMethod()
  playback.value = {
    ...playback.value,
    method,
    src: buildStreamUrl(playback.value.episodeId, method),
  }
}

let prepareToken = 0

/** Analyse an episode's file, then hand a ready-to-play stream to the player. */
async function prepareEpisode(episodeId: string) {
  const token = ++prepareToken
  playbackError.value = null

  let info: MediaInfo | null = null
  try {
    info = (await api.get<MediaInfo>(`/episodes/${episodeId}/media`)).data
  } catch {
    /* the player will try direct play */
  }
  if (token !== prepareToken) return

  mediaInfo.value = info
  forceConvert.value = false

  const preferredLanguage = settings.preferredAudioLanguage.trim().toLowerCase()
  const preferredTrack = preferredLanguage
    ? info?.audio.find(track => track.language?.toLowerCase().startsWith(preferredLanguage))
    : undefined
  audioIndex.value = preferredTrack?.index ?? 0

  const duration = info?.duration ?? currentEpisode.value?.duration ?? null
  const saved = progressStore.positionOf(Number(episodeId))
  const startAt = duration && saved > duration - RESUME_END_MARGIN_SECONDS ? 0 : saved

  const method = resolveMethod()
  // Reports still in flight belong to the episode being replaced.
  latest = null
  playback.value = {
    episodeId,
    src: buildStreamUrl(episodeId, method),
    method,
    duration,
    startAt,
  }
}

function selectAudio(index: number) {
  audioIndex.value = index
  rebuildPlayback()
}

function selectQuality(quality: StreamQuality) {
  settings.setQuality(quality)
  rebuildPlayback()
}

/** The browser couldn't decode the stream: fall back to a conversion once. */
function onPlaybackError() {
  if (playback.value?.method === 'direct' && !forceConvert.value) {
    forceConvert.value = true
    rebuildPlayback()
    return
  }
  playbackError.value = 'Lecture impossible : ce fichier ne peut pas être décodé.'
}

// ── Progress reporting ─────────────────────────────────────────────────

let latest: { position: number; duration: number; paused: boolean } | null = null
let lastSentAt = 0
let lastSentPaused: boolean | null = null

function flushProgress(keepalive = false) {
  const state = playback.value
  if (!state || !latest) return
  const payload = {
    position: latest.position,
    duration: latest.duration || state.duration,
    method: state.method,
    paused: latest.paused,
  }
  lastSentAt = Date.now()
  lastSentPaused = latest.paused

  if (keepalive) {
    // The page is going away: the request must outlive it.
    api.put(`/episodes/${state.episodeId}/progress`, payload, { keepalive: true }).catch(() => {})
    return
  }
  progressStore.report(Number(state.episodeId), payload).catch(() => {})
}

function onProgress(report: { position: number; duration: number; paused: boolean }) {
  latest = report
  const due = Date.now() - lastSentAt >= PROGRESS_INTERVAL_MS
  if (due || report.paused !== lastSentPaused) flushProgress()
}

function onPageHide() {
  flushProgress(true)
}

// ── Navigation ─────────────────────────────────────────────────────────

/** Swap the active episode without leaving the player route. */
function selectEpisode(episode: Episode) {
  router.replace({ name: 'player', params: { id: episode.id } })
}

function goToAnime() {
  if (currentAnime.value) {
    router.push({ name: 'anime', params: { id: currentAnime.value.id } })
  }
}

function toggleWatched() {
  if (!currentEpisode.value) return
  progressStore.setEpisodeWatched(currentEpisode.value.id, !isWatched.value)
}

onMounted(async () => {
  window.addEventListener('pagehide', onPageHide)
  await Promise.all([
    fileStore.animes.length === 0 ? fileStore.getAll() : Promise.resolve(),
    progressStore.ensureLoaded().catch(() => {}),
  ])
  libraryLoaded.value = true
  await prepareEpisode(currentId.value)
})

onUnmounted(() => {
  window.removeEventListener('pagehide', onPageHide)
  prepareToken++
  flushProgress()
  api.delete('/progress/session').catch(() => {})
})

watch(
  () => props.id,
  newId => {
    if (newId === currentId.value) return
    // Save where the previous episode stopped before switching.
    flushProgress()
    latest = null
    currentId.value = newId
    if (libraryLoaded.value) prepareEpisode(newId)
  },
)
</script>

<template>
  <section class="player-page">
    <div class="player-shell">
      <router-link
        :to="currentAnime ? { name: 'anime', params: { id: currentAnime.id } } : '/'"
        class="back-link"
      >
        <IconArrowLeft />
        {{ currentAnime?.name ?? 'Bibliothèque' }}
      </router-link>

      <div v-if="libraryLoaded && !currentEpisode" class="player-empty">
        <p>Épisode introuvable.</p>
        <router-link to="/">Retour à la bibliothèque</router-link>
      </div>

      <div v-else class="player-grid">
        <div class="player-main">
          <VideoPlayer
            v-if="currentEpisode && playback"
            :episode-id="playback.episodeId"
            :src="playback.src"
            :seekable="playback.method === 'direct'"
            :snap-to-keyframe="playback.method === 'remux'"
            :known-duration="playback.duration"
            :start-at="playback.startAt"
            :autoplay="false"
            :autoplay-next="settings.autoplayNext"
            :title="episodeTitle(currentEpisode)"
            :season-name="currentSeason?.name ?? ''"
            :anime-name="currentAnime?.name ?? ''"
            :method-label="METHOD_LABELS[playback.method]"
            :chapters="mediaInfo?.chapters ?? []"
            :audio-options="audioOptions"
            :selected-audio="audioIndex"
            :quality-options="qualityOptions"
            :selected-quality="selectedQuality"
            :next-episode="nextEpisode"
            :prev-episode="prevEpisode"
            @play-episode="selectEpisode"
            @go-anime="goToAnime"
            @go-season="goToAnime"
            @progress="onProgress"
            @playback-error="onPlaybackError"
            @select-audio="selectAudio"
            @select-quality="selectQuality"
          />
          <div v-else class="player-placeholder">
            <div class="loader" />
          </div>

          <p v-if="playbackError" class="player-error" role="alert">{{ playbackError }}</p>

          <div v-if="currentEpisode" class="player-toolbar">
            <div class="media-chips">
              <MetaChip v-if="playback">{{ METHOD_LABELS[playback.method] }}</MetaChip>
              <MetaChip v-if="mediaInfo?.video">
                {{ formatResolution(mediaInfo.video.height) }} · {{ mediaInfo.video.codec.toUpperCase() }}
              </MetaChip>
              <MetaChip v-if="mediaInfo?.audio.length">
                {{ mediaInfo.audio[audioIndex]?.codec.toUpperCase() }}
              </MetaChip>
              <MetaChip v-if="mediaInfo">{{ mediaInfo.container.toUpperCase() }}</MetaChip>
              <MetaChip>{{ formatFileSize(currentEpisode.size) }}</MetaChip>
            </div>
            <button class="watched-btn" :class="{ active: isWatched }" @click="toggleWatched">
              {{ isWatched ? '✓ Vu' : 'Marquer comme vu' }}
            </button>
          </div>

          <EpisodeDetails
            v-if="currentEpisode"
            :episode="currentEpisode"
            :anime="currentAnime"
            class="mt-4"
          />
        </div>

        <UpNextList :episodes="upcomingEpisodes" @select="selectEpisode" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.player-page {
  background: var(--c-bg);
  color: var(--c-text);
  min-height: 100vh;
  padding: 32px 28px 80px;
}
.player-shell {
  max-width: 1400px;
  margin: 0 auto;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-muted);
  text-decoration: none;
  margin-bottom: 24px;
  letter-spacing: .02em;
  transition: color var(--t-fast);
}
.back-link:hover { color: var(--c-text); }

.player-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 32px;
}

.player-main { min-width: 0; }
.mt-4 { margin-top: 1rem; }

.player-placeholder {
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.loader {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, .2);
  border-top-color: #fff;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.player-empty {
  text-align: center;
  padding: 80px 0;
  color: var(--c-muted);
}
.player-error {
  margin: 12px 0 0;
  padding: 10px 14px;
  font-size: 13px;
  color: var(--c-accent);
  background: var(--c-surface);
  border: 1px solid var(--c-accent);
  border-radius: var(--r-md);
}

.player-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
}
.media-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.watched-btn {
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  color: var(--c-text-soft);
  font-size: 12px;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: 100px;
  cursor: pointer;
  transition: border-color var(--t-fast), color var(--t-fast);
}
.watched-btn:hover { color: var(--c-text); border-color: var(--c-muted); }
.watched-btn.active {
  color: var(--c-airing);
  border-color: var(--c-airing);
}

@media (max-width: 1024px) {
  .player-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .player-page { padding: 20px 14px 60px; }
}
</style>
