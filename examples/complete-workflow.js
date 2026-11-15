'use strict';

const path = require('path');
const fs = require('fs/promises');
const EventKit = require('../src/index');

async function main() {
  const exampleStoragePath = path.resolve(__dirname, '../eventkit-phase2-example-data');
  const qrOutputPath = path.join(exampleStoragePath, 'ticket-qr.png');
  const csvOutputPath = path.join(exampleStoragePath, 'attendees-export.csv');

  console.log('=== EventKit Phase 2: Complete Workflow Demonstration ===\n');

  try {
    // 1. Initialize EventKit
    console.log(`1. Initializing EventKit at storage directory: ${exampleStoragePath}`);
    await EventKit.initialize({ storagePath: exampleStoragePath });
    console.log('   ✓ Storage initialized.\n');

    // 2. Create an event
    console.log('2. Creating Event: "AI & Distributed Systems Con 2026"');
    const event = await EventKit.createEvent({
      name: 'AI & Distributed Systems Con 2026',
      description: 'Annual gathering for systems engineers and AI practitioners.',
      date: '2026-11-20',
      location: 'Bengaluru',
      capacity: 5
    });
    console.log(`   ✓ Event Created: ID = ${event.id}, Capacity = ${event.capacity}\n`);

    // 3. Register participants (automatic ticket generation)
    console.log('3. Registering attendees (with automatic ticket generation)...');
    const attendee1 = await EventKit.registerAttendee(event.id, {
      name: 'Dr. Evelyn Carter',
      email: 'evelyn.carter@ai-research.org',
      phone: '+91 9876543210'
    });
    console.log(`   ✓ Registered: ${attendee1.name} (Ticket: ${attendee1.ticket.id}, Status: ${attendee1.ticket.status})`);

    const attendee2 = await EventKit.registerAttendee(event.id, {
      name: 'Marcus Vance',
      email: 'marcus@kernel-systems.io'
    });
    console.log(`   ✓ Registered: ${attendee2.name} (Ticket: ${attendee2.ticket.id}, Status: ${attendee2.ticket.status})`);

    const attendee3 = await EventKit.registerAttendee(event.id, {
      name: 'Priya Sharma',
      email: 'priya@cloudnative.in'
    });
    console.log(`   ✓ Registered: ${attendee3.name} (Ticket: ${attendee3.ticket.id}, Status: ${attendee3.ticket.status})\n`);

    // 4. Generate QR Code
    console.log(`4. Generating PNG QR code for ticket ${attendee1.ticket.id}...`);
    const qrResult = await EventKit.generateQRCode(attendee1.ticket.id, {
      format: 'png',
      width: 250,
      filePath: qrOutputPath
    });
    console.log(`   ✓ QR Code generated (MIME: ${qrResult.mimeType}, Size: ${qrResult.data.length} bytes)`);
    console.log(`   ✓ Saved to: ${qrResult.filePath}\n`);

    // 5. Validate Ticket before check-in
    console.log(`5. Validating ticket ${attendee1.ticket.id} against event ${event.id}...`);
    const validation = await EventKit.validateTicket(event.id, attendee1.ticket.id);
    console.log(`   ✓ Validation Result: Valid = ${validation.valid}, Status = ${validation.status} (${validation.message})\n`);

    // 6. Check in attendee
    console.log(`6. Checking in attendee ${attendee1.name} using ticket ${attendee1.ticket.id}...`);
    const checkInResult = await EventKit.checkIn(event.id, attendee1.ticket.id);
    console.log(`   ✓ Check-in Result: ${checkInResult.message}`);
    console.log(`   ✓ Timestamp: ${checkInResult.checkedInAt}\n`);

    // 7. Duplicate Check-in Prevention
    console.log('7. Attempting duplicate check-in for the same ticket...');
    try {
      await EventKit.checkIn(event.id, attendee1.ticket.id);
    } catch (err) {
      console.log(`   ✓ Correctly rejected duplicate check-in: [${err.code}] ${err.message}\n`);
    }

    // 8. Attendance Statistics
    console.log(`8. Calculating real-time attendance statistics for event ${event.id}...`);
    const stats = await EventKit.getAttendanceStats(event.id);
    console.log('   ✓ Attendance Stats:');
    console.log(`     - Total Registrations: ${stats.totalRegistrations}`);
    console.log(`     - Total Checked-in:    ${stats.totalCheckedIn}`);
    console.log(`     - Total Pending:       ${stats.totalPending}`);
    console.log(`     - Attendance Rate:     ${stats.attendancePercentage}%`);
    console.log(`     - Capacity:            ${stats.capacity}`);
    console.log(`     - Registration Rate:   ${stats.registrationPercentage}%\n`);

    // 9. Search Attendees
    console.log('9. Searching attendees (query: "priya")...');
    const searchResults = await EventKit.searchAttendees(event.id, 'priya');
    console.log(`   ✓ Found ${searchResults.length} matching attendee:`);
    searchResults.forEach(r => console.log(`     - ${r.name} <${r.email}> (Ticket: ${r.ticket.id})`));
    console.log('');

    // 10. Data Export (CSV and JSON)
    console.log('10. Exporting attendee records to CSV and JSON...');
    const csvExport = await EventKit.exportAttendees(event.id, 'csv', {
      filePath: csvOutputPath
    });
    console.log(`    ✓ CSV exported and saved to: ${csvExport.filePath}`);

    const jsonExport = await EventKit.exportEvent(event.id, 'json');
    console.log(`    ✓ JSON snapshot exported (${jsonExport.length} characters)\n`);

    console.log('=== Complete Phase 2 demonstration finished successfully! ===');
  } finally {
    // Clean up temporary demonstration files
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
