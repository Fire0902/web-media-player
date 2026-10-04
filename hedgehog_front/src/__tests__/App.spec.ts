import { describe, it, expect } from 'vitest'

import {
  formatDuration,
  formatEpisodeNumber,
  formatPlaybackTime,
  formatResolution,
} from '../utils/format'

describe('format helpers', () => {
  it('formats playback time with and without hours', () => {
    expect(formatPlaybackTime(65)).toBe('1:05')
    expect(formatPlaybackTime(3725)).toBe('1:02:05')
    expect(formatPlaybackTime(Number.NaN)).toBe('0:00')
  })

  it('formats runtimes', () => {
    expect(formatDuration(1440)).toBe('24 min')
    expect(formatDuration(5520)).toBe('1 h 32')
    expect(formatDuration(null)).toBe('')
  })

  it('formats episode numbers', () => {
    const episode = { episodeNumber: 3, episodeNumberAbsolute: 64 }
    expect(formatEpisodeNumber(episode, 'season')).toBe('03')
    expect(formatEpisodeNumber(episode, 'absolute')).toBe('64')
  })

  it('labels resolutions', () => {
    expect(formatResolution(1080)).toBe('1080p')
    expect(formatResolution(2160)).toBe('4K')
  })
})
