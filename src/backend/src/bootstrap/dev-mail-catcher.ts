/**
 * In-process dev SMTP catcher.
 *
 * Why this exists: email confirmation is mandatory for self-service
 * registration (see bootstrap/email-confirmation-setup.ts), and the
 * register override runs the user creation, the org/profile provisioning
 * and the confirmation email inside one strapi.db.transaction (see
 * extensions/users-permissions/strapi-server.ts). So if the SMTP server
 * is unreachable - or, as happened here, the shared Ethereal test mailbox
 * silently expires and starts answering `535 Authentication failed` -
 * every registration 400s with "Error sending confirmation email" and
 * rolls back completely: no user, no organization, no profile. A local
 * dev environment then has no way to create an account at all.
 *
 * docker-compose.yml already solves this for the containerized stack by
 * running Mailhog on :1025. The local sqlite/dev-server setup has no such
 * service, and requiring a Mailhog/Mailpit install just to sign up locally
 * is a sharp edge. This starts an equivalent catcher inside the Strapi
 * process instead: no extra dependency, no extra process to remember to
 * start, and no external mailbox that can expire.
 *
 * It speaks just enough SMTP for nodemailer: a greeting, EHLO, any AUTH
 * (accepted unconditionally - it is a sink, there is nothing to protect),
 * MAIL FROM/RCPT TO, and DATA terminated by a lone dot. Each message is
 * written to .tmp/mail/ as an .eml file, and any links in it are logged so
 * a confirmation link can be clicked straight out of the dev console.
 *
 * Opt-in via DEV_MAIL_CATCHER=true, and hard-refused when NODE_ENV is
 * production regardless of that flag - a mail sink silently swallowing
 * real confirmation/reset emails in production would be far worse than a
 * send failure.
 */

import { createServer, type Server, type Socket } from 'node:net';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_PORT = 1025;
const MAIL_DIR = path.join(process.cwd(), '.tmp', 'mail');

/**
 * Module-level so Strapi's dev watcher, which re-runs bootstrap() against
 * the same process on every reload, reuses the existing listener instead
 * of leaking a new one (or dying on EADDRINUSE) each time a file changes.
 */
let server: Server | null = null;

