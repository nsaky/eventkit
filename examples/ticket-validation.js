'use strict';

const path = require('path');
const EventKit = require('../src/index');

async function main() {
  const storagePath = path.resolve(__dirname, '../eventkit-validation-example-data');

  console.log('=== EventKit: Ticket Validation Example ===\n');

  // Initialize
  await EventKit.initialize({ storagePath });

  // Create two events
  const conference = await EventKit.createEvent({
    name: 'Tech Conference 2026',
    date: '2026-11-20',
    capacity: 10
  });

  const workshop = await EventKit.createEvent({
    name: 'Hands-on Lab Workshop',
    date: '2026-11-21',
    capacity: 5
  });

  // Register attendees
  const attendee = await EventKit.registerAttendee(conference.id, {
    name: 'Sarah Connor',
    email: 'sarah@resistance.org'
  });

  console.log(`Registered Attendee: ${attendee.name}`);
  console.log(`Ticket ID: ${attendee.ticket.id} for Event: ${conference.name} (${conference.id})\n`);

  // 1. Validate active ticket for matching event
  console.log('1. Validating active ticket against correct event:');
  const validCheck = await EventKit.validateTicket(conference.id, attendee.ticket.id);
  console.log(`   Status: ${validCheck.status} | Valid: ${validCheck.valid}`);
  console.log(`   Message: ${validCheck.message}\n`);

  // 2. Validate ticket against wrong event
  console.log('2. Validating ticket against a different event:');
  const wrongEventCheck = await EventKit.validateTicket(workshop.id, attendee.ticket.id);
  console.log(`   Status: ${wrongEventCheck.status} | Valid: ${wrongEventCheck.valid}`);
  console.log(`   Message: ${wrongEventCheck.message}\n`);

  // 3. Validate non-existent ticket
  console.log('3. Validating a non-existent ticket ID:');
  const invalidCheck = await EventKit.validateTicket(conference.id, 'EK-9999999999');
  console.log(`   Status: ${invalidCheck.status} | Valid: ${invalidCheck.valid}`);
  console.log(`   Message: ${invalidCheck.message}\n`);

  // 4. Check in attendee, then validate
  console.log('4. Checking in attendee and re-validating:');
  await EventKit.checkIn(conference.id, attendee.ticket.id);
  const alreadyUsedCheck = await EventKit.validateTicket(conference.id, attendee.ticket.id);
  console.log(`   Status: ${alreadyUsedCheck.status} | Valid: ${alreadyUsedCheck.valid}`);
  console.log(`   Message: ${alreadyUsedCheck.message}\n`);

  console.log('=== Ticket validation example completed successfully! ===');
  console.log(`Demonstration data stored at: ${storagePath}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Validation example failed:', err);
    process.exit(1);
  });
}

module.exports = main;
