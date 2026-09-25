'use strict';

module.exports = {
  async up(knex) {
    // Custom migrations run before Strapi creates tables from content-type
    // schemas, so on a fresh install `profiles` doesn't exist yet here. The
    // `owner` relation is declared in api::profile.profile's schema.json, so
    // the schema sync that runs right after this migration creates owner_id
    // for us. Only pre-existing (upgrading) databases need this migration.
    const hasTable = await knex.schema.hasTable('profiles');
    if (!hasTable) {
      return;
    }

    // Check if column already exists to support idempotent runs
    const hasColumn = await knex.schema.hasColumn('profiles', 'owner_id');
    if (hasColumn) {
      console.log('owner_id column already exists on profiles table');
      return;
    }

    return knex.schema.table('profiles', (table) => {
      // Add owner_id as a nullable foreign key (nullable for backward compat with existing profiles)
      table.integer('owner_id').nullable().unsigned();

      // Add the foreign key constraint
      table.foreign('owner_id').references('id').inTable('up_users').onDelete('SET NULL');

      // Add index for performance on lookups by owner
      table.index('owner_id');
    });
  },

  async down(knex) {
    const hasTable = await knex.schema.hasTable('profiles');
    if (!hasTable) {
      return;
    }

    // Drop the foreign key and column on rollback
    return knex.schema.table('profiles', (table) => {
      table.dropForeign('owner_id');
      table.dropColumn('owner_id');
    });
  },
};
