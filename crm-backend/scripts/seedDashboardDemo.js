require('dotenv').config();
const mongoose = require('mongoose');
const BusinessUnit = require('../models/BusinessUnit');
const ClientDataset = require('../models/ClientDataset');
const Meeting = require('../models/Meeting');
const User = require('../models/User');

const DEMO_PREFIX = '[Dashboard Demo]';
const statuses = [
  'Pending',
  'Contacted',
  'Follow Up',
  'Interested',
  'Converted',
  'Not Interested',
  'Not Reachable',
];

const companies = [
  'Northstar Retail',
  'Vertex Hospitality',
  'Greenline Foods',
  'UrbanGrid Spaces',
  'Apex Healthcare',
  'Nova Consumer Labs',
  'BluePeak Events',
  'Summit Technologies',
];

const buildRows = (unitIndex, count = 28) =>
  Array.from({ length: count }, (_, index) => {
    const company = companies[(index + unitIndex * 2) % companies.length];
    const status = statuses[(index + unitIndex) % statuses.length];
    return [
      `${company} ${index + 1}`,
      `Contact ${index + 1}`,
      `98${String(unitIndex + 1)}${String(1000000 + index).slice(-7)}`,
      `lead${unitIndex + 1}-${index + 1}@example.com`,
      ['Delhi', 'Mumbai', 'Bengaluru', 'Noida'][index % 4],
      ['Website', 'Referral', 'Event', 'Inbound Call'][index % 4],
      status,
      status === 'Follow Up' ? 'Follow up this week' : '',
      '',
    ];
  });

const run = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Set MONGO_URI or MONGODB_URI before running the demo seed');

  await mongoose.connect(mongoUri);
  const [businessUnits, employees, admin] = await Promise.all([
    BusinessUnit.find({ status: 'active' }).sort({ name: 1 }).lean(),
    User.find({ role: 'employee', accountStatus: 'active', isDeleted: { $ne: true } })
      .sort({ name: 1 })
      .limit(8)
      .lean(),
    User.findOne({ role: 'admin', accountStatus: 'active' }).lean(),
  ]);

  if (!businessUnits.length) throw new Error('No active Business Unit found');
  if (!employees.length) throw new Error('Create at least one active employee before seeding');

  let datasetCount = 0;
  let assignmentCount = 0;
  for (const [unitIndex, unit] of businessUnits.slice(0, 3).entries()) {
    const rows = buildRows(unitIndex);
    const rowAssignments = rows.map((_, rowIndex) => {
      const employee = employees[rowIndex % employees.length];
      return {
        rowIndex,
        employee: employee._id,
        employeeName: employee.name || employee.email,
        assignedBy: admin?._id || employee._id,
        assignedAt: new Date(),
      };
    });
    const name = `${DEMO_PREFIX} ${unit.name} Pipeline`;
    await ClientDataset.findOneAndUpdate(
      { name },
      {
        $set: {
          businessUnitId: unit._id,
          communityKey: unit.legacyCommunityKey,
          tableFormat: unit.legacyCommunityKey || 'exhibition',
          officeModule: 'Sales',
          team: 'Sales Team',
          year: String(new Date().getFullYear()),
          label: 'Prospect List',
          priority: unitIndex === 0 ? 'High' : 'Medium',
          source: 'Dashboard Demo Seed',
          ownerAlias: admin?.name || 'Admin',
          salesStage: 'Qualification',
          originalFileName: 'dashboard-demo.xlsx',
          columns: ['Company Name', 'Client Name', 'Phone', 'Email', 'City', 'Source', 'Status', 'Remark', 'Employee'],
          rows,
          rowAssignments,
          rowCount: rows.length,
          uploadedBy: admin?._id || employees[0]._id,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true, runValidators: true },
    );
    datasetCount += 1;
    assignmentCount += rowAssignments.length;
  }

  const meetingDates = [1, 2, 4, 7].map((days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  });
  for (const [index, meetingDate] of meetingDates.entries()) {
    const employee = employees[index % employees.length];
    const meetingTitle = `${DEMO_PREFIX} ${companies[index]} Review`;
    await Meeting.findOneAndUpdate(
      { meetingTitle },
      {
        $set: {
          communityKey: businessUnits[index % businessUnits.length].legacyCommunityKey,
          businessUnitId: businessUnits[index % businessUnits.length]._id,
          officeModule: 'Sales',
          team: 'Sales Team',
          employee: employee._id,
          clientName: companies[index],
          companyName: companies[index],
          meetingTitle,
          meetingDate,
          meetingTime: ['10:30', '12:00', '15:00', '16:30'][index],
          meetingMode: index % 2 ? 'Phone' : 'Online',
          platformOrLocation: index % 2 ? 'Client call' : 'Google Meet',
          status: 'scheduled',
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
  }

  console.log(
    `Dashboard demo ready: ${datasetCount} datasets, ${assignmentCount} assigned leads, ${meetingDates.length} meetings.`,
  );
};

run()
  .catch((error) => {
    console.error('Dashboard demo seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
