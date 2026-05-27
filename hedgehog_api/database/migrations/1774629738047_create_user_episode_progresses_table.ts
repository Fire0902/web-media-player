import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_episode_progresses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('episode_id').unsigned().references('id').inTable('episodes').onDelete('CASCADE')
      table.float('timestamp').defaultTo(0)
      table.boolean('viewed').defaultTo(false)
      table.unique(['user_id', 'episode_id'])
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}