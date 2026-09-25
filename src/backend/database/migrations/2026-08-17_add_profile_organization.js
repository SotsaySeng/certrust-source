'use strict';

module.exports = {
  async up(knex) {
    // Custom migrations run before Strapi creates tables from content-type
    // schemas, so on a fresh install `profiles` doesn't exist yet here. The
    // `organization` relation is declared in api::profile.profile's schema.json,
    // so the schema sync that runs right after this migration creates
    // organization_id for us. Only pre-existing (upgrading) databases need
    // this migration.
    const hasTable = await knex.schema.hasTable('profiles');
    if (!hasTable) {
      return;
    }

    // Check if column already exists to support idempotent runs
    const hasColumn = await knex.schema.hasColumn('profiles', 'organization_id');
    if (hasColumn) {
      console.log('organization_id column already exists on profiles table');
      return;
    }

    return knex.schema.table('profiles', (table) => {
      // Add organization_id as a nullable foreign key (nullable = legacy/unrestricted profile, not yet assigned to a tenant)
      table.integer('organization_id').nullable().unsigned();

      // Intentionally NOT adding a `.foreign()` constraint here. Unlike
      // owner_id (which references up_users, a core plugin table that
      // already exists before this app boots), the `organizations` table
      // is a brand-new app table that does not exist yet at migration-run
      // time — custom migrations run before Strapi's schema-sync step
      // creates new tables from schema.json. Adding a foreign key against
      // a table that doesn't exist yet would throw and break every
      // upgrade. Do not "fix" this by adding the FK back — schema-sync
      // (which runs immediately after migrations) creates the table and
      // the relation is still enforced at the application/ORM level.

      // Add index for performance on lookups by organization
      table.index('organization_id');
    });
  },

  async down(knex) {
    const hasTable = await knex.schema.hasTable('profiles');
    if (!hasTable) {
      return;
    }

    // No foreign key was added in up(), so just drop the column and its index.
    return knex.schema.table('profiles', (table) => {
      table.dropIndex('organization_id');
      table.dropColumn('organization_id');
    });
  },
};
