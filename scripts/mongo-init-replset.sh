#!/bin/bash
set -e

echo "Initializing MongoDB replica set rs0..."
mongosh --eval "
  try {
    rs.status();
    console.log('Replica set already initialized.');
  } catch (err) {
    console.log('Initiating replica set rs0...');
    rs.initiate({
      _id: 'rs0',
      members: [{ _id: 0, host: 'localhost:27017' }]
    });
  }
"
