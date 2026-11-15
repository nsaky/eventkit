'use strict';

const path = require('path');
const fs = require('fs/promises');
const EventKit = require('../src/index');

async function main() {
  const exampleStoragePath = path.resolve(__dirname, '../eventkit-example-data');

  console.log('=== EventKit: Basic Usage Demonstration ===\n');

  try {
    // 1. Initialize EventKit with a custom storage path
    console.log(`1. Initializing EventKit with storage directory: ${exampleStoragePath}`);
    await EventKit.initialize({ storagePath: exampleStoragePath });
    console.log('   ✓ Storage initialized.\n');

    // 2. Create an event
    console.log('2. Creating a new event: "Tech Summit 2026"');
    const event = await EventKit.createEvent({
      name: 'Tech Summit 2026',
      description: 'Annual conference exploring the future of cloud and distributed systems.',
      date: '2026-12-15',
      location: 'Pune',
      capacity: 2
    });
    console.log('   ✓ Event created successfully:');
    console.log(`     ID: ${event.id}`);
    console.log(`     Name: ${event.name}`);
    console.log(`     Date: ${event.date}`);
    console.log(`     Capacity: ${event.capacity}\n`);

    // 3. Register attendees
    console.log('3. Registering attendees...');
    const attendee1 = await EventKit.registerAttendee(event.id, {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+919876543210'
    });
    console.log(`   ✓ Registered: ${attendee1.name} (${attendee1.email}) -> ID: ${attendee1.id}`);

    const attendee2 = await EventKit.registerAttendee(event.id, {
      name: 'Jane Smith',
      email: 'Jane.Smith@Example.COM' // test email normalization
    });
    console.log(`   ✓ Registered: ${attendee2.name} (${attendee2.email}) -> ID: ${attendee2.id}\n`);

    // 4. Duplicate registration prevention
    console.log('4. Attempting duplicate registration with normalized email...');
    try {
      await EventKit.registerAttendee(event.id, {
        name: 'John Doe Duplicate',
        email: '  JOHN@EXAMPLE.COM  '
      });
    } catch (err) {
      console.log(`   ✓ Correctly caught duplicate error: [${err.code}] ${err.message}\n`);
    }

    // 5. Capacity enforcement
    console.log('5. Attempting registration when capacity is reached (capacity = 2)...');
    try {
      await EventKit.registerAttendee(event.id, {
        name: 'Overflow Attendee',
        email: 'overflow@example.com'
      });
    } catch (err) {
      console.log(`   ✓ Correctly caught capacity error: [${err.code}] ${err.message}\n`);
    }

    // 6. Update event capacity
    console.log('6. Increasing event capacity from 2 to 5...');
    const updatedEvent = await EventKit.updateEvent(event.id, { capacity: 5 });
    console.log(`   ✓ Event capacity updated: ${updatedEvent.capacity}\n`);

    // Now registration succeeds
    const attendee3 = await EventKit.registerAttendee(event.id, {
      name: 'Overflow Attendee',
      email: 'overflow@example.com'
    });
    console.log(`   ✓ Successfully registered after capacity increase: ${attendee3.name}\n`);

    // 7. Retrieve attendees for the event
    console.log(`7. Retrieving all attendees for event: ${event.id}`);
    const attendees = await EventKit.getAttendees(event.id);
    console.log(`   Total registered attendees: ${attendees.length}`);
    attendees.forEach((att, idx) => {
      console.log(`     ${idx + 1}. ${att.name} <${att.email}> (Status: ${att.status})`);
    });
    console.log('');

    // 8. Remove an attendee
    console.log(`8. Removing attendee: ${attendee3.id} (${attendee3.name})...`);
    const removed = await EventKit.removeAttendee(attendee3.id);
    console.log(`   ✓ Removed attendee: ${removed.name}\n`);

    // 9. Event deletion with cascade attendee removal
    console.log(`9. Deleting event: ${event.id}...`);
    const deleted = await EventKit.deleteEvent(event.id);
    console.log(`   ✓ Event "${deleted.name}" and associated attendees deleted successfully.\n`);

    console.log('=== Demonstration completed successfully! ===');
  } finally {
    // Clean up demo files
    try {
      await fs.rm(exampleStoragePath, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Demonstration failed:', err);
    process.exit(1);
  });
}

module.exports = main;
