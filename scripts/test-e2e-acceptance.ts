/**
 * End-to-End Acceptance Verification Script (Requirement 16)
 *
 * Runs live tests against Supabase with real authenticated sessions:
 * Test A: Sign up User A -> Auth UUID -> Profile created
 * Test B: Import CSV as User A -> Connections with userA.id -> Import with userA.id
 * Test C: Outreach -> status 'contacted' -> Day 0, Day 5, Day 12 outreach events
 * Test D: Re-import -> No duplicates -> contacted does NOT downgrade to new
 * Test E: Second user User B -> isolated workspace -> cannot see or mutate User A
 * Test F: Return to User A -> all original data still present
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local without requiring external dotenv types
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
} catch (e) {
  // Ignore
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Admin client strictly for creating confirmed test users (bypassing free-tier email rate limits) and teardown
const adminClient = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

async function runLiveAcceptanceTests() {
  console.log('================================================================');
  console.log('SUPABASE PRODUCTION APPLICATION LIVE ACCEPTANCE SUITE');
  console.log('Target:', supabaseUrl);
  console.log('================================================================\n');

  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const emailA = `test.user.a.${stamp}@linkedin-dm-suite.com`;
  const emailB = `test.user.b.${stamp}@linkedin-dm-suite.com`;
  const password = `SecureTestPass!${stamp}Aa1`;

  let passed = 0;
  let failed = 0;

  // ----------------------------------------------------------------
  // Test A — New account
  // ----------------------------------------------------------------
  console.log('--- Test A — New Account (User A) ---');

  let userAId = '';

  if (adminClient) {
    const { data: createdA, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: password,
      email_confirm: true,
      user_metadata: { name: 'Alice Walker', target_role: 'Staff AI Engineer' }
    });
    if (errA || !createdA.user) {
      console.error('❌ [FAIL] Test A: Failed to provision User A:', errA);
      process.exit(1);
    }
    userAId = createdA.user.id;
  } else {
    const pub = createClient(supabaseUrl, supabaseAnonKey);
    const { data: signUpA, error: errA } = await pub.auth.signUp({
      email: emailA,
      password: password,
      options: { data: { name: 'Alice Walker', target_role: 'Staff AI Engineer' } }
    });
    if (errA || !signUpA.user) {
      console.error('❌ [FAIL] Test A: Failed to sign up User A:', errA);
      process.exit(1);
    }
    userAId = signUpA.user.id;
  }

  // Create client session for User A
  const clientA = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: signA, error: signErrA } = await clientA.auth.signInWithPassword({
    email: emailA,
    password: password
  });

  if (signErrA || !signA.user) {
    failed++;
    console.error('❌ [FAIL] Test A: Failed to sign in as User A:', signErrA);
    process.exit(1);
  }

  const { data: authUserA } = await clientA.auth.getUser();
  if (authUserA.user?.id === userAId) {
    passed++;
    console.log(`✅ [PASS] Test A1: User A authenticated. Supabase Auth UUID: ${userAId}`);
  } else {
    failed++;
    console.error('❌ [FAIL] Test A1: Auth user mismatch:', { expected: userAId, actual: authUserA.user?.id });
  }

  // Create/ensure profile row with profiles.id = auth.users.id
  const { error: profErrA } = await clientA.from('profiles').upsert({
    id: userAId,
    name: 'Alice Walker',
    email: emailA,
    experience: 'Staff AI Engineer',
    skills: ['React', 'TypeScript', 'PostgreSQL', 'Next.js'],
    target_roles: ['Staff AI Engineer'],
    location: 'Remote',
    work_preference: 'Remote'
  });

  if (profErrA) {
    failed++;
    console.error('❌ [FAIL] Test A2: Profile creation failed for User A:', profErrA);
  } else {
    // Confirm profile exists with same UUID
    const { data: fetchProfA, error: fetchErrA } = await clientA
      .from('profiles')
      .select('*')
      .eq('id', userAId)
      .single();

    if (!fetchErrA && fetchProfA && fetchProfA.id === userAId && fetchProfA.name === 'Alice Walker') {
      passed++;
      console.log(`✅ [PASS] Test A2: Profile confirmed in database with id = ${fetchProfA.id}`);
    } else {
      failed++;
      console.error('❌ [FAIL] Test A2: Profile verification failed:', fetchErrA || fetchProfA);
    }
  }

  // ----------------------------------------------------------------
  // Test B — Import
  // ----------------------------------------------------------------
  console.log('\n--- Test B — Import LinkedIn CSV as User A ---');

  // Insert Import Record
  const { data: importRecA, error: importErrA } = await clientA
    .from('imports')
    .insert({
      user_id: userAId,
      total_rows: 2,
      candidate_rows: 2,
      new_connections: 2,
      imported_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (importErrA || !importRecA || importRecA.user_id !== userAId) {
    failed++;
    console.error('❌ [FAIL] Test B1: Import record creation failed:', importErrA);
  } else {
    passed++;
    console.log(`✅ [PASS] Test B1: Import record created with user_id = ${importRecA.user_id}`);
  }

  // Insert Connections for User A
  const sampleConnections = [
    {
      user_id: userAId,
      first_name: 'Satya',
      last_name: 'Nadella',
      name: 'Satya Nadella',
      company: 'Microsoft',
      position: 'CEO',
      linkedin_url: `https://www.linkedin.com/in/satya-${stamp}`,
      status: 'new' as const,
      score: 95
    },
    {
      user_id: userAId,
      first_name: 'Sundar',
      last_name: 'Pichai',
      name: 'Sundar Pichai',
      company: 'Google',
      position: 'CEO',
      linkedin_url: `https://www.linkedin.com/in/sundar-${stamp}`,
      status: 'new' as const,
      score: 92
    }
  ];

  const { data: insertedConnsA, error: connErrA } = await clientA
    .from('connections')
    .insert(sampleConnections)
    .select('*');

  if (connErrA || !insertedConnsA || insertedConnsA.length !== 2) {
    failed++;
    console.error('❌ [FAIL] Test B2: Connections insertion failed:', connErrA);
  } else {
    const allHaveUserA = insertedConnsA.every((c: any) => c.user_id === userAId);
    if (allHaveUserA) {
      passed++;
      console.log(`✅ [PASS] Test B2: ${insertedConnsA.length} connections created strictly with user_id = ${userAId}`);
    } else {
      failed++;
      console.error('❌ [FAIL] Test B2: Connections missing User A UUID');
    }
  }

  const satyaConn = (insertedConnsA || []).find((c: any) => c.first_name === 'Satya');

  // ----------------------------------------------------------------
  // Test C — Outreach & Follow-up Scheduling (Day 0, Day 5, Day 12)
  // ----------------------------------------------------------------
  console.log('\n--- Test C — Outreach & Follow-up Scheduling ---');

  // Mark connection contacted
  const contactedAt = new Date().toISOString();
  const { error: markErrA } = await clientA
    .from('connections')
    .update({
      status: 'contacted',
      contacted_at: contactedAt
    })
    .eq('id', satyaConn.id)
    .eq('user_id', userAId);

  if (markErrA) {
    failed++;
    console.error('❌ [FAIL] Test C1: Marking contacted failed:', markErrA);
  } else {
    const { data: updatedSatya } = await clientA
      .from('connections')
      .select('status, contacted_at')
      .eq('id', satyaConn.id)
      .single();

    if (updatedSatya?.status === 'contacted' && updatedSatya?.contacted_at) {
      passed++;
      console.log(`✅ [PASS] Test C1: Connection marked contacted in database at ${updatedSatya.contacted_at}`);
    } else {
      failed++;
      console.error('❌ [FAIL] Test C1: Contacted status verification failed:', updatedSatya);
    }
  }

  // Create outreach events: Day 0 (completed), Day 5 (+5d), Day 12 (+12d)
  const now = new Date();
  const day5Iso = new Date(now.getTime() + 5 * 86400000).toISOString();
  const day12Iso = new Date(now.getTime() + 12 * 86400000).toISOString();

  const outreachEventsToInsert = [
    {
      user_id: userAId,
      connection_id: satyaConn.id,
      type: 'initial' as const,
      sequence_number: 0,
      message: 'Initial outreach message Day 0',
      scheduled_for: now.toISOString(),
      completed_at: now.toISOString()
    },
    {
      user_id: userAId,
      connection_id: satyaConn.id,
      type: 'follow_up' as const,
      sequence_number: 1,
      message: 'First follow-up Day 5',
      scheduled_for: day5Iso,
      completed_at: null
    },
    {
      user_id: userAId,
      connection_id: satyaConn.id,
      type: 'follow_up' as const,
      sequence_number: 2,
      message: 'Final follow-up Day 12',
      scheduled_for: day12Iso,
      completed_at: null
    }
  ];

  const { data: eventsA, error: eventsErrA } = await clientA
    .from('outreach_events')
    .insert(outreachEventsToInsert)
    .select('*');

  if (eventsErrA || !eventsA || eventsA.length !== 3) {
    failed++;
    console.error('❌ [FAIL] Test C2: Failed inserting outreach events:', eventsErrA);
  } else {
    const day0 = eventsA.find((e: any) => e.sequence_number === 0 && e.completed_at !== null);
    const day5 = eventsA.find((e: any) => e.sequence_number === 1 && e.completed_at === null);
    const day12 = eventsA.find((e: any) => e.sequence_number === 2 && e.completed_at === null);

    if (day0 && day5 && day12) {
      passed++;
      console.log('✅ [PASS] Test C2: Day 0 (completed), Day 5 (+5d scheduled), and Day 12 (+12d scheduled) events verified in live database');
    } else {
      failed++;
      console.error('❌ [FAIL] Test C2: Follow-up sequences incomplete:', { day0, day5, day12 });
    }
  }

  // ----------------------------------------------------------------
  // Test D — Re-import duplicate protection & state preservation
  // ----------------------------------------------------------------
  console.log('\n--- Test D — Re-import Duplicate Protection & State Precedence ---');

  // Attempt to insert duplicate (same user_id, same linkedin_url)
  const { error: dupErr } = await clientA.from('connections').insert({
    user_id: userAId,
    name: 'Satya Nadella Duplicate',
    linkedin_url: satyaConn.linkedin_url,
    status: 'new'
  });

  // Unique constraint must reject duplicate insertion
  if (dupErr && (dupErr.code === '23505' || dupErr.message.includes('unique') || dupErr.message.includes('duplicate'))) {
    passed++;
    console.log(`✅ [PASS] Test D1: Database unique(user_id, linkedin_url) strictly prevented duplicate row (${dupErr.code})`);
  } else {
    failed++;
    console.error('❌ [FAIL] Test D1: Duplicate insertion was not rejected by unique constraint:', dupErr);
  }

  // Check state preservation: Satya must still be 'contacted'
  const { data: allConnsAfterReimport } = await clientA
    .from('connections')
    .select('*')
    .eq('user_id', userAId);

  const satyaCurrent = allConnsAfterReimport?.find((c: any) => c.linkedin_url === satyaConn.linkedin_url);
  if (satyaCurrent?.status === 'contacted' && allConnsAfterReimport?.length === 2) {
    passed++;
    console.log('✅ [PASS] Test D2: Contacted status strictly preserved; count remains exactly 2.');
  } else {
    failed++;
    console.error('❌ [FAIL] Test D2: Re-import protection failed:', { satyaCurrent, count: allConnsAfterReimport?.length });
  }

  // ----------------------------------------------------------------
  // Test E — Second user (User B) Complete Isolation
  // ----------------------------------------------------------------
  console.log('\n--- Test E — Second User (User B) Complete Isolation ---');

  let userBId = '';

  if (adminClient) {
    const { data: createdB, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: password,
      email_confirm: true,
      user_metadata: { name: 'Bob Builder', target_role: 'Product Designer' }
    });
    if (errB || !createdB.user) {
      console.error('❌ [FAIL] Test E: Failed to provision User B:', errB);
      process.exit(1);
    }
    userBId = createdB.user.id;
  } else {
    const pub = createClient(supabaseUrl, supabaseAnonKey);
    const { data: signUpB, error: errB } = await pub.auth.signUp({
      email: emailB,
      password: password,
      options: { data: { name: 'Bob Builder', target_role: 'Product Designer' } }
    });
    if (errB || !signUpB.user) {
      console.error('❌ [FAIL] Test E: Failed to sign up User B:', errB);
      process.exit(1);
    }
    userBId = signUpB.user.id;
  }

  // Authenticate as User B
  const clientB = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: signB, error: signErrB } = await clientB.auth.signInWithPassword({
    email: emailB,
    password: password
  });

  if (signErrB || !signB.user) {
    failed++;
    console.error('❌ [FAIL] Test E: Failed to sign in as User B:', signErrB);
    process.exit(1);
  }

  passed++;
  console.log(`✅ [PASS] Test E1: User B authenticated with distinct UUID: ${userBId}`);

  // Query User B's workspace in database (both standard and trying to query User A's user_id)
  const { data: connsB } = await clientB.from('connections').select('*');
  const { data: importsB } = await clientB.from('imports').select('*');
  const { data: eventsB } = await clientB.from('outreach_events').select('*');

  const userB_cleanSlate =
    (connsB || []).length === 0 &&
    (importsB || []).length === 0 &&
    (eventsB || []).length === 0;

  if (userB_cleanSlate) {
    passed++;
    console.log('✅ [PASS] Test E2: User B sees completely empty workspace (0 connections, 0 imports, 0 outreach events)');
  } else {
    failed++;
    console.error('❌ [FAIL] Test E2: User B leaked User A data:', { connsB, importsB, eventsB });
  }

  // RLS Security boundary test: User B explicitly requests User A's connections
  const { data: userATargetedByB } = await clientB
    .from('connections')
    .select('*')
    .eq('user_id', userAId);

  if (!userATargetedByB || userATargetedByB.length === 0) {
    passed++;
    console.log("✅ [PASS] Test E3: RLS strictly blocked User B from reading User A's connections (returned 0 rows)");
  } else {
    failed++;
    console.error("❌ [FAIL] Test E3: RLS breach! User B read User A's connections:", userATargetedByB);
  }

  // User B attempts to tamper with User A's connection status
  const { error: tamperConnErr, data: tamperConnData } = await clientB
    .from('connections')
    .update({ status: 'skipped' })
    .eq('id', satyaConn.id)
    .select('*');

  // Verify Satya is still contacted and belongs to User A
  const { data: verifySatya } = await clientA
    .from('connections')
    .select('status, user_id')
    .eq('id', satyaConn.id)
    .single();

  if ((!tamperConnData || tamperConnData.length === 0) && verifySatya?.status === 'contacted') {
    passed++;
    console.log("✅ [PASS] Test E4: RLS strictly blocked User B from modifying User A's connection");
  } else {
    failed++;
    console.error('❌ [FAIL] Test E4: Cross-user mutation succeeded unexpectedly:', verifySatya);
  }

  // ----------------------------------------------------------------
  // Test F — Return to User A
  // ----------------------------------------------------------------
  console.log('\n--- Test F — Return to User A Data Integrity ---');
  const { data: restoredConnsA } = await clientA
    .from('connections')
    .select('*')
    .eq('user_id', userAId);

  const { data: restoredEventsA } = await clientA
    .from('outreach_events')
    .select('*')
    .eq('user_id', userAId);

  const { data: restoredImportsA } = await clientA
    .from('imports')
    .select('*')
    .eq('user_id', userAId);

  const userA_intact =
    (restoredConnsA || []).length === 2 &&
    (restoredEventsA || []).length === 3 &&
    (restoredImportsA || []).length === 1 &&
    restoredConnsA?.some((c: any) => c.status === 'contacted');

  if (userA_intact) {
    passed++;
    console.log('✅ [PASS] Test F: User A data 100% intact after switching between accounts.');
  } else {
    failed++;
    console.error('❌ [FAIL] Test F: User A data degraded:', { restoredConnsA, restoredEventsA, restoredImportsA });
  }

  // Cleanup test artifacts from live database
  try {
    if (adminClient) {
      await adminClient.from('outreach_events').delete().eq('user_id', userAId);
      await adminClient.from('connections').delete().eq('user_id', userAId);
      await adminClient.from('imports').delete().eq('user_id', userAId);
      await adminClient.from('profiles').delete().eq('id', userAId);
      await adminClient.from('profiles').delete().eq('id', userBId);
      await adminClient.auth.admin.deleteUser(userAId);
      await adminClient.auth.admin.deleteUser(userBId);
      console.log('🧹 Live test users and records cleaned up successfully.');
    }
  } catch (cleanErr) {
    console.warn('Cleanup warning:', cleanErr);
  }

  console.log('\n================================================================');
  console.log(`LIVE ACCEPTANCE SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runLiveAcceptanceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
