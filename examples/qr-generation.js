'use strict';

const path = require('path');
const EventKit = require('../src/index');

async function main() {
  const storagePath = path.resolve(__dirname, '../eventkit-qr-example-data');
  const pngFilePath = path.join(storagePath, 'attendee-ticket.png');
  const svgFilePath = path.join(storagePath, 'attendee-ticket.svg');

  console.log('=== EventKit: QR Code Generation Example ===\n');

  // Initialize
  await EventKit.initialize({ storagePath });

  const event = await EventKit.createEvent({
    name: 'Mobile & Cloud Expo',
    date: '2026-12-10'
  });

  const attendee = await EventKit.registerAttendee(event.id, {
    name: 'Alex Mercer',
    email: 'alex@proto.io'
  });

  console.log(`Registered Attendee: ${attendee.name}`);
  console.log(`Ticket ID: ${attendee.ticket.id}\n`);

  // 1. Generate PNG QR code
  console.log('1. Generating PNG QR code and saving to disk:');
  const pngResult = await EventKit.generateQRCode(attendee.ticket.id, {
    format: 'png',
    width: 300,
    filePath: pngFilePath,
    overwrite: true
  });
  console.log(`   ✓ Format: ${pngResult.format} (${pngResult.mimeType})`);
  console.log(`   ✓ Buffer Size: ${pngResult.data.length} bytes`);
  console.log(`   ✓ Saved to: ${pngResult.filePath}\n`);

  // 2. Generate SVG QR code
  console.log('2. Generating SVG QR code:');
  const svgResult = await EventKit.generateQRCode(attendee.ticket.id, {
    format: 'svg',
    filePath: svgFilePath,
    overwrite: true
  });
  console.log(`   ✓ Format: ${svgResult.format} (${svgResult.mimeType})`);
  console.log(`   ✓ XML String Length: ${svgResult.data.length} characters`);
  console.log(`   ✓ Saved to: ${svgResult.filePath}\n`);

  console.log('=== QR code generation example completed successfully! ===');
  console.log(`Demonstration files stored at: ${storagePath}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('QR generation example failed:', err);
    process.exit(1);
  });
}

module.exports = main;
