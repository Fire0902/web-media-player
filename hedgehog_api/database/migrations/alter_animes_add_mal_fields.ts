import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  protected tableName = 'animes'
  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('mal_id').nullable().unique()
      table.text('synopsis').nullable()
      table.string('cover_url').nullable()
      table.string('status').nullable()
      table.integer('total_episodes').nullable()
      table.string('rating').nullable()
      table.json('genres').nullable()
      table.json('studios').nullable()
      table.json('voice_actors').nullable()
    })
  }
  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('mal_id')
      table.dropColumn('synopsis')
      table.dropColumn('cover_url')
      table.dropColumn('status')
      table.dropColumn('total_episodes')
      table.dropColumn('rating')
      table.dropColumn('genres')
      table.dropColumn('studios')
      table.dropColumn('voice_actors')
    })
  }
}