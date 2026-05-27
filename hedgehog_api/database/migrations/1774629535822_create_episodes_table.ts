import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'episodes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('season_id').unsigned().references('id').inTable('seasons').onDelete('CASCADE')
      table.string('name').notNullable()
      table.string('path').notNullable()
      table.bigInteger('size').notNullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}