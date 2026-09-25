'use strict';

module.exports = {
  async up(knex) {
    // Custom migrations run before Strapi creates tables from content-type
    // schemas, so on a fresh install `achievements` doesn't exist yet here.
    // The `templateType` field is declared in api::achievement.achievement's
    // schema.json, so the schema sync that runs right after this migration
    // creates template_type for us. Only pre-existing (upgrading) databases
    // need this migration.
    const hasTable = await knex.schema.hasTable('achievements');
    if (!hasTable) {
      return;
    }

    // Check if column already exists to support idempotent runs
    const hasColumn = await knex.schema.hasColumn('achievements', 'template_type');
    if (hasColumn) {
      console.log('template_type column already exists on achievements table');
      return;
    }

    return knex.schema.table('achievements', (table) => {
      // defaultTo('badge') backfills existing rows at the ALTER TABLE level,
      // so no separate UPDATE statement is needed for pre-existing achievements.
      table.string('template_type').defaultTo('badge');
    });
  },

  async down(knex) {
    const hasTable = await knex.schema.hasTable('achievements');
    if (!hasTable) {
      return;
    }

    return knex.schema.table('achievements', (table) => {
      table.dropColumn('template_type');
    });
  },
};
