export default ({ env }) => ({
  documentation: {
    enabled: true,
    config: {
      info: {
        title: 'Certrust API',
        description: 'Open Badges 3.0 / Verifiable Credentials API for issuing, managing, and verifying digital credentials.',
        version: '1.0.0',
      },
    },
  },
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET'),
      jwt: {
        expiresIn: '7d',
      },
      ratelimit: {
        interval: 60000,
        max: 100,
      },
      defaultRole: 'authenticated',
      public: {
        defaultRole: 'public',
      },
      advanced: {
        unique_email: true,
        allow_register: true,
        email_confirmation: false,
        email_reset_password: {
          from: {
            name: 'Certrust Support',
            // Dead config (the plugin never reads it back - see
            // bootstrap/email-confirmation-setup.ts). The real sender for
            // these emails is synced from SMTP_FROM by bootstrap/email-sender-setup.ts.
            email: 'no-reply@localhost',
          },
          subject: 'Reset your password for Certrust',
          message: `<p>Hello,</p>
<p>We received a request to reset your password for your Certrust account.</p>
<p>Please click the link below to set a new password:</p>
<p><%= URL %>?code=<%= TOKEN %></p>
<p>If you did not request this, please ignore this email.</p>
<p>Thanks,</p>
<p>The Certrust Team</p>`,
        },
        email_confirmation_redirection: null,
        default_role: 'authenticated',
      },
    },
  },
  upload: {
    config: {
      // Local disk by default (see docs/self-hosting.md for the uploads
      // volume this needs). Set UPLOAD_PROVIDER=s3 to use an S3-compatible
      // bucket instead - required for more than one backend replica, since
      // a local-disk PVC can't be shared across pods on different nodes
      // (see docs/kubernetes.md). Works with real AWS S3 or any
      // S3-compatible service (MinIO, Cloudflare R2, etc.) via S3_ENDPOINT/
      // S3_FORCE_PATH_STYLE - see the @strapi/provider-upload-aws-s3
      // README's own "S3 compatible services" section for why those two
      // options are what make that work.
      provider: env('UPLOAD_PROVIDER', 'local') === 's3' ? 'aws-s3' : 'local',
      providerOptions: env('UPLOAD_PROVIDER', 'local') === 's3'
        ? {
            // Public URL files are served from (e.g. an R2 bucket's custom
            // domain, https://files.certrust.app). R2's S3 endpoint itself is
            // private, so without this every stored file URL would 403.
            baseUrl: env('S3_PUBLIC_URL'),
            s3Options: {
              credentials: {
                accessKeyId: env('S3_ACCESS_KEY_ID'),
                secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
              },
              region: env('S3_REGION', 'us-east-1'),
              endpoint: env('S3_ENDPOINT'),
              forcePathStyle: env.bool('S3_FORCE_PATH_STYLE', false),
              params: {
                Bucket: env('S3_BUCKET'),
                // Set S3_ACL= (empty) for Cloudflare R2, which does not
                // implement x-amz-acl; the provider then omits the header.
                ACL: env('S3_ACL', 'public-read'),
              },
            },
          }
        : {},
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
      sizeLimit: 10 * 1024 * 1024, // 10MB in bytes
      settings: {
        // Make uploads accessible publicly
        accessControl: true,
        public: true,
      },
    },
  },
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        // Defaults to a local SMTP sink (the in-process dev mail catcher or
        // Mailhog, both on 1025). Real delivery needs SMTP_* set - see the
        // Cloudflare Email Service / Gmail blocks in .env.example. There is
        // deliberately no hardcoded external fallback: the old disposable
        // Ethereal inbox silently expired and broke every signup.
        host: env('SMTP_HOST', '127.0.0.1'),
        port: env.int('SMTP_PORT', 1025),
        auth: env('SMTP_USERNAME')
          ? { user: env('SMTP_USERNAME'), pass: env('SMTP_PASSWORD') }
          : undefined,
        secure: env.bool('SMTP_SECURE', false), // true for implicit TLS on 465
        requireTLS: env.bool('SMTP_REQUIRE_TLS', false), // force STARTTLS; Mailhog can't do this
        ignoreTLS: false, // Don't ignore TLS
        // Batch issuance sends every recipient's email concurrently
        // (Promise.all in credential.batchIssue). Without a pool, that is one
        // SMTP login per recipient at the same instant, which Gmail and
        // Cloudflare Email Service both reject as a burst. The pool reuses a
        // couple of connections and paces messages instead.
        pool: true,
        maxConnections: env.int('SMTP_MAX_CONNECTIONS', 2),
        rateDelta: 1000,
        rateLimit: env.int('SMTP_RATE_PER_SECOND', 2),
      },
      settings: {
        defaultFrom: env('SMTP_FROM', 'Certrust <no-reply@localhost>'),
        defaultReplyTo: env('SMTP_REPLY_TO', env('SMTP_FROM', 'no-reply@localhost')),
      },
    },
  },
});
