'use strict';

const path = require('path');
const EventKit = require('../src/index');

async function main() {
  const storagePath = path.resolve(__dirname, '../eventkit-export-example-data');
  const csvFilePath = path.join(storagePath, 'export-attendees.csv');
  const jsonFilePath = path.join(storagePath, 'export-event.json');

  console.log('=== EventKit: Data Export Example ===\n');

  // Initialize
  await EventKit.initialize({ storagePath });

  const event = await EventKit.createEvent({
    name: 'Data Engineering Summit',
    date: '2026-11-28',
    capacity: 50
  });

  // Register attendees with special characters in names
  const a1 = await EventKit.registerAttendee(event.id, {
    name: 'Linus Torvalds',
    email: 'linus@kernel.org'
  });

  const a2 = await EventKit.registerAttendee(event.id, {
    name: 'Ada Lovelace, Countess',
    email: 'ada@computing.org',
    phone: '+44 20 7946 0991'
  });

  // Check in one attendee
  await EventKit.checkIn(event.id, a1.ticket.id);

  console.log(`Created event: ${event.name} with 2 registered attendees.\n`);

  // 1. Export attendees to CSV
  console.log('1. Exporting attendee list to CSV:');
  const csvResult = await EventKit.exportAttendees(event.id, 'csv', {
    filePath: csvFilePath,
    overwrite: true
  });
  console.log(`   ✓ CSV saved to: ${csvResult.filePath}`);
  console.log('   --- CSV Content Preview ---');
  console.log(csvResult.content.trim());
  console.log('   ---------------------------\n');

  // 2. Export full event snapshot to JSON
  console.log('2. Exporting full event snapshot to JSON:');
  const jsonResult = await EventKit.exportEvent(event.id, 'json', {
    filePath: jsonFilePath,
    overwrite: true
  });
  console.log(`   ✓ JSON saved to: ${jsonResult.filePath}`);
  console.log(`   ✓ Size: ${jsonResult.content.length} bytes\n`);

  console.log('=== Data export example completed successfully! ===');
  console.log(`Exported files stored at: ${storagePath}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Data export example failed:', err);
    process.exit(1);
  });
}

module.exports = main;
