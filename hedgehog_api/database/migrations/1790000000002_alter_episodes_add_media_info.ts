import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'episodes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.float('duration').nullable()
      table.string('container').nullable()
      table.string('video_codec').nullable()
      table.string('audio_codec').nullable()
      table.integer('width').nullable()
      table.integer('height').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('duration')
      table.dropColumn('container')
      table.dropColumn('video_codec')
      table.dropColumn('audio_codec')
      table.dropColumn('width')
      table.dropColumn('height')
    })
  }
}
