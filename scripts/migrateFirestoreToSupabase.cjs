const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Simple .env parser to load configuration
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER_EMAIL = 'ajay.pds2@gmail.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials in .env!');
  process.exit(1);
}

// 2. Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();

// 3. Initialize Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper to calculate billing period (10th of prev month to 9th of current month)
function getMonthPeriod(dateObj) {
  const year = dateObj.getFullYear();
  const month0 = dateObj.getMonth();
  const day = dateObj.getDate();
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
  const pad = (n) => String(n).padStart(2, '0');
  return `${periodYear}-${pad(periodMonth)}`;
}

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 Starting Migration: Firebase Firestore -> Supabase');
  console.log('====================================================\n');

  // STEP 1: Ensure Target User exists in Supabase Auth
  console.log(`Checking user account for: ${TARGET_USER_EMAIL}...`);
  const { data: userListData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  let targetUser = userListData.users.find(u => u.email?.toLowerCase() === TARGET_USER_EMAIL.toLowerCase());

  if (!targetUser) {
    console.log(`User ${TARGET_USER_EMAIL} not found in Supabase Auth. Creating account...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: TARGET_USER_EMAIL,
      email_confirm: true,
      user_metadata: { displayName: 'Ajay Prasad' },
    });
    if (createError) throw createError;
    targetUser = createData.user;
    console.log(`✅ Created Supabase Auth User with ID: ${targetUser.id}`);
  } else {
    console.log(`✅ Found existing Supabase Auth User with ID: ${targetUser.id}`);
  }

  const userId = targetUser.id;

  // STEP 2: Migrate Settings and Milk Rate
  console.log('\n--- Step 2: Migrating Settings & Rate ---');
  const settingsDocRef = firestore.collection('users').doc('defaultUser').collection('settings').doc('appSettings');
  const settingsDoc = await settingsDocRef.get();
  const settingsData = settingsDoc.exists ? settingsDoc.data() : { milkRate: 55, paymentStatus: {} };
  const currentRate = Number(settingsData.milkRate) || 55;
  const paymentStatusMap = settingsData.paymentStatus || {};

  console.log(`Firestore Milk Rate: ₹${currentRate}`);
  console.log(`Payment Statuses found for periods:`, Object.keys(paymentStatusMap));

  // Upsert user_settings
  const { error: settingsError } = await supabase.from('user_settings').upsert({
    user_id: userId,
    cycle_start_day: 10,
    daily_reminder_enabled: true,
    updated_at: new Date().toISOString(),
  });
  if (settingsError) throw new Error(`Error saving user_settings: ${settingsError.message}`);
  console.log('✅ User settings saved (cycle start day = 10).');

  // Insert baseline milk_rate with early effective_from date
  const { error: rateError } = await supabase.from('milk_rates').upsert({
    user_id: userId,
    rate: currentRate,
    effective_from: '2020-01-01',
  }, { onConflict: 'user_id,effective_from' });
  if (rateError) throw new Error(`Error saving milk_rates: ${rateError.message}`);
  console.log(`✅ Milk rate ₹${currentRate} inserted with effective_from = 2020-01-01.`);

  // STEP 3: Migrate Daily Milk Entries
  console.log('\n--- Step 3: Migrating Daily Milk Entries ---');
  const entriesSnap = await firestore.collection('users').doc('defaultUser').collection('milkEntries').get();
  console.log(`Fetched ${entriesSnap.size} entries from Firestore.`);

  const periodLitersMap = {};
  const entriesToInsert = [];

  for (const doc of entriesSnap.docs) {
    const d = doc.data();
    let dateStr = '';
    const rawDate = d.date;
    if (typeof rawDate === 'string') dateStr = rawDate;
    else if (rawDate && typeof rawDate.toDate === 'function') {
      dateStr = rawDate.toDate().toISOString().split('T')[0];
    } else if (rawDate != null) dateStr = String(rawDate);

    if (!dateStr || !dateStr.includes('-')) {
      console.warn(`Skipping invalid date entry ID ${doc.id}:`, d);
      continue;
    }

    const milkTaken = Boolean(d.milkTaken);
    const quantity = milkTaken ? (Number(d.quantity) || 0) : 0;
    const period = d.billingPeriod || getMonthPeriod(new Date(dateStr));

    // Track total liters per period
    periodLitersMap[period] = (periodLitersMap[period] || 0) + quantity;

    entriesToInsert.push({
      user_id: userId,
      entry_date: dateStr,
      milk_taken: milkTaken,
      quantity: quantity,
      billing_period: period,
    });
  }

  // Deduplicate entries by date if any duplicate dates exist in Firestore
  const uniqueEntriesMap = new Map();
  for (const item of entriesToInsert) {
    uniqueEntriesMap.set(item.entry_date, item);
  }
  const deduplicatedEntries = Array.from(uniqueEntriesMap.values());
  console.log(`Prepared ${deduplicatedEntries.length} unique daily entries.`);

  // Insert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < deduplicatedEntries.length; i += BATCH_SIZE) {
    const batch = deduplicatedEntries.slice(i, i + BATCH_SIZE);
    const { error: batchError } = await supabase.from('milk_entries').upsert(batch, {
      onConflict: 'user_id,entry_date',
    });
    if (batchError) throw new Error(`Error inserting entries batch [${i}..${i + batch.length}]: ${batchError.message}`);
    console.log(`  Inserted entries ${i + 1} to ${Math.min(i + batch.length, deduplicatedEntries.length)}...`);
  }
  console.log(`✅ All ${deduplicatedEntries.length} entries successfully inserted into Supabase!`);

  // STEP 4: Migrate Billing Periods & Freeze Paid Amounts
  console.log('\n--- Step 4: Migrating Billing Periods & Payment Statuses ---');
  const periodsSnap = await firestore.collection('users').doc('defaultUser').collection('billingPeriods').get();
  const firestorePeriods = new Set(periodsSnap.docs.map(d => d.id));

  // Also include any periods that exist in entries or paymentStatus
  Object.keys(periodLitersMap).forEach(p => firestorePeriods.add(p));
  Object.keys(paymentStatusMap).forEach(p => firestorePeriods.add(p));

  const sortedPeriods = Array.from(firestorePeriods).sort();
  console.log(`Total billing periods to process: ${sortedPeriods.length}`);

  const billingPeriodsToInsert = [];
  for (const period of sortedPeriods) {
    const totalLiters = Number((periodLitersMap[period] || 0).toFixed(2));
    const status = paymentStatusMap[period] === 'Paid' ? 'Paid' : 'Unpaid';
    const totalAmount = Number((totalLiters * currentRate).toFixed(2));
    const paidAt = status === 'Paid' ? new Date().toISOString() : null;

    billingPeriodsToInsert.push({
      user_id: userId,
      billing_period: period,
      payment_status: status,
      total_liters: totalLiters,
      effective_rate: currentRate,
      total_amount: totalAmount,
      paid_at: paidAt,
    });
  }

  const { error: bpError } = await supabase.from('billing_periods').upsert(billingPeriodsToInsert, {
    onConflict: 'user_id,billing_period',
  });
  if (bpError) throw new Error(`Error inserting billing_periods: ${bpError.message}`);
  console.log(`✅ Inserted ${billingPeriodsToInsert.length} billing periods with frozen rates & totals.`);

  // STEP 5: Reconciliation & Verification
  console.log('\n====================================================');
  console.log('🔍 Reconciliation & Integrity Check');
  console.log('====================================================');

  const { count: supabaseEntriesCount, error: countErr } = await supabase
    .from('milk_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { data: supabasePeriods, error: bpFetchErr } = await supabase
    .from('billing_periods')
    .select('*')
    .eq('user_id', userId)
    .order('billing_period', { ascending: true });

  console.log(`Firestore Total Entries: ${entriesSnap.size}`);
  console.log(`Supabase Total Entries : ${supabaseEntriesCount}`);

  console.log('\nBilling Period Summary in Supabase:');
  console.log('----------------------------------------------------------------------');
  console.log('Period   | Status | Liters  | Rate  | Amount (₹) | Paid At');
  console.log('----------------------------------------------------------------------');
  supabasePeriods.forEach(bp => {
    console.log(
      `${bp.billing_period.padEnd(8)} | ` +
      `${bp.payment_status.padEnd(6)} | ` +
      `${String(bp.total_liters).padStart(7)} | ` +
      `₹${String(bp.effective_rate).padStart(4)} | ` +
      `₹${String(bp.total_amount).padStart(8)} | ` +
      `${bp.paid_at ? bp.paid_at.split('T')[0] : '-'}`
    );
  });
  console.log('----------------------------------------------------------------------');

  console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
}

runMigration().catch(err => {
  console.error('\n❌ Migration Failed with Error:', err);
  process.exit(1);
});
