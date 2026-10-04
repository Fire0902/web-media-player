import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_admin').notNullable().defaultTo(false)
    })

    // Instances created before roles existed: the oldest account is the
    // one that went through the setup screen, so it becomes the admin.
    this.defer(async (db) => {
      const first = await db.from(this.tableName).orderBy('id', 'asc').first()
      if (first) {
        await db.from(this.tableName).where('id', first.id).update({ is_admin: true })
      }
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_admin')
    })
  }
}
