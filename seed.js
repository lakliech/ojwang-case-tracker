const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Report = require('./models/Report');
const fs = require('fs');

dotenv.config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const raw = fs.readFileSync('./db.json');
    const data = JSON.parse(raw);

    const timelineDocs = data.timeline.map(item => ({
      datetime: item.datetime,
      date: item.datetime.split('T')[0],
      event: item.event,
      description: item.event,
      source: item.source,
      category: 'timeline'
    }));

    const conflictDocs = data.contradictions.map(item => ({
      issue: item.issue,
      description: item.description,
      source: item.source,
      category: 'conflict'
    }));

    await Report.deleteMany({});
    await Report.insertMany([...timelineDocs, ...conflictDocs]);

    console.log('✅ Seeded database with timeline and contradictions.');
    process.exit();
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();

