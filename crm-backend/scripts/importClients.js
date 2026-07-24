const mongoose = require('mongoose');
const fs = require('fs');
const csvParser = require('csv-parser');
const Client = require('../models/Client');
require('dotenv').config();

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Function to import clients from CSV
const importClients = (filePath) => {
  const clients = [];
  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on('data', (row) => {
      console.log('Row data:', row);

      const client = {
        name: row['name'],
        contactInfo: {
          phone: row['phone_number'],
        },
        address: row['address'],
        website: row['website'],
        longitude: parseFloat(row['longitude']),
        latitude: parseFloat(row['latitude']),
      };
      clients.push(client);
    })
    .on('end', async () => {
      try {
        await Client.insertMany(clients);
        console.log('Client data successfully imported');
        mongoose.connection.close();
      } catch (error) {
        console.error('Error importing client data:', error);
        mongoose.connection.close();
      }
    });
};

importClients(
  '/Users/rishabhpratap009/Downloads/Google_map_data_scraper-main/output/dummy_data.csv',
);
