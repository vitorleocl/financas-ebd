import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});

async function run() {
  try {
    const docRef = doc(db, 'ebd_states', 'shared_church_ebd');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('--- FIRESTORE DOCUMENT EXISTS ---');
      console.log('Keys:', Object.keys(data));
      console.log('Number of transactions:', data.transactions?.length || 0);
      console.log('Number of boxes:', data.boxes?.length || 0);
      console.log('Number of users:', data.users?.length || 0);
      if (data.users) {
        console.log('Users in Firestore:', data.users.map((u: any) => ({ id: u.id, name: u.name, username: u.username, role: u.role })));
      }
      if (data.transactions) {
        console.log('Transactions sample (up to 3):', data.transactions.slice(0, 3));
      }
      console.log('Boxes sample:', data.boxes);
    } else {
      console.log('--- NO DOCUMENT FOUND IN FIRESTORE ---');
    }
  } catch (err) {
    console.error('Error fetching Firestore document:', err);
  }
}

run();
