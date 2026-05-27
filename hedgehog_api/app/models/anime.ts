import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Season from '#models/season'
import { DateTime } from 'luxon'

export default class Anime extends BaseModel {
  public static table = 'animes'
  @column({ isPrimary: true }) declare id: number
  @column() declare name: string
  @column() declare malId: number | null
  @column() declare synopsis: string | null
  @column() declare coverUrl: string | null
  @column() declare status: string | null
  @column() declare totalEpisodes: number | null
  @column() declare rating: string | null
  @column({
    prepare: (v) => JSON.stringify(v),
    consume: (v) => typeof v === 'string' ? JSON.parse(v) : v,
  }) declare genres: string[] | null
  @column({
    prepare: (v) => JSON.stringify(v),
    consume: (v) => typeof v === 'string' ? JSON.parse(v) : v,
  }) declare studios: string[] | null
  @column({
    prepare: (v) => JSON.stringify(v),
    consume: (v) => typeof v === 'string' ? JSON.parse(v) : v,
  }) declare voiceActors: any[] | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
  @hasMany(() => Season) declare seasons: HasMany<typeof Season>
}