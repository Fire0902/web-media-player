import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Anime from '#models/anime'
import Episode from '#models/episode'
import { DateTime } from 'luxon'

export default class Season extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare animeId: number
  @column() declare name: string
  @column() declare seasonNumber: number | null
  @column() declare malId: number | null
  @column() declare episodeCount: number | null
  @column() declare status: string | null
  @column() declare airedFrom: string | null
  @column() declare coverUrl: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
  @belongsTo(() => Anime) declare anime: BelongsTo<typeof Anime>
  @hasMany(() => Episode) declare episodes: HasMany<typeof Episode>
}