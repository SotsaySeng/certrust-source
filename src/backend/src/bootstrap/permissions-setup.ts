/**
 * Permission setup for Strapi v5
 * Creates and enables permissions for authenticated users
 */

// Permissions to enable for authenticated users
const AUTHENTICATED_PERMISSIONS = [
  // Profile permissions
  'api::profile.profile.find',
  'api::profile.profile.findOne',
  'api::profile.profile.create',
  'api::profile.profile.update',
  // .delete deliberately NOT granted - the controller's own delete()
  // override rejects unconditionally now (see its comment), so the
  // permission is dead weight; not granting it also means a 403 at the
  // policy layer, before even reaching the controller, if that override
  // is ever removed by accident.
  'api::profile.profile.me',
  'api::profile.profile.myIssuedCredentials',
  'api::profile.profile.myReceivedCredentials',
  'api::profile.profile.findIssuedCredentials',
  'api::profile.profile.findReceivedCredentials',
  'api::profile.profile.exportMyData',
  'api::profile.profile.importMyData',
  'api::profile.profile.dashboardStats',
  'api::profile.profile.deleteAccount',

  // Achievement permissions
  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',
  'api::achievement.achievement.create',
  'api::achievement.achievement.update',
  'api::achievement.achievement.delete',
  'api::achievement.achievement.credentials',
  // findByCreator now requires auth (was auth: false - see the route and
  // controller's own comments for why) - every authenticated caller needs
  // this grant, same as find/findOne above; the ownership check inside
  // the handler itself (creatorId must resolve to the caller's own
  // profile) is the real access boundary, not this role permission.
  'api::achievement.achievement.findByCreator',

  // Design template permissions
  'api::design-template.design-template.find',
  'api::design-template.design-template.findOne',
  'api::design-template.design-template.create',
  'api::design-template.design-template.update',
  'api::design-template.design-template.delete',

  // Event permissions
  'api::event.event.find',
  'api::event.event.findOne',
  'api::event.event.create',
  'api::event.event.update',
  'api::event.event.delete',

  // Organization permissions - find/findOne only (create/update/delete
  // stay admin-panel-only; self-service registration provisions
  // organizations server-side via api::organization.provisioning,
  // bypassing this content-API permission layer entirely). `find` is not
  // just for GET /api/organizations itself: @strapi/utils'
  // throwRestrictedRelations requires the caller's role to have `find`
  // on a relation's *target* type before letting them set that relation
  // at all - e.g. design-template.organization on create/update - so
  // without this, every design-template write that sets an organization
  // 400s with "Invalid key organization" regardless of this app's own
  // authorization logic. organization.ts's controller overrides both
  // actions to scope to the caller's own organization only, so this
  // grant does not expose the full organizations list.
  'api::organization.organization.find',
  'api::organization.organization.findOne',

  // Credential permissions
  'api::credential.credential.find',
  'api::credential.credential.findOne',
  'api::credential.credential.create',
  'api::credential.credential.update',
  'api::credential.credential.delete',
  'api::credential.credential.issue',
  // CSV/multi-recipient issuance from the Issue page. Tenancy is enforced
  // by the route's global::is-in-organization policy, same as issue.
  // Missing from this list meant every fresh install 403'd on batch issue.
  'api::credential.credential.batchIssue',
  'api::credential.credential.verify',
  'api::credential.credential.validate',
  'api::credential.credential.revoke',
  'api::credential.credential.import',
  'api::credential.credential.export',
  'api::credential.credential.certificate',
  'api::credential.credential.renew',
  'api::credential.credential.setVisibility',
  'api::credential.credential.expirationCheck',

  // Scheduled issuance permissions
  'api::scheduled-issuance.scheduled-issuance.create',
  'api::scheduled-issuance.scheduled-issuance.find',
  'api::scheduled-issuance.scheduled-issuance.cancel',
  'api::scheduled-issuance.scheduled-issuance.runCheck',

  // Evidence permissions
  'api::evidence.evidence.find',
  'api::evidence.evidence.findOne',
  'api::evidence.evidence.create',
  'api::evidence.evidence.update',
  'api::evidence.evidence.delete',
  
  // Endorsement permissions
  'api::endorsement.endorsement.find',
  'api::endorsement.endorsement.findOne',
  'api::endorsement.endorsement.create',
  'api::endorsement.endorsement.update',
  'api::endorsement.endorsement.delete',
  'api::endorsement.endorsement.verify',
];

