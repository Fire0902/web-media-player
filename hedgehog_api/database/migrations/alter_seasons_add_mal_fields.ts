import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  protected tableName = 'seasons'
  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('season_number').nullable()
      table.integer('mal_id').nullable()
      table.integer('episode_count').nullable()
      table.string('status').nullable()
      table.date('aired_from').nullable()
      table.string('cover_url').nullable()
    })
  }
  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('season_number')
      table.dropColumn('mal_id')
      table.dropColumn('episode_count')
      table.dropColumn('status')
      table.dropColumn('aired_from')
      table.dropColumn('cover_url')
    })
  }
}