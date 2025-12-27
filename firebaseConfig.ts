import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDZSj58AW5xC34BpeElZ68ERuKy-DvUtn8',
  authDomain: 'analcoronata.firebaseapp.com',
  projectId: 'analcoronata',
  storageBucket: 'analcoronata.firebasestorage.app',
  messagingSenderId: '573851176994',
  appId: '1:573851176994:web:246f045cd9c4d489a93a7b',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
