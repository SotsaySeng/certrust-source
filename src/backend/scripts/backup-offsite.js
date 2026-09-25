#!/usr/bin/env node

/**
 * Off-site backup to an S3-compatible bucket (Cloudflare R2 in production).
 *
 * backup.js writes to a local directory, which on a container host is wiped
 * with the container. This keeps the same pg_dump (custom format, restorable
 * with scripts/restore.js) but ships it to a separate backup bucket, and
 * mirrors every uploaded file from the uploads bucket into it too:
 *
 *   db/<label>/<timestamp>.dump      one per run (label: daily, predeploy, manual)
 *   db/monthly/<yyyy-mm>.dump        extra copy from the first daily run of a month
 *   uploads/<key>                    mirror of the uploads bucket; copied when new
 *                                    or changed, never deleted here, so an image
 *                                    removed by mistake stays recoverable
 *
 * Retention (30 daily / 12 monthly) and delete-protection are R2 bucket
 * lifecycle + lock rules on the backup bucket, not this script - see
 * deploy/cloudflare/README.md.
 *
 * Env: BACKUP_S3_BUCKET, plus the S3_* settings config/plugins.ts already uses
 * for uploads (S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION,
 * S3_BUCKET). The access key needs read on the uploads bucket and write on
 * the backup bucket.
 *
 * Usage: npm run backup:offsite -- [--label predeploy]
 */

require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getConnectionConfig, backupPostgres } = require('./backup');

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function stamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function listAll(send, ListObjectsV2Command, bucket, prefix = '') {
  const objects = new Map();
  let token;
  do {
    const page = await send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const obj of page.Contents || []) objects.set(obj.Key, obj);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

/**
 * @param {object} [options]
 * @param {string} [options.label] daily | predeploy | manual
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {Date} [options.now]
 * @param {(command: any) => Promise<any>} [options.send] injectable S3 send (tests)
 * @param {(connection: any, outDir: string) => string} [options.dump] injectable pg_dump (tests)
 */
async function offsiteBackup({ label = 'manual', env = process.env, now = new Date(), send, dump = backupPostgres } = {}) {
  const s3 = require('@aws-sdk/client-s3');
  const backupBucket = requireEnv(env, 'BACKUP_S3_BUCKET');
  const uploadsBucket = env.S3_BUCKET;

  if (!send) {
    const client = new s3.S3Client({
      region: env.S3_REGION || 'auto',
      endpoint: requireEnv(env, 'S3_ENDPOINT'),
      forcePathStyle: String(env.S3_FORCE_PATH_STYLE).toLowerCase() === 'true',
      credentials: {
        accessKeyId: requireEnv(env, 'S3_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv(env, 'S3_SECRET_ACCESS_KEY'),
      },
    });
    send = command => client.send(command);
  }

  const { client, ...connection } = getConnectionConfig();
  if (client !== 'postgres') {
    throw new Error(`Off-site backup needs DATABASE_CLIENT=postgres (got ${client})`);
  }

  // 1. Database dump -> backup bucket
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'certrust-backup-'));
  const dbKeys = [];
  try {
    const dumpFile = dump(connection, workDir);
    const body = fs.readFileSync(dumpFile);
    const keys = [`db/${label}/${stamp(now)}.dump`];
    if (label === 'daily' && now.getUTCDate() === 1) {
      keys.push(`db/monthly/${now.toISOString().slice(0, 7)}.dump`);
    }
    for (const key of keys) {
      await send(new s3.PutObjectCommand({ Bucket: backupBucket, Key: key, Body: body, ContentType: 'application/octet-stream' }));
      dbKeys.push(key);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  // 2. Mirror uploads bucket -> backup bucket (server-side copies)
  let copied = 0;
  let unchanged = 0;
  if (uploadsBucket) {
    const source = await listAll(send, s3.ListObjectsV2Command, uploadsBucket);
    const mirrored = await listAll(send, s3.ListObjectsV2Command, backupBucket, 'uploads/');
    for (const [key, obj] of source) {
      const existing = mirrored.get(`uploads/${key}`);
      if (existing && existing.Size === obj.Size && existing.ETag === obj.ETag) {
        unchanged++;
        continue;
      }
      await send(new s3.CopyObjectCommand({
        Bucket: backupBucket,
        Key: `uploads/${key}`,
        CopySource: `${uploadsBucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
      }));
      copied++;
    }
  }

  return { dbKeys, uploads: { copied, unchanged } };
}

if (require.main === module) {
  const labelIndex = process.argv.indexOf('--label');
  const label = labelIndex > -1 ? process.argv[labelIndex + 1] : 'manual';
  offsiteBackup({ label })
    .then(result => {
      console.log(`[Backup] Database -> ${result.dbKeys.join(', ')}`);
      console.log(`[Backup] Uploads: ${result.uploads.copied} copied, ${result.uploads.unchanged} already backed up`);
    })
    .catch(error => {
      console.error('[Backup] Off-site backup failed:', error.message || error);
      process.exitCode = 1;
    });
}

module.exports = { offsiteBackup };
