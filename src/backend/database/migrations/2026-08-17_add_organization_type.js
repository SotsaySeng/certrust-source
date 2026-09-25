'use strict';

module.exports = {
  async up(knex) {
    // Custom migrations run before Strapi creates tables from content-type
    // schemas, so on a fresh install `organizations` doesn't exist yet here.
    // The `type` relation is declared in api::organization.organization's
    // schema.json, so the schema sync that runs right after this migration
    // creates type_id for us. Only pre-existing (upgrading) databases need
    // this migration.
    const hasTable = await knex.schema.hasTable('organizations');
    if (!hasTable) {
      return;
    }

    // Check if column already exists to support idempotent runs
    const hasColumn = await knex.schema.hasColumn('organizations', 'type_id');
    if (hasColumn) {
      console.log('type_id column already exists on organizations table');
      return;
    }

    return knex.schema.table('organizations', (table) => {
      // Add type_id as a nullable foreign key (nullable = organization has no
      // assigned type yet - existing orgs predate this field, same carve-out
      // as organization_id on profiles).
      table.integer('type_id').nullable().unsigned();

      // Intentionally NOT adding a `.foreign()` constraint here. Just like
      // organization_id on profiles (see 2026-08-17_add_profile_organization.js),
      // the `org_types` table is a brand-new app table that does not exist yet
      // at migration-run time - custom migrations run before Strapi's
      // schema-sync step creates new tables from schema.json. Adding a
      // foreign key against a table that doesn't exist yet would throw and
      // break every upgrade. Do not "fix" this by adding the FK back -
      // schema-sync (which runs immediately after migrations) creates the
      // table and the relation is still enforced at the application/ORM level.

      // Add index for performance on lookups by type
      table.index('type_id');
    });
  },

  async down(knex) {
    const hasTable = await knex.schema.hasTable('organizations');
    if (!hasTable) {
      return;
    }

    // No foreign key was added in up(), so just drop the column and its index.
    return knex.schema.table('organizations', (table) => {
      table.dropIndex('type_id');
      table.dropColumn('type_id');
    });
  },
};