// Permissions to enable for the issuer role
const ISSUER_PERMISSIONS = [
  // Credential permissions
  'api::credential.credential.find',
  'api::credential.credential.findOne',
  'api::credential.credential.create',
  'api::credential.credential.update',
  'api::credential.credential.delete',
  'api::credential.credential.issue',
  'api::credential.credential.validate',
  'api::credential.credential.verify',
  'api::credential.credential.import',
  'api::credential.credential.export',
  'api::credential.credential.revoke',
  'api::credential.credential.renew',
  'api::credential.credential.setVisibility',
  'api::profile.profile.find',
  'api::profile.profile.findOne',
  'api::profile.profile.me',
  'api::profile.profile.myIssuedCredentials',
  'api::profile.profile.myReceivedCredentials',
  'api::profile.profile.exportMyData',
  'api::profile.profile.importMyData',
  'api::profile.profile.dashboardStats',

  // Achievement permissions
  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',
  'api::achievement.achievement.create',
  'api::achievement.achievement.update',
  'api::achievement.achievement.delete',

  // Design template permissions
  'api::design-template.design-template.find',
  'api::design-template.design-template.findOne',
  'api::design-template.design-template.create',
  'api::design-template.design-template.update',
  'api::design-template.design-template.delete',

  // Organization permissions - see the equivalent comment in
  // AUTHENTICATED_PERMISSIONS above.
  'api::organization.organization.find',
  'api::organization.organization.findOne',
];

// Permissions to enable for the reviewer role: read/verify everything,
// no create/update/delete.
const REVIEWER_PERMISSIONS = [
  'api::profile.profile.find',
  'api::profile.profile.findOne',

  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',

  'api::design-template.design-template.find',
  'api::design-template.design-template.findOne',

  'api::credential.credential.find',
  'api::credential.credential.findOne',
  'api::credential.credential.verify',
  'api::credential.credential.validate',

  'api::evidence.evidence.find',
  'api::evidence.evidence.findOne',
];

// Permissions to enable for the viewer role: read-only, narrower than
// reviewer (no evidence, no verify beyond what's already public).
const VIEWER_PERMISSIONS = [
  'api::profile.profile.find',
  'api::profile.profile.findOne',

  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',

  'api::design-template.design-template.find',
  'api::design-template.design-template.findOne',

  'api::credential.credential.find',
  'api::credential.credential.findOne',
];

// Permissions to enable for public users
const PUBLIC_PERMISSIONS = [
  // Profile - read only
  'api::profile.profile.find',
  'api::profile.profile.findOne',
  'api::profile.profile.findIssuedCredentials',
  'api::profile.profile.findReceivedCredentials',
  
  // Achievement - read only
  'api::achievement.achievement.find',
  'api::achievement.achievement.findOne',
  'api::achievement.achievement.credentials',

  // Org type - read only (registration form's org-type dropdown is pre-login,
  // same reasoning as achievement's public find/findOne above). Belt-and-
  // suspenders alongside org-type's own router-level auth: false.
  'api::org-type.org-type.find',
  'api::org-type.org-type.findOne',

  // Homepage/footer CMS singleTypes - read only, public marketing content
  // rendered on every page load without authentication. Belt-and-suspenders
  // alongside each one's own router-level auth: false. No findOne - these
  // are singleTypes, which only expose `find`.
  'api::global-settings.global-settings.find',
  'api::homepage.homepage.find',
  'api::solution-page.solution-page.find',

  // Credential - read and verify
  'api::credential.credential.find',
  'api::credential.credential.findOne',
  'api::credential.credential.verify',
  'api::credential.credential.validate',
  'api::credential.credential.certificate',
  
  // Evidence - read only
  'api::evidence.evidence.find',
  'api::evidence.evidence.findOne',
  
  // Endorsement - read and verify
  'api::endorsement.endorsement.find',
  'api::endorsement.endorsement.findOne',
  'api::endorsement.endorsement.verify',
];

/**
 * Every permission row with the roles it is linked to, in ONE query.
 *
 * This runs on every boot. The previous per-action lookups cost ~3 database
 * round trips per action per role (several hundred in total), which against
 * a remote database (Neon, ~100-240 ms away) made boot take minutes - and on
 * Cloudflare the backend only accepts requests once boot has finished.
 */
async function loadPermissionIndex(strapi: any): Promise<Map<string, { ids: number[]; roleIds: Set<number> }>> {
  const rows = await strapi.db
    .connection('up_permissions as p')
    .leftJoin('up_permissions_role_lnk as l', 'l.permission_id', 'p.id')
    .select('p.id as id', 'p.action as action', 'l.role_id as roleId')
    .orderBy('p.id', 'asc');

  const index = new Map<string, { ids: number[]; roleIds: Set<number> }>();
  for (const row of rows) {
    const entry = index.get(row.action) ?? { ids: [], roleIds: new Set<number>() };
    if (!entry.ids.includes(row.id)) entry.ids.push(row.id);
    if (row.roleId != null) entry.roleIds.add(Number(row.roleId));
    index.set(row.action, entry);
  }
  return index;
}

/**
 * Setup permissions for a specific role
 */
