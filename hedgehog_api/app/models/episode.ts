import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Season from '#models/season'
import { DateTime } from 'luxon'

export default class Episode extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare seasonId: number
  @column() declare name: string
  @column() declare path: string
  @column() declare size: number
  @column() declare episodeNumber: number | null
  @column() declare episodeNumberAbsolute: number | null
  @column() declare malId: number | null
  @column() declare title: string | null
  @column() declare titleJapanese: string | null
  @column() declare airedAt: string | null
  @column({ consume: (v) => Boolean(v) }) declare filler: boolean
  @column({ consume: (v) => Boolean(v) }) declare recap: boolean
  @column() declare thumbnailPath: string | null
  @column() declare duration: number | null
  @column() declare container: string | null
  @column() declare videoCodec: string | null
  @column() declare audioCodec: string | null
  @column() declare width: number | null
  @column() declare height: number | null
  @column({
    prepare: (v) => JSON.stringify(v),
    consume: (v) => typeof v === 'string' ? JSON.parse(v) : v,
  }) declare voiceActors: any[] | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
  @belongsTo(() => Season) declare season: BelongsTo<typeof Season>
}