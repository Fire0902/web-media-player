import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class UserAnimeFavorite extends BaseModel {
  static table = 'user_anime_favorites'
  @column({ isPrimary: true }) declare id: number
  @column() declare userId: number
  @column() declare animeId: number
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
}