async function setupRolePermissions(strapi: any, roleType: string, permissions: string[]): Promise<void> {
  strapi.log.info(`[Permissions] Setting up ${roleType} permissions...`);
  
  // Get the role
  const role = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });

  if (!role) {
    strapi.log.error(`[Permissions] ${roleType} role not found`);
    return;
  }

  let created = 0;
  let linked = 0;
  const index = await loadPermissionIndex(strapi);

  for (const action of permissions) {
    try {
      const entry = index.get(action);

      // Already granted to this role through any row for this action.
      if (entry?.roleIds.has(role.id)) continue;

      // Reuse the first existing row for the action (same row the old
      // findOne({ where: { action } }) picked), or create one.
      let permissionId = entry?.ids[0];
      if (permissionId == null) {
        const permission = await strapi
          .query('plugin::users-permissions.permission')
          .create({ data: { action } });
        permissionId = permission.id;
        created++;
      }

      await strapi.db.connection.raw(`
        INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
        VALUES (?, ?, 1)
        ON CONFLICT DO NOTHING
      `, [permissionId, role.id]);
      linked++;

      const updated = entry ?? { ids: [permissionId], roleIds: new Set<number>() };
      updated.roleIds.add(role.id);
      index.set(action, updated);
    } catch (error) {
      // Ignore duplicate key errors
      if (!String(error).includes('duplicate key')) {
        strapi.log.warn(`[Permissions] Could not set ${action}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  strapi.log.info(`[Permissions] ${roleType}: created ${created} permissions, linked ${linked} to role`);
}

/**
 * The "Platform Admin" role: ZettaByte Lab staff who can see the platform
 * revenue dashboard (global::is-platform-admin). Assigned per user in
 * Strapi admin. It gets every authenticated permission too, so a platform
 * admin can still use the app normally.
 */
async function ensurePlatformAdminRole(strapi: any): Promise<void> {
  const existing = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: 'platform-admin' } });
  if (existing) return;
  await strapi.query('plugin::users-permissions.role').create({
    data: {
      name: 'Platform Admin',
      type: 'platform-admin',
      description: 'Certrust platform staff. Can see the revenue dashboard, plus everything an authenticated user can do.',
    },
  });
  strapi.log.info('[Permissions] Created Platform Admin role');
}

/**
 * Gives a role its OWN permission rows. setupRolePermissions() above
 * links a role to whichever row already exists for an action, so two
 * roles would share one row. Strapi's role editor deletes the rows it
 * unticks, which would then silently strip that permission from the other
 * role too.
 */
async function setupOwnRolePermissions(strapi: any, roleType: string, permissions: string[]): Promise<void> {
  const role = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: roleType } });
  if (!role) return;
  // One read of what the role already owns (see loadPermissionIndex for why
  // boot-time queries are batched), then only the missing rows are created.
  const owned = new Set(
    (await strapi.query('plugin::users-permissions.permission').findMany({ where: { role: role.id } }))
      .map((p: any) => p.action)
  );
  let created = 0;
  for (const action of permissions) {
    if (owned.has(action)) continue;
    await strapi.query('plugin::users-permissions.permission').create({ data: { action, role: role.id } });
    owned.add(action);
    created++;
  }
  strapi.log.info(`[Permissions] ${roleType}: created ${created} permissions`);
}

/**
 * Main permission setup function
 */
export async function setupPermissions(strapi: any): Promise<void> {
  strapi.log.info('[Permissions] Starting permission setup...');
  
  try {
    // Setup authenticated permissions
    await setupRolePermissions(strapi, 'authenticated', AUTHENTICATED_PERMISSIONS);

    await ensurePlatformAdminRole(strapi);
    // Everything the Authenticated role actually holds - not just this
    // file's list, which omits the users-permissions plugin defaults
    // (user.me, auth.changePassword, ...) Strapi grants that role itself.
    const authenticatedActions = (await strapi.query('plugin::users-permissions.permission').findMany({
      where: { role: { type: 'authenticated' } },
    })).map((p: any) => p.action);
    await setupOwnRolePermissions(strapi, 'platform-admin', Array.from(new Set([...authenticatedActions, ...AUTHENTICATED_PERMISSIONS])));

    // Setup public permissions
    await setupRolePermissions(strapi, 'public', PUBLIC_PERMISSIONS);

    // Setup issuer permissions (no-ops with a log message if no 'issuer' role exists yet)
    await setupRolePermissions(strapi, 'issuer', ISSUER_PERMISSIONS);

    // Reviewer/viewer: same no-op-until-the-role-exists caveat as issuer -
    // these lists are inert until an admin creates matching roles in the
    // admin panel (Settings > Users & Permissions > Roles). See
    // docs/known-issues-and-dev-notes.md and docs/security.md.
    await setupRolePermissions(strapi, 'reviewer', REVIEWER_PERMISSIONS);
    await setupRolePermissions(strapi, 'viewer', VIEWER_PERMISSIONS);

    strapi.log.info('[Permissions] Permission setup complete');
  } catch (error) {
    strapi.log.error(`[Permissions] Error setting up permissions: ${error instanceof Error ? error.message : error}`);
  }
}

export default setupPermissions;
