# Security Policy

## Supported Versions

Only the latest release of `@nsaky/eventkit` is actively supported with security patches:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Operating Model & Threat Boundaries

EventKit is an open-source, lightweight Node.js toolkit designed for local file-based event persistence.

When deploying EventKit in production applications, developers should be aware of the following security characteristics:
1. **Single-Process Storage**: Storage writes are protected against in-process race conditions via an async mutex. EventKit is not intended for multi-process clustering or distributed file systems without an application-level synchronization proxy.
2. **File Paths & Directory Access**: All file-saving methods (QR code image exports and data exports) validate paths and allow developers to restrict output locations. Consumers should validate user-supplied file paths to prevent unauthorized directory writes.
3. **QR Code Payloads**: EventKit encodes minimal identifiers (`{ ticketId, eventId }`) into generated QR codes. No personally identifiable information (PII) such as attendee email or phone number is encoded in the QR code.
4. **Authentication & Authorization**: EventKit does not provide HTTP server middleware, authentication, or payment processing. These must be implemented in the host application.

---

## Reporting a Vulnerability

If you discover a security vulnerability in EventKit, please do **NOT** open a public issue on GitHub. Public disclosure could put applications using EventKit at risk before a fix is available.

Instead, please report security concerns responsibly:
- **Security Contact**: Contact the maintainer via GitHub security advisories at `https://github.com/nsaky/eventkit/security/advisories` or email `[SECURITY_CONTACT_EMAIL]` (maintainer to configure before public launch).
- Please include:
  - Description of the vulnerability.
  - Step-by-step reproduction instructions or proof-of-concept script.
  - Potential impact and affected versions.

We will acknowledge receipt within 48 hours and work with you to coordinate a responsible public disclosure and release a patched version.
