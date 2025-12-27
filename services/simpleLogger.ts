import { db, auth } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function submitFeedback(feedbackData: any) {
  try {
    const docData = {
      // Who submitted
      userId: auth.currentUser?.uid || null,

      // What they said
      message: (feedbackData.issueDescription || feedbackData.feedback || feedbackData.message || '').toString(),
      feedbackTypes: feedbackData.feedbackTypes || feedbackData.issueTypes || [],
      feedbackType: feedbackData.feedbackType || '',
      relatedEffects: feedbackData.relatedEffects || {},

      // When
      timestamp: serverTimestamp(),

      // Browser context (for debugging)
      userAgent: navigator.userAgent,

      // Which game
      game: 'suitecoronata',
    };

    await addDoc(collection(db, 'feedback'), docData);
    console.log('[Feedback] Submitted successfully');
  } catch (error) {
    console.error('[Feedback] Failed to submit:', error);
    throw error;
  }
}
