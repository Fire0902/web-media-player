import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  protected tableName = 'episodes'
  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('episode_number').nullable()
      table.integer('episode_number_absolute').nullable()
      table.integer('mal_id').nullable()
      table.string('title').nullable()
      table.string('title_japanese').nullable()
      table.date('aired_at').nullable()
      table.boolean('filler').defaultTo(false)
      table.boolean('recap').defaultTo(false)
      table.json('voice_actors').nullable()
    })
  }
  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('episode_number')
      table.dropColumn('episode_number_absolute')
      table.dropColumn('mal_id')
      table.dropColumn('title')
      table.dropColumn('title_japanese')
      table.dropColumn('aired_at')
      table.dropColumn('filler')
      table.dropColumn('recap')
      table.dropColumn('voice_actors')
    })
  }
}