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
      const users = data.users || [];
      console.log(`TOTAL_USERS: ${users.length}`);
      users.forEach((u: any) => {
        console.log(`- ${u.name} | ${u.username} | ${u.role} | ${u.id}`);
      });
      console.log(`DELETED_EMAILS:`, data.deletedEmails || []);
    } else {
      console.log('NO_DOC');
    }
  } catch (err: any) {
    console.error('ERR:', err.message);
  }
}

run();
