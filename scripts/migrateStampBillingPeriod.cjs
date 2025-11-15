
// Migration script: stamp `billingPeriod` on existing milkEntries documents.
//
// Usage examples (Windows cmd):
//   SET GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccountKey.json
//   node scripts\migrateStampBillingPeriod.cjs               # full run
//   node scripts\migrateStampBillingPeriod.cjs --dry-run     # show changes but don't write
//   node scripts\migrateStampBillingPeriod.cjs --user uid123 --dry-run
//
// Notes:
//  - Test with --user and --dry-run first.
//  - Script is idempotent and will merge billingPeriod into existing docs.

const admin = require('firebase-admin');
const path = require('path');

const argv = process.argv.slice(2);
const opts = {
    dryRun: argv.includes('--dry-run'),
    userOnly: null,
    limitPerUser: null,
};
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--user' && argv[i + 1]) {
        opts.userOnly = argv[i + 1];
        i++;
    }
    if (argv[i] === '--limit' && argv[i + 1]) {
        opts.limitPerUser = parseInt(argv[i + 1], 10) || null;
        i++;
    }
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Please set GOOGLE_APPLICATION_CREDENTIALS to the service account JSON path');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

function getMonthPeriod(date) {
    const year = date.getFullYear();
    const month0 = date.getMonth();
    const day = date.getDate();
    const currentMonth1 = month0 + 1;
    let periodYear = year;
    let periodMonth = currentMonth1;
    if (day >= 10) {
        if (currentMonth1 === 12) {
            periodYear = year + 1;
            periodMonth = 1;
        } else {
            periodMonth = currentMonth1 + 1;
        }
    }
    return `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
}

function toDateFromField(raw) {
    if (!raw) return null;
    // Firestore Timestamp
    if (typeof raw === 'object' && raw !== null) {
        // admin.firestore.Timestamp instance
        if (raw instanceof admin.firestore.Timestamp) return raw.toDate();
        // client Timestamp-like with toDate
        if (typeof raw.toDate === 'function') return raw.toDate();
        // plain object with seconds
        if (typeof raw.seconds === 'number') return new Date(raw.seconds * 1000);
    }
    // string or number
    if (typeof raw === 'string' || typeof raw === 'number') {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

async function migrate() {
    console.log('Starting migration: stamping billingPeriod on milkEntries');

    const usersRef = db.collection('users');

    if (opts.userOnly) {
        // Process a single user
        const userId = opts.userOnly;
        console.log('Processing single user', userId);
        const entriesRef = usersRef.doc(userId).collection('milkEntries');
        const entriesSnap = await entriesRef.get();
        console.log('  found', entriesSnap.size, 'entries for', userId);

        let processed = 0;
        for (const entryDoc of entriesSnap.docs) {
            if (opts.limitPerUser && processed >= opts.limitPerUser) break;
            processed++;
            const data = entryDoc.data();
            try {
                const rawDate = data ? data.date : null;
                const parsed = toDateFromField(rawDate);
                if (!parsed) {
                    console.warn('   skipping', entryDoc.id, 'unable to parse date field:', rawDate);
                    continue;
                }
                const bp = getMonthPeriod(parsed);
                if (opts.dryRun) {
                    console.log('[dry-run] would stamp', `${userId}/milkEntries/${entryDoc.id}`, '->', bp);
                } else {
                    await entryDoc.ref.set({ billingPeriod: bp }, { merge: true });
                    await usersRef.doc(userId).collection('billingPeriods').doc(bp).set({ period: bp, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    console.log('   stamped', entryDoc.id, '->', bp);
                }
            } catch (err) {
                console.error('   failed to process', entryDoc.id, err);
            }
        }
    } else {
        // Process all milkEntries across all users using a collectionGroup query
        console.log('Processing all users via collectionGroup(milkEntries)');
        const allEntriesSnap = await db.collectionGroup('milkEntries').get();
        console.log('  found', allEntriesSnap.size, 'total entries across users');
        let processed = 0;
        for (const entryDoc of allEntriesSnap.docs) {
            processed++;
            const data = entryDoc.data();
            try {
                const rawDate = data ? data.date : null;
                const parsed = toDateFromField(rawDate);
                if (!parsed) {
                    console.warn('   skipping', entryDoc.id, 'unable to parse date field:', rawDate);
                    continue;
                }
                const bp = getMonthPeriod(parsed);
                // derive userId from parent path: users/{userId}/milkEntries/{doc}
                const parent = entryDoc.ref.parent; // milkEntries collection ref
                const userDocRef = parent && parent.parent;
                const userId = userDocRef ? userDocRef.id : '<unknown-user>';
                if (opts.dryRun) {
                    console.log('[dry-run] would stamp', `${userId}/milkEntries/${entryDoc.id}`, '->', bp);
                } else {
                    await entryDoc.ref.set({ billingPeriod: bp }, { merge: true });
                    if (userDocRef) {
                        await usersRef.doc(userId).collection('billingPeriods').doc(bp).set({ period: bp, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    }
                    console.log('   stamped', `${userId}/${entryDoc.id}`, '->', bp);
                }
            } catch (err) {
                console.error('   failed to process', entryDoc.id, err);
            }
            if (opts.limitPerUser && processed >= opts.limitPerUser) break;
        }
    }

    console.log('Migration completed');
}

migrate().catch((err) => {
    console.error('Migration failed', err);
    process.exit(2);
});
