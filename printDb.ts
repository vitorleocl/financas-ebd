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
      console.log('--- ALL TRANSACTIONS ---');
      console.log(JSON.stringify(data.transactions, null, 2));
      console.log('--- ALL BOXES ---');
      console.log(JSON.stringify(data.boxes, null, 2));
    } else {
      console.log('NO DOC FOUND');
    }
  } catch (err: any) {
    console.error('ERR:', err.message);
  }
}

run();
