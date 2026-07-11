import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});

async function run() {
  try {
    const docSnap = await getDoc(doc(db, 'ebd_states', 'shared_church_ebd'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const txs = data.transactions || [];
      console.log(`TOTAL_TXS: ${txs.length}`);
      if (txs.length > 0) {
        txs.slice(0, 5).forEach((t: any) => {
          console.log(`- TX: ${t.id} | ${t.transactionNum} | ${t.boxId} | R$ ${t.amount} | Approved: ${t.isApproved} | Type: ${t.type}`);
        });
      }
      console.log('BOXES:', data.boxes);
    } else {
      console.log('NO_DOC');
    }
  } catch (err: any) {
    console.error('ERR:', err.message);
  }
}

run();
