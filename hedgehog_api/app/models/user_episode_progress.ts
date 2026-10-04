import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Episode from '#models/episode'
import { DateTime } from 'luxon'

export default class UserEpisodeProgress extends BaseModel {
  static table = 'user_episode_progresses'
  @column({ isPrimary: true }) declare id: number
  @column() declare userId: number
  @column() declare episodeId: number
  @column() declare timestamp: number
  @column({ consume: (v) => Boolean(v) }) declare viewed: boolean
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
  @belongsTo(() => User) declare user: BelongsTo<typeof User>
  @belongsTo(() => Episode) declare episode: BelongsTo<typeof Episode>
}