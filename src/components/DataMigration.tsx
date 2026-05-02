import React, { useState } from 'react';
import * as firestore from 'firebase/firestore';
import { Session } from '../types';
import app, { db as newDb } from '../lib/firebase';
import { Database, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface MigrationProps {
  session: Session;
}

const COLLECTIONS = [
  'employees',
  'credentials',
  'leaveBalances',
  'settings',
  'branches',
  'holidays',
  'attendance',
  'leaves',
  'targets',
  'advances',
  'cashRequests',
  'auditLogs',
  'payrollReceipts',
  'paidDeductions',
  'messages',
  'adhocBonuses',
  'dcCollections',
  'systemReports',
  'directory',
  'users'
];

export default function DataMigration({ session }: MigrationProps) {
  const [oldDbId, setOldDbId] = useState('ai-studio-d860bbea-8362-4d57-9819-4287a3f5a25f');
  const [status, setStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const handleMigration = async () => {
    if (!oldDbId) {
      alert("Please enter the old database ID.");
      return;
    }

    try {
      setStatus('migrating');
      setLogs([]);
      addLog(`Initializing connection to old database: ${oldDbId}...`);

      const oldDb = firestore.getFirestore(app, oldDbId);
      addLog("Successfully targeted old database.");

      for (const collectionName of COLLECTIONS) {
        addLog(`Migrating collection: ${collectionName}...`);
        
        try {
          const q = firestore.query(firestore.collection(oldDb, collectionName));
          const snapshot = await firestore.getDocs(q);
          
          if (snapshot.empty) {
            addLog(`-- ${collectionName} was empty.`);
            continue;
          }

          let migratedCount = 0;
          let batch = firestore.writeBatch(newDb);
          let count = 0;
          
          for (const document of snapshot.docs) {
            const docRef = firestore.doc(newDb, collectionName, document.id);
            batch.set(docRef, document.data());
            count++;
            migratedCount++;
            
            if (count === 500) {
              await batch.commit();
              batch = firestore.writeBatch(newDb);
              count = 0;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
          
          addLog(`-- Successfully migrated ${migratedCount} documents from ${collectionName}.`);
        } catch (colErr: any) {
          addLog(`-- Error reading ${collectionName}: ${colErr.message}`);
        }
      }

      addLog("Data Migration Complete!");
      setStatus('success');

    } catch (err: any) {
      addLog(`ERROR: ${err.message}`);
      setStatus('error');
    }
  };

  if (!session.isAdmin) {
    return <div className="p-10 text-red-500">Unauthorized</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-10 space-y-8 animate-fade-in pb-32">
      <div className="flex items-center gap-4 border-b border-border-accent pb-6">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl shadow-sm">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Database Migration Tool</h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">
            Copy data from your old database to the new Blaze-plan database in the same Firebase project.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel p-8 space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-primary mb-2">1. Old Database Name</h3>
            <p className="text-xs text-text-secondary mb-4">
              Enter the name of your old database. If you didn't name it differently, it's typically <span className="font-mono text-[10px] bg-bg-secondary px-1 py-0.5">(default)</span>.
            </p>
            <input
              type="text"
              className="input-field"
              placeholder="(default)"
              value={oldDbId}
              onChange={e => setOldDbId(e.target.value)}
            />
          </div>

          <button
            onClick={handleMigration}
            disabled={status === 'migrating'}
            className="btn btn-primary w-full py-4 mt-4 text-sm gap-2"
          >
            {status === 'migrating' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Moving Data...</>
            ) : (
              <><Database className="w-4 h-4" /> Start Migration</>
            )}
          </button>
        </div>

        <div className="glass-panel p-8 bg-black">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2">
            Migration Logs
            {status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
          </h3>
          <div className="h-96 overflow-y-auto space-y-2 font-mono text-[11px] text-green-400">
            {logs.length === 0 ? (
              <span className="text-gray-500">Ready to start... Data will be copied from `{oldDbId}` to the new DB.</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={log.startsWith('ERROR') ? 'text-red-400' : ''}>{log}</div>
              ))
            )}
            {status === 'migrating' && (
              <div className="animate-pulse">_</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
