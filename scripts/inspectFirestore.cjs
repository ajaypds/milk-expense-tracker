const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function inspect() {
  console.log('--- Inspecting Firebase Auth Users ---');
  try {
    const userRecords = await admin.auth().listUsers(100);
    console.log(`Found ${userRecords.users.length} Auth users:`);
    userRecords.users.forEach((u) => {
      console.log(`- UID: ${u.uid}, Email: ${u.email || 'N/A'}, DisplayName: ${u.displayName || 'N/A'}`);
    });
  } catch (err) {
    console.warn('Could not list Auth users:', err.message);
  }

  console.log('\n--- Inspecting Firestore "users" Collection ---');
  try {
    const usersSnap = await db.collection('users').get();
    console.log(`Found ${usersSnap.docs.length} documents in "users" collection:`);
    for (const doc of usersSnap.docs) {
      console.log(`- User Doc ID: ${doc.id}`);
      const data = doc.data();
      console.log(`  Data:`, data);

      // Check subcollections
      const subcollections = await doc.ref.listCollections();
      console.log(`  Subcollections for ${doc.id}:`, subcollections.map(c => c.id));

      for (const sub of subcollections) {
        const subSnap = await sub.get();
        console.log(`    Subcollection "${sub.id}" has ${subSnap.size} documents.`);
        if (sub.id === 'settings') {
          subSnap.forEach(d => console.log(`      settings/${d.id}:`, d.data()));
        } else if (sub.id === 'billingPeriods') {
          console.log(`      billingPeriods sample IDs:`, subSnap.docs.slice(0, 5).map(d => d.id));
        } else if (sub.id === 'milkEntries') {
          console.log(`      milkEntries count: ${subSnap.size}`);
          if (subSnap.size > 0) {
            console.log(`      Sample entry:`, subSnap.docs[0].data());
          }
        }
      }
    }

    // Check if 'defaultUser' exists even if not in root list
    const defaultUserRef = db.collection('users').doc('defaultUser');
    const defaultSubs = await defaultUserRef.listCollections();
    console.log(`\nDirect check for 'defaultUser' subcollections:`, defaultSubs.map(c => c.id));
    for (const sub of defaultSubs) {
      const subSnap = await sub.get();
      console.log(`  Subcollection "${sub.id}" has ${subSnap.size} documents.`);
      if (sub.id === 'settings') {
        subSnap.forEach(d => console.log(`    settings/${d.id}:`, d.data()));
      } else if (sub.id === 'billingPeriods') {
        console.log(`    billingPeriods IDs:`, subSnap.docs.map(d => d.id));
      } else if (sub.id === 'milkEntries') {
        console.log(`    milkEntries count: ${subSnap.size}`);
        if (subSnap.size > 0) {
          console.log(`    Sample entry:`, subSnap.docs[0].data());
        }
      }
    }
  } catch (err) {
    console.error('Error inspecting Firestore:', err);
  }
}

inspect().then(() => {
  console.log('\nInspection complete.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