/** Nodemailer encodes bodies quoted-printable, which line-wraps URLs with `=\n`. */
function decodeQuotedPrintable(body: string): string {
  return body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function headerValue(message: string, header: string): string {
  // Headers only (up to the first blank line), with folded continuation
  // lines joined back up (RFC 5322 2.2.3): nodemailer wraps long subjects.
  const head = message.split(/\r?\n\r?\n/, 1)[0].replace(/\r?\n[ \t]+/g, ' ');
  const match = head.match(new RegExp(`^${header}:\\s*(.*)$`, 'im'));
  return match ? match[1].trim() : '';
}

function persist(strapi: any, recipients: string[], message: string): void {
  const decoded = decodeQuotedPrintable(message);
  const subject = headerValue(message, 'Subject') || '(no subject)';
  const to = recipients.join(', ') || headerValue(message, 'To') || '(no recipient)';

  let file = '';
  try {
    mkdirSync(MAIL_DIR, { recursive: true });
    file = path.join(MAIL_DIR, `${Date.now()}-${(recipients[0] || 'unknown').replace(/[^\w.@-]/g, '_')}.eml`);
    writeFileSync(file, message, 'utf8');
    // A JSONL index alongside the .eml files, so tooling (e.g. the e2e
    // suite) can read the delivered mail without parsing a directory.
    appendFileSync(
      path.join(MAIL_DIR, 'index.jsonl'),
      `${JSON.stringify({ at: new Date().toISOString(), to: recipients, subject, file, raw: message })}\n`,
      'utf8'
    );
  } catch (err) {
    strapi.log.warn(`[DevMailCatcher] Could not write message to disk: ${(err as Error).message}`);
  }

  const links = [...decoded.matchAll(/https?:\/\/[^\s"'<>]+/g)].map(match => match[0]);
  const unique = [...new Set(links)];

  strapi.log.info(`[DevMailCatcher] Caught mail to ${to} - "${subject}"${file ? ` -> ${file}` : ''}`);
  unique.forEach(link => strapi.log.info(`[DevMailCatcher]   link: ${link}`));
}

function handleConnection(strapi: any, socket: Socket): void {
  let buffer = '';
  let inData = false;
  let message = '';
  let recipients: string[] = [];

  socket.write('220 localhost Certrust dev mail catcher\r\n');

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');

    let breakIndex = buffer.indexOf('\r\n');
    while (breakIndex !== -1) {
      const line = buffer.slice(0, breakIndex);
      buffer = buffer.slice(breakIndex + 2);

      if (inData) {
        if (line === '.') {
          inData = false;
          persist(strapi, recipients, message);
          message = '';
          recipients = [];
          socket.write('250 2.0.0 Ok: queued\r\n');
        } else {
          // Undo SMTP dot-stuffing (RFC 5321 s4.5.2).
          message += `${line.startsWith('..') ? line.slice(1) : line}\n`;
        }
        breakIndex = buffer.indexOf('\r\n');
        continue;
      }

      const command = line.toUpperCase();
      if (command.startsWith('EHLO') || command.startsWith('HELO')) {
        // Deliberately does NOT advertise STARTTLS - there is no
        // certificate here, and nodemailer only upgrades when offered.
        socket.write('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n');
      } else if (command.startsWith('AUTH')) {
        socket.write('235 2.7.0 Authentication successful\r\n');
      } else if (command.startsWith('MAIL FROM')) {
        socket.write('250 OK\r\n');
      } else if (command.startsWith('RCPT TO')) {
        recipients.push(line.slice('RCPT TO:'.length).trim().replace(/^<|>$/g, ''));
        socket.write('250 OK\r\n');
      } else if (command === 'DATA') {
        inData = true;
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (command === 'RSET') {
        recipients = [];
        message = '';
        socket.write('250 OK\r\n');
      } else if (command === 'QUIT') {
        socket.write('221 Bye\r\n');
        socket.end();
      } else {
        socket.write('250 OK\r\n');
      }

      breakIndex = buffer.indexOf('\r\n');
    }
  });

  // A client hanging up mid-conversation is normal; never let it take the
  // Strapi process down with an unhandled 'error' event.
  socket.on('error', () => {});
}

export async function startDevMailCatcher(strapi: any): Promise<void> {
  if (String(process.env.DEV_MAIL_CATCHER).toLowerCase() !== 'true') {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    strapi.log.warn('[DevMailCatcher] DEV_MAIL_CATCHER is set but NODE_ENV=production - refusing to start; real mail must be delivered.');
    return;
  }

  if (server) {
    strapi.log.info('[DevMailCatcher] Already running, reusing the existing listener.');
    return;
  }

  const port = Number(process.env.DEV_MAIL_CATCHER_PORT || process.env.SMTP_PORT || DEFAULT_PORT);

  await new Promise<void>((resolve) => {
    const candidate = createServer(socket => handleConnection(strapi, socket));

    candidate.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Something is already catching mail on this port - another dev
        // server, or a Mailhog/Mailpit container. That is fine: mail still
        // gets caught, just not by us.
        strapi.log.info(`[DevMailCatcher] Port ${port} already in use - assuming another mail catcher owns it.`);
      } else {
        strapi.log.warn(`[DevMailCatcher] Could not start: ${err.message}`);
      }
      resolve();
    });

    candidate.listen(port, '127.0.0.1', () => {
      server = candidate;
      strapi.log.info(`[DevMailCatcher] Catching SMTP on 127.0.0.1:${port}; messages saved to ${MAIL_DIR}`);
      resolve();
    });
  });
}

export default startDevMailCatcher;
