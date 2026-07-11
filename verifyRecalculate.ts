import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { recalculateBalances, AppState } from './src/data/stateManager';

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});

async function run() {
  try {
    const docSnap = await getDoc(doc(db, 'ebd_states', 'shared_church_ebd'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const state: AppState = {
        currentUser: null,
        users: data.users || [],
        boxes: data.boxes || [],
        categories: data.categories || [],
        transactions: data.transactions || [],
        people: data.people || [],
        closings: data.closings || [],
        auditLogs: data.auditLogs || []
      };

      console.log(`Transactions found: ${state.transactions.length}`);
      const updatedBoxes = recalculateBalances(state);
      console.log('RECALCULATED BOXES:', updatedBoxes);
    } else {
      console.log('NO_DOC');
    }
  } catch (err: any) {
    console.error('ERR:', err.message);
  }
}

run();
